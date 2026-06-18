import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { AppStep, EBookState, GeneratedTopic, Chapter } from './types';
import * as geminiService from './services/geminiService';
import { generateAndDownloadDocx } from './utils/docxGenerator';
import { generateCoverPdf, generateEbookPdf } from './utils/pdfGenerator';
import { overlayTextOnCover, COVER_THEMES } from './utils/coverGenerator';
import { splitIntoParagraphs } from './utils/textFormat';
import { 
  ArrowRight, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  RefreshCw,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  PenTool,
  BookOpen,
  Download,
  FileDown,
  Paperclip,
  X,
  User,
  Key,
  Lightbulb,
  DollarSign,
  ClipboardList,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Copy
} from 'lucide-react';
import { ApiCostModal } from './components/ApiCostModal';
import { PatchNotesModal } from './components/PatchNotesModal';

interface AttachedFile {
  name: string;
  data: string; // Base64 string without prefix
  mimeType: string;
}

// 톤앤매너 프리셋 (클릭 시 ebook.toneAndManner 값으로 설정)
const TONE_PRESETS = [
  '친근하고 쉽게 설명하는',
  '전문적이고 신뢰감 있는',
  '강하게 동기부여하는',
  '스토리텔링으로 몰입감 있는',
  '위트있고 유머러스한',
];

// 제목 후킹 스타일 프리셋
const TITLE_HOOK_STYLES = [
  { key: '', label: 'AI 추천' },
  { key: 'number', label: '숫자형 (리스트)' },
  { key: 'question', label: '질문형' },
  { key: 'empathy', label: '공감형' },
  { key: 'confident', label: '단정·자신감형' },
];

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.TOPIC_SELECTION);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'cleared' | 'error'>('idle');
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [showApiCost, setShowApiCost] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [automationProgress, setAutomationProgress] = useState(0);
  const [isAutomating, setIsAutomating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const checkKey = async () => {
    const storedKey = localStorage.getItem('custom_gemini_api_key');
    if (storedKey) {
      setApiKeyInput(storedKey);
      setHasApiKey(true);
      return;
    }
    if ((window as any).aistudio) {
      const has = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(has);
    } else {
      setHasApiKey(false);
    }
  };

  useEffect(() => {
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
      if (globalError && (globalError.includes("API 호출량") || globalError.includes("API 키") || globalError.includes("Quota") || globalError.includes("EXHAUSTED"))) {
        setGlobalError(null);
      }
    }
  };

  const handleSaveApiKey = async () => {
    setApiKeyStatus('saving');
    await new Promise(r => setTimeout(r, 400));

    const cleanKey = apiKeyInput.replace(/[\r\n\s]+/g, '');

    if (cleanKey) {
      if (cleanKey.length < 20) {
        setApiKeyStatus('error');
        setGlobalError('올바른 Gemini API 키 형식이 아닙니다 (너무 짧습니다)');
        setTimeout(() => setApiKeyStatus('idle'), 2500);
        return;
      }
      localStorage.setItem('custom_gemini_api_key', cleanKey);
      setHasApiKey(true);
      setApiKeyStatus('saved');
      
      if (globalError && (globalError.includes("API 호출량") || globalError.includes("API 키") || globalError.includes("Quota") || globalError.includes("EXHAUSTED"))) {
        setGlobalError(null); // Auto close error modal if they fixed it
      }
      setTimeout(() => setApiKeyStatus('idle'), 2500);
    } else {
      localStorage.removeItem('custom_gemini_api_key');
      await checkKey();
      setApiKeyStatus('cleared');
      setTimeout(() => setApiKeyStatus('idle'), 2500);
    }
  };
  
  // Inputs
  const [topicKeyword, setTopicKeyword] = useState('');
  const [topicIdeas, setTopicIdeas] = useState<GeneratedTopic[]>([]);
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [selectedTitleIdx, setSelectedTitleIdx] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  // 사용자가 첫 화면에서 제목을 직접 정했는지 여부 (true면 자동 생성이 덮어쓰지 않음)
  const [isTitleUserDefined, setIsTitleUserDefined] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);

  // E-Book State
  const [ebook, setEbook] = useState<EBookState>({
    topic: '',
    targetAudience: '일반 대중',
    title: '',
    author: '',
    authorExpertise: '',
    bookStyle: '',
    pageCount: 'AI추천',
    coreMessage: '',
    toneAndManner: '',
    outcomePromise: '',
    readerPainPoint: '',
    coverTheme: 'auto',
    titleHookStyle: '',
    outline: [],
    chapters: [],
    generateIllustrations: false,
  });

  // Auto-save logic
  useEffect(() => {
    const savedState = localStorage.getItem('ebookState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.ebook) setEbook(parsedState.ebook);
        if (parsedState.currentStep !== undefined) setCurrentStep(parsedState.currentStep);
        if (parsedState.topicKeyword) setTopicKeyword(parsedState.topicKeyword);
        if (parsedState.topicIdeas) setTopicIdeas(parsedState.topicIdeas);
        if (parsedState.titleIdeas) setTitleIdeas(parsedState.titleIdeas);
        if (parsedState.selectedTitleIdx !== undefined) setSelectedTitleIdx(parsedState.selectedTitleIdx);
        if (parsedState.attachedFiles) setAttachedFiles(parsedState.attachedFiles);
        if (parsedState.isTitleUserDefined !== undefined) setIsTitleUserDefined(parsedState.isTitleUserDefined);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    const stateToSave = {
      ebook,
      currentStep,
      topicKeyword,
      topicIdeas,
      titleIdeas,
      selectedTitleIdx,
      attachedFiles,
      isTitleUserDefined
    };
    try {
        localStorage.setItem('ebookState', JSON.stringify(stateToSave));
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn("localStorage quota exceeded, clearing attachments or images to save data.");
            // To save within quota, we can try to omit large data like attachments or images
            stateToSave.attachedFiles = [];
            // We could also remove generated images from the chapters, but for now we'll just omit attachments here as a fallback
            try {
                localStorage.setItem('ebookState', JSON.stringify(stateToSave));
            } catch (innerError) {
                console.error("Failed to save even after clearing attachments:", innerError);
            }
        } else {
            console.error("Failed to save state:", error);
        }
    }
  }, [ebook, currentStep, topicKeyword, topicIdeas, titleIdeas, selectedTitleIdx, attachedFiles, isTitleUserDefined]);

  // --- Helpers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Explicitly cast to File[] to avoid 'unknown' type inference issues
      const filesToProcess: File[] = Array.from(e.target.files);
      
      const newAttachments: AttachedFile[] = [];

      for (const file of filesToProcess) {
        const reader = new FileReader();
        try {
          const result = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
          const parts = result.split(',');
          const base64Data = parts[1];
          const header = parts[0];

          // Robust MIME type detection
          let mimeType = file.type;
          
          // 1. Try extracting from Data URL header if file.type is empty
          if (!mimeType) {
            const match = header.match(/data:(.*?);base64/);
            if (match && match[1]) {
               mimeType = match[1];
            }
          }

          // 2. Fallback to text/plain if still empty (common for .ts, .md, or extensionless files)
          // Gemini API throws 400 if mimeType is empty string
          if (!mimeType) {
             mimeType = 'text/plain';
          }

          newAttachments.push({
            name: file.name,
            mimeType: mimeType,
            data: base64Data
          });
        } catch (error) {
          console.error("Error reading file:", error);
        }
      }

      setAttachedFiles(prev => [...prev, ...newAttachments]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Error Handling Helper ---
  const getFriendlyErrorMessage = (e: any, defaultMsg: string) => {
    console.error("Operation Error:", e);
    let errorStr = "";
    try {
      errorStr = JSON.stringify(e, Object.getOwnPropertyNames(e)).toUpperCase();
    } catch {
      errorStr = String(e).toUpperCase();
    }
    
    let msg = "";
    if (e && typeof e === 'object') {
      const parts = [
        e.message,
        e.status,
        e.code,
        e.error?.message,
        e.error?.status,
        e.error?.code,
        e.statusText
      ];
      msg = parts.filter(Boolean).map(x => String(x).toUpperCase()).join(" | ");
    } else {
      msg = String(e).toUpperCase();
    }

    const isQuotaError = errorStr.includes('QUOTA') || 
                         msg.includes('QUOTA') || 
                         errorStr.includes('EXCEEDED YOUR CURRENT QUOTA') || 
                         msg.includes('EXCEEDED YOUR CURRENT QUOTA') ||
                         errorStr.includes('BILLING') ||
                         msg.includes('BILLING');

    const isRateLimit = errorStr.includes('429') || 
                        errorStr.includes('RESOURCE_EXHAUSTED') || 
                        msg.includes('429') || 
                        msg.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError || isRateLimit) {
      return 'API 호출량(Quota) 한도가 초과되었거나 결제 등록이 필요합니다. 계속 생성하려면 우측 상단 [설정 API Key] 메뉴에서 본인의 개별 Gemini API Key를 입력해주시기 바랍니다. (개별 API 키는 매달 무료 제공 호출 한도가 있어 훨씬 매끄러운 진행이 가능합니다.)';
    }
    if (errorStr.includes('SAFETY') || msg.includes('SAFETY')) {
      return '입력 내용이 AI 안전 정책에 의해 차단되었습니다. 키워드나 내용을 변경해주세요.';
    }
    if (errorStr.includes('API_KEY_INVALID') || msg.includes('API_KEY_INVALID') || errorStr.includes('401') || msg.includes('401') || errorStr.includes('PERMISSION_DENIED') || msg.includes('PERMISSION_DENIED') || errorStr.includes('403') || msg.includes('403')) {
      return '유효하지 않은 API 키이거나 권한이 없습니다. 우측 상단 설정을 확인하여 올바른 API 키를 입력해주세요.';
    }
    if (errorStr.includes('NOT_FOUND') || msg.includes('NOT_FOUND') || errorStr.includes('404') || msg.includes('404')) {
      return '해당 AI 모델을 사용할 수 없습니다. API 키의 권한을 확인하거나 관리자에게 문의하세요.';
    }
    if (errorStr.includes('503') || msg.includes('503') || errorStr.includes('OVERLOADED') || msg.includes('OVERLOADED') || errorStr.includes('UNAVAILABLE') || msg.includes('UNAVAILABLE')) {
      return '현재 AI 서버에 트래픽이 몰려 서비스가 지연되고 있습니다. (모델 과부하) 잠시 후 다시 시도해주세요.';
    }
    if (errorStr.includes('TIMEOUT') || msg.includes('TIMEOUT')) {
      return '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    if (errorStr.includes('JSON') || msg.includes('JSON')) {
      return 'AI 텍스트 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    if (errorStr.includes('FAILED TO FETCH') || msg.includes('FAILED TO FETCH') || errorStr.includes('NETWORK') || msg.includes('NETWORK')) {
      return '네트워크 연결 오류입니다. 인터넷 환경을 확인해주세요.';
    }
    if (errorStr.includes('UNSUPPORTED MIME TYPE') || msg.includes('UNSUPPORTED MIME TYPE') || errorStr.includes('INVALID_ARGUMENT') || msg.includes('INVALID_ARGUMENT') || errorStr.includes('400') || msg.includes('400')) {
      return '잘못된 요청이거나 지원하지 않는 파일 형식입니다. (DOC/DOCX 등은 지원하지 않습니다. 다른 파일을 첨부해주세요.)';
    }
    
    const conciseMsg = (msg && msg !== "[OBJECT OBJECT]") ? msg.substring(0, 70) + "..." : errorStr.substring(0, 70) + "...";
    return `${defaultMsg} (상세: ${conciseMsg})`;
  };

  // --- Step Handlers ---

  // Step 1: Generate Ideas
  const handleGenerateIdeas = async () => {
    if (!topicKeyword && attachedFiles.length === 0) return;
    setLoading(true);
    setLoadingMessage('Gemini 3 Pro가 입력된 키워드와 자료를 분석하여 브레인스토밍 중입니다...');
    setSelectedTopicIdx(null);
    try {
      const topics = await geminiService.generateTopics(topicKeyword, attachedFiles, ebook.authorExpertise, ebook.bookStyle, ebook.readerPainPoint, ebook.outcomePromise);
      setTopicIdeas(topics);
    } catch (e: any) {
      console.error("DEBUG Error in generateTopics:", e);
      setGlobalError(getFriendlyErrorMessage(e, '주제 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setLoading(false);
    }
  };

  // --- FULL AUTOMATION WORKFLOW ---
  const runFullAutomation = async (selectedTopic?: GeneratedTopic) => {
    // Check for API Key
    if (!hasApiKey) {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
        setGlobalError("API 키가 필요합니다. 상단 우측 설정을 확인해주세요.");
        return;
      }
    }

    setIsAutomating(true);
    setAutomationProgress(0);
    setSelectedTopicIdx(null);
    setLoading(true);

    try {
        let localEbookState: EBookState = { ...ebook };

        // --- PHASE 0: TOPIC GENERATION (If starting from scratch) ---
        if (currentStep === AppStep.TOPIC_SELECTION && !selectedTopic && !ebook.title) {
            if (!topicKeyword && attachedFiles.length === 0) {
                setGlobalError("키워드를 입력하거나 파일을 첨부해주세요.");
                setLoading(false);
                setIsAutomating(false);
                return;
            }
            setLoadingMessage('Gemini가 최적의 주제를 브레인스토밍 중입니다...');
            setAutomationProgress(5);
            const topics = await geminiService.generateTopics(topicKeyword, attachedFiles, ebook.authorExpertise, ebook.bookStyle, ebook.readerPainPoint, ebook.outcomePromise);
            if (topics.length === 0) throw new Error("주제 생성 실패");
            
            setTopicIdeas(topics);
            const bestTopic = topics[0];
            setSelectedTopicIdx(0);
            
            localEbookState = {
                ...localEbookState,
                title: bestTopic.title,
                topic: bestTopic.description,
                outline: [],
                chapters: []
            };
            setEbook(localEbookState);
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (selectedTopic) {
            localEbookState = {
                ...localEbookState,
                title: selectedTopic.title,
                topic: selectedTopic.description,
                outline: [],
                chapters: []
            };
            setEbook(localEbookState);
        } else if (isTitleUserDefined && localEbookState.title && !localEbookState.topic) {
            // 사용자가 제목을 직접 정한 경우: 주제 설명(topic)을 보완해 이후 단계가 동작하도록 함
            localEbookState = {
                ...localEbookState,
                topic: [localEbookState.outcomePromise, localEbookState.readerPainPoint, topicKeyword].filter(Boolean).join(' / ') || localEbookState.title,
            };
            setEbook(localEbookState);
        }


        // --- PHASE 0.5: TITLE GENERATION (사용자가 제목을 직접 정했으면 건너뜀) ---
        if (currentStep <= AppStep.TITLE_GENERATION && !isTitleUserDefined) {
            setCurrentStep(AppStep.TITLE_GENERATION);
            setLoadingMessage('AI가 후킹성 있는 매력적인 제목을 생성하고 있습니다...');
            setAutomationProgress(8);

            const titles = await geminiService.generateTitles(localEbookState.title, localEbookState.topic, localEbookState.authorExpertise, localEbookState.bookStyle, localEbookState.titleHookStyle, localEbookState.outcomePromise, localEbookState.readerPainPoint);
            if (titles && titles.length > 0) {
               setTitleIdeas(titles);
               localEbookState = { ...localEbookState, title: titles[0] }; // pick the first one
               setSelectedTitleIdx(0);
               setEbook(localEbookState);
            }
            setAutomationProgress(9);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 1: AUDIENCE SETTING ---
        if (currentStep <= AppStep.TOPIC_SELECTION) {
            setCurrentStep(AppStep.AUDIENCE_SETTING);
            setLoadingMessage('AI가 주제에 최적화된 독자층을 분석하고 있습니다...');
            setAutomationProgress(10);
            
            const suggestedAudience = await geminiService.suggestTargetAudience(localEbookState.title, localEbookState.topic);
            localEbookState = { ...localEbookState, targetAudience: suggestedAudience };
            setEbook(localEbookState);
            setAutomationProgress(15);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 2: PLANNING ---
        if (currentStep <= AppStep.AUDIENCE_SETTING) {
            setCurrentStep(AppStep.PLANNING);
            setLoadingMessage('Gemini가 체계적인 목차를 기획하고 있습니다...');
            setAutomationProgress(20);
            
            const outline = await geminiService.generateOutline(localEbookState.title, localEbookState.targetAudience, localEbookState.pageCount, localEbookState.coreMessage, localEbookState.toneAndManner, localEbookState.referenceContent, localEbookState.outcomePromise, localEbookState.readerPainPoint);
            localEbookState = {
                ...localEbookState,
                outline,
                chapters: outline.map((title, idx) => ({ id: idx, title, content: '' }))
            };
            setEbook(localEbookState);
            setAutomationProgress(30);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 3: WRITING ---
        if (currentStep <= AppStep.PLANNING) {
            setCurrentStep(AppStep.WRITING);
            setLoadingMessage('본문 집필을 시작합니다...');
            setAutomationProgress(35);
            
            const writtenChapters = [...localEbookState.chapters];
            for (let i = 0; i < writtenChapters.length; i++) {
                const stepProgress = 35 + ((i / writtenChapters.length) * 40);
                setAutomationProgress(Math.round(stepProgress));
                setLoadingMessage(`'${writtenChapters[i].title}' 챕터 작성 중... (${i + 1}/${writtenChapters.length})`);
                
                const content = await geminiService.generateChapterContent(
                    localEbookState.title,
                    writtenChapters[i].title,
                    localEbookState.outline,
                    localEbookState.author,
                    localEbookState.coreMessage,
                    localEbookState.toneAndManner,
                    localEbookState.referenceContent,
                    localEbookState.outcomePromise,
                    localEbookState.readerPainPoint
                );
                writtenChapters[i].content = content;
                localEbookState = { ...localEbookState, chapters: [...writtenChapters] };
                setEbook(prev => ({ ...prev, chapters: [...writtenChapters] }));
                setWritingProgress(((i + 1) / writtenChapters.length) * 100);
            }
            setAutomationProgress(75);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 4: COVER DESIGN ---
        if (currentStep <= AppStep.WRITING) {
            setCurrentStep(AppStep.COVER_DESIGN);
            setLoadingMessage('표지 디자인 프롬프트 생성 중...');
            setAutomationProgress(80);
            
            const authorToUse = localEbookState.author || "혁신 AI 저자";
            const coverPrompt = await geminiService.generateImagePrompt(`Title: ${localEbookState.title}, Topic: ${localEbookState.topic}, Author: ${authorToUse}`, 'cover');
            if (!coverPrompt) throw new Error("표지 프롬프트 생성 실패");
            
            setLoadingMessage('표지 이미지를 렌더링 중입니다...');
            setAutomationProgress(85);
            let coverImage = await geminiService.generateImage(coverPrompt, '3:4');
            
            setLoadingMessage('표지에 한국어 타이틀과 저자 정보를 선명하게 디자인 중입니다...');
            try {
                const composited = await overlayTextOnCover(coverImage, localEbookState.title, authorToUse, {
                    subtitle: localEbookState.coreMessage || localEbookState.readerPainPoint,
                    description: localEbookState.outcomePromise || localEbookState.topic,
                    themeKey: localEbookState.coverTheme,
                });
                coverImage = composited;
            } catch (overlayErr) {
                console.error("Failed to apply text overlay onto cover background:", overlayErr);
            }
            
            localEbookState = { ...localEbookState, coverPrompt, coverImage };
            setEbook(localEbookState);
            setAutomationProgress(90);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 5: ILLUSTRATIONS ---
        if (currentStep <= AppStep.COVER_DESIGN && localEbookState.generateIllustrations) {
            setCurrentStep(AppStep.ILLUSTRATION);
            setLoadingMessage('각 챕터별 삽화 생성 준비 중...');
            
            const chaptersWithImages = [...localEbookState.chapters];
            for (let i = 0; i < chaptersWithImages.length; i++) {
                const stepProgress = 90 + ((i / chaptersWithImages.length) * 8);
                setAutomationProgress(Math.round(stepProgress));
                setLoadingMessage(`챕터 ${i+1} 삽화 그리는 중... (${i+1}/${chaptersWithImages.length})`);
                
                const illPrompt = await geminiService.generateImagePrompt(
                    `Chapter Title: ${chaptersWithImages[i].title}. Content summary: ${chaptersWithImages[i].content.slice(0, 200)}...`, 
                    'illustration'
                );
                
                if (illPrompt) {
                    const imgData = await geminiService.generateImage(illPrompt, '4:3');
                    chaptersWithImages[i].imagePrompt = illPrompt;
                    chaptersWithImages[i].imageData = imgData;
                }
                
                localEbookState = { ...localEbookState, chapters: [...chaptersWithImages] };
                setEbook(prev => ({ ...prev, chapters: [...chaptersWithImages] }));
                setIllustrationProgress(((i + 1) / chaptersWithImages.length) * 100);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            setAutomationProgress(98);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // --- PHASE 6: FINISH ---
        setAutomationProgress(100);
        setCurrentStep(AppStep.REVIEW_DOWNLOAD);
        
        // --- AUTO DOWNLOAD ---
        setLoadingMessage('문서 파일 생성 중...');
        await generateAndDownloadDocx(localEbookState);

    } catch (error) {
        setGlobalError(getFriendlyErrorMessage(error, "자동 생성 과정 중 오류가 발생했습니다."));
    } finally {
        setLoading(false);
        setIsAutomating(false);
    }
  };

  const selectTopic = async (topic: GeneratedTopic, idx: number) => {
    setEbook(prev => ({
      ...prev,
      title: topic.title,
      topic: topic.description,
      outline: [],
      chapters: []
    }));
    setSelectedTopicIdx(idx);
    setIsTitleUserDefined(false); // AI 주제 선택 시에는 제목도 AI 흐름을 따름

    // Now transition to TITLE_GENERATION
    setTimeout(() => setCurrentStep(AppStep.TITLE_GENERATION), 500);
  };

  // --- Manual Handlers (Kept for manual retry capability) ---



  // 첫 화면에서 키워드/페인포인트/얻는 변화 등을 바탕으로 제목을 추천
  const handleRecommendTitles = async () => {
    const hasContext = topicKeyword || ebook.title || ebook.outcomePromise || ebook.readerPainPoint || attachedFiles.length > 0;
    if (!hasContext) {
      setGlobalError('제목을 추천받으려면 주제 키워드나 "독자가 얻는 변화" 등을 먼저 입력해주세요.');
      return;
    }
    setTitleLoading(true);
    setLoadingMessage('AI가 매력적인 제목을 추천하고 있습니다...');
    setSelectedTitleIdx(null);
    try {
      const baseTitle = ebook.title || topicKeyword;
      const baseDesc = [ebook.outcomePromise, ebook.readerPainPoint, ebook.referenceContent, topicKeyword]
        .filter(Boolean)
        .join(' / ') || topicKeyword;
      const titles = await geminiService.generateTitles(
        baseTitle,
        baseDesc,
        ebook.authorExpertise,
        ebook.bookStyle,
        ebook.titleHookStyle,
        ebook.outcomePromise,
        ebook.readerPainPoint
      );
      setTitleIdeas(titles);
    } catch (e) {
      setGlobalError(getFriendlyErrorMessage(e, '제목 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setTitleLoading(false);
    }
  };

  // 추천된 제목 중 하나를 첫 화면에서 선택
  const selectRecommendedTitle = (title: string, idx: number) => {
    setEbook(prev => ({ ...prev, title }));
    setSelectedTitleIdx(idx);
    setIsTitleUserDefined(true);
  };

  const handleGenerateTitles = async () => {
    if (!ebook.topic) return;
    setLoading(true);
    setLoadingMessage('Gemini 3 Pro가 트렌디하고 매력적인 제목을 브레인스토밍 중입니다...');
    setSelectedTitleIdx(null);
    try {
      const titles = await geminiService.generateTitles(ebook.title, ebook.topic, ebook.authorExpertise, ebook.bookStyle, ebook.titleHookStyle, ebook.outcomePromise, ebook.readerPainPoint);
      setTitleIdeas(titles);
    } catch (e: any) {
      console.error("Error generating titles:", e);
      setGlobalError('제목 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const selectTitle = (title: string, idx: number) => {
     setEbook(prev => ({ ...prev, title }));
     setSelectedTitleIdx(idx);
     
     // Auto suggest audience
     setLoading(true);
     setLoadingMessage('AI가 최적의 독자층을 분석하고 있습니다...');
     geminiService.suggestTargetAudience(title, ebook.topic).then(res => {
         setEbook(prev => ({ ...prev, targetAudience: res }));
         setLoading(false);
         // Move to audience setting
         setTimeout(() => setCurrentStep(AppStep.AUDIENCE_SETTING), 300);
     }).catch(e => {
         console.error(e);
         setLoading(false);
         setTimeout(() => setCurrentStep(AppStep.AUDIENCE_SETTING), 300);
     });
  };


  const handleGenerateOutline = async (titleOverride?: string, audienceOverride?: string) => {
    const titleToUse = titleOverride || ebook.title;
    const audienceToUse = audienceOverride || ebook.targetAudience;

    if (!titleToUse) {
        setGlobalError("제목이 설정되지 않았습니다.");
        return;
    }

    setLoading(true);
    setLoadingMessage('Gemini가 책의 구조를 논리적으로 기획하고 있습니다 (Thinking)...');
    try {
      const outline = await geminiService.generateOutline(titleToUse, audienceToUse, ebook.pageCount, ebook.coreMessage, ebook.toneAndManner, ebook.referenceContent, ebook.outcomePromise, ebook.readerPainPoint);
      setEbook(prev => ({ 
        ...prev, 
        outline,
        chapters: outline.map((title, idx) => ({ id: idx, title, content: '' }))
      }));
    } catch (e) {
      setGlobalError(getFriendlyErrorMessage(e, '목차 생성 오류가 발생했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const startWriting = () => {
    if (ebook.outline.length === 0) return;
    setCurrentStep(AppStep.WRITING);
    handleWriteAllChapters();
  };

  const [writingProgress, setWritingProgress] = useState(0);

  const handleWriteAllChapters = async () => {
    setLoading(true);
    setLoadingMessage('본문 집필을 시작합니다. 잠시만 기다려주세요...');
    
    const newChapters = [...ebook.chapters];
    
    try {
      for (let i = 0; i < newChapters.length; i++) {
        setLoadingMessage(`'${newChapters[i].title}' 챕터 작성 중... (${i + 1}/${newChapters.length})`);
        const content = await geminiService.generateChapterContent(ebook.title, newChapters[i].title, ebook.outline, ebook.author, ebook.coreMessage, ebook.toneAndManner, ebook.referenceContent, ebook.outcomePromise, ebook.readerPainPoint);
        newChapters[i].content = content;
        setEbook(prev => ({ ...prev, chapters: [...newChapters] }));
        setWritingProgress(((i + 1) / newChapters.length) * 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCover = async () => {
    setLoading(true);
    setLoadingMessage('표지 디자인 프롬프트 생성 및 렌더링 중...');
    try {
      const authorToUse = ebook.author || "혁신 AI 저자";
      const prompt = await geminiService.generateImagePrompt(`Title: ${ebook.title}, Topic: ${ebook.topic}, Author: ${authorToUse}`, 'cover');
      setEbook(prev => ({ ...prev, coverPrompt: prompt }));
      
      let base64Image = await geminiService.generateImage(prompt, '3:4');

      setLoadingMessage('표지에 한국어 타이틀과 저자 정보를 선명하게 디자인 중입니다...');
      try {
        const composited = await overlayTextOnCover(base64Image, ebook.title, authorToUse, {
          subtitle: ebook.coreMessage || ebook.readerPainPoint,
          description: ebook.outcomePromise || ebook.topic,
          themeKey: ebook.coverTheme,
        });
        base64Image = composited;
      } catch (overlayErr) {
        console.error("Failed to apply text overlay onto cover background:", overlayErr);
      }

      setEbook(prev => ({ ...prev, coverImage: base64Image }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [illustrationProgress, setIllustrationProgress] = useState(0);
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number | null>(null);
  const handleGenerateIllustrations = async () => {
    setLoading(true);
    setLoadingMessage('각 챕터에 맞는 삽화를 생성 중입니다...');
    
    const newChapters = [...ebook.chapters];
    try {
      for (let i = 0; i < newChapters.length; i++) {
        if (!newChapters[i].imageData) {
            setLoadingMessage(`챕터 ${i+1} 삽화 그리는 중...`);
            const prompt = await geminiService.generateImagePrompt(`Chapter Title: ${newChapters[i].title}. Content summary: ${newChapters[i].content.slice(0, 200)}...`, 'illustration');
            newChapters[i].imagePrompt = prompt;
            const imgData = await geminiService.generateImage(prompt, '4:3');
            newChapters[i].imageData = imgData;
            
            setEbook(prev => ({ ...prev, chapters: [...newChapters] }));
            setIllustrationProgress(((i + 1) / newChapters.length) * 100);
        }
      }
    } catch(e) {
        console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
        await generateAndDownloadDocx(ebook);
    } catch (e) {
        console.error(e);
        setGlobalError('파일 생성 중 오류가 발생했습니다.');
    }
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setLoadingMessage('PDF 파일을 생성하고 있습니다. 잠시만 기다려주세요...');
    try {
        await generateEbookPdf(ebook);
    } catch (e) {
        console.error(e);
        setGlobalError(getFriendlyErrorMessage(e, 'PDF 생성 중 오류가 발생했습니다.'));
    } finally {
        setPdfLoading(false);
    }
  };

  const handleDownloadCoverPdf = async () => {
    if (!ebook.coverImage) {
        setGlobalError('먼저 표지를 생성해주세요.');
        return;
    }
    setPdfLoading(true);
    try {
        await generateCoverPdf(ebook);
    } catch (e) {
        console.error(e);
        setGlobalError(getFriendlyErrorMessage(e, '표지 PDF 생성 중 오류가 발생했습니다.'));
    } finally {
        setPdfLoading(false);
    }
  };


  // --- Render Helpers ---


  const renderTopicSelection = () => (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* 16:9 Hero Banner at the top of Topic Selection */}
      <div className="w-full aspect-video relative rounded-3xl overflow-hidden shadow-2xl mb-12 flex items-center justify-center group">
        <img 
          src="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=2000&auto=format&fit=crop" 
          alt="Innovation E-book AI Hero" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-purple-600/30 to-slate-900/50 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-black/10"></div>
        
        <div className="relative z-10 text-center px-6 flex flex-col items-center">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-2xl mb-6 border border-white/20 shadow-2xl">
            <Sparkles className="w-12 h-12 text-indigo-300" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-2xl mb-6" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            혁신 전자책 AI
          </h1>
          <p className="text-xl md:text-2xl text-indigo-100 font-medium max-w-3xl mx-auto drop-shadow-lg leading-relaxed">
            혁신 전자책 AI의 강력한 추론 능력과 이미지 생성 기능을 결합하여<br className="hidden md:block" />
            단 몇 번의 클릭으로 전문가 수준의 전자책을 기획하고 출판하세요.
          </p>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">어떤 주제로 글을 쓰시겠습니까?</h2>
        <p className="text-slate-500">핵심 키워드를 입력하거나 참고 자료를 첨부하면 AI가 흥미로운 주제를 제안합니다.</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Author Name and Page Count Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">저자명</label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
               </div>
               <input 
                type="text" 
                value={ebook.author}
                onChange={(e) => setEbook(prev => ({...prev, author: e.target.value}))}
                placeholder="저자명을 입력하세요" 
                className="w-full pl-10 pr-6 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
              />
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">전자책 분량 선택</label>
            <select 
              value={ebook.pageCount}
              onChange={(e) => setEbook(prev => ({...prev, pageCount: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm bg-white"
            >
              <option value="AI추천">AI 추천 (자동 최적화)</option>
              <option value="10">10페이지 내외</option>
              <option value="20">20페이지 내외</option>
              <option value="30">30페이지 내외</option>
              <option value="50">50페이지 내외</option>
              <option value="100">100페이지 내외</option>
              <option value="150">150페이지 내외</option>
              <option value="200">200페이지 내외</option>
            </select>
          </div>
        </div>

        {/* E-Book Title (직접 입력 또는 추천) */}
        <div className="p-5 bg-white rounded-2xl border-2 border-indigo-200 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <PenTool size={16} className="text-indigo-600" />
              전자책 제목 (직접 정하거나, 추천받을 수 있어요)
            </label>
            <button
              type="button"
              onClick={handleRecommendTitles}
              disabled={titleLoading || loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {titleLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {titleLoading ? '추천 중...' : '제목 추천받기'}
            </button>
          </div>
          <input
            type="text"
            value={ebook.title}
            onChange={(e) => { setEbook(prev => ({...prev, title: e.target.value})); setIsTitleUserDefined(e.target.value.trim().length > 0); }}
            placeholder="원하는 제목을 직접 입력하세요 (비워두면 AI가 자동으로 정합니다)"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
          />

          {titleIdeas.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-500 ml-1">추천 제목 (클릭하면 적용됩니다)</p>
              <div className="flex flex-col gap-2">
                {titleIdeas.map((title, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectRecommendedTitle(title, idx)}
                    className={`text-left px-4 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      ebook.title === title
                        ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium text-slate-800">{title}</span>
                    {ebook.title === title && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expertise and Style Options (For High-Quality) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">저자의 전문성/배경 (선택)</label>
            <input 
              type="text" 
              value={ebook.authorExpertise}
              onChange={(e) => setEbook(prev => ({...prev, authorExpertise: e.target.value}))}
              placeholder="예: 10년차 현업 마케터, 요가 강사 등" 
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">원하는 형식/스타일 (선택)</label>
            <input 
              type="text" 
              value={ebook.bookStyle}
              onChange={(e) => setEbook(prev => ({...prev, bookStyle: e.target.value}))}
              placeholder="예: 노하우/실무서, 에세이, PDF 강의형 등" 
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
            />
          </div>
        </div>

        {/* Reader Pain Point & Outcome Promise (매력도 핵심) */}
        <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-4">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
            <Sparkles size={16} className="text-indigo-600" />
            매력도 핵심 설정 (입력할수록 후킹·몰입도가 올라갑니다)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">독자의 핵심 고민 (선택)</label>
              <input
                type="text"
                value={ebook.readerPainPoint || ''}
                onChange={(e) => setEbook(prev => ({...prev, readerPainPoint: e.target.value}))}
                placeholder="예: 보고서를 만들 때마다 디자인이 막막하다"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base shadow-sm"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">독자가 얻는 변화/약속 (선택)</label>
              <input
                type="text"
                value={ebook.outcomePromise || ''}
                onChange={(e) => setEbook(prev => ({...prev, outcomePromise: e.target.value}))}
                placeholder="예: 30분 만에 합격하는 보고서를 만들 수 있다"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base shadow-sm"
              />
            </div>
          </div>

          {/* Tone presets */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 ml-1">톤앤매너 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {TONE_PRESETS.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setEbook(prev => ({...prev, toneAndManner: prev.toneAndManner === tone ? '' : tone}))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    ebook.toneAndManner === tone
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Title hook style */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 ml-1">제목 후킹 스타일 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {TITLE_HOOK_STYLES.map((style) => (
                <button
                  key={style.key || 'auto'}
                  type="button"
                  onClick={() => setEbook(prev => ({...prev, titleHookStyle: style.key}))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    (ebook.titleHookStyle || '') === style.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cover theme */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 ml-1">표지 무드/컬러 (선택)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEbook(prev => ({...prev, coverTheme: 'auto'}))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  (ebook.coverTheme || 'auto') === 'auto'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                }`}
              >
                자동
              </button>
              {COVER_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setEbook(prev => ({...prev, coverTheme: theme.key}))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    ebook.coverTheme === theme.key
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                  }`}
                  style={ebook.coverTheme === theme.key ? { backgroundColor: theme.swatch } : undefined}
                >
                  <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: theme.swatch }} />
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reference Content Field */}
        <div className="relative mt-2">
          <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">참고 내용 작성 (선택 - 입력시 전자책 결과물에 필수 반영됨)</label>
          <textarea 
            value={ebook.referenceContent || ''}
            onChange={(e) => setEbook(prev => ({...prev, referenceContent: e.target.value}))}
            placeholder="전자책 내용에 꼭 포함되어야 할 구체적인 참고 내용, 사례, 혹은 필수 메시지를 자유롭게 작성해주세요." 
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[100px] text-base shadow-sm resize-y"
          />
        </div>

        {/* Keyword Input */}
        <div className="flex gap-4">
          <input 
            type="text" 
            value={topicKeyword}
            onChange={(e) => setTopicKeyword(e.target.value)}
            placeholder="주제 키워드 입력 (예: 인공지능, 힐링...)" 
            className="flex-1 px-6 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
          />
          <button 
            onClick={handleGenerateIdeas}
            disabled={loading || (!topicKeyword && attachedFiles.length === 0)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
          >
            {loading ? <Loader2 className="animate-spin" /> : '아이디어 생성'}
          </button>
        </div>

        {/* File Upload Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
              <input
               type="file"
               id="file-upload"
               multiple
               accept=".pdf,.txt,image/*"
               className="hidden"
               onChange={handleFileChange}
               disabled={loading}
             />
             <label 
               htmlFor="file-upload"
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-600 transition-colors
                 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer hover:border-indigo-400 hover:text-indigo-600'}
               `}
             >
               <Paperclip size={16} />
               참고자료 첨부 (PDF, TXT, 이미지)
             </label>
             <span className="text-xs text-slate-400">
               {attachedFiles.length} files attached
             </span>
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700 border border-slate-200">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button 
                    onClick={() => removeFile(idx)}
                    className="p-0.5 rounded-full hover:bg-slate-300 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Illustration Toggle */}
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
            <input 
                type="checkbox" 
                id="generateIllustrations"
                checked={ebook.generateIllustrations}
                onChange={(e) => setEbook(prev => ({...prev, generateIllustrations: e.target.checked}))}
                className="mt-1 w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
                <label htmlFor="generateIllustrations" className="font-bold text-amber-900">삽화 이미지 생성</label>
                <p className="text-sm text-amber-800 mt-1">삽화 이미지 생성시 API 비용이 과도하게 소모될 수 있습니다.</p>
            </div>
        </div>
      </div>

      {topicIdeas.length > 0 && (
        <div className="space-y-6 mt-12">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="text-amber-500 w-5 h-5" />
              AI 추천 주제 (추천순)
            </h3>
            {selectedTopicIdx !== null && (
              <div className="animate-bounce-subtle flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100 shadow-sm">
                <ArrowRight className="rotate-90 w-4 h-4" />
                하단의 '원클릭 자동화' 또는 '다음단계 진행' 버튼을 눌러주세요!
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {topicIdeas.map((idea, idx) => (
              <div key={idx} className={`relative bg-white p-6 rounded-2xl border transition-all cursor-pointer group flex flex-col h-full
                ${selectedTopicIdx === idx 
                  ? 'border-indigo-500 shadow-xl ring-2 ring-indigo-500/20 bg-indigo-50/30' 
                  : 'border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300'
                }`}
                onClick={() => selectTopic(idea, idx)}
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg z-10">
                  {idx + 1}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 mt-2">{idea.title}</h3>
                <p className="text-slate-600 flex-1 text-sm leading-relaxed">{idea.description}</p>
                <div className={`mt-6 flex items-center font-semibold text-sm transition-colors ${selectedTopicIdx === idx ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                  {selectedTopicIdx === idx ? '선택됨' : '이 주제 선택하기'} 
                  <ArrowRight className={`ml-1 w-4 h-4 transition-transform ${selectedTopicIdx === idx ? 'translate-x-1' : ''}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );


  const renderTitleGeneration = () => (
    <div className="space-y-8 animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">제목 생성 (후킹성/매력)</h2>
            <p className="text-slate-500 mb-6">주제를 기반으로 독자의 시선을 사로잡는 매력적인 제목을 제안합니다.</p>
            
            <div className="mb-8 p-6 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h3 className="font-bold text-indigo-900 mb-2">선택된 주제</h3>
                <p className="text-indigo-800 font-medium whitespace-pre-wrap">{ebook.topic}</p>
            </div>
            
            <div className="flex justify-center mb-8">
               <button 
                onClick={handleGenerateTitles}
                disabled={loading}
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
               >
                 {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                 {titleIdeas.length > 0 ? "매력적인 제목 다시 생성하기" : "매력적인(후킹성) 제목 생성하기"}
               </button>
            </div>

            {titleIdeas.length > 0 && (
                <div className="grid md:grid-cols-1 gap-4">
                <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">원하는 제목을 선택하세요</label>
                {titleIdeas.map((title, idx) => (
                    <div key={idx} className={`relative bg-white p-6 rounded-2xl border transition-all cursor-pointer group flex items-center gap-4
                        ${selectedTitleIdx === idx 
                        ? 'border-indigo-500 shadow-xl ring-2 ring-indigo-500/20 bg-indigo-50/30' 
                        : 'border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300'
                        }`}
                        onClick={() => selectTitle(title, idx)}
                    >
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600">{title}</h3>
                        </div>
                        {selectedTitleIdx === idx && (
                            <div className="text-indigo-600">
                                <CheckCircle2 size={32} />
                            </div>
                        )}
                    </div>
                ))}
                </div>
            )}
            
            <div className="mt-8">
                <label className="block text-sm font-medium text-slate-700 mb-2 ml-1">직접 제목 수정/입력</label>
                <input 
                    type="text" 
                    value={ebook.title} 
                    onChange={(e) => setEbook({...ebook, title: e.target.value})}
                    placeholder="제목을 입력하거나 수정하세요"
                    className="w-full px-4 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
                />
            </div>
            
        </div>
    </div>
  );

  const renderAudienceSetting = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">독자 설정</h2>
        <div className="space-y-6">
          <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <Sparkles size={18} />
              선택된 주제
            </h3>
            <p className="text-indigo-800 font-medium text-lg">"{ebook.title}"</p>
            <p className="text-indigo-600 text-sm mt-1">{ebook.topic}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 ml-1">AI 추천 타겟 독자</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                value={ebook.targetAudience} 
                onChange={(e) => setEbook({...ebook, targetAudience: e.target.value})}
                placeholder="예: 인공지능에 관심 있는 30대 직장인"
                className="w-full pl-12 pr-6 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 ml-1">* AI가 분석한 최적의 독자층입니다. 필요시 수정할 수 있습니다.</p>
          </div>
        </div>
        
        <div className="mt-10 flex justify-end">
          <button 
            onClick={() => setCurrentStep(AppStep.PLANNING)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all active:scale-95"
          >
            기획 및 목차 생성 단계로 이동
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderPlanning = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">책 정보 설정</h2>
        <div className="grid gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">전자책 제목</label>
                <input 
                    type="text" 
                    value={ebook.title} 
                    onChange={(e) => setEbook({...ebook, title: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">타겟 독자</label>
                <input 
                    type="text" 
                    value={ebook.targetAudience} 
                    onChange={(e) => setEbook({...ebook, targetAudience: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">저자명</label>
                <input 
                    type="text" 
                    value={ebook.author} 
                    onChange={(e) => setEbook({...ebook, author: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">핵심 메시지/목적 (옵션)</label>
                <input 
                    type="text" 
                    value={ebook.coreMessage} 
                    onChange={(e) => setEbook({...ebook, coreMessage: e.target.value})}
                    placeholder="예: 독자들에게 자신감을 심어주고 실질적인 해결책을 제시"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">문체 및 어조 (옵션)</label>
                <input 
                    type="text" 
                    value={ebook.toneAndManner} 
                    onChange={(e) => setEbook({...ebook, toneAndManner: e.target.value})}
                    placeholder="예: 전문가적이고 신뢰감 있는, 하지만 친근하고 읽기 쉬운 어조"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
        </div>
        <div className="mt-8 flex justify-end">
             {/* Note: This button remains for manual overrides if needed */}
            <button 
                onClick={() => handleGenerateOutline()}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><LayoutTemplate size={20}/> 목차 다시 생성하기</>}
            </button>
        </div>
      </div>

      {ebook.outline.length > 0 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-slide-up">
            <h3 className="text-xl font-bold text-slate-800 mb-4">생성된 목차 (AI 기획)</h3>
            <ul className="space-y-3 mb-8">
                {ebook.outline.map((chapter, idx) => (
                    <li key={idx} className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-4">{idx + 1}</span>
                        <span className="text-lg text-slate-800">{chapter}</span>
                    </li>
                ))}
            </ul>
             {/* If loading, show status, else show manual controls */}
             {loading ? (
                <div className="flex items-center justify-center text-indigo-600 gap-2">
                    <Loader2 className="animate-spin" />
                    <span>다음 단계 자동 진행 중...</span>
                </div>
             ) : (
                <div className="flex justify-end gap-3">
                    <button onClick={() => handleGenerateOutline()} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">다시 생성</button>
                    <button onClick={startWriting} className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">
                        이 구성으로 원고 작성 시작
                    </button>
                </div>
             )}
        </div>
      )}
    </div>
  );

  const renderWriting = () => (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="w-24 h-24 mb-8 relative">
            <svg className="animate-spin w-full h-full text-indigo-200" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <PenTool className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">전자책 집필 중...</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">{loadingMessage}</p>
        
        <div className="w-full max-w-lg bg-slate-200 rounded-full h-4 mb-4">
            <div className="bg-indigo-600 h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${writingProgress}%` }}></div>
        </div>
        <p className="text-sm font-semibold text-indigo-600">{Math.round(writingProgress)}% 완료</p>
    </div>
  );

  const renderCoverDesign = () => (
    <div className="space-y-8 animate-fade-in">
        <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">표지 디자인</h2>
            <p className="text-slate-500">책의 첫인상을 결정하는 중요한 표지입니다.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md mx-auto">
                <div className={`aspect-[210/297] bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 relative ${loading ? 'animate-pulse' : ''}`}>
                    {ebook.coverImage ? (
                        <div className="relative w-full h-full group">
                            <img src={`data:image/png;base64,${ebook.coverImage}`} alt="Book Cover" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="text-center p-6 text-slate-400">
                            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>표지가 여기에 생성됩니다.</p>
                        </div>
                    )}
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center flex-col text-white">
                            <Loader2 className="animate-spin w-10 h-10 mb-2"/>
                            <p className="text-sm">Generating...</p>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex flex-col gap-3">
                    {!ebook.coverImage ? (
                         <button onClick={handleGenerateCover} disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md">
                            AI 표지 생성 시작
                         </button>
                    ) : (
                        <>
                            {/* Only show these if not auto-progressing (i.e. if user manually came here or if automation finished but stayed here for some reason, though automation goes to Review) */}
                            {!loading && (
                                <>
                                    <button onClick={handleGenerateCover} className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 flex items-center justify-center gap-2">
                                        <RefreshCw size={18}/> 다시 생성
                                    </button>
                                    <button onClick={handleDownloadCoverPdf} disabled={pdfLoading} className="w-full py-3 bg-indigo-700 text-white rounded-lg font-bold hover:bg-indigo-800 shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                                        {pdfLoading ? <Loader2 className="animate-spin" size={18}/> : <FileDown size={18}/>} 표지 PDF 저장 (A4)
                                    </button>
                                    <button onClick={() => setCurrentStep(AppStep.ILLUSTRATION)} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center justify-center gap-2">
                                        <CheckCircle2 size={18}/> 확정 및 다음 단계
                                    </button>
                                </>
                            )}
                            {loading && <p className="text-center text-sm text-slate-500">다음 단계로 자동 진행 중...</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  const renderIllustration = () => (
    <div className="space-y-8 animate-fade-in h-full flex flex-col">
         <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">삽화 작업</h2>
            <p className="text-slate-500">각 챕터의 내용을 시각화하여 독자의 이해를 돕습니다.</p>
        </div>

        {ebook.chapters.some(c => c.imageData) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ebook.chapters.map((chapter, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="aspect-[4/3] bg-slate-100 rounded-lg mb-4 overflow-hidden">
                             {chapter.imageData ? (
                                <img src={`data:image/png;base64,${chapter.imageData}`} alt={`Ch ${idx+1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                             ) : <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">생성 실패 또는 대기 중</div>}
                        </div>
                        <h4 className="font-bold text-slate-800 truncate">{idx+1}. {chapter.title}</h4>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
                 <button 
                    onClick={handleGenerateIllustrations} 
                    disabled={loading}
                    className="px-8 py-4 bg-indigo-600 text-white text-lg rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-3 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin"/> : <ImageIcon />}
                    {loading ? '그리는 중...' : '모든 챕터 삽화 일괄 생성'}
                </button>
                {loading && (
                    <div className="mt-8 w-full max-w-md">
                         <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${illustrationProgress}%` }}></div>
                        </div>
                        <p className="text-center text-slate-500 text-sm">{loadingMessage}</p>
                    </div>
                )}
            </div>
        )}
        
        {ebook.chapters.some(c => c.imageData) && !loading && (
             <div className="flex justify-center gap-4 mt-8 pb-10">
                {ebook.chapters.some(c => !c.imageData) && (
                    <button onClick={handleGenerateIllustrations} className="px-8 py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 shadow-md flex items-center gap-2">
                        <RefreshCw size={18} />
                        실패한 삽화 다시 생성
                    </button>
                )}
                <button onClick={() => setCurrentStep(AppStep.REVIEW_DOWNLOAD)} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">
                    최종 검토 하러가기
                </button>
             </div>
        )}
    </div>
  );

  const renderFormattedContent = (text: string) => {
      const parts = text.split(/(\[(?:RED|BLUE|GREEN|YELLOW_BG|IMPORTANT|EMPHASIS|HIGHLIGHT)\].*?\[\/(?:RED|BLUE|GREEN|YELLOW_BG|IMPORTANT|EMPHASIS|HIGHLIGHT)\])/g);
      
      return parts.map((part, index) => {
          if (part.startsWith('[RED]') || part.startsWith('[IMPORTANT]')) {
              const content = part.replace(/\[(RED|IMPORTANT)\]/g, '').replace(/\[\/(RED|IMPORTANT)\]/g, '');
              return <span key={index} className="text-red-600 font-bold">{content}</span>;
          } else if (part.startsWith('[BLUE]') || part.startsWith('[EMPHASIS]')) {
              const content = part.replace(/\[(BLUE|EMPHASIS)\]/g, '').replace(/\[\/(BLUE|EMPHASIS)\]/g, '');
              return <span key={index} className="text-blue-600 font-bold">{content}</span>;
          } else if (part.startsWith('[GREEN]')) {
              const content = part.replace(/\[GREEN\]/g, '').replace(/\[\/GREEN\]/g, '');
              return <span key={index} className="text-green-600 font-bold">{content}</span>;
          } else if (part.startsWith('[YELLOW_BG]') || part.startsWith('[HIGHLIGHT]')) {
              const content = part.replace(/\[(YELLOW_BG|HIGHLIGHT)\]/g, '').replace(/\[\/(YELLOW_BG|HIGHLIGHT)\]/g, '');
              return <span key={index} className="bg-yellow-200 text-slate-900 px-1 font-bold">{content}</span>;
          }
          return <span key={index}>{part}</span>;
      });
  };

  const formatContentForHtml = (text: string) => {
      let html = text
          .replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br/>');
          
      html = html.replace(/\[(RED|IMPORTANT)\](.*?)\[\/\1\]/g, '<span style="color:#dc2626; font-weight:bold;">$2</span>');
      html = html.replace(/\[(BLUE|EMPHASIS)\](.*?)\[\/\1\]/g, '<span style="color:#2563eb; font-weight:bold;">$2</span>');
      html = html.replace(/\[GREEN\](.*?)\[\/GREEN\]/g, '<span style="color:#16a34a; font-weight:bold;">$1</span>');
      html = html.replace(/\[(YELLOW_BG|HIGHLIGHT)\](.*?)\[\/\1\]/g, '<span style="background-color:#fef08a; font-weight:bold; color:black;">$2</span>');
      
      return `<p>${html}</p>`;
  };

  const handleCopyToDocs = async () => {
      setLoading(true);
      try {
          let htmlContent = `<div style="font-family: Arial, sans-serif;">`;
          htmlContent += `<h1 style="text-align: center; font-size: 36px; margin-bottom: 10px;">${ebook.title}</h1>`;
          if (ebook.author) htmlContent += `<p style="text-align: center; font-size: 18px; color: #555;">저자: ${ebook.author}</p>`;
          if (ebook.coverImage) htmlContent += `<div style="text-align: center; margin: 20px 0;"><img src="data:image/png;base64,${ebook.coverImage}" style="max-width: 400px;" /></div>`;
          
          htmlContent += `<h2 style="font-size: 24px; margin-top: 40px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">목차</h2>`;
          htmlContent += `<ul>`;
          ebook.outline.forEach(ch => { htmlContent += `<li><strong>${ch}</strong></li>`; });
          htmlContent += `</ul>`;
          htmlContent += `<hr style="margin: 40px 0;" />`;

          ebook.chapters.forEach((chapter, idx) => {
              htmlContent += `<h2 style="font-size: 24px; color: #333; margin-top: 40px;">${idx + 1}. ${chapter.title}</h2>`;
              if (chapter.imageData) {
                  htmlContent += `<div style="text-align: center; margin: 20px 0;"><img src="data:image/png;base64,${chapter.imageData}" style="max-width: 600px;" /></div>`;
              }
              htmlContent += `<div style="line-height: 1.6; font-size: 16px; color: #333; text-align: justify;">${formatContentForHtml(chapter.content)}</div>`;
              htmlContent += `<hr style="margin: 40px 0;" />`;
          });
          
          htmlContent += `</div>`;

          const blobHtml = new Blob([htmlContent], { type: 'text/html' });
          const blobText = new Blob([ebook.title + '\n(웹 브라우저의 HTML 복사 기능을 사용해주세요)'], { type: 'text/plain' });
          const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
          
          await navigator.clipboard.write(data);
          alert('웹 문서용 원문(HTML)이 클립보드에 복사되었습니다. 구글 문서(Docs)나 워드 등에 붙여넣기 해보세요.');
      } catch (err) {
          console.error('Copy failed:', err);
          alert('클립보드 복사에 실패했습니다.');
      } finally {
          setLoading(false);
      }
  };

  const renderReview = () => (
    <div className="space-y-8 animate-fade-in pb-20">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">최종 검토 및 다운로드</h2>
                <p className="text-slate-500 mt-1">완성된 전자책을 PDF/DOCX 파일로 저장하거나 Docs로 복사하세요.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
                <button
                    onClick={handleCopyToDocs}
                    disabled={loading || pdfLoading}
                    className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-700 border-2 border-indigo-700 rounded-xl font-bold hover:bg-indigo-50 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Copy size={20} />}
                    Docs로 복사
                </button>
                <button
                    onClick={handleDownload}
                    disabled={pdfLoading}
                    className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 border-2 border-slate-300 rounded-xl font-bold hover:bg-slate-50 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                >
                    <Download size={20} />
                    DOCX
                </button>
                <button
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-700 text-white rounded-xl font-bold hover:bg-indigo-800 shadow-lg transition-transform active:scale-95 disabled:opacity-60"
                >
                    {pdfLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <FileDown size={20} />}
                    {pdfLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}
                </button>
            </div>
        </div>

        <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 max-w-4xl mx-auto min-h-[800px]">
            {/* Preview Header / Cover */}
            <div className="bg-slate-900 text-white p-12 text-center relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 font-serif">{ebook.title}</h1>
                    {/* Removed Target Audience Line */}
                    {ebook.author && <p className="text-lg text-slate-400 mt-2">저자: {ebook.author}</p>}
                    {ebook.coverImage && (
                        <div className="mt-8 max-w-xs mx-auto shadow-2xl rounded-lg overflow-hidden border-4 border-white/20">
                             <img src={`data:image/png;base64,${ebook.coverImage}`} alt="Cover" className="w-full" />
                        </div>
                    )}
                </div>
                <div className="absolute inset-0 bg-indigo-900/50"></div>
            </div>

            {/* Preview Content */}
            <div className="p-12 space-y-12">
                <div className="prose prose-lg max-w-none text-slate-700">
                    <h2 className="text-3xl font-bold text-slate-900 border-b pb-4">목차</h2>
                    <ul className="list-decimal pl-5 space-y-2">
                        {ebook.outline.map((ch, i) => <li key={i} className="font-medium">{ch}</li>)}
                    </ul>
                </div>

                {ebook.chapters.map((chapter, idx) => (
                    <article key={idx} className="prose prose-lg max-w-none prose-slate">
                        <hr className="my-8 border-slate-100"/>
                        <h2 className="text-3xl font-bold text-indigo-900">{idx + 1}. {chapter.title}</h2>
                        
                        {chapter.imageData && (
                            <figure className="my-8">
                                <img 
                                    src={`data:image/png;base64,${chapter.imageData}`} 
                                    alt={chapter.title} 
                                    className="rounded-xl shadow-lg w-full max-w-2xl mx-auto"
                                />
                                <figcaption className="text-center text-sm text-slate-500 mt-2">AI Generated Illustration for Chapter {idx+1}</figcaption>
                            </figure>
                        )}

                        <div className="mt-6 text-justify leading-relaxed font-sans space-y-4">
                            {splitIntoParagraphs(chapter.content).map((para, pIdx) => (
                                <p key={pIdx}>{renderFormattedContent(para)}</p>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
            
            <div className="bg-slate-50 p-8 text-center border-t border-slate-200 text-slate-400 text-sm">
                <p>Created with 혁신 전자책 AI (Powered by Gemini 3 Pro)</p>
            </div>
        </div>
    </div>
  );


  const renderNavigationFooter = () => {
    const canGoPrev = currentStep > AppStep.TOPIC_SELECTION;
    const canGoNext = currentStep < AppStep.REVIEW_DOWNLOAD;
    
    const handlePrev = () => {
      setCurrentStep(prev => Math.max(prev - 1, AppStep.TOPIC_SELECTION));
    };

    const handleNext = () => {
      setCurrentStep(prev => Math.min(prev + 1, AppStep.REVIEW_DOWNLOAD));
    };

    const handleProceed = () => {
      switch(currentStep) {
        case AppStep.TOPIC_SELECTION:
          if (isTitleUserDefined && ebook.title) {
            // 사용자가 제목을 직접 정함 → 주제 설명 보완 후 독자 설정 단계로 이동
            if (!ebook.topic) {
              setEbook(prev => ({ ...prev, topic: [prev.outcomePromise, prev.readerPainPoint, topicKeyword].filter(Boolean).join(' / ') || prev.title }));
            }
            setCurrentStep(AppStep.AUDIENCE_SETTING);
          } else if (ebook.topic) {
            setCurrentStep(AppStep.TITLE_GENERATION);
          } else {
            setGlobalError('주제를 선택하거나 제목을 직접 입력해주세요.');
          }
          break;
        case AppStep.TITLE_GENERATION:
          if (ebook.title) setCurrentStep(AppStep.AUDIENCE_SETTING);
          else setGlobalError('주제를 먼저 선택해주세요.');
          break;
        case AppStep.AUDIENCE_SETTING:
          if (ebook.targetAudience) setCurrentStep(AppStep.PLANNING);
          else setGlobalError('독자 설정을 완료해주세요.');
          break;
        case AppStep.PLANNING:
          if (ebook.outline.length > 0) setCurrentStep(AppStep.WRITING);
          else handleGenerateOutline();
          break;
        case AppStep.WRITING:
          if (ebook.chapters.every(c => c.content)) setCurrentStep(AppStep.COVER_DESIGN);
          else handleWriteAllChapters();
          break;
        case AppStep.COVER_DESIGN:
          if (ebook.coverImage) {
              if (ebook.generateIllustrations) setCurrentStep(AppStep.ILLUSTRATION);
              else setCurrentStep(AppStep.REVIEW_DOWNLOAD);
          } else handleGenerateCover();
          break;
        case AppStep.ILLUSTRATION:
          if (ebook.chapters.every(c => c.imageData)) setCurrentStep(AppStep.REVIEW_DOWNLOAD);
          else handleGenerateIllustrations();
          break;
        default:
          break;
      }
    };

    return (
      <div className={`fixed bottom-0 right-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] transition-all duration-300 ${isSidebarOpen ? 'left-64' : 'left-0'}`}>
        <div className="flex gap-3">
          <button 
            onClick={handlePrev}
            disabled={!canGoPrev || loading}
            className="px-6 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <ArrowRight className="rotate-180 w-4 h-4" />
            이전
          </button>
          <button 
            onClick={handleNext}
            disabled={!canGoNext || loading}
            className="px-6 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            다음
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 items-center">
          {isAutomating && (
            <div className="flex flex-col items-end mr-4">
              <span className="text-xs font-bold text-indigo-600 mb-1">자동화 진행률: {automationProgress}%</span>
              <div className="w-48 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500" 
                  style={{ width: `${automationProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => runFullAutomation()}
            disabled={loading || (currentStep === AppStep.TOPIC_SELECTION && !topicKeyword && attachedFiles.length === 0 && !ebook.title)}
            className="px-6 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Sparkles size={18} />
            원클릭 자동화
          </button>

          {currentStep < AppStep.REVIEW_DOWNLOAD && (
            <button 
              onClick={handleProceed}
              disabled={loading}
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              다음단계 진행
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderHeaderRight = () => (
    <div className="flex items-center gap-4">
      {/* Reset State Button */}
      <button 
        onClick={() => {
            if(window.confirm('저장된 진행 상황을 초기화하고 처음부터 다시 시작하시겠습니까?')) {
                localStorage.removeItem('ebookState');
                window.location.reload();
            }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold transition-colors text-sm border border-red-100"
      >
        <RefreshCw size={16} />
        새로 만들기
      </button>

      {/* Patch Note Button */}
      <button 
        onClick={() => setShowPatchNotes(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors text-sm border border-slate-700"
      >
        <ClipboardList size={16} />
        패치노트
      </button>

      {/* API Cost Button */}
      <button 
        onClick={() => setShowApiCost(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold transition-colors text-sm border border-indigo-100"
      >
        <DollarSign size={16} />
        API 비용
      </button>

      {/* How to Use Button */}
      <button 
        onClick={() => setShowHowToUse(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors text-sm"
      >
        <BookOpen size={16} />
        사용 방법
      </button>

      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
        {hasApiKey ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold border border-green-200">
            <CheckCircle2 size={16} />
            API 키 적용됨
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold border border-red-200 animate-pulse ring-4 ring-red-500/20">
            <X size={16} />
            API 키 미적용
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type={showApiKey ? "text" : "password"} 
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Gemini API 키 입력"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48 pr-8"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button 
            onClick={handleSaveApiKey}
            disabled={apiKeyStatus === 'saving'}
            className={`px-4 py-1.5 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center min-w-[70px] ${
              apiKeyStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' :
              apiKeyStatus === 'cleared' ? 'bg-slate-600 hover:bg-slate-700' :
              apiKeyStatus === 'error' ? 'bg-red-600 hover:bg-red-700' :
              'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {apiKeyStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : 
             apiKeyStatus === 'saved' ? <span className="flex items-center gap-1"><CheckCircle2 size={14} /> 적용됨</span> : 
             apiKeyStatus === 'cleared' ? '해제됨' :
             (!apiKeyInput.trim() ? '해제' : '적용')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout 
      currentStep={currentStep} 
      setCurrentStep={setCurrentStep}
      onSettingsOpen={() => {}}
      headerRight={renderHeaderRight()}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      {currentStep === AppStep.TOPIC_SELECTION && renderTopicSelection()}
      {currentStep === AppStep.TITLE_GENERATION && renderTitleGeneration()}
      {currentStep === AppStep.AUDIENCE_SETTING && renderAudienceSetting()}
      {currentStep === AppStep.PLANNING && renderPlanning()}
      {currentStep === AppStep.WRITING && renderWriting()}
      {currentStep === AppStep.COVER_DESIGN && renderCoverDesign()}
      {currentStep === AppStep.ILLUSTRATION && renderIllustration()}
      {currentStep === AppStep.REVIEW_DOWNLOAD && renderReview()}

      {renderNavigationFooter()}

      {/* How to Use Modal */}
      {showHowToUse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
              <h3 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                <Lightbulb className="text-indigo-600" />
                혁신 전자책 AI 사용 방법
              </h3>
              <button 
                onClick={() => setShowHowToUse(false)}
                className="p-2 hover:bg-white/50 rounded-full transition-colors"
              >
                <X size={24} className="text-indigo-900" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6 text-slate-700 leading-relaxed">
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                  API 키 설정
                </h4>
                <p>우측 상단 입력창에 Gemini API 키를 입력하고 '적용' 버튼을 누르세요. 한 번 적용하면 동일한 브라우저에서는 계속 유지됩니다.</p>
              </section>
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                  주제 선정 및 저자 입력
                </h4>
                <p>저자명을 입력하고, 원하는 책의 키워드를 입력하세요. 참고할 파일(PDF, DOCX, 이미지 등)은 개수 제한 없이 첨부할 수 있습니다. '아이디어 생성' 버튼을 누르면 AI가 3가지 주제를 제안합니다.</p>
              </section>
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                  독자 설정
                </h4>
                <p>선택된 주제에 가장 적합한 독자층을 AI가 분석하여 제안합니다. 필요에 따라 직접 수정할 수 있습니다.</p>
              </section>
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                  분량 선택
                </h4>
                <p>원하는 전자책의 대략적인 페이지 수를 선택하세요. 'AI 추천'을 선택하면 주제에 가장 적합한 분량으로 자동 설정됩니다.</p>
              </section>
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
                  자동 생성 프로세스
                </h4>
                <p>제안된 주제 중 하나를 선택하면 [독자 설정 &rarr; 기획 &rarr; 목차 생성 &rarr; 본문 집필 &rarr; 표지 디자인 &rarr; 삽화 생성] 단계가 자동으로 진행됩니다. 각 단계별로 진행 상황을 확인할 수 있습니다.</p>
              </section>
              <section>
                <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">6</span>
                  다운로드
                </h4>
                <p>모든 과정이 완료되면 'DOCX 다운로드' 버튼을 통해 워드 파일로 결과물을 저장할 수 있습니다.</p>
              </section>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowHowToUse(false)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Cost Modal */}
      <ApiCostModal 
        isOpen={showApiCost} 
        onClose={() => setShowApiCost(false)} 
      />

      {/* Patch Notes Modal */}
      <PatchNotesModal
        isOpen={showPatchNotes}
        onClose={() => setShowPatchNotes(false)}
      />

      {/* Global Error Modal */}
      {globalError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl shadow-2xl w-full animate-scale-in overflow-hidden transition-all ${
            (globalError.includes("API 호출량") || globalError.includes("API 키") || globalError.includes("Quota") || globalError.includes("EXHAUSTED") || globalError.includes("RESOURCE")) 
              ? 'max-w-md' 
              : 'max-w-sm'
          }`}>
            <div className="p-6 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                알림
              </h3>
              <button onClick={() => setGlobalError(null)} className="p-1 hover:bg-indigo-100 rounded-full">
                <X size={20} className="text-indigo-900" />
              </button>
            </div>
            <div className="p-8 text-slate-700 space-y-4">
              <p className="font-medium leading-relaxed">{globalError}</p>
              
              {/* If it's a quota or API Key error, show a dedicated input here */}
              {(globalError.includes("API 호출량") || globalError.includes("API 키") || globalError.includes("Quota") || globalError.includes("EXHAUSTED") || globalError.includes("RESOURCE")) && (
                <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="text-xs font-bold text-indigo-900">내 개별 Gemini API Key 입력:</div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AI Studio에서 발급받은 API 키 붙여넣기"
                      className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      disabled={apiKeyStatus === 'saving'}
                      className={`px-4 py-2 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap min-w-[80px] flex items-center justify-center ${
                        apiKeyStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' :
                        apiKeyStatus === 'error' ? 'bg-red-600 hover:bg-red-700' :
                        'bg-indigo-600 hover:bg-indigo-700 animate-pulse'
                      }`}
                    >
                      {apiKeyStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : 
                       apiKeyStatus === 'saved' ? <span className="flex items-center gap-1"><CheckCircle2 size={16} /> 적용됨</span> : 
                       '적용'}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-normal">
                    * <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">여기(Google AI Studio)</a>에서 무료로 API 키를 즉시 발급받으실 수 있으며, 이 곳이나 우측 상단 바에서 입력하시면 리소스 소진 없이 전자책을 무제한으로 작성하실 수 있습니다.
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setGlobalError(null)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 w-full"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error & Maintenance Modal */}
      {showMaintenance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
                오류 및 유지보수 안내
              </h3>
              <button onClick={() => setShowMaintenance(false)} className="p-1 hover:bg-red-100 rounded-full">
                <X size={20} className="text-red-900" />
              </button>
            </div>
            <div className="p-8 text-slate-700">
              <p className="mb-4 font-medium">혁신 전자책 AI 오류 및 유지보수 요청사항이 있을 경우, 아래 메일로 명확한 상황을 작성해서 보내주시면 실시간 확인 후 조치해 드립니다.</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                <span className="font-bold text-indigo-600">info@nextin.ai.kr</span>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowMaintenance(false)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Buttons (Bottom Right) */}
      <div className="fixed bottom-24 right-8 flex flex-col gap-3 z-50">
        <button 
          onClick={() => setShowMaintenance(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-full shadow-xl hover:bg-slate-50 transition-all font-bold text-sm"
        >
          오류 및 유지보수
        </button>
        <a 
          href="https://hyeoksinai.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-all font-bold text-sm"
        >
          혁신 AI 플랫폼 바로가기
          <ArrowRight size={16} />
        </a>
      </div>
    </Layout>
  );
};

export default App;