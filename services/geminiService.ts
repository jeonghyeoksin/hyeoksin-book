import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Model Constants
const TEXT_MODEL = 'gemini-3.1-pro-preview';
const IMAGE_MODEL = 'gemini-3.0-pro-nanobanana';

/**
 * Helper to get a fresh GoogleGenAI instance with the current API key.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY || '';
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
    
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
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
    2. **모든 제안된 주제의 '제목'에는 반드시 입력된 키워드 "${keyword}"가 포함되어야 합니다.**
    3. 첨부파일이 있다면 해당 파일의 내용(이미지, 텍스트 등)을 적극적으로 반영하여 주제를 선정해주세요.
    
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
    },
  }));

  return JSON.parse(response.text || "[]");
};

/**
 * Generates a book outline (chapters).
 */
export const generateOutline = async (title: string, audience: string): Promise<string[]> => {
  const prompt = `
    전자책 제목: "${title}"
    예상 독자: "${audience}"
    
    이 전자책을 위한 체계적이고 논리적인 목차(챕터 제목) 15~20개를 생성해주세요. 
    [중요] 전체 분량이 A4 50페이지 이상이 되어야 하므로, 주제를 아주 세분화하여 많은 챕터를 구성해야 합니다.
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
       - **텍스트 강조 스타일 가이드**:
         - 중요 텍스트(핵심 키워드 등)는 [IMPORTANT]텍스트[/IMPORTANT] 형식으로 감싸주세요. (빨간색 볼드 처리 예정)
         - 강조 텍스트(부연 설명 중 강조 등)는 [EMPHASIS]텍스트[/EMPHASIS] 형식으로 감싸주세요. (파란색 볼드 처리 예정)
         - 꼭 강조할 문장(명언, 핵심 문장 등)은 [HIGHLIGHT]문장[/HIGHLIGHT] 형식으로 감싸주세요. (노란색 배경 처리 예정)
         - 위 태그들을 적절히 섞어서 가독성 좋게 작성하세요.
    
    4. **형식**: 완성된 산문 형태의 줄글로 작성하세요.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 4096 },
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
    3. DO NOT include any text related to the target audience (e.g. "for beginners", "target: ..."). Only the Title and Author (if provided) should be visible.
    The visual style should be suitable for the Korean market.
    
    Output: Just the English prompt string.
  `;

  const ai = getAI();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
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
        }
      }
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    return "";
  } catch (error) {
    console.error("Image generation failed:", error);
    return "";
  }
};