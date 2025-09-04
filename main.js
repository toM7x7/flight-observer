import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { CONFIG } from './config.js';

// DOM helpers
const $ = (s)=>document.querySelector(s);
const c = $('#c'), latI=$('#lat'), lonI=$('#lon'), radI=$('#radius');
$('#fetchBtn').onclick = refresh;
$('#toggleBtn').onclick = ()=>toggleView();
$('#startAR').onclick = startAR;
document.getElementById('demoBtn')?.addEventListener('click', ()=>{
  const lat=Number(latI.value), lon=Number(lonI.value);
  const demo = genDemoStates({lat,lon}, 6);
  lastStates = demo;
  $('#src').textContent=`source: demo | flights: ${lastStates.length}`;
  placeMarkers({lat,lon}, lastStates);
  renderList(lastStates); hookListHandlers(lastStates);
});

// Robust AR button state (fail-safe): disable with reason when unsupported
const startBtn = document.getElementById('startAR');
async function prepareARButton(){
  if(!startBtn) return;
  const disable = (msg)=>{ startBtn.disabled=true; startBtn.title=msg; startBtn.textContent = 'START AR (不可)'; };
  try{
    if (!window.isSecureContext){ disable('HTTPSが必要です'); return; }
    if (!('xr' in navigator)){ disable('WebXR未対応ブラウザ'); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if (ok === false){ disable('immersive-ar未対応環境'); return; }
    // enabled
    startBtn.disabled=false; startBtn.title='ARを開始'; startBtn.textContent='START AR';
  }catch(e){ disable('AR準備に失敗: '+(e?.message||e)); }
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
let useAR = false;

// DOM Overlay handling
const overlayRoot = document.getElementById('overlay');
document.addEventListener('beforexrselect', (ev)=>{
  if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault();
}, true);
overlayRoot?.setAttribute('tabindex','-1');

// Fallback panel (3D UI)
let fallbackPanel=null, fallbackPanelMesh=null, fallbackButtonMesh=null;
let fallbackBtnHide=null, fallbackBtnFollow=null; // extra buttons
let panelCanvas=null, panelCtx=null, panelTex=null;
let panelMode='hidden'; // 'head' | 'docked' | 'hidden' (default hidden)
const interactiveTargets=[]; const raycaster=new THREE.Raycaster(); const _tmpMat=new THREE.Matrix4();
let controller0=null, controller1=null; let controllerGrip0=null, controllerGrip1=null; let controllerLine0=null, controllerLine1=null;
let hitTestSource=null, viewerSpace=null, haveHitPose=false; const lastHitPos=new THREE.Vector3(); let reticle=null; const dockedPos=new THREE.Vector3();
// Hand pinch states for AR area control
let pinchOne={active:false,start:{x:0,z:0},base:{lat:0,lon:0}};
let pinchTwo={active:false,startDist:0,baseRadius:0};

// HUD (head-locked mini toolbar)
let hud=null, hudPlace=null, hudFollow=null, hudHide=null, hudChat=null;

function makeHudIcon(text, w=0.14, h=0.06){
  const cvs=document.createElement('canvas'); cvs.width=256; cvs.height=128; const ctx=cvs.getContext('2d');
  ctx.fillStyle='#22303a'; ctx.fillRect(0,0,256,128);
  ctx.strokeStyle='#4b6a84'; ctx.lineWidth=4; ctx.strokeRect(2,2,252,124);
  ctx.fillStyle='#cfe8ff'; ctx.font='bold 44px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,64);
  const tex=new THREE.CanvasTexture(cvs); const mat=new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat); return mesh;
}

function ensureHUD(){
  if (hud) return;
  hud = new THREE.Group();
  hudPlace = makeHudIcon('Place'); hudPlace.position.set(-0.24,-0.08,0); hudPlace.userData.action='place-markers';
  hudFollow = makeHudIcon('Follow'); hudFollow.position.set(-0.08,-0.08,0); hudFollow.userData.action='toggle-follow';
  hudChat = makeHudIcon('Chat'); hudChat.position.set(0.08,-0.08,0); hudChat.userData.action='toggle-chat';
  hudHide = makeHudIcon('Hide'); hudHide.position.set(0.24,-0.08,0); hudHide.userData.action='hide-panel';
  hud.add(hudPlace); hud.add(hudFollow); hud.add(hudChat); hud.add(hudHide); scene.add(hud);
  interactiveTargets.push(hudPlace, hudFollow, hudChat, hudHide);
  hud.onBeforeRender = ()=>{
    const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
    const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
    const pos=camPos.clone().add(camDir.multiplyScalar(0.7));
    hud.position.copy(pos);
    hud.lookAt(camPos);
  };
}

function redrawPanelCanvas(){
  if(!panelCtx||!panelCanvas) return;
  const cvs=panelCanvas, ctx=panelCtx; ctx.clearRect(0,0,cvs.width,cvs.height);
  ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.fillStyle='#cde3ff'; ctx.font='bold 48px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('AR UI Fallback: Panel', 512, 110);
  ctx.font='30px system-ui';
  const sub = panelMode==='head'? 'Aim and Place. Then Dock.' : panelMode==='docked'? 'Docked. Use buttons below.' : 'Hidden';
  ctx.fillText(sub, 512, 170);
  // Buttons: Place / Dock|Follow / Hide
  ctx.fillStyle='#1e88ff'; ctx.fillRect(250, 250, 220, 80); ctx.fillStyle='#ffffff'; ctx.font='bold 36px system-ui'; ctx.fillText('Place', 360, 290);
  ctx.fillStyle='#546e7a'; ctx.fillRect(510, 250, 220, 80); ctx.fillStyle='#ffffff'; ctx.font='bold 28px system-ui'; ctx.fillText(panelMode==='head'? 'Dock' : 'Follow', 620, 290);
  ctx.fillStyle='#455a64'; ctx.fillRect(770, 250, 220, 80); ctx.fillStyle='#ffffff'; ctx.font='bold 28px system-ui'; ctx.fillText('Hide', 880, 290);
  if(panelTex) panelTex.needsUpdate=true;
}

function ensureFallbackUI(session){
  const type = session?.domOverlayState?.type; // if DOM overlay works, panel is optional
  if (type) return;
  if (fallbackPanel) return;
  // draw canvas panel with buttons
  panelCanvas=document.createElement('canvas'); panelCanvas.width=1024; panelCanvas.height=512; panelCtx=panelCanvas.getContext('2d');
  panelTex=new THREE.CanvasTexture(panelCanvas); panelTex.anisotropy=8; const mat=new THREE.MeshBasicMaterial({map:panelTex, transparent:true, side:THREE.DoubleSide});
  fallbackPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.8), mat);
  fallbackPanel = new THREE.Group(); fallbackPanel.add(fallbackPanelMesh);
  // invisible buttons: Place / Dock-Follow / Hide
  const btnMat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.0001, side:THREE.DoubleSide});
  const btnGeo=new THREE.PlaneGeometry(0.36,0.12);
  fallbackButtonMesh=new THREE.Mesh(btnGeo, btnMat); fallbackButtonMesh.position.set(-0.26,-0.02,0.001); fallbackButtonMesh.userData.action='place-markers'; fallbackPanel.add(fallbackButtonMesh);
  fallbackBtnFollow=new THREE.Mesh(btnGeo.clone(), btnMat.clone()); fallbackBtnFollow.position.set(0.0,-0.02,0.001); fallbackBtnFollow.userData.action='toggle-follow'; fallbackPanel.add(fallbackBtnFollow);
  fallbackBtnHide=new THREE.Mesh(btnGeo.clone(), btnMat.clone()); fallbackBtnHide.position.set(0.26,-0.02,0.001); fallbackBtnHide.userData.action='hide-panel'; fallbackPanel.add(fallbackBtnHide);
  interactiveTargets.length=0; interactiveTargets.push(fallbackButtonMesh, fallbackPanelMesh, fallbackBtnFollow, fallbackBtnHide);
  scene.add(fallbackPanel);
  // Per-frame positioning depending on mode
  fallbackPanel.onBeforeRender = ()=>{
    const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
    const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
    const pos=camPos.clone().add(camDir.multiplyScalar(0.9));
    if(panelMode==='head') { fallbackPanel.visible=true; fallbackPanel.position.copy(pos); }
    else if(panelMode==='docked') { fallbackPanel.visible=true; fallbackPanel.position.copy(dockedPos); }
    fallbackPanel.lookAt(camPos);
  };
  redrawPanelCanvas();
}

function ensureControllers(session){
  if (controller0 && controller1) return;
  const onSelect=(e)=>{
    const src=e.target; _tmpMat.identity().extractRotation(src.matrixWorld);
    const origin=new THREE.Vector3().setFromMatrixPosition(src.matrixWorld);
    const direction=new THREE.Vector3(0,0,-1).applyMatrix4(_tmpMat).normalize();
    raycaster.set(origin,direction);
    const isects=raycaster.intersectObjects(interactiveTargets,true);
    if(isects.length>0){
      const hit=isects[0].object?.userData?.action||'panel';
      if(hit==='place-markers' && haveHitPose){
        markers.position.set(lastHitPos.x,lastHitPos.y,lastHitPos.z);
        dockedPos.set(lastHitPos.x,lastHitPos.y+0.1,lastHitPos.z);
        panelMode='docked'; redrawPanelCanvas();
        try{ if(fallbackButtonMesh?.material){ fallbackButtonMesh.material.opacity=0.2; setTimeout(()=>fallbackButtonMesh.material.opacity=0.0001,150);} }catch{}
      } else if(hit==='toggle-follow'){
        panelMode = panelMode==='head' ? 'docked' : 'head';
        redrawPanelCanvas();
        if(panelMode==='head' && fallbackPanel) fallbackPanel.visible=true;
      } else if(hit==='hide-panel'){
        panelMode='hidden'; if(fallbackPanel) fallbackPanel.visible=false; if(hud) hud.visible=false;
      } else if(hit==='toggle-chat'){
        if (overlayRoot){ const cur = overlayRoot.style.display; overlayRoot.style.display = (cur==='none')?'':'none'; }
      } else {
        const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
        const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
        const target=camPos.add(camDir.multiplyScalar(2));
        markers.position.copy(target);
        markers.position.y=THREE.MathUtils.clamp(markers.position.y,-2,5);
      }
    } else {
      console.debug('select: no panel hit');
    }
  };
  controller0 = renderer.xr.getController(0); controller0.addEventListener('select', onSelect); controller0.addEventListener('selectstart', onSelect); scene.add(controller0);
  controller1 = renderer.xr.getController(1); controller1.addEventListener('select', onSelect); controller1.addEventListener('selectstart', onSelect); scene.add(controller1);
}

function ensureGlobalSelect(session){
  if (!session) return; const refSpace=renderer.xr.getReferenceSpace(); const q=new THREE.Quaternion();
  const handle=(e)=>{ if(!fallbackPanelMesh) return; try{ const pose=e.frame?.getPose?.(e.inputSource?.targetRaySpace, refSpace); if(!pose)return; const p=pose.transform.position; const o=pose.transform.orientation; const origin=new THREE.Vector3(p.x,p.y,p.z); q.set(o.x,o.y,o.z,o.w); const direction=new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize(); raycaster.set(origin,direction); const isects=raycaster.intersectObjects(interactiveTargets,true); if(isects.length>0){ const hit=isects[0].object?.userData?.action||'panel'; if(hit==='place-markers' && haveHitPose){ markers.position.set(lastHitPos.x,lastHitPos.y,lastHitPos.z); dockedPos.set(lastHitPos.x,lastHitPos.y+0.1,lastHitPos.z); panelMode='docked'; redrawPanelCanvas(); } else if(hit==='toggle-follow'){ panelMode = panelMode==='head' ? 'docked' : 'head'; redrawPanelCanvas(); if(panelMode==='head' && fallbackPanel) fallbackPanel.visible=true; } else if(hit==='hide-panel'){ panelMode='hidden'; if(fallbackPanel) fallbackPanel.visible=false; if(hud) hud.visible=false; } else if(hit==='toggle-chat'){ if (overlayRoot){ const cur=overlayRoot.style.display; overlayRoot.style.display = (cur==='none')?'':'none'; } } else { const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const target=camPos.add(camDir.multiplyScalar(2)); markers.position.copy(target); markers.position.y=THREE.MathUtils.clamp(markers.position.y,-2,5); } } }catch{} };
  session.addEventListener('select', handle); session.addEventListener('selectstart', handle);
}

// Labels
function makeLabel(text){
  const cv=document.createElement('canvas'); const s=256; cv.width=cv.height=s; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,s/2,s/2);
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(12,5.5,1); sp.renderOrder=999; sp.userData.baseScale={x:12,y:5.5}; return sp;
}
function updateLabelScales(){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const tmp=new THREE.Vector3(); for(const m of markers.children){ if(!m||!m.children) continue; m.getWorldPosition(tmp); const d=camPos.distanceTo(tmp); const s=THREE.MathUtils.clamp(1.2/Math.max(0.5,d),0.35,1.1); for(const ch of m.children){ if(ch&&ch.isSprite){ const base=ch.userData?.baseScale||{x:12,y:5.5}; ch.scale.set(base.x*s, base.y*s, 1); ch.renderOrder=999; } } } }

// Presets
const PRESETS_DEFAULT = [
  { name:'鄒ｽ逕ｰ T1 螻墓悍', lat:35.553972, lon:139.779978, radius:30 },
  { name:'謌千伐 B 蜊礼ｫｯ', lat:35.757589, lon:140.383137, radius:30 },
  { name:'莨贋ｸｹ 蜊∽ｸ牙・', lat:34.777094, lon:135.438095, radius:20 },
  { name:'驍｣隕・轢ｬ髟ｷ蟲ｶ', lat:26.183469, lon:127.646278, radius:25 },
  { name:'荳ｭ驛ｨ 繧ｻ繝ｳ繝医Ξ繧｢', lat:34.858333, lon:136.805278, radius:30 }
];
const PRESET_KEY='flightObserver.presets';
function getPresets(){ try{ return JSON.parse(localStorage.getItem(PRESET_KEY)||'[]').concat(PRESETS_DEFAULT);}catch{ return PRESETS_DEFAULT; } }
function renderPresetSelect(){ const sel=document.getElementById('preset'); if(!sel) return; sel.innerHTML=''; getPresets().forEach((p,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=p.name; sel.appendChild(o);}); }
function applyPreset(idx){ const p=getPresets()[Number(idx)]; if(!p) return; document.getElementById('lat').value=String(p.lat); document.getElementById('lon').value=String(p.lon); document.getElementById('radius').value=String(p.radius); refresh(); }
document.getElementById('preset')?.addEventListener('change', (e)=>applyPreset(e.target.value));
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My蝨ｰ轤ｹ ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// Flight placement
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function makeMarkerMesh({callsign,hdg}){ const g=new THREE.ConeGeometry(3,8,12), m=new THREE.MeshStandardMaterial({color:0xffc83d}); const mesh=new THREE.Mesh(g,m); mesh.rotation.x=-Math.PI/2; const label=makeLabel(callsign||'N/A'); label.position.set(0,5,0); mesh.add(label); const yaw=THREE.MathUtils.degToRad(hdg||0); mesh.rotation.z=-yaw; return mesh; }
function placeMarkers(center, flights){ markers.clear(); flights.forEach((f,i)=>{ const {x,y}=llDiffMeters(center.lat,center.lon,f.lat,f.lon); const m=makeMarkerMesh(f); m.userData.idx=i; m.position.set(x/10,0,y/10); markers.add(m); }); if(typeof applySelectionEffects==='function') applySelectionEffects(); }

function genDemoStates(center, n=6){
  const out=[]; for(let i=0;i<n;i++){
    const ang= (i/n)*Math.PI*2; const dkm= 2 + (i%3);
    const dlat = (dkm/111.132); const dlon = (dkm/(111.320*Math.cos(center.lat*Math.PI/180)));
    const lat = center.lat + Math.sin(ang)*dlat; const lon = center.lon + Math.cos(ang)*dlon;
    out.push({ callsign:`DEMO${i+1}`, lat, lon, geo_alt: 200+i*50, vel: 70+i*5, hdg: (ang*180/Math.PI)%360 });
  }
  return out;
}

async function refresh(){
  const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
  const url=`${CONFIG.FLIGHT_ENDPOINT}
function hookListHandlers(states){
  const box=#list; if(!box) return;
  box.querySelectorAll('.item').forEach(el=>{
    el.onclick = async ()=>{
      const idx=Number(el.getAttribute('data-idx'));
      selectedIdx = (selectedIdx===idx? -1 : idx);
      applySelectionEffects();
      const s=states[idx]; if(!s) return;
      const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon};
      try{ const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})}); const {text}=await g.json(); appendLog(text||'(no response)'); }catch(e){ console.error('describe failed',e); }
    };
  });
}
function applySelectionEffects(){
  markers.children.forEach((m)=>{ if(!m.isMesh) return; const on = (m.userData?.idx===selectedIdx); m.scale.setScalar(on?1.2:1.0); if(m.material?.color){ m.material.color.setHex(on?0x66d9ff:0xffc83d); } });
  document.querySelectorAll('#list .item').forEach(el=>{ const idx=Number(el.getAttribute('data-idx')); el.classList.toggle('selected', idx===selectedIdx); });
  const info=document.getElementById('info'); if(!info) return; if(selectedIdx<0){ info.innerHTML=''; return; }
  const s=lastStates[selectedIdx]; if(!s){ info.innerHTML=''; return; }
  const alt=Math.round(s.geo_alt??s.baro_alt??0); const spd=Math.round((s.vel??0)*1.94384); const hdg=Math.round(s.hdg??0);
  info.innerHTML = <div class='card'><div class='title'></div><div class='row'>alt  m •  kt • °</div></div>;
}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
  try{
    console.log('fetch nearby:', url);
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    console.log('nearby resp:', j?.states?.length, j?.degraded?'degraded':'' , j?.debug||'');
    lastStates=j.states||[];
    $('#src').textContent=`source: opensky | flights: ${lastStates.length}`;
    placeMarkers({lat,lon}, lastStates);
    renderList(lastStates); hookListHandlers(lastStates);
    if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(e){ console.error('fetch failed', e); alert('蜿門ｾ励↓螟ｱ謨・ '+(e?.message||e)); }
}

function renderList(states){
  const box=$('#list'); if(!box) return;
  box.innerHTML='<h3>繝輔Λ繧､繝井ｸ隕ｧ</h3>' + (states||[]).map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join('');
  box.querySelectorAll('.item').forEach(el=>el.addEventListener('click',async()=>{
    const s=states[Number(el.getAttribute('data-idx'))]; if(!s) return;
    const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon};
    try{
      const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})});
      const {text}=await g.json(); appendLog(text||'(no response)');
    }catch(e){ console.error('describe failed',e); }
  }));
}

function toggleView(){ grid.visible=!grid.visible; }

// Ask (region-first)
const askBtn=$('#ask'); if(askBtn) askBtn.onclick=async ()=>{ const qEl=$('#q'); const speakEl=$('#speak'); const q=(qEl?.value||'').trim(); if(!q){ appendLog('雉ｪ蝠上ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞'); return; } const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) }; const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined; try{ const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })}); const { text }=await g.json(); appendLog(text||'(no response)'); if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); } }catch(e){ console.error('ask failed', e); appendLog('繧ｨ繝ｩ繝ｼ: '+(e?.message||e)); } };
function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }

// AR
async function startAR(){
  try{
    if(!navigator.xr){ alert('WebXR譛ｪ蟇ｾ蠢懊・繝悶Λ繧ｦ繧ｶ縺ｧ縺・); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if(ok===false){ alert('immersive-ar譛ｪ蟇ｾ蠢懊・迺ｰ蠅・〒縺・); return; }
    let session;
    try{
      const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hand-tracking','hit-test'], domOverlay:{ root: overlayRoot } };
      renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsStrict);
    }catch(_){
      const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hand-tracking','hit-test'], domOverlay:{ root: overlayRoot } };
      renderer.xr.setReferenceSpaceType('local-floor'); session=await navigator.xr.requestSession('immersive-ar', optsLoose);
    }
    await renderer.xr.setSession(session);

    // Controller visuals
    try{ const factory=new XRControllerModelFactory(); controllerGrip0=renderer.xr.getControllerGrip(0); controllerGrip0.add(factory.createControllerModel(controllerGrip0)); scene.add(controllerGrip0); controllerGrip1=renderer.xr.getControllerGrip(1); controllerGrip1.add(factory.createControllerModel(controllerGrip1)); scene.add(controllerGrip1); const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]); const mkLine=()=>new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:0x00aaff})); controllerLine0=mkLine(); controllerLine0.scale.z=2.0; controllerLine1=mkLine(); controllerLine1.scale.z=2.0; }catch(e){ console.warn('controller visuals failed', e);}    

    // Hit-test
    try{ if(session.requestReferenceSpace && session.requestHitTestSource){ viewerSpace=await session.requestReferenceSpace('viewer'); hitTestSource=await session.requestHitTestSource({ space: viewerSpace }); } }catch(e){ console.warn('Hit Test unavailable', e); }

    // Fallback UI + HUD + controllers
    ensureFallbackUI(session); ensureHUD(); ensureControllers(session); ensureGlobalSelect(session);
    if(controllerLine0) controller0.add(controllerLine0); if(controllerLine1) controller1.add(controllerLine1);

    // Reticle
    try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch(e){ console.warn('reticle init failed', e); }

    console.log('domOverlayState=', session.domOverlayState?.type, 'isPresenting=', renderer.xr.isPresenting);
    try{ const srcs=Array.from(renderer.xr.getSession()?.inputSources||[]).map(s=>({profiles:s.profiles, hand:!!s.hand, mode:s.targetRayMode})); console.log('inputSources=', srcs);}catch{}

    useAR=true; animateAR(session);
    session.addEventListener('end', ()=>{ if(fallbackPanel){ scene.remove(fallbackPanel); fallbackPanel=null; fallbackPanelMesh=null; } controller0=null; controller1=null; hitTestSource=null; viewerSpace=null; haveHitPose=false; reticle=null; });
  }catch(e){ console.error('startAR failed', e); alert('AR髢句ｧ九↓螟ｱ謨・ '+(e?.message||e)); }
}

function animateAR(session){ const refSpace=renderer.xr.getReferenceSpace(); renderer.setAnimationLoop((t,frame)=>{ if(frame){ if(hitTestSource){ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(refSpace); if(pose){ const p=pose.transform.position; lastHitPos.set(p.x,p.y,p.z); haveHitPose=true; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { haveHitPose=false; if(reticle) reticle.visible=false; } } trackHands(session, frame, refSpace); } if(fallbackPanel){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const pos=camPos.clone().add(camDir.multiplyScalar(0.9)); if(panelMode==='head'){ fallbackPanel.visible=true; fallbackPanel.position.copy(pos);} else if(panelMode==='docked'){ fallbackPanel.visible=true; fallbackPanel.position.copy(dockedPos);} fallbackPanel.lookAt(camPos); } updateLabelScales(); renderer.render(scene,camera); }); }

// Track hand pinches: one-hand moves lat/lon, two-hand scales radius
function trackHands(session, frame, refSpace){
  const lat0 = Number(latI.value), lon0 = Number(lonI.value);
  const hands = {};
  for (const src of session.inputSources){
    if(!src.hand) continue;
    const tip = src.hand.get('index-finger-tip');
    const thumb = src.hand.get('thumb-tip');
    const jt = tip && frame.getJointPose(tip, refSpace);
    const jb = thumb && frame.getJointPose(thumb, refSpace);
    if(!jt || !jb) continue;
    const dx = jt.transform.position.x - jb.transform.position.x;
    const dy = jt.transform.position.y - jb.transform.position.y;
    const dz = jt.transform.position.z - jb.transform.position.z;
    const dist = Math.hypot(dx,dy,dz);
    const pinching = dist < 0.025;
    hands[src.handedness] = { pinching, tip: jt.transform.position };
  }
  const left = hands.left?.pinching; const right = hands.right?.pinching;
  // Two-hand pinch 竊・radius
  if (left && right){
    const lx=hands.left.tip.x, lz=hands.left.tip.z; const rx=hands.right.tip.x, rz=hands.right.tip.z;
    const d = Math.hypot(lx-rx, lz-rz);
    if(!pinchTwo.active){ pinchTwo={active:true,startDist:d,baseRadius:Number(radI.value||30)}; }
    const factor = THREE.MathUtils.clamp(d / (pinchTwo.startDist||d), 0.4, 2.5);
    const newR = THREE.MathUtils.clamp(pinchTwo.baseRadius * factor, 5, 120);
    radI.value = String(Math.round(newR));
  } else if (pinchTwo.active) {
    pinchTwo.active=false; refresh();
  }
  // One-hand pinch (exclusive XOR)
  const single = (left ^ right) ? (left ? 'left' : 'right') : null;
  if (single){
    const tip = hands[single].tip; const x=tip.x, z=tip.z;
    if(!pinchOne.active){ pinchOne={active:true,start:{x,z},base:{lat:lat0, lon:lon0}}; }
    const dxm = x - pinchOne.start.x; const dzm = z - pinchOne.start.z; // meters in local-floor
    const dlon = dxm / (111320*Math.cos(pinchOne.base.lat*Math.PI/180));
    const dlat = dzm / 111132; // approximate: +z竊貞圏
    latI.value = String(pinchOne.base.lat + dlat);
    lonI.value = String(pinchOne.base.lon + dlon);
  } else if (pinchOne.active){
    pinchOne.active=false; refresh();
  }
}

// Kick-off
refresh();


