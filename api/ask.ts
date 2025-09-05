import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { PERSONA_SYSTEM } from './persona';

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
      PERSONA_SYSTEM,
      'あなたは現地ガイドAIとして、簡潔で正確な日本語で回答します。',
      '機体未選択のときは region{lat,lon,radius_km} から「今の空の見どころ」を要約して良い。',
      '最新性が必要な場合は、次のJSONのみを単独で返してください: {"search_web":{"q":"<検索語>"}}',
      '地図操作の音声/テキスト指示が含まれる場合は、次のいずれかのJSONのみを単独で返してください:',
      '{"map_command":{"set_center":{"lat":<num>,"lon":<num>}}} | {"map_command":{"adjust_center":{"north_km":<num>,"east_km":<num>}}} | {"map_command":{"set_radius":{"km":<num>}}} | {"map_command":{"follow":{"on":true|false}}}',
      'フライト選択の指示が含まれる場合は、次のJSONのみを単独で返してください:',
      '{"select_flight":{"by":"callsign","value":"JAL688","focus":true,"follow":false}} | {"select_flight":{"by":"index","value":1}}',
    ].join('\n');

    const ctx = [
      sys,
      `\n<region>${JSON.stringify(region||{})}</region>`,
      `\n<flight>${JSON.stringify(flight||{})}</flight>`,
      `\nUser: ${message}`
    ].join('\n');

    const first = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{ role:'user', parts:[{text:ctx}] }] });
    const firstText = (first as any).text || '';

    let searchQ: string | null = null; let mapCommand:any = null; let selectFlight:any = null;
    try {
      const maybe = JSON.parse(firstText.trim());
      if (maybe && maybe.search_web && typeof maybe.search_web.q === 'string') searchQ = maybe.search_web.q;
      if (maybe && maybe.map_command) mapCommand = maybe.map_command;
      if (maybe && maybe.select_flight) selectFlight = maybe.select_flight;
    } catch {}

    if (searchQ) {
      const results = await searchWeb(searchQ);
      const secondPrompt = [
        PERSONA_SYSTEM,
        '以下の検索結果を踏まえて最新の回答を作成してください。',
        `質問: ${message}`,
        `地域: ${JSON.stringify(region||{})}`,
        flight ? `機体: ${JSON.stringify(flight)}` : '',
        `検索結果(JSON): ${JSON.stringify(results)}`,
        '回答の最後に根拠URLを1〜3件、文末に列挙してください。'
      ].filter(Boolean).join('\n');

      const second = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{role:'user', parts:[{text:secondPrompt}]}] });
      const text = (second as any).text || firstText;
      return res.json({ text, sources: results, map_command: null, select_flight: null });
    }

    return res.json({ text: firstText, sources: [], map_command: mapCommand||null, select_flight: selectFlight||null });
  }catch(e:any){ return res.status(500).json({error:e?.message||'ask_failed'}); }
}
