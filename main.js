import * as THREE from 'three';


// ---- Minimal hardening: global error surface + bootstrap retries ----
function surfaceError(msg){ try{ console.error(msg); appendLog(typeof msg==='string'? msg : (msg?.message||String(msg))); const s=document.getElementById('src'); if(s) s.textContent = 'ERROR: see log'; }catch{} }
window.addEventListener('error', (e)=>{ surfaceError(e?.error||e?.message||'window.error'); });
window.addEventListener('unhandledrejection', (e)=>{ surfaceError(e?.reason||'unhandledrejection'); });
(function bootstrapRetries(){ let n=0; const t=setInterval(()=>{ try{ renderPresetSelect(); prepareARButton(); }catch{} if(++n>=3) clearInterval(t); }, 1200); })();
import * as THREE from 'three';


  const q=(qEl?.value||'').trim(); if(!q){ appendLog('Please enter a question'); return; }
  if(applyQuickVoiceCommand(q)) { try{ setMicState('idle'); }catch{} return; }
  askBtn.disabled=true; try{ setMicState('replying'); }catch{}
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { CONFIG } from './config.js';

// DOM helpers
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

// Buttons
document.getElementById('fetchBtn')?.addEventListener('click', refresh);
document.getElementById('toggleBtn')?.addEventListener('click', ()=>toggleView());
document.getElementById('startAR')?.addEventListener('click', startAR);
document.getElementById('demoBtn')?.addEventListener('click', ()=> runDemo(3));

// AR button state (fail-safe)
const startBtn = document.getElementById('startAR');
async function prepareARButton(){
  if(!startBtn) return;
  const disable = (msg)=>{ startBtn.disabled=true; startBtn.title=msg; startBtn.textContent='Start AR'; };
  try{
    if (!window.isSecureContext){ disable('HTTPS is required'); return; }
    if (!('xr' in navigator)){ disable('WebXR not supported'); return; }
    const ok = await navigator.xr?.isSessionSupported?.('immersive-ar');
    if (ok === false){ disable('immersive-ar not supported'); return; }
    startBtn.disabled=false; startBtn.title='Start AR'; startBtn.textContent='Start AR';
  }catch(e){ disable('Failed to prepare AR button: '+(e?.message||e)); }
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
addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
function toggleView(){ grid.visible = !grid.visible; }

// State
let lastStates = [];
let selectedIdx = -1;
let useAR = false;
let altMode = 'geo';
let altScale = 0.006;
let groundElev = 0;
let panSpeed = 1.0;
let zoomSpeed = 1.0;
const ALT_SCALE_BASE = 0.006;
let followMode = false;
let selectedKey = null; // icao24 or callsign

// DOM Overlay handling
const overlayRoot = document.getElementById('overlay');
document.addEventListener('beforexrselect', (ev)=>{ if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault(); }, true);
overlayRoot?.setAttribute('tabindex','-1');

// ------------------------------
// Helpers and core rendering
// ------------------------------
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function distKm(lat1,lon1,lat2,lon2){ const R=6371e3,rad=(x)=>x*Math.PI/180; const dlat=rad(lat2-lat1),dlon=rad(lon2-lon1); const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2; return (2*R*Math.asin(Math.sqrt(a)))/1000; }
function bearingDeg(lat1,lon1,lat2,lon2){ const rad=(x)=>x*Math.PI/180,deg=(x)=>x*180/Math.PI; const y=Math.sin(rad(lon2-lon1))*Math.cos(rad(lat2)); const x=Math.cos(rad(lat1))*Math.sin(rad(lat2))-Math.sin(rad(lat1))*Math.cos(rad(lat2))*Math.cos(rad(lon2-lon1)); return (deg(Math.atan2(y,x))+360)%360; }

function altitudeMeters(s){ const geo = Number.isFinite(s.geo_alt)? s.geo_alt : null; const baro = Number.isFinite(s.baro_alt)? s.baro_alt : null; if (altMode==='geo') return geo ?? baro ?? 0; if (altMode==='baro') return baro ?? geo ?? 0; const base = geo ?? baro ?? 0; return Math.max(0, base - groundElev); }
const ALT_MODE_HUE = { geo: 120/360, baro: 210/360, agl: 30/360 };
function altitudeColor(alt){ const t = THREE.MathUtils.clamp(alt/8000,0,1); const base = ALT_MODE_HUE[altMode] ?? (200/360); const range = 60/360; const h = base - t*range; const s=0.8, l=0.55; const col=new THREE.Color(); col.setHSL(h,s,l); return col.getHex(); }
function makeBarMesh(height, color){ const h=Math.max(0.2, height); const r=0.6; const geo=new THREE.CylinderGeometry(r,r,h,12,1,true); geo.translate(0,h/2,0); const mat=new THREE.MeshStandardMaterial({color, transparent:true, opacity:0.95}); return new THREE.Mesh(geo,mat); }
function makeMarkerMesh({callsign,alt_m}){ const color=altitudeColor(alt_m); const height = alt_m * altScale; const bar=makeBarMesh(height, color); const group=new THREE.Group(); group.add(bar); const label=makeLabel(callsign||'N/A'); label.position.set(0,height+1.2,0); group.add(label); return group; }
function placeMarkers(center, flights){ markers.clear(); try{ if(centerPin) markers.add(centerPin); if(guideLine) markers.add(guideLine);}catch{} (flights||[]).forEach((s,i)=>{ const {x,y}=llDiffMeters(center.lat,center.lon,s.lat,s.lon); const alt_m=altitudeMeters(s); const m=makeMarkerMesh({callsign:s.callsign, alt_m}); m.userData.idx=i; m.userData.alt_m=alt_m; m.position.set(x/10,0,y/10); markers.add(m); }); updateLabelScales(); }
function getMarkerObjectByIndex(idx){ for(const o of markers.children){ if(o?.userData?.idx===idx) return o; } return null; }
function findIndexByKey(list, key){ if(!key) return -1; let i=list.findIndex(s=>s.icao24===key); if(i<0) i=list.findIndex(s=>s.callsign===key); return i; }

// Labels
function makeLabel(text){ const s=256; const cv=document.createElement('canvas'); cv.width=s; cv.height=s; const ctx=cv.getContext('2d'); ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,s/2,s/2); const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(12,5.5,1); sp.renderOrder=999; sp.userData.baseScale={x:12,y:5.5}; return sp; }
function updateLabelScales(){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const tmp=new THREE.Vector3(); for(const m of markers.children){ if(!m||!m.children) continue; m.getWorldPosition(tmp); const d=camPos.distanceTo(tmp); const s=THREE.MathUtils.clamp(1.2/Math.max(0.5,d),0.35,1.1); for(const ch of m.children){ if(ch&&ch.isSprite){ const base=ch.userData?.baseScale||{x:12,y:5.5}; ch.scale.set(base.x*s, base.y*s, 1); ch.renderOrder=999; } } } }

// Presets
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
(function(){ const sel=document.getElementById('preset'); if(sel){ sel.addEventListener('change', ()=> applyPreset(sel.value)); }})();
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My Spot ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// Fetch + render
let _refreshTimer = null;
function scheduleRefresh(ms=250){ clearTimeout(_refreshTimer); _refreshTimer = setTimeout(()=>refresh(), ms); }

async function refresh(){
  try{
    const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
    const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    lastStates=j.states||[];
    // keep selection by key if present
    if(selectedKey){ const i1=lastStates.findIndex(s=>s.icao24===selectedKey || s.callsign===selectedKey); if(i1>=0) selectedIdx=i1; }
    const clat=Number(latI.value), clon=Number(lonI.value);
    const src=document.getElementById('src'); if(src) src.textContent=`Source: opensky | Flights: ${lastStates.length}`;
    placeMarkers({lat:clat,lon:clon}, lastStates);
    renderList(lastStates);
    updateSelectionUI();
    if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(e){ console.error('refresh failed', e); try{ alert('Fetch failed. Switching to DEMO (3).'); }catch(_){} runDemo(3); }
}

function renderList(states){ const box=document.getElementById('list'); if(!box) return; box.innerHTML='<h3>Flights</h3>' + (states||[]).map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join(''); box.querySelectorAll('.item').forEach(el=>el.addEventListener('click', async ()=>{ const idx=Number(el.getAttribute('data-idx')); selectedIdx = (selectedIdx===idx ? -1 : idx); const s=states[idx]; selectedKey = s?.icao24 || s?.callsign || null; updateSelectionUI(); if(!s) return; try{ const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon}; const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}); if(!g.ok){ const t=await g.text(); appendLog('Summarization failed: '+t.slice(0,200)); return; } const {text}=await g.json(); appendLog(text||'(no response)'); if(useAR && text) try{ showARText(text); }catch{} }catch(e){ console.warn('describe failed', e); appendLog('Summarization error: '+(e?.message||e)); } })); }

function updateSelectionUI(){
  // markers highlight
  markers.children.forEach((m)=>{ if(!m.isMesh) return; const on = (m.userData?.idx===selectedIdx); m.scale.setScalar(on?1.2:1.0); if(m.material?.color){ m.material.color.setHex(on?0x66d9ff:0xffc83d); } });
  // list selection
  document.querySelectorAll('#list .item').forEach(el=>{ const idx=Number(el.getAttribute('data-idx')); el.classList.toggle('selected', idx===selectedIdx); });
  // info + guide
  const info=document.getElementById('info'); if(!info) return; if(selectedIdx<0){ info.innerHTML=''; if(guideLine) guideLine.visible=false; return; }
  const s=lastStates[selectedIdx]; if(!s){ info.innerHTML=''; if(guideLine) guideLine.visible=false; return; }
  const altV=Math.round(altitudeMeters(s)); const spdKt=Math.round((s.vel??0)*1.94384); const hdg=Math.round(s.hdg??0);
  const clat=Number(latI.value), clon=Number(lonI.value); const dkm=distKm(clat,clon,s.lat,s.lon); const brg=Math.round(bearingDeg(clat,clon,s.lat,s.lon));
  const title = s.callsign || '(unknown)';
  info.innerHTML = `<div class='card'>
    <div class='title'>${title}</div>
    <div class='row'>Altitude: ${altV} m</div>
    <div class='row'>Speed: ${spdKt} kt</div>
    <div class='row'>Heading (true): ${hdg}ﾂｰ</div>
    <div class='row'>Distance/Bearing (from center): ${dkm.toFixed(1)} km / ${brg}ﾂｰ</div>
  </div>`;
  ensureGuideLine(); const m = [...markers.children].find(o=>o?.userData?.idx===selectedIdx); if (m && guideLine){ const arr=guideLine.geometry.attributes.position.array; arr[0]=0;arr[1]=0;arr[2]=0; arr[3]=m.position.x; arr[4]=0; arr[5]=m.position.z; guideLine.geometry.attributes.position.needsUpdate=true; guideLine.computeLineDistances?.(); guideLine.visible=true; }
}
// Center pin and guide line
let centerPin; try{ centerPin=new THREE.Mesh(new THREE.RingGeometry(0.25,0.35,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x66d9ff, transparent:true, opacity:0.9, side:THREE.DoubleSide})); centerPin.position.y=0.01; markers.add(centerPin);}catch{}
let guideLine=null; function ensureGuideLine(){ if(guideLine) return; const geo=new THREE.BufferGeometry(); const pos=new Float32Array([0,0,0, 0,0,0]); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); const mat=new THREE.LineDashedMaterial({color:0x66d9ff, dashSize:0.25, gapSize:0.15}); guideLine=new THREE.Line(geo,mat); guideLine.computeLineDistances(); guideLine.visible=false; markers.add(guideLine); }

// HUD for AR
const raycaster = new THREE.Raycaster();
let hud=null, hudFocus=null, hudFollow=null, hudAsk=null, dirArrow=null;
let hudRPlus=null, hudRMinus=null, hudNorth=null, hudSouth=null, hudEast=null, hudWest=null;
let hudBg=null, hudPin=null, hudPlace=null, hudMic=null; // new controls
let hudReadoutRadius=null, hudReadoutScale=null, hudReadoutPan=null, hudReadoutAlt=null, hudReadoutFollow=null, hudReadoutPreset=null, hudReadoutSel=null; // readouts
let hudPresetPrev=null, hudPresetNext=null, hudPresetGo=null; let hudPresetIndex=0;
let hudPinned=false, hudInitPlaced=false, hudDragging=false, hudDragCtrl=null, hudDragFromPlace=false, hudDragStartTime=0;
const interactiveTargets=[];
function makeHudButton(text, w=0.14, h=0.06){
  const cvs=document.createElement('canvas'); cvs.width=256; cvs.height=128; const ctx=cvs.getContext('2d');
  ctx.fillStyle='#22303a'; ctx.fillRect(0,0,256,128);
  ctx.strokeStyle='#4b6a84'; ctx.lineWidth=4; ctx.strokeRect(2,2,252,124);
  ctx.fillStyle='#cfe8ff'; ctx.font='bold 40px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,64);
  const tex=new THREE.CanvasTexture(cvs); const mat=new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide});
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat);
}
function makeArrow(){
  const cvs=document.createElement('canvas'); cvs.width=128; cvs.height=128; const ctx=cvs.getContext('2d');
  ctx.clearRect(0,0,128,128); ctx.fillStyle='#66d9ff'; ctx.beginPath(); ctx.moveTo(64,8); ctx.lineTo(110,120); ctx.lineTo(64,96); ctx.lineTo(18,120); ctx.closePath(); ctx.fill();
  const tex=new THREE.CanvasTexture(cvs); return new THREE.Mesh(new THREE.PlaneGeometry(0.08,0.08), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
}
function ensureHUD(){ if(hud) return; hud=new THREE.Group();
  // background board (single panel)
  const bgGeo=new THREE.PlaneGeometry(0.90, 0.38, 1, 1);
  const bgMat=new THREE.MeshBasicMaterial({color:0x1a2735, transparent:true, opacity:0.9});
  hudBg=new THREE.Mesh(bgGeo, bgMat); hudBg.position.set(0,0,-0.001); hudBg.userData.action='drag'; hud.add(hudBg);

  // primary row (spaced)
  // primary row (y=+0.02)
  hudPin=makeHudButton('Pin', 0.10, 0.05); hudPin.position.set(-0.38, 0.02, 0); hudPin.userData.action='pin-toggle';
  hudFocus=makeHudButton('Focus'); hudFocus.position.set(-0.22, 0.02, 0); hudFocus.userData.action='focus';
  hudFollow=makeHudButton('Follow'); hudFollow.position.set(0.00, 0.02, 0); hudFollow.userData.action='follow';
  hudAsk=makeHudButton('Ask'); hudAsk.position.set(0.22, 0.02, 0); hudAsk.userData.action='ask';
  hudMic=makeHudButton('Mic', 0.10, 0.05); hudMic.position.set(0.38, 0.02, 0); hudMic.userData.action='mic';

  // secondary row (y=-0.10)
  hudPlace=makeHudButton('Place', 0.12, 0.05); hudPlace.position.set(-0.38, -0.10, 0); hudPlace.userData.action='place-here';
  hudWest =makeHudButton('W', 0.06, 0.06); hudWest .position.set(-0.22, -0.10, 0); hudWest .userData.action='west';
  hudNorth=makeHudButton('N', 0.06, 0.06); hudNorth.position.set(-0.10, -0.10, 0); hudNorth.userData.action='north';
  hudEast =makeHudButton('E', 0.06, 0.06); hudEast .position.set( 0.02, -0.10, 0); hudEast .userData.action='east';
  hudSouth=makeHudButton('S', 0.06, 0.06); hudSouth.position.set( 0.14, -0.10, 0); hudSouth.userData.action='south';
  hudRPlus=makeHudButton('+R', 0.08, 0.05); hudRPlus.position.set(0.26, -0.10, 0); hudRPlus.userData.action='radius+';
  hudRMinus=makeHudButton('-R', 0.08, 0.05); hudRMinus.position.set(0.34, -0.10, 0); hudRMinus.userData.action='radius-';

  // readouts
  const makeHudText = (w=0.22,h=0.05,text='')=>{ const cvs=document.createElement('canvas'); cvs.width=512; cvs.height=128; const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,512,128); ctx.fillStyle='#9ec7ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,256,64); const tex=new THREE.CanvasTexture(cvs); const mat=new THREE.MeshBasicMaterial({map:tex, transparent:true}); const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat); m.userData={cvs,ctx,tex}; return m; };
  hudReadoutScale =makeHudText(0.26,0.05,'Scale: x1.00'); hudReadoutScale.position.set(-0.18,0.12,0);
  hudReadoutRadius=makeHudText(0.26,0.05,'R: -- km');    hudReadoutRadius.position.set( 0.18,0.12,0);

  dirArrow=makeArrow(); dirArrow.position.set(0,0.10,0);
  [hudBg,hudFocus,hudFollow,hudAsk,hudRPlus,hudRMinus,hudPin,hudPlace,hudMic,
   hudReadoutAlt,hudReadoutScale,hudReadoutRadius,hudReadoutFollow,hudReadoutSel,
   hudPresetPrev,hudPresetNext,hudPresetGo,hudReadoutPreset,
   hudNorth,hudSouth,hudWest,hudEast,dirArrow].forEach(x=>hud.add(x));
  scene.add(hud);
  // exclude hudBg from click targets to avoid drag interference on button press
  interactiveTargets.push(hudFocus,hudFollow,hudAsk,hudRPlus,hudRMinus,hudPin,hudPlace,hudMic,
    hudPresetPrev,hudPresetNext,hudPresetGo,hudNorth,hudSouth,hudWest,hudEast);

  hud.onBeforeRender=()=>{
    const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
    const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
    const camQ=new THREE.Quaternion(); camera.getWorldQuaternion(camQ);
    const camUp=new THREE.Vector3(0,1,0).applyQuaternion(camQ);
    // initial world placement at 0.9m height
    if(!hudInitPlaced){ const pos=camPos.clone(); pos.y=0.9; pos.add(camDir.clone().multiplyScalar(0.4)); hud.position.copy(pos); hudPinned=true; hudInitPlaced=true; }
    // head-locked when not pinned
    if(!hudPinned){ const pos=camPos.clone().add(camDir.multiplyScalar(0.9)).add(camUp.clone().multiplyScalar(-0.1)); hud.position.copy(pos); }
    hud.lookAt(camPos);
    // update readouts
    try{ const radius=Number(radI.value||30); const scale=(Number(altScaleInp?.value||ALT_SCALE_BASE)/ALT_SCALE_BASE) || 1; const upd=(m,txt)=>{ if(!m) return; const {cvs,ctx,tex}=m.userData; ctx.clearRect(0,0,cvs.width,cvs.height); ctx.fillStyle='#9ec7ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt, cvs.width/2, cvs.height/2); tex.needsUpdate=true; }; upd(hudReadoutRadius, `R: ${Math.round(radius)} km`); upd(hudReadoutScale, `Scale: x${scale.toFixed(2)}`);}catch{}
    // Arrow to selected
    if(selectedIdx>=0){ const m=getMarkerObjectByIndex(selectedIdx); if(m){ const to=new THREE.Vector3().subVectors(m.position, new THREE.Vector3(0,0,0)); const invQ=camQ.clone().invert(); const local=to.clone().applyQuaternion(invQ); const ang=Math.atan2(local.x, -local.z); dirArrow.visible=true; dirArrow.rotation.z = -ang; } else { dirArrow.visible=false; } }
    else { dirArrow.visible=false; }
  };
}

function adjustCenterByKm(northKm=0, eastKm=0){
  const lat0=Number(latI.value), lon0=Number(lonI.value);
  const dlat = northKm/111.132;
  const dlon = eastKm/(111.320*Math.cos(lat0*Math.PI/180));
  latI.value=String(lat0 + dlat);
  lonI.value=String(lon0 + dlon);
  scheduleRefresh(0);
}

// Pointer/zoom interactions
let isPanning=false; let panStart={x:0,y:0}; let panBase={lat:0,lon:0};
function onPointerDown(ev){ isPanning=true; panStart={x:ev.clientX,y:ev.clientY}; panBase={lat:Number(latI.value), lon:Number(lonI.value)}; try{ c.setPointerCapture(ev.pointerId);}catch{} c.style.cursor='grabbing'; }
function onPointerMove(ev){ if(!isPanning) return; const dx=ev.clientX-panStart.x; const dy=ev.clientY-panStart.y; const radius=Number(radI.value||30); const width=innerWidth, height=innerHeight; const kmPerPxX=(2*radius)/Math.max(1,width); const kmPerPxY=(2*radius)/Math.max(1,height); const dKmX=dx*kmPerPxX*panSpeed; const dKmY=-dy*kmPerPxY*panSpeed; const Rlat=111.132; const Rlon=111.320*Math.cos(panBase.lat*Math.PI/180); const dlat=dKmY/Rlat; const dlon=dKmX/Math.max(1e-6,Rlon); latI.value=String(panBase.lat + dlat); lonI.value=String(panBase.lon + dlon); placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); }
function onPointerUp(ev){ if(!isPanning) return; isPanning=false; c.style.cursor='grab'; try{ c.releasePointerCapture(ev.pointerId);}catch{} scheduleRefresh(150); }
function onWheel(ev){ ev.preventDefault(); let r=Number(radI.value||30); const step = ev.deltaY>0? (1.08*zoomSpeed) : (0.92/zoomSpeed); r=Math.round(THREE.MathUtils.clamp(r*step,5,200)); radI.value=String(r); scheduleRefresh(200); }
function adjustZoom(delta){ let r=Number(radI.value||30); const factor=THREE.MathUtils.clamp(1+delta,0.5,2.0); r=Math.round(THREE.MathUtils.clamp(r*factor,5,200)); radI.value=String(r); scheduleRefresh(120); }
function adjustPanSpeed(delta){ panSpeed = THREE.MathUtils.clamp((panSpeed||1)+delta, 0.5, 3.0); if(panSpeedVal) panSpeedVal.textContent = `x${panSpeed.toFixed(1)}`; }
addEventListener('keydown',(e)=>{ const r=Number(radI.value||30); const stepKm=r*0.2; const lat0=Number(latI.value), lon0=Number(lonI.value); const Rlat=111.132; const Rlon=111.320*Math.cos(lat0*Math.PI/180); let dlat=0, dlon=0; if(e.key==='ArrowUp') dlat= stepKm/Rlat; else if(e.key==='ArrowDown') dlat= -stepKm/Rlat; else if(e.key==='ArrowLeft') dlon= -stepKm/Math.max(1e-6,Rlon); else if(e.key==='ArrowRight') dlon= stepKm/Math.max(1e-6,Rlon); else return; latI.value=String(lat0 + dlat); lonI.value=String(lon0 + dlon); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); scheduleRefresh(120); });
if (c){ c.addEventListener('pointerdown', onPointerDown); c.addEventListener('pointermove', onPointerMove); c.addEventListener('pointerup', onPointerUp); c.addEventListener('pointercancel', onPointerUp); c.addEventListener('wheel', onWheel, { passive:false }); }

// Controls
focusBtn?.addEventListener('click', ()=>{ if(selectedIdx<0) return; const s=lastStates[selectedIdx]; if(!s) return; latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0); });
followChk?.addEventListener('change', ()=>{ followMode = !!followChk.checked; if(followMode && selectedIdx>=0){ const s=lastStates[selectedIdx]; selectedKey=s?.icao24||s?.callsign||null; }
});
altModeSel?.addEventListener('change', ()=>{ altMode = altModeSel.value||'geo'; placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
altScaleInp?.addEventListener('input', ()=>{ altScale = Number(altScaleInp.value)||ALT_SCALE_BASE; if(altScaleVal){ const r=altScale/ALT_SCALE_BASE; altScaleVal.textContent = `x${r.toFixed(2)}`; } placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
groundElevInp?.addEventListener('change', ()=>{ groundElev = Number(groundElevInp.value)||0; placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
autoElevBtn?.addEventListener('click', async ()=>{ try{ const lat=Number(latI.value), lon=Number(lonI.value); const r=await fetch(`/api/elevation?lat=${lat}&lon=${lon}`); const j=await r.json(); if(Number.isFinite(j?.elevation)){ groundElev = j.elevation; if(groundElevInp) groundElevInp.value=String(Math.round(groundElev)); placeMarkers({lat,lon}, lastStates); updateSelectionUI(); appendLog(`Ground elevation set to ${Math.round(groundElev)} m.`); } else { appendLog('Failed to get ground elevation'); } }catch(e){ appendLog('Error getting ground elevation'); } });
panSpeedInp?.addEventListener('input', ()=>{ panSpeed = Number(panSpeedInp.value)||1; if(panSpeedVal) panSpeedVal.textContent = `x${panSpeed.toFixed(1)}`; });
zoomSpeedInp?.addEventListener('input', ()=>{ zoomSpeed = Number(zoomSpeedInp.value)||1; if(zoomSpeedVal) zoomSpeedVal.textContent = `x${zoomSpeed.toFixed(1)}`; });

// Ask (region-first)
const askBtn=$('#ask');
if(askBtn) askBtn.onclick=async ()=>{
  const qEl=$('#q'); const speakEl=$('#speak');
  const q=(qEl?.value||'').trim(); if(!q){ appendLog('Please enter a question'); return; }
  askBtn.disabled=true; try{ setMicState('replying'); }catch{}
  const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) };
  const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined;
  try{
    const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })});
    if(!g.ok){ const t=await g.text(); appendLog('Ask failed: '+t); return; }
    const resp=await g.json(); const text=resp?.text||'';
    if(resp?.map_command) try{ applyMapCommand(resp.map_command);}catch{}
    if(resp?.select_flight) try{ applySelectFlight(resp.select_flight);}catch{}
    appendLog(text||'(no response)'); if(useAR && text) try{ showARText(text); }catch{}
    if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); }
  }catch(e){ console.error('ask failed', e); appendLog('Error: '+(e?.message||e)); }
  finally{ askBtn.disabled=false; if(micState==='replying') try{ setMicState('idle'); }catch{} }
};
// Press-To-Talk (PTT) microphone to /api/stt (optional)
let pttStream=null, pttRecorder=null, pttChunks=[];
let micState='idle';
let audioCtx=null; function ensureAudioCtx(){ if(!audioCtx){ const AC=(window.AudioContext||window.webkitAudioContext); audioCtx=new AC(); } return audioCtx; }
function beep(kind='start'){ try{ const ac=ensureAudioCtx(); ac.resume?.(); const o=ac.createOscillator(); const g=ac.createGain(); o.type='sine'; o.frequency.value=(kind==='start'?880:(kind==='end'?660:520)); g.gain.value=0.0001; o.connect(g).connect(ac.destination); const t=ac.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.08, t+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t+0.12); o.stop(t+0.14);}catch{} }
function setMicState(s, note=''){ micState=s; try{ updateHudMicVisual(); if(note) appendLog(`Mic: ${s} ${note}`);}catch{} }
function updateHudMicVisual(){ try{ if(!hudMic) return; const tex=hudMic.material?.map; const cvs=tex?.image; const ctx=cvs?.getContext?.('2d'); if(!ctx) return; ctx.clearRect(0,0,256,128); let bg='#22303a', label='Mic'; if(micState==='capturing'){ bg='#b14a4a'; label='REC'; } else if(micState==='uploading'){ bg='#394b6a'; label='UP'; } else if(micState==='transcribing'){ bg='#364a2a'; label='STT'; } else if(micState==='replying'){ bg='#2a3a4d'; label='TTS'; } else if(micState==='error'){ bg='#6a2a2a'; label='ERR'; } ctx.fillStyle=bg; ctx.fillRect(0,0,256,128); ctx.strokeStyle='#4b6a84'; ctx.lineWidth=4; ctx.strokeRect(2,2,252,124); ctx.fillStyle='#fff'; ctx.font='bold 40px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(label,128,64); tex.needsUpdate=true; }catch{} }
async function pttStart(){
  try{
    if(pttRecorder) return; if(!navigator.mediaDevices?.getUserMedia) return appendLog('PTT not available');
    await ensureAudioCtx()?.resume();
    pttStream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:false}});
    pttChunks=[];
    const mime = MediaRecorder.isTypeSupported?.('audio/webm')? 'audio/webm' : '';
    pttRecorder = new MediaRecorder(pttStream, mime? {mimeType:mime}: {});
    pttRecorder.ondataavailable = (e)=>{ if(e.data?.size>0) pttChunks.push(e.data); };
    pttRecorder.onstop = async ()=>{
      try{
        const blob = new Blob(pttChunks, {type:'audio/webm'});
        pttChunks=[];
        setMicState('uploading');
        const r = await fetch('/api/stt', { method:'POST', body: blob });
        if(r.ok){ setMicState('transcribing'); const j=await r.json(); const text=j?.text||''; const qEl=$('#q'); if(qEl && text) qEl.value=text; appendLog(text? `STT: ${text}` : '(STT empty)'); if(text){ setMicState('replying'); askBtn?.click(); } else { setMicState('idle'); } }
        else { appendLog('STT endpoint not available'); setMicState('error'); setTimeout(()=>setMicState('idle'),1200); }
      }catch(err){ console.warn('stt failed', err); appendLog('PTT error'); }
      finally{ try{ pttStream?.getTracks?.().forEach(t=>t.stop()); }catch{} pttStream=null; pttRecorder=null; }
    };
    pttRecorder.start(); setMicState('capturing'); beep('start');
  }catch(e){ console.warn('pttStart failed', e); appendLog('PTT error'); }
}
function pttStop(){ try{ pttRecorder?.stop(); }catch{} setMicState('uploading'); beep('end'); }
function applyMapCommand(cmd){ try{
  if(cmd.set_center){ const {lat,lon}=cmd.set_center; if(Number.isFinite(lat)&&Number.isFinite(lon)){ latI.value=String(lat); lonI.value=String(lon); scheduleRefresh(0); return; } }
  if(cmd.adjust_center){ const {north_km=0,east_km=0}=cmd.adjust_center; const lat0=Number(latI.value), lon0=Number(lonI.value); const dlat = north_km/111.132; const dlon = east_km/(111.320*Math.cos(lat0*Math.PI/180)); latI.value=String(lat0 + dlat); lonI.value=String(lon0 + dlon); scheduleRefresh(0); return; }
  if(cmd.set_radius){ const {km}=cmd.set_radius; if(Number.isFinite(km)){ radI.value=String(km); scheduleRefresh(0); return; } }
  if(cmd.follow){ followMode = !!cmd.follow.on; if(followChk) followChk.checked=followMode; }
}catch(e){ console.warn('map_command failed', e); }
}
function applySelectFlight(sel){ try{
  const by=(sel?.by||'').toLowerCase(); const v=sel?.value;
  let idx=-1;
  if(by==='index' && Number.isFinite(v)){ idx = Math.max(0, Math.min(lastStates.length-1, Number(v))); }
  else if(by==='callsign' && typeof v==='string'){
    const normalize=(s)=>String(s||'').replace(/\s+/g,'').toUpperCase(); const tgt=normalize(v);
    idx = lastStates.findIndex(s=> normalize(s.callsign)===tgt );
  }
  if(idx>=0){ selectedIdx=idx; const s=lastStates[idx]; selectedKey = s?.icao24 || s?.callsign || null; updateSelectionUI(); if(sel.focus){ latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0); } if(sel.follow!==undefined){ followMode=!!sel.follow; if(followChk) followChk.checked=followMode; } }
}catch(e){ console.warn('select_flight failed', e); }
}

// Voice input (Web Speech API, optional)
const micBtn = document.getElementById('micBtn');
if(micBtn){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ micBtn.title='Speech recognition not supported'; micBtn.disabled=false; }
  else{
    const rec = new SR(); rec.lang='ja-JP'; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onresult = (e)=>{ const t=e.results?.[0]?.[0]?.transcript||''; if(t){ const qEl=$('#q'); if(qEl) qEl.value=t; askBtn?.click(); } };
    rec.onerror = (e)=> appendLog('Speech error: '+(e?.error||'unknown'));
    micBtn.addEventListener('click', ()=>{ try{ rec.start(); appendLog('Initializing microphone...'); }catch{} });
  }
}
function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }


// Quick voice commands: presets / lat,lon / radius / alt mode / follow
function applyQuickVoiceCommand(text){ try{
  const s=String(text||''); const lower=s.toLowerCase();
  // lat,lon pattern
  const m=s.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if(m){ const lat=Number(m[1]), lon=Number(m[2]); if(Number.isFinite(lat)&&Number.isFinite(lon)){ latI.value=String(lat); lonI.value=String(lon); scheduleRefresh(0); return true; } }
  // radius
  const mr = s.match(/(?:radius|半径)\s*(\d{1,3})/i);
  if(mr){ const r=Math.max(5, Math.min(200, Number(mr[1]))); radI.value=String(r); scheduleRefresh(0); return true; }
  // alt mode
  if(/\bagl\b|地表|地面/i.test(s)){ altMode='agl'; altModeSel && (altModeSel.value='agl'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  if(/\bbaro\b|気圧/i.test(s)){ altMode='baro'; altModeSel && (altModeSel.value='baro'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  if(/\bgeo\b|gnss|衛星/i.test(s)){ altMode='geo'; altModeSel && (altModeSel.value='geo'); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); updateSelectionUI(); return true; }
  // follow
  if(/follow on|追従\s*on|追尾\s*on/i.test(s)){ followMode=true; if(followChk) followChk.checked=true; return true; }
  if(/follow off|追従\s*off|追尾\s*off/i.test(s)){ followMode=false; if(followChk) followChk.checked=false; return true; }
  // presets by name
  const ps = (typeof getPresets==='function'? getPresets():[]);
  const norm=(x)=>String(x||'').toLowerCase();
  for(let i=0;i<ps.length;i++){ const name=norm(ps[i].name); if(lower.includes(name)){ hudPresetIndex=i; const p=ps[i]; latI.value=String(p.lat); lonI.value=String(p.lon); radI.value=String(p.radius); scheduleRefresh(0); return true; } }
  const alias = [ ['haneda','haneda'], ['narita','narita'], ['itami','itm'], ['naha','naha'], ['centrair','centrair'] ];
  for(const [k,label] of alias){ if(lower.includes(k)){ const i=ps.findIndex(p=>norm(p.name).includes(label)); if(i>=0){ hudPresetIndex=i; const p=ps[i]; latI.value=String(p.lat); lonI.value=String(p.lon); radI.value=String(p.radius); scheduleRefresh(0); return true; } } }
  return false;
}catch{ return false; }}
// Simple CLI-style typewriter panel in AR (optional)
let cliPanel=null, cliTex=null, cliCtx=null, cliCvs=null, cliText='', cliIndex=0, cliLastUpdate=0;
function showARText(text){ try{
  if(!useAR) return; cliText=String(text||''); cliIndex=0; cliLastUpdate=0;
  if(!cliPanel){
    cliCvs=document.createElement('canvas'); cliCvs.width=1024; cliCvs.height=256; cliCtx=cliCvs.getContext('2d');
    cliTex=new THREE.CanvasTexture(cliCvs);
    const mat=new THREE.MeshBasicMaterial({map:cliTex, transparent:true});
    cliPanel=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.2), mat);
    cliPanel.position.set(0,0,0);
    scene.add(cliPanel);
  }
  const camPos=new THREE.Vector3(); const camDir=new THREE.Vector3(); camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
  const pos=camPos.clone().add(camDir.multiplyScalar(0.9)); cliPanel.position.copy(pos); cliPanel.lookAt(camPos);
}catch(e){ console.warn('showARText failed', e); }
}

// AR (minimal)
let reticle=null; let hitTestSource=null; let viewerSpace=null;
async function startAR(){
  try{
    if(!navigator.xr){ alert('WebXR not supported'); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if(ok===false){ alert('immersive-ar not supported'); return; }
    let session;
    try{ const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hit-test','hand-tracking'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsStrict);}catch(_){ const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hit-test','hand-tracking'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsLoose); }
    await renderer.xr.setSession(session);
    try{ const ui=document.getElementById('ui'); if(ui) ui.style.display='none'; if(overlayRoot) overlayRoot.style.display='block'; }catch{}
    // Controller visuals + rays
    try{ const factory=new XRControllerModelFactory();
      const grip0=renderer.xr.getControllerGrip(0); grip0.add(factory.createControllerModel(grip0)); scene.add(grip0);
      const grip1=renderer.xr.getControllerGrip(1); grip1.add(factory.createControllerModel(grip1)); scene.add(grip1);
      const mkRay=()=>{ const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]); const ln=new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x00aaff})); ln.scale.z=1.5; return ln; };
      const ctrl0=renderer.xr.getController(0); ctrl0.add(mkRay()); scene.add(ctrl0);
      const ctrl1=renderer.xr.getController(1); ctrl1.add(mkRay()); scene.add(ctrl1);
      ctrl0.addEventListener('connected', (e)=>{ try{ ctrl0.userData.gamepad = e.data?.gamepad; }catch{} });
      ctrl1.addEventListener('connected', (e)=>{ try{ ctrl1.userData.gamepad = e.data?.gamepad; }catch{} });
      const onSelect=(e)=>{ if(!hud || hudDragging) return; const src=e.target; const m=src.matrixWorld; const origin=new THREE.Vector3().setFromMatrixPosition(m); const dir=new THREE.Vector3(0,0,-1).applyMatrix4(new THREE.Matrix4().extractRotation(m)).normalize(); raycaster.set(origin, dir); const hits=raycaster.intersectObjects(interactiveTargets,true); if(hits.length>0){ const a=hits[0].object?.userData?.action; if(a==='focus'){ if(selectedIdx>=0){ const s=lastStates[selectedIdx]; latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0);} }
        else if(a==='follow'){ followMode=!followMode; if(followChk){ followChk.checked=followMode; } if(followMode && selectedIdx>=0){ const s=lastStates[selectedIdx]; selectedKey=s?.icao24||s?.callsign||null; } }
        else if(a==='ask'){ if(selectedIdx>=0){ const s=lastStates[selectedIdx]; const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon}; fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}).then(r=>r.json()).then(({text})=>{ appendLog(text||'(no response)'); if(useAR && text) try{ showARText(text); }catch{} }); } }
        else if(a==='radius+'){ const r=Number(radI.value||30); radI.value=String(Math.round(Math.min(200, r+2))); scheduleRefresh(0); }
        else if(a==='radius-'){ const r=Number(radI.value||30); radI.value=String(Math.round(Math.max(5, r-2))); scheduleRefresh(0); }
        else if(a==='mic'){ if(pttRecorder){ pttStop(); } else { pttStart(); } }
        else if(a==='pin-toggle'){ hudPinned=!hudPinned; try{ const tex=hudPin?.material?.map; if(tex?.image){ const cvs=tex.image; const ctx=cvs.getContext('2d'); ctx.fillStyle='#22303a'; ctx.fillRect(0,0,256,128); ctx.strokeStyle='#4b6a84'; ctx.lineWidth=4; ctx.strokeRect(2,2,252,124); ctx.fillStyle='#cfe8ff'; ctx.font='bold 40px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(hudPinned?'Unpin':'Pin',128,64); tex.needsUpdate=true; } }catch{} }
        else if(a==='place-here'){ try{ let pos=null; if(reticle&&reticle.visible){ pos=reticle.position.clone(); } else { const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const camQ=new THREE.Quaternion(); camera.getWorldQuaternion(camQ); const camUp=new THREE.Vector3(0,1,0).applyQuaternion(camQ); pos=camPos.clone().add(camDir.multiplyScalar(0.9)).add(camUp.clone().multiplyScalar(-0.1)); } hud.position.copy(pos); hudPinned=true; }catch{} }
        else if(a==='north'){ adjustCenterByKm(0.5,0); }
        else if(a==='south'){ adjustCenterByKm(-0.5,0); }
        else if(a==='west'){ adjustCenterByKm(0,-0.5); }
        else if(a==='east'){ adjustCenterByKm(0,0.5); }
      } };
      const onSelectStart=(e)=>{
        if(!hud) return;
        const src=e.target; const m=src.matrixWorld;
        const origin=new THREE.Vector3().setFromMatrixPosition(m);
        const dir=new THREE.Vector3(0,0,-1).applyMatrix4(new THREE.Matrix4().extractRotation(m)).normalize();
        raycaster.set(origin, dir);
        // 1) Button hits take precedence => trigger button, no drag
        const btnHits=raycaster.intersectObjects(interactiveTargets, true);
        if(btnHits.length>0){ onSelect(e); return; }
        // 2) Drag only when background explicitly hit
        const bgHits=raycaster.intersectObjects([hudBg], true);
        if(bgHits.length>0){ hudDragging=true; hudDragCtrl=src; hudPinned=true; }
      };
      const onSelectEnd=(e)=>{ hudDragging=false; hudDragCtrl=null; };
      ctrl0.addEventListener('select', onSelect); ctrl1.addEventListener('select', onSelect);
      ctrl0.addEventListener('selectstart', onSelectStart); ctrl1.addEventListener('selectstart', onSelectStart);
      ctrl0.addEventListener('selectend', onSelectEnd); ctrl1.addEventListener('selectend', onSelectEnd);
      const onSqueeze=(e)=>{ followMode=!followMode; if(followChk) followChk.checked=followMode; };
      ctrl0.addEventListener('squeeze', onSqueeze); ctrl1.addEventListener('squeeze', onSqueeze);
      ctrl0.addEventListener('squeezestart', ()=>{ try{ pttStart(); }catch{} });
      ctrl0.addEventListener('squeezeend', ()=>{ try{ pttStop(); }catch{} });
      ctrl1.addEventListener('squeezestart', ()=>{ try{ pttStart(); }catch{} });
      ctrl1.addEventListener('squeezeend', ()=>{ try{ pttStop(); }catch{} });
    }catch{}
    try{ if(session.requestReferenceSpace && session.requestHitTestSource){ viewerSpace=await session.requestReferenceSpace('viewer'); hitTestSource=await session.requestHitTestSource({ space: viewerSpace }); } }catch{}
    try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch{}
    ensureHUD();
    console.info('presenting?', renderer.xr.isPresenting, 'domOverlayState=', session.domOverlayState?.type, 'visibility=', session.visibilityState);
    useAR=true; updateCanvasPointer(); animateAR(session);
    session.addEventListener('end', ()=>{ hitTestSource=null; viewerSpace=null; reticle=null; useAR=false; updateCanvasPointer(); try{ const ui=document.getElementById('ui'); if(ui) ui.style.display=''; if(overlayRoot) overlayRoot.style.display=''; }catch{} });
  }catch(e){ alert('Failed to start AR: '+(e?.message||e)); }
}
function animateAR(session){ const refSpace=renderer.xr.getReferenceSpace(); renderer.setAnimationLoop((t,frame)=>{ if(frame && hitTestSource){ try{ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(refSpace); if(pose){ const p=pose.transform.position; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { if(reticle) reticle.visible=false; } }catch{} } try{ const ctrl0=renderer.xr.getController(0); const gp=ctrl0?.userData?.gamepad; if(gp&&gp.axes){ const ax=gp.axes[0]||0, ay=gp.axes[1]||0; if(Math.abs(ay)>0.25) adjustZoom(ay*-0.03); if(Math.abs(ax)>0.25) adjustPanSpeed(ax*0.02); } }catch{} if(hudDragging && hudDragCtrl){ try{ const m=hudDragCtrl.matrixWorld; const origin=new THREE.Vector3().setFromMatrixPosition(m); const dir=new THREE.Vector3(0,0,-1).applyMatrix4(new THREE.Matrix4().extractRotation(m)).normalize(); const dist=0.6; const pos=origin.clone().add(dir.multiplyScalar(dist)); hud.position.copy(pos); }catch{} } // typewriter update
  try{ if(cliPanel && useAR && cliText){ const now=t||0; if(now-cliLastUpdate>25){ cliIndex=Math.min(cliText.length, cliIndex+2); cliLastUpdate=now; const txt=cliText.slice(0,cliIndex); cliCtx.clearRect(0,0,cliCvs.width,cliCvs.height); cliCtx.fillStyle='rgba(0,0,0,0.65)'; cliCtx.fillRect(0,0,cliCvs.width,cliCvs.height); cliCtx.fillStyle='#A6FF9E'; cliCtx.font='bold 42px ui-monospace, monospace'; cliCtx.textAlign='left'; cliCtx.textBaseline='top'; const pad=24; const lines=wrapText(txt, 60); lines.forEach((ln,i)=>cliCtx.fillText(ln, pad, pad+i*48)); cliTex.needsUpdate=true; if(cliIndex>=cliText.length){ /* keep last */ } } } }catch{}
  updateLabelScales(); renderer.render(scene,camera); }); }

function wrapText(s, n){ const out=[]; let i=0; while(i<s.length){ out.push(s.slice(i, i+n)); i+=n; } return out; }

// Demo data
function genDemoStates(center, n=6){ const out=[]; for(let i=0;i<n;i++){ const ang=(i/n)*Math.PI*2; const dkm= 2 + (i%3); const dlat=(dkm/111.132); const dlon=(dkm/(111.320*Math.cos(center.lat*Math.PI/180))); const lat=center.lat+Math.sin(ang)*dlat; const lon=center.lon+Math.cos(ang)*dlon; out.push({ icao24:`demo${i}`, callsign:`DEMO${i+1}`, lat, lon, geo_alt: 200+i*50, vel: 70+i*5, hdg: (ang*180/Math.PI)%360 }); } return out; }
function runDemo(n=3){ const lat=Number(latI.value), lon=Number(lonI.value); lastStates = genDemoStates({lat,lon}, n); const src=document.getElementById('src'); if(src) src.textContent=`Source: demo | Flights: ${lastStates.length}`; placeMarkers({lat,lon}, lastStates); selectedIdx = -1; renderList(lastStates); updateSelectionUI(); }

// Pointer enabling for canvas
function updateCanvasPointer(){ try{ if(!c) return; c.style.pointerEvents = 'auto'; }catch{} }
updateCanvasPointer();

// Kick-off
refresh();
// STT endpoint availability probe (updates HUD mic state)
async function checkSTT(){
  try{
    const r = await fetch('/api/stt', { method:'OPTIONS' });
    if(r.status===404){ try{ setMicState('unavailable','STT 404'); }catch{} }
    else { try{ setMicState('idle'); }catch{} }
  }catch{ try{ setMicState('unavailable'); }catch{} }
}
checkSTT();













