export enum Language {
  English = 'English',
  Spanish = 'Spanish',
  French = 'French',
  German = 'German',
  Chinese = 'Chinese',
  Japanese = 'Japanese',
  Korean = 'Korean',
}

export enum SubjectType {
  Text = 'Text',
  Math = 'Math',
}

export enum QuizType {
  MultipleChoice = 'Multiple Choice',
  TrueFalse = 'True/False',
  Open = 'Open Ended',
}

export enum MathQuizType {
  SimilarExercises = 'Similar Exercises',
  ApplicationProblems = 'Application Problems',
}

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
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

export interface TextQuizOptions {
  subjectType: SubjectType.Text;
  numberOfQuestions: number;
  quizType: QuizType;
  language: Language;
}

export interface MathQuizOptions {
  subjectType: SubjectType.Math;
  numberOfQuestions: number;
  mathQuizType: MathQuizType;
  difficulty: Difficulty;
  language: Language;
}

export type QuizOptions = TextQuizOptions | MathQuizOptions;

// Add global declaration for KaTeX auto-render function
declare global {
  interface Window {
    renderMathInElement?: (element: HTMLElement, options?: any) => void;
  }
}
