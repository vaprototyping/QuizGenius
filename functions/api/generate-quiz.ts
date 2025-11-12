// functions/api/generate-quiz.ts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { text, quizType } = await request.json();

    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You generate concise, unambiguous quizzes from textbook text." },
          { role: "user", content: `Type: ${quizType}\nText:\n${text}` }
        ],
        temperature: 0.2
      })
    });

    if (!r.ok) {
      const msg = await r.text();
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const data = await r.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
};
