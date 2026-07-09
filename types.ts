export interface Chapter {
  id: number;
  title: string;
  content: string;
  imagePrompt?: string;
  imageData?: string; // Base64 string
}

export interface EBookState {
  topic: string;
  targetAudience: string;
  title: string;
  author: string;
  authorExpertise: string;
  bookStyle: string; // Add bookStyle for topic selection
  referenceContent?: string; // Optional reference content for topic selection
  pageCount: string; // "AI추천", "20", "30", "50", "100", "150", "200"
  toneAndManner: string;
  coreMessage: string;
  outcomePromise?: string;   // 독자가 얻는 변화/약속 (예: "보고서 디자인을 30분 만에 끝낼 수 있다")
  readerPainPoint?: string;  // 독자의 핵심 고민/페인포인트
  coverTheme?: string;       // 표지 무드/컬러 키 ('auto' | 'red' | 'green' | ...)
  coverLayout?: string;      // 표지 레이아웃 키 ('auto' | 'band' | 'fullbleed' | 'minimal' | 'magazine')
  referenceCoverImage?: string; // 참고 표지 이미지 (Base64, 업로드 시 화풍/색감 참고용)
  titleHookStyle?: string;   // 제목 후킹 스타일 ('' = AI추천 | 'number' | 'question' | 'empathy' | 'confident')
  outline: string[];
  chapters: Chapter[];
  coverPrompt?: string;
  coverImage?: string; // Base64 string
  generateIllustrations: boolean;
}

export enum AppStep {
  DASHBOARD = 0,
  TOPIC_SELECTION = 1,
  TITLE_GENERATION = 2,
  AUDIENCE_SETTING = 3,
  PLANNING = 4,
  WRITING = 5,
  COVER_DESIGN = 6,
  ILLUSTRATION = 7,
  REVIEW_DOWNLOAD = 8,
}

export interface GeneratedTopic {
  title: string;
  description: string;
}