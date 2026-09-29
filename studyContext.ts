export const SUBJECT_GROUPS = [
  { key: 'languages', subjects: ['languageArts', 'english', 'dutch', 'italian', 'foreignLanguages', 'literature'] },
  { key: 'science', subjects: ['biology', 'chemistry', 'physics', 'generalScience', 'earthScience', 'computerScience'] },
  { key: 'math', subjects: ['mathematics', 'statistics'] },
  { key: 'humanities', subjects: ['history', 'geography', 'civics', 'economics', 'philosophy', 'religion'] },
  { key: 'otherGroup', subjects: ['business', 'art', 'music', 'health', 'other'] },
] as const;

export const SUBJECT_KEYS = SUBJECT_GROUPS.flatMap(group => group.subjects);
export type SubjectKey = (typeof SUBJECT_KEYS)[number];
export type SchoolType = 'primary' | 'middle' | 'high' | 'college';
export type StudentProfile = { age: number | null; schoolType: SchoolType | ''; year: number | null };

export const SUBJECT_NAMES: Record<SubjectKey, string> = {
  languageArts: 'Language arts', english: 'English language', dutch: 'Dutch language', italian: 'Italian language',
  foreignLanguages: 'Foreign languages', literature: 'Literature', biology: 'Biology', chemistry: 'Chemistry',
  physics: 'Physics', generalScience: 'General science', earthScience: 'Earth science', computerScience: 'Computer science',
  mathematics: 'Mathematics', statistics: 'Statistics', history: 'History', geography: 'Geography',
  civics: 'Civics', economics: 'Economics', philosophy: 'Philosophy', religion: 'Religion',
  business: 'Business studies', art: 'Art', music: 'Music', health: 'Health education', other: 'Other subject',
};
