# Deploying (Vercel)

## Environment Variables

Set these in Vercel → Project Settings → Environment Variables:

- `GEMINI_API_KEY`: Google Generative AI
- `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`: (Optional) Web search
- `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`: (Optional) OpenSky OAuth2
- `AIVIS_API_KEY`, `AIVIS_BASE_URL` (default: https://api.aivis-project.com)
- `AIVIS_MODEL_UUID` (default is embedded in `config.js`)

## Headers / Permissions

`vercel.json` already sets:

- `Permissions-Policy: microphone=(self), xr-spatial-tracking=(self)`
- `X-Content-Type-Options: nosniff`

## Local Development

1. Copy `.env.example` to `.env.local` and fill in values
2. `npm i`
3. `vercel dev`

