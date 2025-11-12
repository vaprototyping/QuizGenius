// functions/api/generate-quiz.ts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { text, quizType } = await request.json();

    const baseInstructions = `You are QuizGenius, a master educator who writes rigorous, unambiguous quizzes.
Focus exclusively on the supplied source material. Do not invent facts that are not supported by it.
Always include a brief explanation that teaches the key idea behind the answer.`;

    const typeInstructions = {
      mcq: `Create exactly five multiple-choice questions. Each question must have four plausible answer choices labelled as an array of strings.
Ensure only one option is correct and the remaining options are credible distractors drawn from the context.`,
      true_false: `Create exactly six true/false statements. Mix truths and misconceptions that can be validated by the context.
Set the answer field to either "True" or "False".`,
      open: `Create exactly five short-answer questions that require a concise response (1-3 sentences or a specific fact).
Answers should still be grounded in the context.`,
    }[quizType as "mcq" | "true_false" | "open"] ?? "";

    const formatInstructions = `Respond in valid JSON inside a markdown fenced code block labelled json.
Schema:
\n\n\n{
  "quiz": {
    "title": string,
    "description": string,
    "questions": [
      {
        "question": string,
        "options"?: string[],
        "answer": string,
        "explanation": string
      }
    ]
  }
}
\n\n\nKeep explanations concise (1-2 sentences). Use markdown only inside explanations if it aids clarity.`;

    const prompt = `Quiz type: ${quizType}\n\n${typeInstructions}\n\nSource material:\n"""\n${text}\n"""`;

    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: baseInstructions },
          { role: "user", content: `${prompt}\n\n${formatInstructions}` }
        ],
        temperature: 0.25,
        max_tokens: 1200
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
