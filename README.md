<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1nepcrLpqlK4VzU9UHmQPthl92k_OaBLB

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Configure server secrets (Cloudflare Pages)

Set these in the Cloudflare Pages project settings, for both Production and Preview environments where needed:

| Variable | Purpose |
| --- | --- |
| `QUIZ_ACCESS_CODE` | Shared MVP access code. Required. Set a new private value; never put it in the repository. |
| `DEEPSEEK_API_KEY` | Primary quiz provider. |
| `OPENROUTER_API_KEY` | Backup provider, used when the primary fails or returns an invalid quiz. |
| `OPENROUTER_MODEL` | Optional backup model ID; defaults to `openai/gpt-4o-mini`. |

At least one provider key is required. Redeploy after setting the variables. Do not expose them with the `VITE_` prefix. The browser sends the entered access code to the server; the server checks it for both access verification and quiz generation.

This shared code is a temporary invitation gate. It is not an account system or a usage cap. Anyone with the code can generate unlimited quizzes, so keep provider spending limits in place until quotas are implemented.

The app accepts up to five images or one PDF/DOCX. Images use browser OCR in the selected source language; PDFs need selectable text (scanned PDFs are not OCRed). Generated quizzes use the selected interface language. Open answers are reviewed against model answers without an automatic percentage score.

For local end-to-end testing of Pages Functions, use the Cloudflare Pages development runtime with the secrets configured locally. Plain `vite` serves the UI only and does not implement `/api/*`.

If the key is missing or blank, the app returns the configuration error shown in the quiz screen.
