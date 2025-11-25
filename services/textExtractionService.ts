// src/services/textExtractionService.ts
// This file now ONLY does client-side OCR using tesseract.js (no API keys in browser).

import { createWorker } from "tesseract.js";

// Minimal type aliases — keep your imports in App.tsx unchanged.
import type { Language, SubjectType } from "../types";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function fileToBase64(file: File): Promise<string> {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

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

async function extractTextFromPdf(file: File, pageLimit = 15): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error("PDF parser is not available in this browser.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  if (pdf.numPages > pageLimit) {
    throw new Error(`PDF exceeds the ${pageLimit}-page limit.`);
  }

  const extractedPages: string[] = [];
  const totalPages = Math.min(pdf.numPages, pageLimit);

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    if (pageText.trim()) {
      extractedPages.push(pageText.trim());
    }
  }

  return extractedPages.join("\n\n").trim();
}

async function extractTextFromDocx(file: File): Promise<string> {
  const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("The DOCX file is missing its main document content.");
  }

  const documentXml = await documentFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, "application/xml");
  const textNodes = Array.from(xmlDoc.getElementsByTagName("w:t"));
  const text = textNodes.map((node) => node.textContent ?? "").join(" ");

  return text.replace(/\s+/g, " ").trim();
}

function mapFileToCategory(file: File): "image" | "pdf" | "docx" {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === DOCX_MIME) return "docx";
  return "image";
}

export async function extractTextFromUploads(
  files: File[],
  lang: Language,
  subject: SubjectType
): Promise<string> {
  const textChunks: string[] = [];

  for (const file of files) {
    const category = mapFileToCategory(file);

    if (category === "image") {
      const base64 = await fileToBase64(file);
      const text = await extractTextFromImage(base64, file.type, lang, subject);
      if (text) {
        textChunks.push(text.trim());
      }
    }

    if (category === "pdf") {
      const text = await extractTextFromPdf(file);
      if (text) {
        textChunks.push(text.trim());
      }
    }

    if (category === "docx") {
      const text = await extractTextFromDocx(file);
      if (text) {
        textChunks.push(text.trim());
      }
    }
  }

  return textChunks.join("\n\n").trim();
}

export function isDocxMime(type: string): boolean {
  return type === DOCX_MIME;
}

// IMPORTANT: Do NOT export any `generateQuiz` here.
// Quiz generation must go through your serverless endpoint (/api/generate-quiz).
