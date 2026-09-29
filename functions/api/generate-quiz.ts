import { SUBJECT_KEYS, SUBJECT_NAMES, SubjectKey } from '../../studyContext';
type QuizType = 'mcq' | 'true_false' | 'open';
type Locale = 'en' | 'nl' | 'it';
interface Env { DEEPSEEK_API_KEY?: string; OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string; QUIZ_ACCESS_CODE?: string }
type PagesFunction<T> = (context: { request: Request; env: T }) => Promise<Response>;
type FailureCode = 'credits_exhausted' | 'rate_limited' | 'authentication' | 'request_rejected' |
  'timeout' | 'provider_unavailable' | 'network' | 'invalid_response' | 'output_truncated' | 'unknown';
type Attempt = { provider: 'DeepSeek' | 'OpenRouter'; code: FailureCode; status?: number };
class ProviderFailure extends Error {
  constructor(public code: FailureCode, public status?: number, message: string = code) { super(message); }
}
function classifyStatus(status: number): FailureCode {
  if (status === 402) return 'credits_exhausted';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'authentication';
  if (status === 408 || status === 504 || status === 524) return 'timeout';
  if (status >= 500) return 'provider_unavailable';
  return 'request_rejected';
}
function classifyFailure(error: unknown): { code: FailureCode; status?: number; detail: string } {
  if (error instanceof ProviderFailure) return { code: error.code, status: error.status, detail: error.message };
  if (error instanceof SyntaxError || (error instanceof Error && /quiz structure|question|options|answer/i.test(error.message)))
    return { code: 'invalid_response', detail: error instanceof Error ? error.message : 'Invalid model output' };
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    return { code: 'timeout', detail: 'Request timed out' };
  if (error instanceof TypeError) return { code: 'network', detail: 'Provider connection failed' };
  return { code: 'unknown', detail: error instanceof Error ? error.message : 'Unknown provider failure' };
}
const errorMessages: Record<FailureCode | 'providers_failed', string> = {
  credits_exhausted: 'The AI provider has insufficient credits. Please check its balance or configure the fallback.',
  rate_limited: 'The AI provider is receiving too many requests. Please try again shortly.',
  authentication: 'The AI provider rejected its configured API key. Please check the server settings.',
  request_rejected: 'The AI provider rejected the request. Please check the model configuration.',
  timeout: 'The AI provider took too long to respond. Please try again.',
  provider_unavailable: 'The AI provider is temporarily unavailable. Please try again.',
  network: 'The server could not reach the AI provider. Please try again.',
  invalid_response: 'The AI returned a quiz that did not pass validation. Please try again or choose fewer questions.',
  output_truncated: 'The AI response was incomplete. Please try fewer questions.',
  unknown: 'Quiz generation failed unexpectedly. Please try again.',
  providers_failed: 'The AI providers failed for different reasons. See the diagnostic details below.',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

function parseQuiz(content: string, type: QuizType, count: number) {
  const data = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  const quiz = data.quiz ?? data;
  if (typeof quiz?.title !== 'string' || !Array.isArray(quiz.questions) || quiz.questions.length !== count)
    throw new Error('Invalid quiz structure or count.');
  for (const question of quiz.questions) {
    if (typeof question.question !== 'string' || !question.question.trim() ||
        typeof question.answer !== 'string' || !question.answer.trim() ||
        typeof question.explanation !== 'string' || !question.explanation.trim())
      throw new Error('Missing question, answer, or explanation.');
    if (type === 'mcq' && (!Array.isArray(question.options) || question.options.length !== 4 ||
        question.options.some((value: unknown) => typeof value !== 'string' || !value.trim()) ||
        new Set(question.options.map((value: string) => value.trim().toLowerCase())).size !== 4))
      throw new Error('Invalid multiple choice options or answer.');
    if (type === 'mcq') {
      const answer = question.answer.trim();
      const matched = question.options.find((option: string) => option.trim().toLowerCase() === answer.toLowerCase());
      const letter = /^[A-D][.)]?$/i.test(answer) ? answer[0].toUpperCase().charCodeAt(0) - 65 : -1;
      const resolved = matched ?? (letter >= 0 ? question.options[letter] : undefined);
      if (!resolved) throw new Error('Invalid multiple choice answer.');
      question.answer = resolved;
    }
    if (type === 'true_false') {
      const normalized = question.answer.trim().toLowerCase();
      if (['true', 'waar', 'vero'].includes(normalized)) question.answer = 'True';
      else if (['false', 'onwaar', 'falso'].includes(normalized)) question.answer = 'False';
      else throw new Error('Invalid true/false answer.');
    }
  }
  return quiz;
}

async function generate(url: string, key: string, model: string, messages: unknown[], count: number) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.25, max_tokens: Math.min(7500, Math.max(2500, count * 450)), response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new ProviderFailure(classifyStatus(response.status), response.status, `HTTP ${response.status}`);
  const body: any = await response.json();
  if (body?.choices?.[0]?.finish_reason === 'length') throw new ProviderFailure('output_truncated', undefined, 'Token limit reached');
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ProviderFailure('invalid_response', undefined, 'Provider returned no quiz content');
  return content;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.QUIZ_ACCESS_CODE?.trim()) return json({ error: 'Access is not configured.' }, 503);
  if (request.headers.get('X-Quiz-Access-Code') !== env.QUIZ_ACCESS_CODE.trim())
    return json({ error: 'Incorrect access code.' }, 401);
  let input: any;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const { text, numberOfQuestions: count, quizType: type, language } = input ?? {};
  if (typeof text !== 'string' || text.trim().length < 50 || text.length > 24000 ||
      !Number.isInteger(count) || count < 1 || count > 15 ||
      !['mcq', 'true_false', 'open'].includes(type) || !['en', 'nl', 'it'].includes(language))
    return json({ error: 'Please provide 50 to 24,000 characters of study material and valid quiz options.' }, 400);
  const mode = input.mode === 'parent' ? 'parent' : 'student';
  const subject = input.subject === 'math' ? 'math' : 'text';
  if (!SUBJECT_KEYS.includes(input.studySubject) ||
      !Number.isInteger(input.studentProfile?.age) || input.studentProfile.age < 5 || input.studentProfile.age > 99 ||
      !['primary', 'middle', 'high', 'college'].includes(input.studentProfile.schoolType) ||
      !Number.isInteger(input.studentProfile.year) || input.studentProfile.year < 1 || input.studentProfile.year > 8 ||
      (input.studySubject === 'other' && (typeof input.customSubject !== 'string' ||
        !/^[^\x00-\x1f\x7f]{2,80}$/.test(input.customSubject.trim()))))
    return json({ error: 'Please choose a subject and provide a valid student age, school type, and year.' }, 400);
  const studySubject = input.studySubject === 'other' ? input.customSubject.trim() : SUBJECT_NAMES[input.studySubject as SubjectKey];
  const { age, schoolType, year } = input.studentProfile;
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(input.difficulty) ? input.difficulty : 'Medium';
  const mathStyle = input.mathStyle === 'ApplicationProblems' ? 'application problems' : 'similar exercises';
  const languageName = ({ en: 'English', nl: 'Dutch', it: 'Italian' } as const)[language as Locale];
  const instructions = `Create an accurate study quiz grounded in the source. Respond ONLY with JSON: {"quiz":{"title":"...","questions":[{"question":"...","options":["..."],"answer":"...","explanation":"..."}]}}. Exactly ${count} questions. All visible prose in ${languageName}, except true/false answer values, which must be exactly "True" or "False". No unsupported facts. Every answer needs a concise teaching explanation. Subject: ${studySubject}. Learner: age ${age}, ${schoolType} school, year ${year} of that school type. Match the vocabulary, sentence length, examples and reasoning demands to this learner. School systems differ: use the stated age and school type together and do not infer a senior level from the year number alone. Keep the source facts accurate and do not introduce advanced ideas beyond the material unless explaining a term briefly. ${mode === 'parent' ? 'Use wording suitable for a parent to discuss with this learner.' : 'Write for this student practicing independently.'} ${subject === 'math' ? `Create ${mathStyle} at ${difficulty.toLowerCase()} difficulty appropriate to the learner. Check mathematical answers carefully.` : ''} ${type === 'mcq' ? 'Each question needs exactly four distinct options and exactly one correct answer that matches an option verbatim.' : type === 'true_false' ? 'Use declarative statements, a mix of true and false. No options. Answer exactly True or False.' : 'Short-answer questions with concise model answers. No options.'}`;
  const messages = [{ role: 'system', content: instructions }, { role: 'user', content: `Source material:\n${text.trim()}` }];
  const providers = [
    env.DEEPSEEK_API_KEY?.trim() && { name: 'DeepSeek' as const, url: 'https://api.deepseek.com/chat/completions', key: env.DEEPSEEK_API_KEY.trim(), model: 'deepseek-chat' },
    env.OPENROUTER_API_KEY?.trim() && { name: 'OpenRouter' as const, url: 'https://openrouter.ai/api/v1/chat/completions', key: env.OPENROUTER_API_KEY.trim(), model: env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini' },
  ].filter(Boolean) as { name: Attempt['provider']; url: string; key: string; model: string }[];
  if (!providers.length) return json({ error: 'Quiz generation is not configured.', code: 'not_configured' }, 503);
  const requestId = crypto.randomUUID().slice(0, 8);
  const attempts: Attempt[] = [];
  for (const provider of providers) {
    try {
      const content = await generate(provider.url, provider.key, provider.model, messages, count);
      return json({ quiz: parseQuiz(content, type, count) });
    } catch (error) {
      const failure = classifyFailure(error);
      attempts.push({ provider: provider.name, code: failure.code, ...(failure.status ? { status: failure.status } : {}) });
      console.error('quiz_generation_attempt_failed', { requestId, provider: provider.name, code: failure.code, status: failure.status, detail: failure.detail });
    }
  }
  const code = attempts.every(attempt => attempt.code === attempts[0].code) ? attempts[0].code : 'providers_failed';
  return json({ error: errorMessages[code], code, requestId, attempts, fallbackConfigured: Boolean(env.OPENROUTER_API_KEY?.trim()) }, 502);
};
