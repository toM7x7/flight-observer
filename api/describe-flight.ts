import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req:VercelRequest,res:VercelResponse){
  try{
    const body = typeof req.body==='string'? JSON.parse(req.body): req.body;
    const f = body?.flight || {};
    const system = [
      'あなたは航空ファン向けの解説者です。',
      '30秒で伝わる要点要約を日本語で出力し、最後に「見分けのコツ」を1つ付けます。'
    ].join('\n');
    const user = `対象:
- 便名/コールサイン: ${f.callsign??'不明'}
- 高度: ${Math.round(f.alt_m??0)} m / 速度: ${Math.round((f.vel_ms??0)*1.94384)} kt
- 方位: ${Math.round(f.hdg_deg??0)}° / 距離: ${Math.round(f.distance_km??0)} km`;

    const out = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: [{ role:'user', parts:[{ text: system+'\n\n'+user }] }]
    });
    res.setHeader('Content-Type','application/json');
    return res.status(200).send({ text: out.text });
  }catch(e:any){ return res.status(500).send({error:e?.message||'gemini failed'}); }
}
