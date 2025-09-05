import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { PERSONA_SYSTEM } from './persona';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req:VercelRequest,res:VercelResponse){
  try{
    const body = typeof req.body==='string'? JSON.parse(req.body): req.body;
    const f = body?.flight || {};
    const prompt = [
      PERSONA_SYSTEM,
      '以下の機体について、やさしい要点解説を作成してください。',
      '出力: 一言サマリ → 箇条書き3〜5項目 → 最後に「見どころ」1行。',
      '対象データ:',
      - コールサイン: ,
      - 高度:  m,
      - 速度:  kt,
      - 方位: °,
      f.lat&&f.lon? - 位置: lat , lon  : ''
    ].filter(Boolean).join('\n');

    const out = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: [{ role:'user', parts:[{ text: prompt }] }]
    });
    res.setHeader('Content-Type','application/json');
    return res.status(200).send({ text: (out as any).text });
  }catch(e:any){ return res.status(500).send({error:e?.message||'gemini failed'}); }
}

