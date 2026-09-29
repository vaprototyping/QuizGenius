import type { StudentProfile, SubjectKey } from '../../studyContext';
// src/lib/api.ts
export type QuizAttempt = { provider: 'DeepSeek' | 'OpenRouter'; code: string; status?: number };
export class QuizApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: string,
    public readonly attempts: QuizAttempt[] = [],
    public readonly fallbackConfigured?: boolean
  ) {
    super(message);
    this.name = 'QuizApiError';
  }
}

export async function generateQuiz(
  ocrText: string,
  quizType: "mcq" | "true_false" | "open",
  numberOfQuestions: number,
  language: string,
  preferences: { mode: 'student' | 'parent'; subject: 'text' | 'math'; difficulty?: string; mathStyle?: string; studySubject: SubjectKey; customSubject?: string; studentProfile: StudentProfile },
  accessCode: string
) {
  let res: Response;
  try {
    res = await fetch("/api/generate-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Quiz-Access-Code": accessCode },
    body: JSON.stringify({ text: ocrText, quizType, numberOfQuestions, language, ...preferences })
    });
  } catch {
    throw new QuizApiError('Could not reach the quiz server.', 'network');
  }

  let data: any;
  try { data = await res.json(); }
  catch { throw new QuizApiError('The quiz server returned an unreadable response.', 'invalid_server_response'); }
  if (!res.ok || data.error) {
    throw new QuizApiError(data.error || 'Generation failed', data.code || 'unknown', data.requestId, data.attempts || [], data.fallbackConfigured);
  }

  return data.quiz;
}
