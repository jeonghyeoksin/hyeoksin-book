import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Model Constants
const TEXT_MODEL = 'gemini-3.1-pro-preview';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

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
  const apiKey = customKey || process.env.API_KEY || '';
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

/**
 * Generates topic ideas based on a keyword and optional reference files.
 */
export const generateTopics = async (
  keyword: string, 
  files: { data: string; mimeType: string }[] = []
): Promise<{ title: string; description: string }[]> => {
  
  const systemPrompt = `
    사용자가 입력한 키워드 "${keyword}"${files.length > 0 ? '와 첨부된 참고 자료' : ''}를 바탕으로 매력적인 전자책 주제 3가지를 제안해주세요.
    
    [필수 요구사항]
    1. 각 주제는 '제목'과 '설명'으로 구성되어야 합니다.
    2. **추천순(가장 매력적이고 시장성 있는 순서)으로 3가지를 제안해주세요.**
    3. **모든 제안된 주제의 '제목'에는 반드시 입력된 키워드 "${keyword}"가 포함되어야 합니다.**
    4. 첨부파일이 있다면 해당 파일의 내용(이미지, 텍스트 등)을 적극적으로 반영하여 주제를 선정해주세요.
    
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

  return JSON.parse(response.text || "[]");
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
export const generateOutline = async (title: string, audience: string, pageCount: string = 'AI추천'): Promise<string[]> => {
  let pageInstruction = '';
  if (pageCount === 'AI추천') {
    pageInstruction = '주제에 가장 적합한 분량으로 체계적이고 논리적인 목차를 구성해주세요.';
  } else {
    pageInstruction = `전체 분량이 약 ${pageCount}페이지 내외가 될 수 있도록 목차를 상세하게 구성해주세요.`;
  }

  const prompt = `
    전자책 제목: "${title}"
    예상 독자: "${audience}"
    
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

  return JSON.parse(response.text || "[]");
};

/**
 * Generates content for a specific chapter.
 */
export const generateChapterContent = async (bookTitle: string, chapterTitle: string, outline: string[], author: string = ''): Promise<string> => {
  const prompt = `
    전자책 제목: ${bookTitle}
    ${author ? `저자: ${author}` : ''}
    전체 목차: ${outline.join(', ')}
    
    현재 작성할 챕터: "${chapterTitle}"
    
    [작성 절대 원칙 - 필독]
    1. **마크다운(Markdown) 문법 금지**: 텍스트에 '#', '*', '-', '>', '---', '[ ]' 등의 마크다운 특수기호를 절대 사용하지 마십시오.
       - 제목이나 강조가 필요하다면 특수기호 대신 문맥과 줄바꿈으로 표현하세요.
       - 오직 '줄바꿈(Enter)'으로만 문단을 구분하세요.
    
    2. **내용 전략 (브랜딩 & 셀링포인트)**:
       - 이 원고는 단순 정보 전달이 아닌, **저자("${author}")의 브랜딩**을 극대화하는 수단입니다.
       - 저자만의 독창적인 철학, 경험, 노하우를 깊이 있게 서술하여 독자가 저자를 업계의 권위자로 느끼게 하십시오.
       - 저자가 제공하는 서비스나 핵심 가치(Selling Point)가 글 전반에 자연스럽게 녹아들어, 독자가 감동하고 행동(구매/문의 등)하고 싶게 만드십시오.
    
    3. **분량 및 스타일 (매우 중요)**:
       - 전체 책 분량(A4 50페이지 이상)을 위해, 이 챕터 하나만으로도 **A4 3~4페이지 분량(약 4000자 이상)**이 나오도록 아주 상세하고 길게 작성하십시오.
       - 사례, 예시, 구체적인 방법론을 풍부하게 넣어 내용을 확장하세요.
    
    4. **형식**: 완성된 산문 형태의 줄글로 작성하세요.
    5. **가독성 최적화**: 독자가 읽기 편하도록 **두 문단(Paragraph)마다 반드시 한 줄의 빈 줄(Blank Line)**을 삽입하여 단락을 구분하십시오.
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
    Create a highly detailed and artistic prompt in English for an AI image generator (Gemini 3 Pro Image).
    
    Context: ${context}
    Type: ${type === 'cover' ? 'Book Cover' : 'Book Illustration'}
    
    Style: ${type === 'cover' ? 'Minimalist, Modern, Eye-catching, High resolution, Typography friendly' : 'Digital Art, Storybook style, Clean lines'}
    
    [IMPORTANT FOR COVER]
    If this is a 'cover':
    1. The text on the cover MUST be 100% in Korean (Hangul).
    2. You must explicitly include instructions in the prompt to render the title in Korean characters.
    3. The author's name is MANDATORY and must be placed at the bottom center of the cover in the format: "[Author Name] 지음" (in Korean).
    4. DO NOT include any other names, brands, or text related to the target audience (e.g. "for beginners", "target: ..."). ONLY the Title and the specified Author Name must be visible on the cover.
    The visual style should be suitable for the Korean market.
    
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
 * Generates an image using Gemini 3 Pro Image Preview.
 */
export const generateImage = async (prompt: string, aspectRatio: '3:4' | '4:3' = '3:4'): Promise<string> => {
  try {
    const ai = getAI();
    const response = await callWithRetry(() => ai.models.generateContent({
      model: IMAGE_MODEL,
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
      console.error("No candidates in image generation response");
      return "";
    }

    for (const part of response.candidates[0].content.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    console.warn("No inlineData found in image generation parts");
    return "";
  } catch (error) {
    console.error("Image generation failed:", error);
    return "";
  }
};