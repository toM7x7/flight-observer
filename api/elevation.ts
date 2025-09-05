import type { VercelRequest, VercelResponse } from '@vercel/node';

async function withTimeout(url:string, init:RequestInit={}, ms=6000){
  const ac = new AbortController(); const id = setTimeout(()=>ac.abort(), ms);
  try{ return await fetch(url, { ...init, signal: ac.signal }); }
  finally{ clearTimeout(id); }
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({error:'lat/lon required'});
  // Try OpenTopodata (SRTM90m)
  try{
    const u = new URL('https://api.opentopodata.org/v1/srtm90m');
    u.searchParams.set('locations', `${lat},${lon}`);
    const r = await withTimeout(u.toString());
    if (r.ok){ const j=await r.json(); const e=j?.results?.[0]?.elevation; if(Number.isFinite(e)) return res.json({ elevation: Math.round(e) }); }
  }catch{}
  // Fallback: Open-Elevation
  try{
    const u = new URL('https://api.open-elevation.com/api/v1/lookup');
    u.searchParams.set('locations', `${lat},${lon}`);
    const r = await withTimeout(u.toString());
    if (r.ok){ const j=await r.json(); const e=j?.results?.[0]?.elevation; if(Number.isFinite(e)) return res.json({ elevation: Math.round(e) }); }
  }catch{}
  return res.status(502).json({ error:'elevation_unavailable' });
}

