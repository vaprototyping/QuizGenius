// src/services/geminiService.ts
// This file now ONLY does client-side OCR using tesseract.js (no API keys in browser).

import { createWorker } from "tesseract.js";

// Minimal type aliases — keep your imports in App.tsx unchanged.
import type { Language, SubjectType } from "../types";

/**
 * Convert a base64 string (with or without data URL metadata) to a Blob so
 * tesseract.js can read it reliably.
 */
function base64ToBlob(data: string, fallbackMime: string): Blob {
  let mime = fallbackMime || "image/png";
  let base64 = data;

  if (data.startsWith("data:")) {
    const [meta, body] = data.split(",");
    if (!body) throw new Error("Invalid data URL: missing base64 payload");
    base64 = body;
    const metaMatch = meta.match(/data:(.*?);base64/);
    if (metaMatch?.[1]) mime = metaMatch[1];
  }

  const normalized = base64.replace(/\s/g, "");
  if (!normalized) throw new Error("No base64 data to decode");

  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const binary = atob(padded);

  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = binary.charCodeAt(i);

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
  const blob = base64ToBlob(base64Data, _mimeType);

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
