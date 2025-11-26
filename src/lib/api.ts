// src/lib/api.ts
export async function generateQuiz(
  ocrText: string,
  quizType: "mcq" | "true_false" | "open",
  numberOfQuestions: number
) {
  const res = await fetch("/api/generate-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: ocrText, quizType, numberOfQuestions })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Generation failed");
  }

  // The serverless function returns OpenAI-compatible JSON.
  // We'll return the raw content and let the caller parse/shape it.
  return data.choices?.[0]?.message?.content ?? "";
}
