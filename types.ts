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
  pageCount: string; // "AI추천", "20", "30", "50", "100", "150", "200"
  outline: string[];
  chapters: Chapter[];
  coverPrompt?: string;
  coverImage?: string; // Base64 string
}

export enum AppStep {
  DASHBOARD = 0,
  TOPIC_SELECTION = 1,
  AUDIENCE_SETTING = 2,
  PLANNING = 3,
  WRITING = 4,
  COVER_DESIGN = 5,
  ILLUSTRATION = 6,
  REVIEW_DOWNLOAD = 7,
}

export interface GeneratedTopic {
  title: string;
  description: string;
}