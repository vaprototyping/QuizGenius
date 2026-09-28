type QuizType = 'mcq' | 'true_false' | 'open';
type Locale = 'en' | 'nl' | 'it';
interface Env { DEEPSEEK_API_KEY?: string; OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string; QUIZ_ACCESS_CODE?: string }
type PagesFunction<T> = (context: { request: Request; env: T }) => Promise<Response>;
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
        new Set(question.options.map((value: string) => value.trim().toLowerCase())).size !== 4 ||
        !question.options.some((value: string) => value.trim() === question.answer.trim())))
      throw new Error('Invalid multiple choice options or answer.');
    if (type === 'true_false' && !['True', 'False'].includes(question.answer))
      throw new Error('Invalid true/false answer.');
  }
  return quiz;
}

async function generate(url: string, key: string, model: string, messages: unknown[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.25, max_tokens: 4000, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  const body: any = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Provider returned no content.');
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
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(input.difficulty) ? input.difficulty : 'Medium';
  const mathStyle = input.mathStyle === 'ApplicationProblems' ? 'application problems' : 'similar exercises';
  const languageName = ({ en: 'English', nl: 'Dutch', it: 'Italian' } as const)[language as Locale];
  const instructions = `Create an accurate study quiz grounded in the source. Respond ONLY with JSON: {"quiz":{"title":"...","questions":[{"question":"...","options":["..."],"answer":"...","explanation":"..."}]}}. Exactly ${count} questions. All visible prose in ${languageName}, except true/false answer values, which must be exactly "True" or "False". No unsupported facts. Every answer needs a concise teaching explanation. ${mode === 'parent' ? 'Use wording suitable for a parent to discuss with a child.' : 'Write for a student practicing independently.'} ${subject === 'math' ? `Create ${mathStyle} at ${difficulty.toLowerCase()} difficulty. Check mathematical answers carefully.` : ''} ${type === 'mcq' ? 'Each question needs exactly four distinct options and exactly one correct answer that matches an option verbatim.' : type === 'true_false' ? 'Use declarative statements, a mix of true and false. No options. Answer exactly True or False.' : 'Short-answer questions with concise model answers. No options.'}`;
  const messages = [{ role: 'system', content: instructions }, { role: 'user', content: `Source material:\n${text.trim()}` }];
  const providers = [
    env.DEEPSEEK_API_KEY?.trim() && { url: 'https://api.deepseek.com/chat/completions', key: env.DEEPSEEK_API_KEY.trim(), model: 'deepseek-chat' },
    env.OPENROUTER_API_KEY?.trim() && { url: 'https://openrouter.ai/api/v1/chat/completions', key: env.OPENROUTER_API_KEY.trim(), model: env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini' },
  ].filter(Boolean) as { url: string; key: string; model: string }[];
  if (!providers.length) return json({ error: 'Quiz generation is not configured.' }, 503);
  for (const provider of providers) {
    try {
      const content = await generate(provider.url, provider.key, provider.model, messages);
      return json({ quiz: parseQuiz(content, type, count) });
    } catch (error) {
      console.error('Quiz provider failed:', provider.url, error instanceof Error ? error.message : error);
    }
  }
  return json({ error: 'We could not create a reliable quiz right now. Please try again.' }, 502);
};
