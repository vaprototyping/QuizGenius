export enum QuizType {
  MultipleChoice = 'Multiple Choice',
  TrueFalse = 'True/False',
  Open = 'Open Questions',
}

export enum Language {
  English = 'English',
  Dutch = 'Dutch',
  Italian = 'Italian',
}

export interface Question {
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  type: QuizType;
}

export interface Quiz {
  title: string;
  questions: Question[];
}

// Global declaration for pdfjsLib from CDN
declare const pdfjsLib: any;
