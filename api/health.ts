import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req:VercelRequest, res:VercelResponse){
  res.setHeader('Cache-Control','no-store');
  const out = {
    ok: true,
    now: new Date().toISOString(),
    env: {
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAivis: !!process.env.AIVIS_API_KEY,
      hasOpenSkyClient: !!process.env.OPENSKY_CLIENT_ID,
      hasOpenSkySecret: !!process.env.OPENSKY_CLIENT_SECRET,
      hasGoogleCSE: !!process.env.GOOGLE_API_KEY && !!process.env.GOOGLE_CSE_ID
    },
    version: 'diag-1'
  };
  return res.status(200).json(out);
}
