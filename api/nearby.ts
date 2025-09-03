import type { VercelRequest, VercelResponse } from '@vercel/node';
let cache:{ts:number;data:any}={ts:0,data:null}; const CACHE_MS=60000;

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Access-Control-Allow-Origin','*');
  const lat=Number(req.query.lat),lon=Number(req.query.lon),radiusKm=Number(req.query.radius_km??50);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({error:'lat/lon required'});
  const now=Date.now(); if(!cache.data||now-cache.ts>CACHE_MS){ const r=await fetch('https://opensky-network.org/api/states/all'); cache={ts:now,data:await r.json()}; }
  const states=(cache.data?.states||[]).map((s:any[])=>({icao24:s[0],callsign:s[1]?.trim(),lon:s[5],lat:s[6],baro_alt:s[7],geo_alt:s[13],vel:s[9],hdg:s[10]}))
    .filter((p:any)=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
    .filter((p:any)=>haversine(lat,lon,p.lat,p.lon)<=radiusKm);
  return res.json({states,fetchedAt:new Date().toISOString()});
}
function haversine(lat1:number,lon1:number,lat2:number,lon2:number){const R=6371e3,rad=(x:number)=>x*Math.PI/180;
  const dlat=rad(lat2-lat1),dlon=rad(lon2-lon1); const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2; return (2*R*Math.asin(Math.sqrt(a)))/1000;}
