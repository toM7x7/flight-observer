import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { CONFIG } from './config.js';

// DOM helpers
const $ = (s)=>document.querySelector(s);
const c = $('#c');
const latI = $('#lat');
const lonI = $('#lon');
const radI = $('#radius');

$('#fetchBtn')?.addEventListener('click', refresh);
$('#toggleBtn')?.addEventListener('click', ()=>toggleView());
$('#startAR')?.addEventListener('click', startAR);

// Optional demo
document.getElementById('demoBtn')?.addEventListener('click', ()=> runDemo(3));

function runDemo(n=3){
  const lat=Number(latI.value), lon=Number(lonI.value);
  lastStates = genDemoStates({lat,lon}, n);
  $('#src').textContent=`source: demo | flights: ${lastStates.length}`;
  placeMarkers({lat,lon}, lastStates);
  selectedIdx = -1;
  renderList(lastStates);
  applySelectionEffects();
}

// Robust AR button state (fail-safe)
const startBtn = document.getElementById('startAR');
async function prepareARButton(){
  if(!startBtn) return;
  const disable = (msg)=>{ startBtn.disabled=true; startBtn.title=msg; startBtn.textContent = 'START AR (unavailable)'; };
  try{
    if (!window.isSecureContext){ disable('HTTPS required'); return; }
    if (!('xr' in navigator)){ disable('WebXR not supported'); return; }
    const ok = await navigator.xr?.isSessionSupported?.('immersive-ar');
    if (ok === false){ disable('immersive-ar unsupported'); return; }
    startBtn.disabled=false; startBtn.title='Start AR'; startBtn.textContent='START AR';
  }catch(e){ disable('AR init error: '+(e?.message||e)); }
}
prepareARButton();

// three.js basics
const renderer = new THREE.WebGLRenderer({canvas:c, antialias:true, alpha:true});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.01, 2000);
const grid = new THREE.GridHelper(1000, 40, 0x2a3a4d, 0x1a2735); grid.position.y = -1; scene.add(grid);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.0));
const markers = new THREE.Group(); scene.add(markers);
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// State
let lastStates = [];
let selectedIdx = -1;
let useAR = false;

// DOM Overlay handling (for AR chat overlay focus)
const overlayRoot = document.getElementById('overlay');
document.addEventListener('beforexrselect', (ev)=>{
  if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault();
}, true);
overlayRoot?.setAttribute('tabindex','-1');

// Labels
function makeLabel(text){
  const s=256; const cv=document.createElement('canvas'); cv.width=s; cv.height=s; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s);
  ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,s/2,s/2);
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(12,5.5,1); sp.renderOrder=999; sp.userData.baseScale={x:12,y:5.5}; return sp;
}
function updateLabelScales(){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const tmp=new THREE.Vector3(); for(const m of markers.children){ if(!m||!m.children) continue; m.getWorldPosition(tmp); const d=camPos.distanceTo(tmp); const s=THREE.MathUtils.clamp(1.2/Math.max(0.5,d),0.35,1.1); for(const ch of m.children){ if(ch&&ch.isSprite){ const base=ch.userData?.baseScale||{x:12,y:5.5}; ch.scale.set(base.x*s, base.y*s, 1); ch.renderOrder=999; } } } }

// Placement helpers
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function makeMarkerMesh({callsign,hdg}){ const g=new THREE.ConeGeometry(3,8,12), m=new THREE.MeshStandardMaterial({color:0xffc83d}); const mesh=new THREE.Mesh(g,m); mesh.rotation.x=-Math.PI/2; const label=makeLabel(callsign||'N/A'); label.position.set(0,5,0); mesh.add(label); const yaw=THREE.MathUtils.degToRad(hdg||0); mesh.rotation.z=-yaw; return mesh; }
function placeMarkers(center, flights){ markers.clear(); flights.forEach((f,i)=>{ const {x,y}=llDiffMeters(center.lat,center.lon,f.lat,f.lon); const m=makeMarkerMesh(f); m.userData.idx=i; m.position.set(x/10,0,y/10); markers.add(m); }); updateLabelScales(); }

// Presets (basic)
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
function applyPreset(idx){ const p=getPresets()[Number(idx)]; if(!p) return; document.getElementById('lat').value=String(p.lat); document.getElementById('lon').value=String(p.lon); document.getElementById('radius').value=String(p.radius); refresh(); }
document.getElementById('preset')?.addEventListener('change', (e)=>applyPreset(e.target.value));
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My Spot ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// Fetch + render
async function refresh(){
  const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
  const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
  try{
    console.log('fetch nearby:', url);
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    console.log('nearby resp:', j?.states?.length, j?.degraded?'degraded':'' , j?.debug||'');
    lastStates=j.states||[];
    $('#src').textContent=`source: opensky | flights: ${lastStates.length}`;
    placeMarkers({lat,lon}, lastStates);
    selectedIdx = -1;
    renderList(lastStates);
    applySelectionEffects();
    if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(e){
    console.error('fetch failed', e);
    alert('Live fetch failed. Falling back to DEMO (3 flights).');
    runDemo(3);
  }
}

function renderList(states){
  const box=$('#list'); if(!box) return;
  box.innerHTML='<h3>Flights</h3>' + (states||[]).map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join('');
  box.querySelectorAll('.item').forEach(el=>el.addEventListener('click',async()=>{
    const idx=Number(el.getAttribute('data-idx'));
    selectedIdx = (selectedIdx===idx ? -1 : idx);
    applySelectionEffects();
    const s=states[idx]; if(!s) return;
    const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon};
    try{ const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}); const {text}=await g.json(); appendLog(text||'(no response)'); }catch(e){ console.error('describe failed',e); }
  }));
}

function applySelectionEffects(){
  // markers
  markers.children.forEach((m)=>{ if(!m.isMesh) return; const on = (m.userData?.idx===selectedIdx); m.scale.setScalar(on?1.2:1.0); if(m.material?.color){ m.material.color.setHex(on?0x66d9ff:0xffc83d); } });
  // list selection
  document.querySelectorAll('#list .item').forEach(el=>{ const idx=Number(el.getAttribute('data-idx')); el.classList.toggle('selected', idx===selectedIdx); });
  // info panel
  const info=document.getElementById('info'); if(!info) return; if(selectedIdx<0){ info.innerHTML=''; return; }
  const s=lastStates[selectedIdx]; if(!s){ info.innerHTML=''; return; }
  const alt=Math.round(s.geo_alt??s.baro_alt??0); const spdKt=Math.round((s.vel??0)*1.94384); const hdg=Math.round(s.hdg??0);
  const title = s.callsign || '(unknown)';
  info.innerHTML = `<div class='card'>
    <div class='title'>${title}</div>
    <div class='row'>Alt: ${alt} m</div>
    <div class='row'>Spd: ${spdKt} kt</div>
    <div class='row'>Hdg: ${hdg}°</div>
  </div>`;
}

// Ask (region-first)
const askBtn=$('#ask');
if(askBtn) askBtn.onclick=async ()=>{
  const qEl=$('#q'); const speakEl=$('#speak');
  const q=(qEl?.value||'').trim(); if(!q){ appendLog('Please enter a question'); return; }
  const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) };
  const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined;
  try{
    const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })});
    const { text }=await g.json(); appendLog(text||'(no response)');
    if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); }
  }catch(e){ console.error('ask failed', e); appendLog('Error: '+(e?.message||e)); }
};
function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }

// AR (minimal)
let reticle=null; let hitTestSource=null; let viewerSpace=null;
async function startAR(){
  try{
    if(!navigator.xr){ alert('WebXR not supported by this browser'); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if(ok===false){ alert('immersive-ar not supported in this environment'); return; }
    let session;
    try{
      const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hit-test'], domOverlay:{ root: overlayRoot } };
      renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsStrict);
    }catch(_){
      const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hit-test'], domOverlay:{ root: overlayRoot } };
      renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsLoose);
    }
    await renderer.xr.setSession(session);

    // Controller models (optional visuals)
    try{ const factory=new XRControllerModelFactory(); const grip0=renderer.xr.getControllerGrip(0); grip0.add(factory.createControllerModel(grip0)); scene.add(grip0); const grip1=renderer.xr.getControllerGrip(1); grip1.add(factory.createControllerModel(grip1)); scene.add(grip1);}catch{}

    // Hit-test (if available)
    try{ if(session.requestReferenceSpace && session.requestHitTestSource){ viewerSpace=await session.requestReferenceSpace('viewer'); hitTestSource=await session.requestHitTestSource({ space: viewerSpace }); } }catch{}
    try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch{}

    useAR=true; animateAR(session);
    session.addEventListener('end', ()=>{ hitTestSource=null; viewerSpace=null; reticle=null; useAR=false; });
  }catch(e){ console.error('startAR failed', e); alert('Failed to start AR: '+(e?.message||e)); }
}

function animateAR(session){ const refSpace=renderer.xr.getReferenceSpace(); renderer.setAnimationLoop((t,frame)=>{ if(frame){ if(hitTestSource){ try{ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(refSpace); if(pose){ const p=pose.transform.position; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { if(reticle) reticle.visible=false; } }catch{} } } updateLabelScales(); renderer.render(scene,camera); }); }

// Demo data
function genDemoStates(center, n=6){
  const out=[]; for(let i=0;i<n;i++){
    const ang= (i/n)*Math.PI*2; const dkm= 2 + (i%3);
    const dlat = (dkm/111.132); const dlon = (dkm/(111.320*Math.cos(center.lat*Math.PI/180)));
    const lat = center.lat + Math.sin(ang)*dlat; const lon = center.lon + Math.cos(ang)*dlon;
    out.push({ callsign:`DEMO${i+1}`, lat, lon, geo_alt: 200+i*50, vel: 70+i*5, hdg: (ang*180/Math.PI)%360 });
  }
  return out;
}

// Kick-off
refresh();
