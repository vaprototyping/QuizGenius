// src/services/geminiService.ts
// This file now ONLY does client-side OCR using tesseract.js (no API keys in browser).

import { createWorker } from "tesseract.js";

// Minimal type aliases — keep your imports in App.tsx unchanged.
import type { Language, SubjectType } from "../types";

/**
 * Convert base64 (data URL) to a Blob so tesseract.js can read it.
 */
function dataURLToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Keyless OCR in the browser. Ignores language/subject for now (can be extended).
 */
export async function extractTextFromImage(
  base64Data: string,
  _mimeType: string,
  _lang: Language,
  _subject: SubjectType
): Promise<string> {
  const blob = dataURLToBlob(base64Data);

  const worker = await createWorker();
  // Load English by default; add more with worker.loadLanguage('eng+ita') etc.
  await worker.loadLanguage("eng");
  await worker.initialize("eng");

  const {
    data: { text },
  } = await worker.recognize(blob);

  await worker.terminate();
  return text?.trim() || "";
}

// IMPORTANT: Do NOT export any `generateQuiz` here.
// Quiz generation must go through your serverless endpoint (/api/generate-quiz).
