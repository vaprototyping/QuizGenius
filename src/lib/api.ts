import type { StudentProfile, SubjectKey } from '../../studyContext';
// src/lib/api.ts
export async function generateQuiz(
  ocrText: string,
  quizType: "mcq" | "true_false" | "open",
  numberOfQuestions: number,
  language: string,
  preferences: { mode: 'student' | 'parent'; subject: 'text' | 'math'; difficulty?: string; mathStyle?: string; studySubject: SubjectKey; customSubject?: string; studentProfile: StudentProfile },
  accessCode: string
) {
  const res = await fetch("/api/generate-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Quiz-Access-Code": accessCode },
    body: JSON.stringify({ text: ocrText, quizType, numberOfQuestions, language, ...preferences })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Generation failed");
  }

  return data.quiz;
}
