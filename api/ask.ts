import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || '';
const CSE_ID = process.env.GOOGLE_CSE_ID || '';

async function searchWeb(q:string){
  if (!GOOGLE_KEY || !CSE_ID) return [] as any[];
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_KEY);
  url.searchParams.set('cx', CSE_ID);
  url.searchParams.set('q', q);
  url.searchParams.set('num', '5');
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items||[]).map((it:any)=>({title:it.title, link:it.link, snippet:it.snippet, displayLink:it.displayLink}));
}

export default async function handler(req:VercelRequest, res:VercelResponse){
  try{
    const body = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    const { message, region, flight } = body || {};
    if (!message || String(message).trim()==='') return res.status(400).json({error:'message required'});

    const sys = [
      'あなたは航空ファン向けの「現地ガイドAI」です。',
      '日本語で簡潔・正確に答え、必要なら最新情報を検索し、出典URLを付けます。',
      '機体が未選択のときは region{lat,lon,radius_km} から今の空の見どころを要約して良い。',
      '検索が必要な場合は、次のJSONのみを1行で返してください: {"search_web":{"q":"<検索語>"}}',
    ].join('\n');

    const ctx = [
      sys,
      `\n<region>${JSON.stringify(region||{})}</region>`,
      `\n<flight>${JSON.stringify(flight||{})}</flight>`,
      `\nUser: ${message}`
    ].join('\n');

    const first = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{ role:'user', parts:[{text:ctx}] }] });
    const firstText = (first as any).text || '';

    // Try to detect search request protocol
    let searchQ: string | null = null;
    try {
      const maybe = JSON.parse(firstText.trim());
      if (maybe && maybe.search_web && typeof maybe.search_web.q === 'string') searchQ = maybe.search_web.q;
    } catch {}

    if (searchQ) {
      const results = await searchWeb(searchQ);
      const secondPrompt = [
        '以下の検索結果を踏まえて最新の回答を作ってください。',
        `質問: ${message}`,
        `地域: ${JSON.stringify(region||{})}`,
        flight ? `機体: ${JSON.stringify(flight)}` : '',
        `検索結果(JSON): ${JSON.stringify(results)}`,
        '回答には根拠となるURLを2〜3件、文末に列挙してください。'
      ].filter(Boolean).join('\n');

      const second = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{role:'user', parts:[{text:secondPrompt}]}] });
      const text = (second as any).text || firstText;
      return res.json({ text, sources: results });
    }

    // No search needed, return first answer
    return res.json({ text: firstText, sources: [] });
  }catch(e:any){ return res.status(500).json({error:e?.message||'ask_failed'}); }
}

