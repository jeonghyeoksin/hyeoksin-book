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
  outline: string[];
  chapters: Chapter[];
  coverPrompt?: string;
  coverImage?: string; // Base64 string
}

export enum AppStep {
  DASHBOARD = 0,
  TOPIC_SELECTION = 1,
  PLANNING = 2,
  WRITING = 3,
  COVER_DESIGN = 4,
  ILLUSTRATION = 5,
  REVIEW_DOWNLOAD = 6,
}

export interface GeneratedTopic {
  title: string;
  description: string;
}