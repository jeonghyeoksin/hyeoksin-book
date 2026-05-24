import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Model Constants
const TEXT_MODEL = 'gemini-3.1-pro-preview';
const IMAGE_MODEL = 'imagen-4.0-ultra-generate-001';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

/**
 * Helper to get a fresh GoogleGenAI instance with the current API key.
 */
const getAI = () => {
  const customKey = localStorage.getItem('custom_gemini_api_key');
  const apiKey = customKey || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to call Gemini API with exponential backoff retry for 429 errors.
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error);
    const isRateLimit = error?.message?.includes('429') || 
                        error?.status === 'RESOURCE_EXHAUSTED' ||
                        errorStr.includes('429') ||
                        errorStr.includes('RESOURCE_EXHAUSTED');
    
    const isUnavailable = error?.message?.includes('503') ||
                          error?.status === 'UNAVAILABLE' ||
                          errorStr.includes('503') ||
                          errorStr.includes('UNAVAILABLE');
    
    if ((isRateLimit || isUnavailable) && retries > 0) {
      console.warn(`Retryable error hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/* Helper to safely parse JSON returned from the API */
const parseJSONFallback = (text: string, defaultOutput: any) => {
  if (!text) return defaultOutput;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("Direct JSON parse failed, trying fallback extraction");
    try {
      let rawText = text;
      if (rawText.includes("```json")) {
        rawText = rawText.split("```json")[1].split("```")[0].trim();
      } else if (rawText.includes("```")) {
        rawText = rawText.split("```")[1].split("```")[0].trim();
      }
      return JSON.parse(rawText);
    } catch (e2) {
      console.error("Fallback JSON parsing also failed", e2);
      throw new Error("JSON_PARSE_ERROR: " + String(e2));
    }
  }
};

/**
 * Generates topic ideas based on a keyword and optional reference files.
 */
export const generateTopics = async (
  keyword: string, 
  files: { data: string; mimeType: string }[] = [],
  authorExpertise: string = '',
  bookStyle: string = ''
): Promise<{ title: string; description: string }[]> => {
  
  const systemPrompt = `
    사용자가 입력한 정보${files.length > 0 ? '와 첨부된 참고 자료' : ''}를 바탕으로 매력적인 전자책 주제 3가지를 제안해주세요.
    
    [입력된 정보]
    - 핵심 키워드: "${keyword}"
    ${authorExpertise ? `- 저자의 전문성/배경: "${authorExpertise}"` : ''}
    ${bookStyle ? `- 희망하는 전자책 스타일/형식: "${bookStyle}"` : ''}

    [필수 요구사항]
    1. 각 주제는 '제목'과 '설명'으로 구성되어야 합니다.
    2. **추천순(가장 매력적이고 시장성 있는 순서)으로 3가지를 제안해주세요.**
    3. **모든 제안된 주제의 '제목'에는 반드시 입력된 키워드 "${keyword}"가 포함되어야 합니다.**
    4. 첨부파일이 있다면 해당 파일의 내용(이미지, 텍스트 등)을 적극적으로 반영하여 주제를 선정해주세요.
    5. 저자의 전문성이나 희망 스타일이 입력되었다면, 이를 최우선으로 반영하여 고품질의 주제를 도출해주세요.
    
    JSON 형식으로 출력해주세요.
  `;

  let parts: any[] = [{ text: systemPrompt }];

  if (files && files.length > 0) {
    const fileParts = files.map(file => ({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType || 'text/plain'
      }
    }));
    parts = [...parts, ...fileParts];
  }

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["title", "description"],
        },
      },
      thinkingConfig: { thinkingBudget: 1024 },
      safetySettings: SAFETY_SETTINGS,
    },
  }));

  return parseJSONFallback(response.text || "", []);
};

/**
 * Generates catchy titles based on a topic.
 */
export const generateTitles = async (topicTitle: string, topicDescription: string, authorExpertise: string, bookStyle: string): Promise<string[]> => {
  const prompt = `
    다음 전자책 주제를 바탕으로 독자의 시선을 사로잡는(후킹성 있는) 매력적인 전자책 제목을 3가지 제안해주세요.

    [주제 정보]
    - 주제명: "${topicTitle}"
    - 주제 설명: "${topicDescription}"
    ${authorExpertise ? `- 저자의 전문성/배경: "${authorExpertise}"` : ''}
    ${bookStyle ? `- 희망하는 전자책 스타일/형식: "${bookStyle}"` : ''}

    [필수 요구사항]
    1. 후킹성 있고 타겟 독자의 클릭을 유도할 수 있는 매력적이고 트렌디한 제목이어야 합니다.
    2. 부제(Subtitle)를 포함하여 구성해도 좋습니다. (예: "메인 제목: 부제목")
    3. JSON 배열 형식(Array of Strings)으로 3가지 제목만 반환해주세요.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      thinkingConfig: { thinkingBudget: 1024 },
      safetySettings: SAFETY_SETTINGS,
    },
  }));

  return parseJSONFallback(response.text || "", []);
};

/**
 * Suggests a target audience based on the selected topic.
 */
export const suggestTargetAudience = async (title: string, description: string): Promise<string> => {
  const prompt = `
    전자책 제목: "${title}"
    주제 설명: "${description}"
    
    이 전자책에 가장 적합한 '타겟 독자'를 한 문장으로 정의해주세요. 
    누가 이 책을 읽으면 가장 큰 도움을 받을 수 있을지 고민하여 구체적으로 작성하세요.
    출력은 오직 타겟 독자 정의 문장만 반환하세요.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
    }
  }));

  return response.text?.trim() || "일반 대중";
};

/**
 * Generates a book outline (chapters).
 */
export const generateOutline = async (title: string, audience: string, pageCount: string = 'AI추천', coreMessage: string = '', toneAndManner: string = ''): Promise<string[]> => {
  let pageInstruction = '';
  if (pageCount === 'AI추천') {
    pageInstruction = '주제에 가장 적합한 분량으로 체계적이고 논리적인 목차를 구성해주세요.';
  } else {
    pageInstruction = `전체 분량이 약 ${pageCount}페이지 내외가 될 수 있도록 목차를 상세하게 구성해주세요.`;
  }

  const prompt = `
    전자책 제목: "${title}"
    예상 독자: "${audience}"
    ${coreMessage ? `핵심 메시지/목적: "${coreMessage}"` : ''}
    ${toneAndManner ? `문체 및 어조: "${toneAndManner}"` : ''}
    
    이 전자책을 위한 체계적이고 논리적인 목차(챕터 제목)를 생성해주세요. 
    [분량 가이드] ${pageInstruction}
    보통 한 챕터당 A4 2~3페이지 분량으로 작성될 예정입니다. 이를 고려하여 적절한 개수의 챕터를 생성하세요.
    JSON 배열 형식으로 문자열만 반환하세요. 서론이나 결론은 제외하고 본문 챕터 위주로 구성하세요.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      thinkingConfig: { thinkingBudget: 2048 },
      safetySettings: SAFETY_SETTINGS,
    },
  }));

  return parseJSONFallback(response.text || "", []);
};

/**
 * Generates content for a specific chapter.
 */
export const generateChapterContent = async (bookTitle: string, chapterTitle: string, outline: string[], author: string = '', coreMessage: string = '', toneAndManner: string = ''): Promise<string> => {
  const prompt = `
    전자책 제목: ${bookTitle}
    ${author ? `저자: ${author}` : ''}
    전체 목차: ${outline.join(', ')}
    ${coreMessage ? `핵심 메시지/목적: ${coreMessage}` : ''}
    ${toneAndManner ? `문체 및 어조: ${toneAndManner}` : ''}
    
    현재 작성할 챕터: "${chapterTitle}"
    
    [작성 절대 원칙 - 필독]
    1. **형식 지침 (매우 중요 - 마크다운 금지 및 색상 태그 사용)**: 
       - 텍스트에 '#', '*', '-', '>', '---', '[ ]' 등의 마크다운 특수기호를 절대 사용하지 마십시오.
       - 대신, 내용 강조를 위해 아래와 같은 특수 태그를 **반드시** 사용하십시오:
         [RED]빨간색으로 강조할 내용[/RED]
         [BLUE]파란색으로 강조할 내용[/BLUE]
         [GREEN]초록색으로 강조할 내용[/GREEN]
         [YELLOW_BG]노란색 배경의 검은색 텍스트로 강조할 내용[/YELLOW_BG]
       - 이 네 가지 강조 색상(빨강, 파랑, 초록, 노랑배경)을 본문 안에서 적절하게 섞어서 입체적이고 다채롭게 구성해 주세요.
       - 문단 구분은 오직 '줄바꿈(Enter)'으로만 하세요.
    
    2. **내용 전략 (브랜딩 & 셀링포인트 & 분위기)**:
       - 이 원고는 단순 정보 전달이 아닌, **저자("${author}")의 브랜딩**을 극대화하는 수단입니다.
       - 저자만의 독창적인 철학, 경험, 노하우를 깊이 있게 서술하여 독자가 저자를 업계의 권위자로 느끼게 하십시오.
       ${toneAndManner ? `- **반드시 다음 문체와 어조를 유지하여 작성하십시오:** ${toneAndManner}` : ''}
       ${coreMessage ? `- **글의 핵심 목적 달성에 집중하십시오:** ${coreMessage}` : ''}
    
    3. **분량 및 스타일 (매우 중요)**:
       - 전체 책 분량(A4 50페이지 이상)을 위해, 이 챕터 하나만으로도 **A4 3~4페이지 분량(약 4000자 이상)**이 나오도록 아주 상세하고 길게 작성하십시오.
       - 사례, 예시, 구체적인 방법론을 풍부하게 넣어 내용을 확장하세요.
    
    4. **제한 사항**: 본문의 내용에는 '혁신 전자책 AI' 또는 관련된 AI 서비스 이름(Gemini 등)을 절대 언급하지 마십시오. 오직 주제와 내용에 집중하세요.
    5. **형식**: 완성된 산문 형태의 줄글로 작성하세요.
    6. **가독성 최적화**: 독자가 읽기 편하도록 **두 문단(Paragraph)마다 반드시 한 줄의 빈 줄(Blank Line)**을 삽입하여 단락을 구분하십시오.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 4096 },
      safetySettings: SAFETY_SETTINGS,
    },
  }));

  return response.text || "";
};

/**
 * Generates a prompt for image generation (English).
 */
export const generateImagePrompt = async (context: string, type: 'cover' | 'illustration'): Promise<string> => {
  const prompt = `
    Create a highly detailed and artistic prompt in English for an AI image generator (Gemini 3 Pro Image or Nanobanana 2).
    
    Context: ${context}
    Type: ${type === 'cover' ? 'Book Cover' : 'Book Illustration'}
    
    Style: ${type === 'cover' ? 'Minimalist, Modern, Eye-catching, High resolution, Typography friendly' : 'Digital Art, Storybook style, Clean lines'}
    
    [CRITICAL INSTRUCTION]
    ${type === 'cover' 
      ? `You MUST extract the Exact Title and Author from the Context. Your final prompt MUST explicitly include them in quotes. For example include: "A book cover design prominently featuring the exact Korean text \\"Title\\" and \\"Author\\". The text overlay must be prominent, perfectly spelled, and beautifully integrated into the typography." Do not use generic placeholders, you MUST use the exact Korean text from the context in the final English prompt.`
      : `DO NOT include any text, typography, fonts, characters, letters, or words in the image. The image must be purely visual art without any written elements.`}
    
    Output: Just the English prompt string.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
    }
  }));

  return response.text || "";
};

/**
 * Helper to generate image using a specific model. Throws if failed.
 */
const tryGenerateImageWithModel = async (model: string, prompt: string, aspectRatio: '3:4' | '4:3'): Promise<string> => {
  const ai = getAI();
  if (model.includes('imagen')) {
    const response = await callWithRetry(() => ai.models.generateImages({
      model: model,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio,
      }
    }));
    // @ts-ignore
    if (response && response.generatedImages && response.generatedImages.length > 0) {
      // @ts-ignore
      return response.generatedImages[0].image.imageBytes;
    }
    throw new Error(`No image generated by Imagen model: ${model}`);
  } else {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K"
        },
        safetySettings: SAFETY_SETTINGS,
      }
    }));

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error(`No candidates in image generation response for model: ${model}`);
    }

    for (const part of response.candidates[0].content.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    throw new Error(`No inlineData found in image generation parts for model: ${model}`);
  }
};

/**
 * Generates an image using Gemini 3 Pro Image Preview or specified model with sequential fallbacks.
 */
export const generateImage = async (prompt: string, aspectRatio: '3:4' | '4:3' = '3:4', modelOverride?: string): Promise<string> => {
  const primaryModel = modelOverride || IMAGE_MODEL;
  
  // Design fallback chain: if the premium Imagen model is overloaded (503), try other excellent models in order.
  const modelsToTry = [primaryModel];
  const fallbackList = [
    'imagen-4.0-ultra-generate-001',
    'imagen-3.0-generate-002',
    'gemini-3.1-flash-image-preview',
    'gemini-2.5-flash-image'
  ];
  
  for (const fallback of fallbackList) {
    if (!modelsToTry.includes(fallback)) {
      modelsToTry.push(fallback);
    }
  }

  console.log("Image generation models fallback queue:", modelsToTry);

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      console.log(`[Image Fallback System] Attempting generation with model: ${model}`);
      const imageBytes = await tryGenerateImageWithModel(model, prompt, aspectRatio);
      if (imageBytes) {
        console.log(`[Image Fallback System] Successfully generated image with model: ${model}`);
        return imageBytes;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[Image Fallback System] Model ${model} failed:`, error?.message || error);
      // Wait a small delay before trying the next model to let network clear
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  console.error("[Image Fallback System] All attempted models failed. Last error:", lastError);
  // Throw last error to let calling context handle failure if needed, or return ""
  // Let's propagate the error so that the user gets a clear message, but returning empty could fail coverImage.
  // Actually, throwing the error allows the UI error handling in App.tsx to catch it nicely.
  throw lastError || new Error("All image generation models failed.");
};