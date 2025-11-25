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

## Configure the DeepSeek API key

Quiz generation requires a valid `DEEPSEEK_API_KEY` available to the Cloudflare Pages Function:

- **Cloudflare Pages:** In your project settings, add an environment variable named `DEEPSEEK_API_KEY` with your key value and redeploy. The function reads it from the Pages runtime `env` object.
- **Local development:** Export `DEEPSEEK_API_KEY` in your shell before running `npm run dev` (the function falls back to `process.env`).

If the key is missing or blank, the app returns the configuration error shown in the quiz screen.
