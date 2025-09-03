import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';

const BASE = process.env.AIVIS_BASE_URL || 'https://api.aivis-project.com';
const KEY  = process.env.AIVIS_API_KEY!;

export default async function handler(req:VercelRequest,res:VercelResponse){
  try{
    const body = typeof req.body==='string'? JSON.parse(req.body): req.body;
    const { text, model_uuid, use_ssml=true } = body || {};
    if(!text || !model_uuid) return res.status(400).json({error:'text and model_uuid required'});

    const upstream = await fetch(`${BASE.replace(/\/$/,'')}/v1/tts/synthesize`,{
      method:'POST',
      headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ model_uuid, text, use_ssml, output_format:'mp3', leading_silence_seconds:0 })
    });
    if(!upstream.ok){ const msg=await upstream.text(); return res.status(upstream.status).send(msg); }

    res.setHeader('Content-Type','audio/mpeg'); res.setHeader('Cache-Control','no-store');
    // Node Readable <- Web ReadableStream （Vercel Functions はストリーミング対応）
    // @ts-expect-error: node18+
    Readable.fromWeb(upstream.body).pipe(res);
  }catch(e:any){ return res.status(500).json({error:e?.message||'tts failed'}); }
}
