import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { CONFIG } from './config.js';

// ---------- Minimal Hardening ----------
function surfaceError(msg){ try{ console.error(msg); const s=document.getElementById('src'); if(s) s.textContent = 'ERROR: see log'; const el=document.getElementById('log'); if(el){ el.innerHTML += `<div>${(msg?.message||msg||'error')}</div>`; el.scrollTop=el.scrollHeight; } }catch{} }
window.addEventListener('error', (e)=>surfaceError(e?.error||e?.message||'window.error'));
window.addEventListener('unhandledrejection', (e)=>surfaceError(e?.reason||'unhandledrejection'));

// ---------- DOM ----------
const $ = (s)=>document.querySelector(s);
const c = $('#c');
const latI = $('#lat');
const lonI = $('#lon');
const radI = $('#radius');
const altModeSel = $('#altMode');
const altScaleInp = $('#altScale');
const altScaleVal = $('#altScaleVal');
const groundElevInp = $('#groundElev');
const autoElevBtn = document.getElementById('autoElev');
const panSpeedInp = document.getElementById('panSpeed');
const panSpeedVal = document.getElementById('panSpeedVal');
const zoomSpeedInp = document.getElementById('zoomSpeed');
const zoomSpeedVal = document.getElementById('zoomSpeedVal');
const focusBtn = document.getElementById('focusBtn');
const followChk = document.getElementById('follow');
const overlayRoot = document.getElementById('overlay');
document.addEventListener('beforexrselect', (ev)=>{ if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault(); }, true);
overlayRoot?.setAttribute('tabindex','-1');

// ---------- three.js ----------
const renderer = new THREE.WebGLRenderer({canvas:c, antialias:true, alpha:true});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.01, 2000);
const grid = new THREE.GridHelper(1000, 40, 0x2a3a4d, 0x1a2735); grid.position.y = -1; scene.add(grid);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.0));
const markers = new THREE.Group(); scene.add(markers);
addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
function toggleView(){ grid.visible = !grid.visible; }

// ---------- State ----------
let lastStates = [];
let selectedIdx = -1;
let selectedKey = null;
let useAR = false;
let altMode = 'geo';
let altScale = 0.006;
let groundElev = 0;
let panSpeed = 1.0;
let zoomSpeed = 1.0;
const ALT_SCALE_BASE = 0.006;
let followMode = false;

// ---------- Helpers ----------
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function distKm(lat1,lon1,lat2,lon2){ const R=6371e3,rad=(x)=>x*Math.PI/180; const dlat=rad(lat2-lat1),dlon=rad(lon2-lon1); const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2; return (2*R*Math.asin(Math.sqrt(a)))/1000; }
function altitudeMeters(s){ const geo = Number.isFinite(s.geo_alt)? s.geo_alt : null; const baro = Number.isFinite(s.baro_alt)? s.baro_alt : null; if (altMode==='geo') return geo ?? baro ?? 0; if (altMode==='baro') return baro ?? geo ?? 0; const base = geo ?? baro ?? 0; return Math.max(0, base - groundElev); }
function makeBarMesh(height, color){ const h=Math.max(0.2, height); const r=0.6; const geo=new THREE.CylinderGeometry(r,r,h,12,1,true); geo.translate(0,h/2,0); const mat=new THREE.MeshStandardMaterial({color, transparent:true, opacity:0.95}); return new THREE.Mesh(geo,mat); }
function makeLabel(text){ const s=256; const cv=document.createElement('canvas'); cv.width=s; cv.height=s; const ctx=cv.getContext('2d'); ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text||'N/A',s/2,s/2); const tex=new THREE.CanvasTexture(cv); const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(12,5.5,1); sp.renderOrder=999; sp.userData.baseScale={x:12,y:5.5}; return sp; }
function makeMarkerMesh({callsign,alt_m}){ const height = alt_m * altScale; const color=0xffc83d; const bar=makeBarMesh(height,color); const g=new THREE.Group(); g.add(bar); const lab=makeLabel(callsign||'N/A'); lab.position.set(0,height+1.2,0); g.add(lab); return g; }
function placeMarkers(center, flights){ markers.clear(); flights.forEach((s,i)=>{ const {x,y}=llDiffMeters(center.lat,center.lon,s.lat,s.lon); const alt_m=altitudeMeters(s); const m=makeMarkerMesh({callsign:s.callsign, alt_m}); m.userData.idx=i; m.position.set(x/10,0,y/10); markers.add(m); }); }

// ---------- Presets ----------
const PRESETS_DEFAULT = [
  { name:'Haneda T1', lat:35.553972, lon:139.779978, radius:30 },
  { name:'Narita South', lat:35.757589, lon:140.383137, radius:30 },
  { name:'ITM Juso', lat:34.777094, lon:135.438095, radius:20 },
  { name:'Naha Senagajima', lat:26.183469, lon:127.646278, radius:25 },
  { name:'Centrair', lat:34.858333, lon:136.805278, radius:30 }
];
const PRESET_KEY='flightObserver.presets';
function getPresets(){ try{ return JSON.parse(localStorage.getItem(PRESET_KEY)||'[]').concat(PRESETS_DEFAULT);}catch{ return PRESETS_DEFAULT; } }
function renderPresetSelect(){ const sel=document.getElementById('preset'); if(!sel) return; sel.innerHTML=''; getPresets().forEach((p,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=p.name; sel.appendChild(o);}); }
function applyPreset(idx){ const p=getPresets()[Number(idx)]; if(!p) return; latI.value=String(p.lat); lonI.value=String(p.lon); radI.value=String(p.radius); refresh(); }
(function(){ const sel=document.getElementById('preset'); if(sel){ sel.addEventListener('change', ()=> applyPreset(sel.value)); }})();
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My Spot ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// ---------- Fetch + render ----------
let _refreshTimer=null;
function scheduleRefresh(ms=250){ clearTimeout(_refreshTimer); _refreshTimer=setTimeout(()=>refresh(),ms); }
async function refresh(){
  try{
    const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
    const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    lastStates=j.states||[];
    const src=document.getElementById('src'); if(src) src.textContent=`Source: opensky | Flights: ${lastStates.length}`;
    placeMarkers({lat,lon}, lastStates);
    renderList(lastStates);
    updateSelectionUI();
    if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(e){ surfaceError('Fetch failed; switching to DEMO'); runDemo(3); }
}
function renderList(states){ const box=document.getElementById('list'); if(!box) return; box.innerHTML='<h3>Flights</h3>' + (states||[]).map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join(''); box.querySelectorAll('.item').forEach(el=>el.addEventListener('click', async ()=>{ const idx=Number(el.getAttribute('data-idx')); selectedIdx = (selectedIdx===idx ? -1 : idx); const s=states[idx]; selectedKey = s?.icao24 || s?.callsign || null; updateSelectionUI(); if(!s) return; try{ const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon}; const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}); if(!g.ok){ const t=await g.text(); surfaceError('Summarization failed: '+t.slice(0,120)); return; } const {text}=await g.json(); appendLog(text||'(no response)'); }catch(e){ surfaceError('describe failed'); } })); }
function updateSelectionUI(){ document.querySelectorAll('#list .item').forEach(el=>{ const idx=Number(el.getAttribute('data-idx')); el.classList.toggle('selected', idx===selectedIdx); }); const info=document.getElementById('info'); if(!info){return;} if(selectedIdx<0){ info.innerHTML=''; return;} const s=lastStates[selectedIdx]; if(!s){ info.innerHTML=''; return;} const altV=Math.round(altitudeMeters(s)); const spdKt=Math.round((s.vel??0)*1.94384); const title=s.callsign||'(unknown)'; const dkm=distKm(Number(latI.value),Number(lonI.value),s.lat,s.lon).toFixed(1); info.innerHTML = `<div class='card'><div class='title'>${title}</div><div class='row'>Altitude: ${altV} m</div><div class='row'>Speed: ${spdKt} kt</div><div class='row'>Range: ${dkm} km</div></div>`; }

// ---------- Controls ----------
document.getElementById('fetchBtn')?.addEventListener('click', refresh);
document.getElementById('toggleBtn')?.addEventListener('click', ()=>toggleView());
document.getElementById('demoBtn')?.addEventListener('click', ()=> runDemo(3));
focusBtn?.addEventListener('click', ()=>{ if(selectedIdx<0) return; const s=lastStates[selectedIdx]; if(!s) return; latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0); });
followChk?.addEventListener('change', ()=>{ followMode = !!followChk.checked; });
altModeSel?.addEventListener('change', ()=>{ altMode = altModeSel.value||'geo'; placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
altScaleInp?.addEventListener('input', ()=>{ altScale = Number(altScaleInp.value)||ALT_SCALE_BASE; if(altScaleVal){ const r=altScale/ALT_SCALE_BASE; altScaleVal.textContent = `x${r.toFixed(2)}`; } placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
autoElevBtn?.addEventListener('click', async ()=>{ try{ const lat=Number(latI.value), lon=Number(lonI.value); const r=await fetch(`/api/elevation?lat=${lat}&lon=${lon}`); const j=await r.json(); if(Number.isFinite(j?.elevation)){ groundElev = j.elevation; if(groundElevInp) groundElevInp.value=String(Math.round(groundElev)); placeMarkers({lat,lon}, lastStates); updateSelectionUI(); appendLog(`Ground elevation set to ${Math.round(groundElev)} m.`); } else { appendLog('Failed to get ground elevation'); } }catch(e){ appendLog('Error getting ground elevation'); } });
panSpeedInp?.addEventListener('input', ()=>{ panSpeed = Number(panSpeedInp.value)||1; if(panSpeedVal) panSpeedVal.textContent = `x${panSpeed.toFixed(1)}`; });
zoomSpeedInp?.addEventListener('input', ()=>{ zoomSpeed = Number(zoomSpeedInp.value)||1; if(zoomSpeedVal) zoomSpeedVal.textContent = `x${zoomSpeed.toFixed(1)}`; });

// ---------- Ask ----------
const askBtn=$('#ask');
if(askBtn) askBtn.onclick=async ()=>{
  const qEl=$('#q'); const speakEl=$('#speak');
  const q=(qEl?.value||'').trim(); if(!q){ appendLog('Please enter a question'); return; }
  if(applyQuickVoiceCommand(q)) return;
  askBtn.disabled=true;
  const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) };
  const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined;
  try{
    const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })});
    if(!g.ok){ const t=await g.text(); appendLog('Ask failed: '+t); return; }
    const resp=await g.json(); const text=resp?.text||'';
    if(resp?.map_command) try{ applyMapCommand(resp.map_command);}catch{}
    if(resp?.select_flight) try{ applySelectFlight(resp.select_flight);}catch{}
    appendLog(text||'(no response)');
    if(speakEl?.checked && text){ const tts=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await tts.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); }
  }catch(e){ surfaceError('ask failed'); }
  finally{ askBtn.disabled=false; }
};

function applyMapCommand(cmd){ try{
  if(cmd.set_center){ const {lat,lon}=cmd.set_center; if(Number.isFinite(lat)&&Number.isFinite(lon)){ latI.value=String(lat); lonI.value=String(lon); scheduleRefresh(0); return; } }
  if(cmd.adjust_center){ const {north_km=0,east_km=0}=cmd.adjust_center; const lat0=Number(latI.value), lon0=Number(lonI.value); const dlat = north_km/111.132; const dlon = east_km/(111.320*Math.cos(lat0*Math.PI/180)); latI.value=String(lat0 + dlat); lonI.value=String(lon0 + dlon); scheduleRefresh(0); return; }
  if(cmd.set_radius){ const {km}=cmd.set_radius; if(Number.isFinite(km)){ radI.value=String(km); scheduleRefresh(0); return; } }
  if(cmd.follow){ followMode = !!cmd.follow.on; if(followChk) followChk.checked=followMode; }
}catch(e){ console.warn('map_command failed', e); }
}
function applySelectFlight(sel){ try{
  const by=(sel?.by||'').toLowerCase(); const v=sel?.value; let idx=-1;
  if(by==='index' && Number.isFinite(v)){ idx = Math.max(0, Math.min(lastStates.length-1, Number(v))); }
  else if(by==='callsign' && typeof v==='string'){ const tgt=String(v||'').replace(/\s+/g,'').toUpperCase(); idx = lastStates.findIndex(s=> String(s.callsign||'').replace(/\s+/g,'').toUpperCase()===tgt ); }
  if(idx>=0){ selectedIdx=idx; const s=lastStates[idx]; selectedKey = s?.icao24 || s?.callsign || null; updateSelectionUI(); }
}catch(e){ console.warn('select_flight failed', e); }
}

// ---------- Quick Commands (typed or STT) ----------
function applyQuickVoiceCommand(text){ try{
  const s=String(text||''); const lower=s.toLowerCase();
  const m=s.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); if(m){ const lat=Number(m[1]), lon=Number(m[2]); if(Number.isFinite(lat)&&Number.isFinite(lon)){ latI.value=String(lat); lonI.value=String(lon); scheduleRefresh(0); return true; } }
  const mr = s.match(/(?:radius|半径)\s*(\d{1,3})/i); if(mr){ const r=Math.max(5, Math.min(200, Number(mr[1]))); radI.value=String(r); scheduleRefresh(0); return true; }
  if(/\bagl\b|地表|地面/i.test(s)){ altMode='agl'; altModeSel && (altModeSel.value='agl'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  if(/\bbaro\b|気圧/i.test(s)){ altMode='baro'; altModeSel && (altModeSel.value='baro'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  if(/\bgeo\b|gnss|衛星/i.test(s)){ altMode='geo'; altModeSel && (altModeSel.value='geo'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  if(/follow on|追従\s*on|追尾\s*on/i.test(s)){ followMode=true; if(followChk) followChk.checked=true; return true; }
  if(/follow off|追従\s*off|追尾\s*off/i.test(s)){ followMode=false; if(followChk) followChk.checked=false; return true; }
  const ps = getPresets(); const norm=(x)=>String(x||'').toLowerCase();
  for(let i=0;i<ps.length;i++){ if(lower.includes(norm(ps[i].name))){ const p=ps[i]; latI.value=String(p.lat); lonI.value=String(p.lon); radI.value=String(p.radius); scheduleRefresh(0); return true; } }
  return false;
}catch{ return false; }}

// ---------- AR (minimal) ----------
const startBtn = document.getElementById('startAR');
async function prepareARButton(){ if(!startBtn) return; const disable = (msg)=>{ startBtn.disabled=true; startBtn.title=msg; startBtn.textContent='Start AR'; }; try{ if (!window.isSecureContext){ disable('HTTPS required'); return; } if (!('xr' in navigator)){ disable('WebXR not supported'); return; } const ok = await navigator.xr?.isSessionSupported?.('immersive-ar'); if (ok === false){ disable('immersive-ar not supported'); return; } startBtn.disabled=false; startBtn.title='Start AR'; startBtn.textContent='Start AR'; }catch(e){ disable('AR not available'); } }
prepareARButton();

let reticle=null; let hitTestSource=null; let viewerSpace=null;
async function startAR(){ try{ if(!navigator.xr){ alert('WebXR not supported'); return; } const ok = await navigator.xr.isSessionSupported?.('immersive-ar'); if(ok===false){ alert('immersive-ar not supported'); return; } let session; try{ const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hit-test'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsStrict);}catch(_){ const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hit-test'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsLoose); } await renderer.xr.setSession(session); try{ const factory=new XRControllerModelFactory(); const grip0=renderer.xr.getControllerGrip(0); grip0.add(factory.createControllerModel(grip0)); scene.add(grip0); const grip1=renderer.xr.getControllerGrip(1); grip1.add(factory.createControllerModel(grip1)); scene.add(grip1);}catch{} try{ if(session.requestReferenceSpace && session.requestHitTestSource){ viewerSpace=await session.requestReferenceSpace('viewer'); hitTestSource=await session.requestHitTestSource({ space: viewerSpace }); } }catch{} try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch{} useAR=true; renderer.setAnimationLoop((t,frame)=>{ if(frame && hitTestSource){ try{ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(renderer.xr.getReferenceSpace()); if(pose){ const p=pose.transform.position; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { if(reticle) reticle.visible=false; } }catch{} } renderer.render(scene,camera); }); session.addEventListener('end', ()=>{ hitTestSource=null; viewerSpace=null; reticle=null; useAR=false; }); }catch(e){ alert('Failed to start AR: '+(e?.message||e)); } }
document.getElementById('startAR')?.addEventListener('click', startAR);

// ---------- DEMO ----------
function genDemoStates(center, n=6){ const out=[]; for(let i=0;i<n;i++){ const ang=(i/n)*Math.PI*2; const dkm= 2 + (i%3); const dlat=(dkm/111.132); const dlon=(dkm/(111.320*Math.cos(center.lat*Math.PI/180))); const lat=center.lat+Math.sin(ang)*dlat; const lon=center.lon+Math.cos(ang)*dlon; out.push({ icao24:`demo${i}`, callsign:`DEMO${i+1}`, lat, lon, geo_alt: 200+i*50, vel: 70+i*5, hdg: (ang*180/Math.PI)%360 }); } return out; }
function runDemo(n=3){ const lat=Number(latI.value), lon=Number(lonI.value); lastStates = genDemoStates({lat,lon}, n); const src=document.getElementById('src'); if(src) src.textContent=`Source: demo | Flights: ${lastStates.length}`; placeMarkers({lat,lon}, lastStates); selectedIdx = -1; renderList(lastStates); updateSelectionUI(); }

// ---------- Boot ----------
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
refresh();
// retry binding a few times to recover from slow paints
(function bootstrapRetries(){ let n=0; const t=setInterval(()=>{ try{ renderPresetSelect(); prepareARButton(); }catch{} if(++n>=3) clearInterval(t); }, 1200); })();

