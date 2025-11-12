// src/lib/api.ts
export async function generateQuiz(ocrText: string, quizType: "mcq" | "true_false" | "open") {
  const res = await fetch("/api/generate-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: ocrText, quizType })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Generation failed");
  }
  // DeepSeek (OpenAI-compatible) response shape:
  return data.choices?.[0]?.message?.content ?? "";
}
