import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { AppStep, EBookState, GeneratedTopic, Chapter } from './types';
import * as geminiService from './services/geminiService';
import { generateAndDownloadDocx } from './utils/docxGenerator';
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
  Paperclip,
  X,
  User,
  Key
} from 'lucide-react';

interface AttachedFile {
  name: string;
  data: string; // Base64 string without prefix
  mimeType: string;
}

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };
  
  // Inputs
  const [topicKeyword, setTopicKeyword] = useState('');
  const [topicIdeas, setTopicIdeas] = useState<GeneratedTopic[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  
  // E-Book State
  const [ebook, setEbook] = useState<EBookState>({
    topic: '',
    targetAudience: '일반 대중',
    title: '',
    author: '',
    outline: [],
    chapters: [],
  });

  // --- Helpers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Explicitly cast to File[] to avoid 'unknown' type inference issues
      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 5 - attachedFiles.length;
      const filesToProcess = files.slice(0, remainingSlots);
      
      if (files.length > remainingSlots) {
        alert(`최대 5개까지만 첨부할 수 있습니다.`);
      }

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


  // --- Step Handlers ---

  // Step 1: Generate Ideas
  const handleGenerateIdeas = async () => {
    if (!topicKeyword && attachedFiles.length === 0) return;
    setLoading(true);
    setLoadingMessage('Gemini 3 Pro가 입력된 키워드와 자료를 분석하여 브레인스토밍 중입니다...');
    try {
      const topics = await geminiService.generateTopics(topicKeyword, attachedFiles);
      setTopicIdeas(topics);
    } catch (e) {
      console.error(e);
      alert('주제 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- FULL AUTOMATION WORKFLOW ---
  const runFullAutomation = async (selectedTopic: GeneratedTopic) => {
    // Check for API Key
    if (!hasApiKey) {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
        alert("API 키가 필요합니다. 설정을 확인해주세요.");
        return;
      }
    }

    // 1. Initialize Local State for Consistency
    // We use a local variable to track state across async calls because React state updates are asynchronous/batched.
    let localEbookState: EBookState = {
        ...ebook, // Preserve current inputs like author/audience
        title: selectedTopic.title,
        topic: selectedTopic.description,
        outline: [],
        chapters: []
    };

    // Update UI State
    setEbook(localEbookState);
    setLoading(true);

    try {
        // --- PHASE 1: PLANNING ---
        setCurrentStep(AppStep.PLANNING);
        setLoadingMessage('Gemini가 50페이지 이상의 방대한 분량을 위해 체계적인 목차를 기획하고 있습니다...');
        
        const outline = await geminiService.generateOutline(localEbookState.title, localEbookState.targetAudience);
        localEbookState = {
            ...localEbookState,
            outline,
            chapters: outline.map((title, idx) => ({ id: idx, title, content: '' }))
        };
        setEbook(localEbookState);
        
        // UX Delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // --- PHASE 2: WRITING ---
        setCurrentStep(AppStep.WRITING);
        setLoadingMessage('대규모 본문 집필을 시작합니다. 각 챕터별로 상세한 내용을 작성합니다...');
        
        const writtenChapters = [...localEbookState.chapters];
        for (let i = 0; i < writtenChapters.length; i++) {
            setLoadingMessage(`'${writtenChapters[i].title}' 챕터 작성 중... (${i + 1}/${writtenChapters.length})`);
            
            const content = await geminiService.generateChapterContent(
                localEbookState.title,
                writtenChapters[i].title,
                localEbookState.outline,
                localEbookState.author
            );
            writtenChapters[i].content = content;
            
            // Update both local and UI state
            localEbookState = { ...localEbookState, chapters: [...writtenChapters] };
            setEbook(prev => ({ ...prev, chapters: [...writtenChapters] }));
            setWritingProgress(((i + 1) / writtenChapters.length) * 100);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // --- PHASE 3: COVER DESIGN ---
        setCurrentStep(AppStep.COVER_DESIGN);
        setLoadingMessage('표지 디자인 프롬프트 생성 및 렌더링 중...');
        
        const coverPrompt = await geminiService.generateImagePrompt(`Title: ${localEbookState.title}, Topic: ${localEbookState.topic}`, 'cover');
        setEbook(prev => ({ ...prev, coverPrompt }));
        
        const coverImage = await geminiService.generateImage(coverPrompt, '3:4');
        localEbookState = { ...localEbookState, coverPrompt, coverImage };
        setEbook(localEbookState);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // --- PHASE 4: ILLUSTRATIONS ---
        setCurrentStep(AppStep.ILLUSTRATION);
        setLoadingMessage('각 챕터에 맞는 삽화를 생성 중입니다...');
        
        const chaptersWithImages = [...localEbookState.chapters];
        for (let i = 0; i < chaptersWithImages.length; i++) {
            setLoadingMessage(`챕터 ${i+1} 삽화 그리는 중... (${i+1}/${chaptersWithImages.length})`);
            
            const illPrompt = await geminiService.generateImagePrompt(
                `Chapter Title: ${chaptersWithImages[i].title}. Content summary: ${chaptersWithImages[i].content.slice(0, 200)}...`, 
                'illustration'
            );
            chaptersWithImages[i].imagePrompt = illPrompt;
            
            const imgData = await geminiService.generateImage(illPrompt, '4:3');
            chaptersWithImages[i].imageData = imgData;
             
            localEbookState = { ...localEbookState, chapters: [...chaptersWithImages] };
            setEbook(prev => ({ ...prev, chapters: [...chaptersWithImages] }));
            setIllustrationProgress(((i + 1) / chaptersWithImages.length) * 100);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // --- PHASE 5: FINISH ---
        setCurrentStep(AppStep.REVIEW_DOWNLOAD);

    } catch (error) {
        console.error(error);
        alert("자동 생성 과정 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        setLoading(false);
    }
  };

  const selectTopic = (topic: GeneratedTopic) => {
    // Starts the full automation chain
    runFullAutomation(topic);
  };

  // --- Manual Handlers (Kept for manual retry capability) ---

  const handleGenerateOutline = async (titleOverride?: string, audienceOverride?: string) => {
    const titleToUse = titleOverride || ebook.title;
    const audienceToUse = audienceOverride || ebook.targetAudience;

    if (!titleToUse) {
        alert("제목이 설정되지 않았습니다.");
        return;
    }

    setLoading(true);
    setLoadingMessage('Gemini가 책의 구조를 논리적으로 기획하고 있습니다 (Thinking)...');
    try {
      const outline = await geminiService.generateOutline(titleToUse, audienceToUse);
      setEbook(prev => ({ 
        ...prev, 
        outline,
        chapters: outline.map((title, idx) => ({ id: idx, title, content: '' }))
      }));
    } catch (e) {
      console.error(e);
      alert('목차 생성 오류');
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
        const content = await geminiService.generateChapterContent(ebook.title, newChapters[i].title, ebook.outline, ebook.author);
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
      const prompt = await geminiService.generateImagePrompt(`Title: ${ebook.title}, Topic: ${ebook.topic}`, 'cover');
      setEbook(prev => ({ ...prev, coverPrompt: prompt }));
      
      const base64Image = await geminiService.generateImage(prompt, '3:4');
      setEbook(prev => ({ ...prev, coverImage: base64Image }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [illustrationProgress, setIllustrationProgress] = useState(0);
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
        alert('파일 생성 중 오류가 발생했습니다.');
    }
  };


  // --- Render Helpers ---

  const renderDashboard = () => (
    <div className="flex flex-col items-center h-full animate-fade-in pb-20">
      {/* 16:9 Hero Banner */}
      <div className="w-full aspect-video relative rounded-3xl overflow-hidden shadow-2xl mb-12 flex items-center justify-center group">
        <img 
          src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2000&auto=format&fit=crop" 
          alt="Innovation E-book AI Hero" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/80 to-slate-900/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        <div className="relative z-10 text-center px-6 flex flex-col items-center">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-2xl mb-6 border border-white/20 shadow-2xl">
            <Sparkles className="w-12 h-12 text-indigo-300" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-2xl mb-6" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            혁신 전자책 AI
          </h1>
          <p className="text-xl md:text-2xl text-indigo-100 font-medium max-w-3xl mx-auto drop-shadow-lg leading-relaxed">
            Gemini 3.1 Pro의 강력한 추론 능력과 이미지 생성 기능을 결합하여<br className="hidden md:block" />
            단 몇 번의 클릭으로 전문가 수준의 전자책을 기획하고 출판하세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-8">
        {!hasApiKey && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl w-full">
            <p className="text-amber-800 text-sm mb-3 text-center">
              이미지 생성을 위해 유료 API 키 선택이 필요합니다.
            </p>
            <button 
              onClick={handleOpenKeySelection}
              className="flex items-center justify-center gap-2 w-full py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors"
            >
              <Key size={18} />
              API 키 선택하기
            </button>
          </div>
        )}

        <button 
          onClick={() => setCurrentStep(AppStep.TOPIC_SELECTION)}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-indigo-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-700 shadow-lg w-full sm:w-auto"
        >
          새로운 프로젝트 시작하기
          <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );

  const renderTopicSelection = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">어떤 주제로 글을 쓰시겠습니까?</h2>
        <p className="text-slate-500">핵심 키워드를 입력하거나 참고 자료를 첨부하면 AI가 흥미로운 주제를 제안합니다.</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Author Name Input */}
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
              placeholder="저자명을 입력하세요 (예: 홍길동)" 
              className="w-full pl-10 pr-6 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg shadow-sm"
            />
          </div>
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
              className="hidden"
              onChange={handleFileChange}
              disabled={loading || attachedFiles.length >= 5}
            />
            <label 
              htmlFor="file-upload"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-600 transition-colors
                ${attachedFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer hover:border-indigo-400 hover:text-indigo-600'}
              `}
            >
              <Paperclip size={16} />
              참고자료 첨부 (최대 5개)
            </label>
            <span className="text-xs text-slate-400">
              {attachedFiles.length}/5 files
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
      </div>

      {topicIdeas.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {topicIdeas.map((idea, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-500 transition-all cursor-pointer group flex flex-col"
              onClick={() => selectTopic(idea)}
            >
              <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600">{idea.title}</h3>
              <p className="text-slate-600 flex-1">{idea.description}</p>
              <div className="mt-6 flex items-center text-indigo-600 font-semibold text-sm">
                이 주제 선택하기 <ArrowRight className="ml-1 w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}
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
                <div className={`aspect-[3/4] bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 relative ${loading ? 'animate-pulse' : ''}`}>
                    {ebook.coverImage ? (
                        <img src={`data:image/png;base64,${ebook.coverImage}`} alt="Book Cover" className="w-full h-full object-cover" />
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

  const renderReview = () => (
    <div className="space-y-8 animate-fade-in pb-20">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">최종 검토 및 다운로드</h2>
                <p className="text-slate-500 mt-1">완성된 전자책을 확인하고 DOCX 파일로 저장하세요.</p>
            </div>
            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-700 text-white rounded-xl font-bold hover:bg-indigo-800 shadow-lg transition-transform active:scale-95"
            >
                <Download size={20} />
                DOCX 다운로드
            </button>
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

                        <div className="mt-6 text-justify leading-relaxed whitespace-pre-wrap font-sans">
                            {chapter.content}
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

  const getStepContent = () => {
    switch (currentStep) {
      case AppStep.DASHBOARD: return renderDashboard();
      case AppStep.TOPIC_SELECTION: return renderTopicSelection();
      case AppStep.PLANNING: return renderPlanning();
      case AppStep.WRITING: return renderWriting();
      case AppStep.COVER_DESIGN: return renderCoverDesign();
      case AppStep.ILLUSTRATION: return renderIllustration();
      case AppStep.REVIEW_DOWNLOAD: return renderReview();
      default: return renderDashboard();
    }
  };

  return (
    <Layout 
      currentStep={currentStep} 
      setCurrentStep={setCurrentStep}
      onSettingsOpen={handleOpenKeySelection}
    >
      {getStepContent()}
    </Layout>
  );
};

export default App;