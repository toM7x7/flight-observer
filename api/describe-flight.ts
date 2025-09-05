import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { PERSONA_SYSTEM } from './persona';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const f = (body?.flight || {}) as any;

    const callsign = String(f.callsign || '').trim() || '(unknown)';
    const alt = Math.round(Number(f.alt_m ?? 0));
    const velKt = Math.round(Number((f.vel_ms ?? 0) * 1.94384));
    const hdg = Math.round(Number(f.hdg_deg ?? 0));
    const loc = (Number.isFinite(f.lat) && Number.isFinite(f.lon)) ? `位置: lat ${f.lat}, lon ${f.lon}` : '';

    const prompt = [
      PERSONA_SYSTEM,
      '以下の機体の状況を1〜2文で簡潔に日本語で要約してください。',
      `コールサイン: ${callsign}`,
      `高度: ${alt} m`,
      `速度: ${velKt} kt`,
      `方位: ${hdg}°`,
      loc
    ].filter(Boolean).join('\n');

    const out = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = (out as any).text || '';
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'describe_failed' });
  }
}

