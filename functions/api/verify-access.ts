interface Env { QUIZ_ACCESS_CODE?: string }
type PagesFunction<T> = (context: { request: Request; env: T }) => Promise<Response>;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.QUIZ_ACCESS_CODE?.trim()) return new Response(null, { status: 503 });
  let code: unknown;
  try { code = (await request.json() as { code?: unknown }).code; }
  catch { return new Response(null, { status: 400 }); }
  return new Response(null, { status: code === env.QUIZ_ACCESS_CODE.trim() ? 204 : 401 });
};
