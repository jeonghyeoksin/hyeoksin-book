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