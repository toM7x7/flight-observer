import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple SWR cache
type Cache = { ts:number; data:any };
let cache: Cache = { ts:0, data:null };
const CACHE_MS = 60_000;

// Token cache for OpenSky OAuth2 (optional)
let tokenCache: { token?: string; exp?: number } = {};
async function getToken(){
  if (tokenCache.token && (tokenCache.exp||0) > Date.now()) return tokenCache.token;
  const id = process.env.OPENSKY_CLIENT_ID, secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return undefined; // anonymous fallback
  const r = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',{
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ grant_type:'client_credentials', client_id:id, client_secret:secret })
  });
  if (!r.ok) return undefined;
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + 25*60*1000 };
  return tokenCache.token;
}

// km → deg (approx)
const km2degLat = (km:number)=> km/111.132;
const km2degLon = (km:number, lat:number)=> km/(111.320*Math.cos(lat*Math.PI/180));

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  const lat=Number(req.query.lat), lon=Number(req.query.lon), radiusKm=Number(req.query.radius_km??50);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({error:'lat/lon required'});

  // Build bbox query for OpenSky
  const dLat = km2degLat(radiusKm);
  const dLon = km2degLon(radiusKm, lat);
  const params = new URLSearchParams({
    lamin: String(lat - dLat), lamax: String(lat + dLat),
    lomin: String(lon - dLon), lomax: String(lon + dLon)
  });

  // Serve stale quickly if available (up to 5x cache window)
  const now = Date.now();
  const staleOk = cache.data && (now - cache.ts) < 5*CACHE_MS;
  let served = false;
  if (staleOk) { served = true; res.setHeader('x-cache','HIT-stale'); res.json(cache.data); }

  const token = await getToken();
  const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Abort/timeouts for upstream calls
  const withTimeout = async (url:string, init:RequestInit={}, ms=6000)=>{
    const ac = new AbortController(); const id = setTimeout(()=>ac.abort(), ms);
    try { return await fetch(url, { ...init, signal: ac.signal }); }
    finally { clearTimeout(id); }
  };

  const fetchOnce = async ()=>{
    const url = `https://opensky-network.org/api/states/all?${params.toString()}`;
    const r = await withTimeout(url, { headers });
    if (!r.ok){
      const retry = r.headers.get('X-Rate-Limit-Retry-After-Seconds') || r.headers.get('Retry-After');
      const txt = await r.text();
      const err = new Error(`Upstream ${r.status} ${r.statusText} retry=${retry} body=${txt.slice(0,200)}`);
      (err as any).status = r.status; (err as any).retry = Number(retry||0);
      throw err;
    }
    const d = await r.json();
    const states = (d?.states||[]).map((s:any[])=>({
      icao24:s[0], callsign:s[1]?.trim(), lon:s[5], lat:s[6],
      baro_alt:s[7], geo_alt:s[13], vel:s[9], hdg:s[10], category:s[17]
    })).filter((p:any)=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    return { states, fetchedAt:new Date().toISOString() };
  };

  const MAX_TRY=3; let out:any=null; let delay=500;
  for(let i=0;i<MAX_TRY;i++){
    try { out = await fetchOnce(); break; }
    catch(e:any){ const ra = Number(e?.retry||0); await new Promise(r=>setTimeout(r, Math.max(ra*1000, delay))); delay*=2; }
  }
  // 1st path OK
  if (out){ cache = { ts: Date.now(), data: out }; if(!served){ res.setHeader('x-cache','MISS'); return res.json(out); } }

  // 2nd path fallback: try global feed and filter locally
  if (!out) {
    try {
      const r = await withTimeout('https://opensky-network.org/api/states/all');
      if (r.ok){
        const d = await r.json();
        const states = (d?.states||[]).map((s:any[])=>({
          icao24:s[0], callsign:s[1]?.trim(), lon:s[5], lat:s[6],
          baro_alt:s[7], geo_alt:s[13], vel:s[9], hdg:s[10]
        })).filter((p:any)=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
          .filter((p:any)=>haversineKm(lat,lon,p.lat,p.lon) <= radiusKm);
        out = { states, fetchedAt:new Date().toISOString(), degraded:true };
        cache = { ts: Date.now(), data: out };
        if(!served){ res.setHeader('x-cache','MISS-global'); return res.json(out); }
      }
    } catch {}
  }

  // 3rd path: graceful empty response (HTTP 200)
  if(!served){
    res.setHeader('x-cache','EMPTY');
    const debug = req.query.debug ? {
      bbox: Object.fromEntries(params),
      token: !!token,
      note: 'Upstream failed; returning empty set'
    } : undefined;
    return res.json({ states: [], fetchedAt:new Date().toISOString(), degraded:true, debug });
  }
}

function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){
  const R=6371e3,rad=(x:number)=>x*Math.PI/180;
  const dlat=rad(lat2-lat1),dlon=rad(lon2-lon1);
  const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2;
  return (2*R*Math.asin(Math.sqrt(a)))/1000;
}
