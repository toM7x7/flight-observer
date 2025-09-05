import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { PERSONA_SYSTEM } from './persona';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
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

// Lightweight local command parser (fallback)
function quickCommand(message:string){
  try{
    const s=String(message||''); const lower=s.toLowerCase();
    const m=s.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if(m){ const lat=Number(m[1]), lon=Number(m[2]); if(Number.isFinite(lat)&&Number.isFinite(lon)) return { map_command:{ set_center:{lat,lon} } }; }
    const mr=s.match(/(?:radius|半径)\s*(\d{1,3})/i);
    if(mr){ const km=Math.max(5, Math.min(200, Number(mr[1]))); return { map_command:{ set_radius:{ km } } }; }
    if(/\bagl\b|地表|地面/i.test(s)) return { map_command:{ follow:{on:false} }, note:'agl' };
    if(/\bbaro\b|気圧/i.test(s)) return { map_command:{ follow:{on:false} }, note:'baro' };
    if(/\bgeo\b|gnss|衛星/i.test(s)) return { map_command:{ follow:{on:false} }, note:'geo' };
    if(/follow on|追従\s*on|追尾\s*on/i.test(s)) return { map_command:{ follow:{on:true} } };
    if(/follow off|追従\s*off|追尾\s*off/i.test(s)) return { map_command:{ follow:{on:false} } };
    return null;
  }catch{ return null; }
}

export default async function handler(req:VercelRequest, res:VercelResponse){
  try{
    const body = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    const { message, region, flight } = body || {};
    if (!message || String(message).trim()==='') return res.status(400).json({error:'message required'});

    // Fallback path when GEMINI key is missing
    if (!GEMINI_KEY){
      const q = quickCommand(String(message));
      if(q) return res.json({ text: '(local command)', map_command: q.map_command||null, select_flight: null, sources: [] });
      return res.json({ text: 'AI unavailable (set GEMINI_API_KEY). You can still use quick commands like "35.6,139.7" or "radius 50".', map_command: null, select_flight: null, sources: [], degraded:true });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const sys = [
      PERSONA_SYSTEM,
      '簡潔で正確な日本語で回答します。地図/選択操作は所定のJSONのみで返せます。',
      '{"map_command":{"set_center":{"lat":<num>,"lon":<num>}}} / {"map_command":{"adjust_center":{"north_km":<num>,"east_km":<num>}}} / {"map_command":{"set_radius":{"km":<num>}}} / {"map_command":{"follow":{"on":true|false}}}',
      '{"select_flight":{"by":"callsign","value":"JAL688","focus":true}} / {"select_flight":{"by":"index","value":1}}'
    ].join('\n');

    const ctx = [ sys, `\n<region>${JSON.stringify(region||{})}</region>`, `\n<flight>${JSON.stringify(flight||{})}</flight>`, `\nUser: ${message}` ].join('\n');

    const first = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{ role:'user', parts:[{text:ctx}] }] });
    const firstText = (first as any).text || '';

    let searchQ: string | null = null; let mapCommand:any = null; let selectFlight:any = null;
    try{ const maybe = JSON.parse(firstText.trim()); if(maybe?.search_web?.q) searchQ=maybe.search_web.q; if(maybe?.map_command) mapCommand=maybe.map_command; if(maybe?.select_flight) selectFlight=maybe.select_flight; }catch{}

    if (searchQ) {
      const results = await searchWeb(searchQ);
      const secondPrompt = [ PERSONA_SYSTEM, `Question: ${message}`, `Region: ${JSON.stringify(region||{})}`, flight ? `Flight: ${JSON.stringify(flight)}` : '', `Results(JSON): ${JSON.stringify(results)}` ].filter(Boolean).join('\n');
      const second = await ai.models.generateContent({ model:'gemini-2.5-flash', contents:[{role:'user', parts:[{text:secondPrompt}]}] });
      const text = (second as any).text || firstText;
      return res.json({ text, sources: results, map_command: null, select_flight: null });
    }

    return res.json({ text: firstText, sources: [], map_command: mapCommand||null, select_flight: selectFlight||null });
  }catch(e:any){ return res.status(200).json({ text:'(degraded: ask failed)', sources:[], map_command:null, select_flight:null, degraded:true }); }
}
