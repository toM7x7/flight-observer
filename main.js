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

$('#fetchBtn')?.addEventListener('click', refresh);
$('#toggleBtn')?.addEventListener('click', ()=>toggleView());
$('#startAR')?.addEventListener('click', startAR);

document.getElementById('demoBtn')?.addEventListener('click', ()=> runDemo(3));

function runDemo(n=3){
  const lat=Number(latI.value), lon=Number(lonI.value);
  lastStates = genDemoStates({lat,lon}, n);
  $('#src').textContent=`ソース: demo | 便数: ${lastStates.length}`;
  placeMarkers({lat,lon}, lastStates);
  selectedIdx = -1;
  renderList(lastStates);
  updateSelectionUI();
}

// AR button state (fail-safe)
const startBtn = document.getElementById('startAR');
async function prepareARButton(){
  if(!startBtn) return;
  const disable = (msg)=>{ startBtn.disabled=true; startBtn.title=msg; startBtn.textContent = 'START AR（利用不可）'; };
  try{
    if (!window.isSecureContext){ disable('HTTPSが必要です'); return; }
    if (!('xr' in navigator)){ disable('WebXR未対応のブラウザです'); return; }
    const ok = await navigator.xr?.isSessionSupported?.('immersive-ar');
    if (ok === false){ disable('immersive-ar未対応の環境です'); return; }
    startBtn.disabled=false; startBtn.title='ARを開始'; startBtn.textContent='AR開始';
  }catch(e){ disable('AR初期化エラー: '+(e?.message||e)); }
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

// Center pin and guide line
let centerPin; try{ centerPin=new THREE.Mesh(new THREE.RingGeometry(0.25,0.35,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x66d9ff, transparent:true, opacity:0.9, side:THREE.DoubleSide})); centerPin.position.y=0.01; markers.add(centerPin);}catch{}
let guideLine=null; function ensureGuideLine(){ if(guideLine) return; const geo=new THREE.BufferGeometry(); const pos=new Float32Array([0,0,0, 0,0,0]); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); const mat=new THREE.LineDashedMaterial({color:0x66d9ff, dashSize:0.25, gapSize:0.15}); guideLine=new THREE.Line(geo,mat); guideLine.computeLineDistances(); guideLine.visible=false; markers.add(guideLine); }

// Simple head-locked HUD for AR
const raycaster = new THREE.Raycaster();
let hud=null, hudFocus=null, hudFollow=null, hudAsk=null, dirArrow=null;
let hudRPlus=null, hudRMinus=null, hudNorth=null, hudSouth=null, hudEast=null, hudWest=null;
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
  hudFocus=makeHudButton('Focus'); hudFocus.position.set(-0.16,-0.08,0); hudFocus.userData.action='focus';
  hudFollow=makeHudButton('Follow'); hudFollow.position.set(0.0,-0.08,0); hudFollow.userData.action='follow';
  hudAsk=makeHudButton('Ask'); hudAsk.position.set(0.16,-0.08,0); hudAsk.userData.action='ask';
  // AR単体操作（半径／中心移動）
  hudRPlus=makeHudButton('+R', 0.08, 0.05); hudRPlus.position.set(0.24,-0.08,0); hudRPlus.userData.action='radius+';
  hudRMinus=makeHudButton('-R', 0.08, 0.05); hudRMinus.position.set(0.32,-0.08,0); hudRMinus.userData.action='radius-';
  hudNorth=makeHudButton('N', 0.06, 0.06); hudNorth.position.set(-0.06,0.02,0); hudNorth.userData.action='north';
  hudSouth=makeHudButton('S', 0.06, 0.06); hudSouth.position.set(-0.06,-0.18,0); hudSouth.userData.action='south';
  hudWest =makeHudButton('W', 0.06, 0.06); hudWest .position.set(-0.13,-0.08,0); hudWest .userData.action='west';
  hudEast =makeHudButton('E', 0.06, 0.06); hudEast .position.set( 0.01,-0.08,0); hudEast .userData.action='east';
  dirArrow=makeArrow(); dirArrow.position.set(0,0.06,0);
  hud.add(hudFocus); hud.add(hudFollow); hud.add(hudAsk); hud.add(hudRPlus); hud.add(hudRMinus);
  hud.add(hudNorth); hud.add(hudSouth); hud.add(hudWest); hud.add(hudEast);
  hud.add(dirArrow); scene.add(hud);
  interactiveTargets.push(hudFocus, hudFollow, hudAsk, hudRPlus, hudRMinus, hudNorth, hudSouth, hudWest, hudEast);
  hud.onBeforeRender=()=>{
    const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
    const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
    const pos=camPos.clone().add(camDir.multiplyScalar(0.8)); hud.position.copy(pos); hud.lookAt(camPos);
    // Update arrow towards selected
    if(selectedIdx>=0){ const m=getMarkerObjectByIndex(selectedIdx); if(m){ const to=new THREE.Vector3().subVectors(m.position, new THREE.Vector3(0,0,0)); // in marker space
        const camQ=new THREE.Quaternion(); camera.getWorldQuaternion(camQ); const invQ=camQ.clone().invert(); const local=to.clone().applyQuaternion(invQ);
        const ang=Math.atan2(local.x, -local.z); dirArrow.visible=true; dirArrow.rotation.z = -ang; } else { dirArrow.visible=false; } }
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

// Labels
function makeLabel(text){ const s=256; const cv=document.createElement('canvas'); cv.width=s; cv.height=s; const ctx=cv.getContext('2d'); ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,s/2,s/2); const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(12,5.5,1); sp.renderOrder=999; sp.userData.baseScale={x:12,y:5.5}; return sp; }
function updateLabelScales(){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const tmp=new THREE.Vector3(); for(const m of markers.children){ if(!m||!m.children) continue; m.getWorldPosition(tmp); const d=camPos.distanceTo(tmp); const s=THREE.MathUtils.clamp(1.2/Math.max(0.5,d),0.35,1.1); for(const ch of m.children){ if(ch&&ch.isSprite){ const base=ch.userData?.baseScale||{x:12,y:5.5}; ch.scale.set(base.x*s, base.y*s, 1); ch.renderOrder=999; } } } }

// Helpers
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function distKm(lat1,lon1,lat2,lon2){ const R=6371e3,rad=(x)=>x*Math.PI/180; const dlat=rad(lat2-lat1),dlon=rad(lon2-lon1); const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2; return (2*R*Math.asin(Math.sqrt(a)))/1000; }
function bearingDeg(lat1,lon1,lat2,lon2){ const rad=(x)=>x*Math.PI/180,deg=(x)=>x*180/Math.PI; const y=Math.sin(rad(lon2-lon1))*Math.cos(rad(lat2)); const x=Math.cos(rad(lat1))*Math.sin(rad(lat2))-Math.sin(rad(lat1))*Math.cos(rad(lat2))*Math.cos(rad(lon2-lon1)); return (deg(Math.atan2(y,x))+360)%360; }
function altitudeMeters(s){ const geo = Number.isFinite(s.geo_alt)? s.geo_alt : null; const baro = Number.isFinite(s.baro_alt)? s.baro_alt : null; if (altMode==='geo') return geo ?? baro ?? 0; if (altMode==='baro') return baro ?? geo ?? 0; const base = geo ?? baro ?? 0; return Math.max(0, base - groundElev); }
const ALT_MODE_HUE = { geo: 120/360, baro: 210/360, agl: 30/360 };
function altitudeColor(alt){ const t = THREE.MathUtils.clamp(alt/8000,0,1); const base = ALT_MODE_HUE[altMode] ?? (200/360); const range = 60/360; const h = base - t*range; const s=0.8, l=0.55; const col=new THREE.Color(); col.setHSL(h,s,l); return col.getHex(); }
function makeBarMesh(height, color){ const h=Math.max(0.2, height); const r=0.6; const geo=new THREE.CylinderGeometry(r,r,h,12,1,true); geo.translate(0,h/2,0); const mat=new THREE.MeshStandardMaterial({color, transparent:true, opacity:0.95}); return new THREE.Mesh(geo,mat); }
function makeMarkerMesh({callsign,alt_m}){ const color=altitudeColor(alt_m); const height = alt_m * altScale; const bar=makeBarMesh(height, color); const group=new THREE.Group(); group.add(bar); const label=makeLabel(callsign||'N/A'); label.position.set(0,height+1.2,0); group.add(label); return group; }
function placeMarkers(center, flights){ markers.clear(); try{ if(centerPin) markers.add(centerPin); if(guideLine) markers.add(guideLine);}catch{} flights.forEach((s,i)=>{ const {x,y}=llDiffMeters(center.lat,center.lon,s.lat,s.lon); const alt_m=altitudeMeters(s); const m=makeMarkerMesh({callsign:s.callsign, alt_m}); m.userData.idx=i; m.userData.alt_m=alt_m; m.position.set(x/10,0,y/10); markers.add(m); }); updateLabelScales(); }
function getMarkerObjectByIndex(idx){ for(const o of markers.children){ if(o?.userData?.idx===idx) return o; } return null; }
function findIndexByKey(list, key){ if(!key) return -1; let i=list.findIndex(s=>s.icao24===key); if(i<0) i=list.findIndex(s=>s.callsign===key); return i; }

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
document.getElementById('preset')?.addEventListener('change', (e)=>applyPreset(e.target.value));
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My Spot ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// Fetch + render
let _refreshTimer = null;
function scheduleRefresh(ms=250){ clearTimeout(_refreshTimer); _refreshTimer = setTimeout(()=>refresh(), ms); }

async function refresh(){
  const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
  const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
  try{
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    lastStates=j.states||[];
    if (followMode && selectedKey){ const fi=findIndexByKey(lastStates, selectedKey); if(fi>=0){ const fs=lastStates[fi]; latI.value=String(fs.lat); lonI.value=String(fs.lon); selectedIdx=fi; } }
    const clat=Number(latI.value), clon=Number(lonI.value);
    $('#src').textContent=`ソース: opensky | 便数: ${lastStates.length}`;
    placeMarkers({lat:clat,lon:clon}, lastStates);
    if(selectedIdx<0 && selectedKey){ const si=findIndexByKey(lastStates, selectedKey); if(si>=0) selectedIdx=si; }
    renderList(lastStates);
    updateSelectionUI();
    if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(e){ alert('ライブ取得に失敗しました。DEMO（3機）に切り替えます。'); runDemo(3); }
}

function renderList(states){
  const box=$('#list'); if(!box) return;
  box.innerHTML='<h3>フライト一覧</h3>' + (states||[]).map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join('');
  box.querySelectorAll('.item').forEach(el=>el.addEventListener('click',async()=>{
    const idx=Number(el.getAttribute('data-idx'));
    selectedIdx = (selectedIdx===idx ? -1 : idx);
    const s=states[idx]; selectedKey = s?.icao24 || s?.callsign || null;
    updateSelectionUI();
    if(!s) return;
    const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon};
    try{ const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}); const {text}=await g.json(); appendLog(text||'(no response)');
      const speakEl=$('#speak'); if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); }
    }catch(e){ console.error('describe failed',e); }
  }));
}

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
    <div class='row'>高度: ${altV} m</div>
    <div class='row'>速度: ${spdKt} kt</div>
    <div class='row'>方位（進行）: ${hdg}°</div>
    <div class='row'>距離/方角（中心→機体）: ${dkm.toFixed(1)} km / ${brg}°</div>
  </div>`;
  ensureGuideLine();
  const m = getMarkerObjectByIndex(selectedIdx);
  if (m && guideLine){ const arr=guideLine.geometry.attributes.position.array; arr[0]=0;arr[1]=0;arr[2]=0; arr[3]=m.position.x; arr[4]=0; arr[5]=m.position.z; guideLine.geometry.attributes.position.needsUpdate=true; guideLine.computeLineDistances?.(); guideLine.visible=true; }
}

// Altitude controls listeners
altModeSel?.addEventListener('change', ()=>{ altMode = altModeSel.value||'geo'; placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
altScaleInp?.addEventListener('input', ()=>{ altScale = Number(altScaleInp.value)||ALT_SCALE_BASE; if(altScaleVal){ const r=altScale/ALT_SCALE_BASE; altScaleVal.textContent = `x${r.toFixed(2)}`; } placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
groundElevInp?.addEventListener('change', ()=>{ groundElev = Number(groundElevInp.value)||0; placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); updateSelectionUI(); });
autoElevBtn?.addEventListener('click', async ()=>{ try{ const lat=Number(latI.value), lon=Number(lonI.value); const r=await fetch(`/api/elevation?lat=${lat}&lon=${lon}`); const j=await r.json(); if(Number.isFinite(j?.elevation)){ groundElev = j.elevation; if(groundElevInp) groundElevInp.value=String(Math.round(groundElev)); placeMarkers({lat,lon}, lastStates); updateSelectionUI(); appendLog(`地面高度を ${Math.round(groundElev)} m に設定しました`); } else { appendLog('地面高度の取得に失敗しました'); } }catch(e){ appendLog('地面高度の取得でエラー'); } });

// Sensitivity controls
panSpeedInp?.addEventListener('input', ()=>{ panSpeed = Number(panSpeedInp.value)||1; if(panSpeedVal) panSpeedVal.textContent = `x${panSpeed.toFixed(1)}`; });
zoomSpeedInp?.addEventListener('input', ()=>{ zoomSpeed = Number(zoomSpeedInp.value)||1; if(zoomSpeedVal) zoomSpeedVal.textContent = `x${zoomSpeed.toFixed(1)}`; });

// Focus/Follow controls
focusBtn?.addEventListener('click', ()=>{ if(selectedIdx<0) return; const s=lastStates[selectedIdx]; if(!s) return; latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0); });
followChk?.addEventListener('change', ()=>{ followMode = !!followChk.checked; if(followMode && selectedIdx>=0){ const s=lastStates[selectedIdx]; selectedKey = s?.icao24 || s?.callsign || null; } });

// Map-like panning and zoom
let isPanning=false; let panStart={x:0,y:0}; let panBase={lat:0,lon:0};
function onPointerDown(ev){ try{ c.setPointerCapture(ev.pointerId); }catch{} isPanning=true; panStart={x:ev.clientX,y:ev.clientY}; panBase={lat:Number(latI.value)||0, lon:Number(lonI.value)||0}; c.style.cursor='grabbing'; }
function onPointerMove(ev){ if(!isPanning) return; const dx=ev.clientX-panStart.x; const dy=ev.clientY-panStart.y; const radius=Number(radI.value||30); const width=innerWidth, height=innerHeight; const kmPerPxX=(2*radius)/Math.max(1,width); const kmPerPxY=(2*radius)/Math.max(1,height); const dKmX=dx*kmPerPxX*panSpeed; const dKmY=-dy*kmPerPxY*panSpeed; const Rlat=111.132; const Rlon=111.320*Math.cos(panBase.lat*Math.PI/180); const dlat=dKmY/Rlat; const dlon=dKmX/Math.max(1e-6,Rlon); latI.value=String(panBase.lat + dlat); lonI.value=String(panBase.lon + dlon); placeMarkers({lat:Number(latI.value), lon:Number(lonI.value)}, lastStates); }
function onPointerUp(ev){ if(!isPanning) return; isPanning=false; c.style.cursor='grab'; try{ c.releasePointerCapture(ev.pointerId);}catch{} scheduleRefresh(150); }
function onWheel(ev){ ev.preventDefault(); let r=Number(radI.value||30); const step = ev.deltaY>0? (1.08*zoomSpeed) : (0.92/zoomSpeed); r=Math.round(THREE.MathUtils.clamp(r*step,5,200)); radI.value=String(r); scheduleRefresh(200); }
addEventListener('keydown',(e)=>{ const r=Number(radI.value||30); const stepKm=r*0.2; const lat0=Number(latI.value), lon0=Number(lonI.value); const Rlat=111.132; const Rlon=111.320*Math.cos(lat0*Math.PI/180); let dlat=0, dlon=0; if(e.key==='ArrowUp') dlat= stepKm/Rlat; else if(e.key==='ArrowDown') dlat= -stepKm/Rlat; else if(e.key==='ArrowLeft') dlon= -stepKm/Math.max(1e-6,Rlon); else if(e.key==='ArrowRight') dlon= stepKm/Math.max(1e-6,Rlon); else return; latI.value=String(lat0 + dlat); lonI.value=String(lon0 + dlon); placeMarkers({lat:Number(latI.value),lon:Number(lonI.value)}, lastStates); scheduleRefresh(120); });
if (c){ c.addEventListener('pointerdown', onPointerDown); c.addEventListener('pointermove', onPointerMove); c.addEventListener('pointerup', onPointerUp); c.addEventListener('pointercancel', onPointerUp); c.addEventListener('wheel', onWheel, { passive:false }); }

// Ask (region-first)
const askBtn=$('#ask');
if(askBtn) askBtn.onclick=async ()=>{ const qEl=$('#q'); const speakEl=$('#speak'); const q=(qEl?.value||'').trim(); if(!q){ appendLog('質問を入力してください'); return; } const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) }; const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined; try{ const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })}); const resp=await g.json(); const text=resp?.text||''; if(resp?.map_command) try{ applyMapCommand(resp.map_command);}catch{} if(resp?.select_flight) try{ applySelectFlight(resp.select_flight);}catch{} appendLog(text||'(no response)'); if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); } }catch(e){ console.error('ask failed', e); appendLog('エラー: '+(e?.message||e)); } };
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
  if(!SR){ micBtn.title='音声入力は未対応のブラウザです'; micBtn.disabled=false; }
  else{
    const rec = new SR(); rec.lang='ja-JP'; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onresult = (e)=>{ const t=e.results?.[0]?.[0]?.transcript||''; if(t){ const qEl=$('#q'); if(qEl) qEl.value=t; askBtn?.click(); } };
    rec.onerror = (e)=> appendLog('音声入力エラー: '+(e?.error||'unknown'));
    micBtn.addEventListener('click', ()=>{ try{ rec.start(); appendLog('…録音中（話しかけてください）'); }catch{} });
  }
}
function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }

// AR (minimal)
let reticle=null; let hitTestSource=null; let viewerSpace=null;
async function startAR(){
  try{
    if(!navigator.xr){ alert('WebXR未対応のブラウザです'); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if(ok===false){ alert('immersive-ar未対応の環境です'); return; }
    let session;
    try{ const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hit-test'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsStrict);}catch(_){ const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hit-test'], domOverlay:{ root: overlayRoot } }; renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsLoose); }
    await renderer.xr.setSession(session);
    // Controller visuals + rays
    try{ const factory=new XRControllerModelFactory();
      const grip0=renderer.xr.getControllerGrip(0); grip0.add(factory.createControllerModel(grip0)); scene.add(grip0);
      const grip1=renderer.xr.getControllerGrip(1); grip1.add(factory.createControllerModel(grip1)); scene.add(grip1);
      const mkRay=()=>{ const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]); const ln=new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x00aaff})); ln.scale.z=1.5; return ln; };
      const ctrl0=renderer.xr.getController(0); ctrl0.add(mkRay()); scene.add(ctrl0);
      const ctrl1=renderer.xr.getController(1); ctrl1.add(mkRay()); scene.add(ctrl1);
      const onSelect=(e)=>{ if(!hud) return; const src=e.target; const m=src.matrixWorld; const origin=new THREE.Vector3().setFromMatrixPosition(m); const dir=new THREE.Vector3(0,0,-1).applyMatrix4(new THREE.Matrix4().extractRotation(m)).normalize(); raycaster.set(origin, dir); const hits=raycaster.intersectObjects(interactiveTargets,true); if(hits.length>0){ const a=hits[0].object?.userData?.action; if(a==='focus'){ if(selectedIdx>=0){ const s=lastStates[selectedIdx]; latI.value=String(s.lat); lonI.value=String(s.lon); scheduleRefresh(0);} }
        else if(a==='follow'){ followMode=!followMode; if(followChk){ followChk.checked=followMode; } if(followMode && selectedIdx>=0){ const s=lastStates[selectedIdx]; selectedKey=s?.icao24||s?.callsign||null; } }
        else if(a==='ask'){ if(selectedIdx>=0){ const s=lastStates[selectedIdx]; const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon}; fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}).then(r=>r.json()).then(({text})=>{ appendLog(text||'(no response)'); }); } }
        else if(a==='radius+'){ const r=Number(radI.value||30); radI.value=String(Math.round(Math.min(200, r+2))); scheduleRefresh(0); }
        else if(a==='radius-'){ const r=Number(radI.value||30); radI.value=String(Math.round(Math.max(5, r-2))); scheduleRefresh(0); }
        else if(a==='north'){ adjustCenterByKm(0.5,0); }
        else if(a==='south'){ adjustCenterByKm(-0.5,0); }
        else if(a==='west'){ adjustCenterByKm(0,-0.5); }
        else if(a==='east'){ adjustCenterByKm(0,0.5); }
      } };
      ctrl0.addEventListener('select', onSelect); ctrl1.addEventListener('select', onSelect);
    }catch{}
    try{ if(session.requestReferenceSpace && session.requestHitTestSource){ viewerSpace=await session.requestReferenceSpace('viewer'); hitTestSource=await session.requestHitTestSource({ space: viewerSpace }); } }catch{}
    try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch{}
    ensureHUD();
    useAR=true; animateAR(session);
    session.addEventListener('end', ()=>{ hitTestSource=null; viewerSpace=null; reticle=null; useAR=false; });
  }catch(e){ alert('AR開始に失敗しました: '+(e?.message||e)); }
}
function animateAR(session){ const refSpace=renderer.xr.getReferenceSpace(); renderer.setAnimationLoop((t,frame)=>{ if(frame && hitTestSource){ try{ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(refSpace); if(pose){ const p=pose.transform.position; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { if(reticle) reticle.visible=false; } }catch{} } updateLabelScales(); renderer.render(scene,camera); }); }

// Demo data
function genDemoStates(center, n=6){ const out=[]; for(let i=0;i<n;i++){ const ang=(i/n)*Math.PI*2; const dkm= 2 + (i%3); const dlat=(dkm/111.132); const dlon=(dkm/(111.320*Math.cos(center.lat*Math.PI/180))); const lat=center.lat+Math.sin(ang)*dlat; const lon=center.lon+Math.cos(ang)*dlon; out.push({ icao24:`demo${i}`, callsign:`DEMO${i+1}`, lat, lon, geo_alt: 200+i*50, vel: 70+i*5, hdg: (ang*180/Math.PI)%360 }); } return out; }

// Kick-off
refresh();
