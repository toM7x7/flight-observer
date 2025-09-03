import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/XRControllerModelFactory.js';
import { CONFIG } from './config.js';

// DOM helpers
const $ = (s)=>document.querySelector(s);
const c = $('#c'), latI=$('#lat'), lonI=$('#lon'), radI=$('#radius');
$('#fetchBtn').onclick = refresh;
$('#toggleBtn').onclick = ()=>toggleView();
$('#startAR').onclick = startAR;

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
const interactiveTargets=[]; const raycaster=new THREE.Raycaster(); const _tmpMat=new THREE.Matrix4();
let controller0=null, controller1=null; let controllerGrip0=null, controllerGrip1=null; let controllerLine0=null, controllerLine1=null;
let hitTestSource=null, viewerSpace=null, haveHitPose=false; const lastHitPos=new THREE.Vector3(); let reticle=null;

function ensureFallbackUI(session){
  const type = session?.domOverlayState?.type; // if DOM overlay works, panel is optional
  if (type) return;
  if (fallbackPanel) return;
  // draw canvas panel with a button
  const cvs=document.createElement('canvas'); cvs.width=1024; cvs.height=512; const ctx=cvs.getContext('2d');
  ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.fillStyle='#cde3ff'; ctx.font='bold 48px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('AR UI Fallback: Panel', 512, 120);
  ctx.font='32px system-ui'; ctx.fillText('Trigger on panel to place markers (hit-test if available).',512,200);
  ctx.fillStyle='#1e88ff'; ctx.fillRect(362,300,300,100); ctx.fillStyle='#ffffff'; ctx.font='bold 40px system-ui'; ctx.fillText('Place Here',512,350);
  const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=8; const mat=new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide});
  fallbackPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.6), mat);
  fallbackPanel = new THREE.Group(); fallbackPanel.add(fallbackPanelMesh);
  // invisible button for broad hit area
  const btnGeo=new THREE.PlaneGeometry(0.6,0.2); const btnMat=new THREE.MeshBasicMaterial({color:0x1e88ff, transparent:true, opacity:0.0001, side:THREE.DoubleSide});
  fallbackButtonMesh=new THREE.Mesh(btnGeo, btnMat); fallbackButtonMesh.position.set(0,-0.02,0.001); fallbackButtonMesh.userData.action='place-markers';
  fallbackPanel.add(fallbackButtonMesh);
  interactiveTargets.length=0; interactiveTargets.push(fallbackButtonMesh, fallbackPanelMesh);
  scene.add(fallbackPanel);
}

function ensureControllers(session){
  if (controller0 && controller1) return;
  const onSelect=(e)=>{
    if (!fallbackPanelMesh) return;
    const src=e.target; _tmpMat.identity().extractRotation(src.matrixWorld);
    const origin=new THREE.Vector3().setFromMatrixPosition(src.matrixWorld);
    const direction=new THREE.Vector3(0,0,-1).applyMatrix4(_tmpMat).normalize();
    raycaster.set(origin,direction);
    const isects=raycaster.intersectObjects(interactiveTargets,true);
    if(isects.length>0){
      const hit=isects[0].object?.userData?.action||'panel';
      if(hit==='place-markers' && haveHitPose){ markers.position.set(lastHitPos.x,lastHitPos.y,lastHitPos.z); if(fallbackPanel) fallbackPanel.position.set(lastHitPos.x,lastHitPos.y+0.1,lastHitPos.z); }
      else { const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const target=camPos.add(camDir.multiplyScalar(2)); markers.position.copy(target); markers.position.y=THREE.MathUtils.clamp(markers.position.y,-2,5); }
    }
  };
  controller0 = renderer.xr.getController(0); controller0.addEventListener('select', onSelect); controller0.addEventListener('selectstart', onSelect); scene.add(controller0);
  controller1 = renderer.xr.getController(1); controller1.addEventListener('select', onSelect); controller1.addEventListener('selectstart', onSelect); scene.add(controller1);
}

function ensureGlobalSelect(session){
  if (!session) return; const refSpace=renderer.xr.getReferenceSpace(); const q=new THREE.Quaternion();
  const handle=(e)=>{ if(!fallbackPanelMesh) return; try{ const pose=e.frame?.getPose?.(e.inputSource?.targetRaySpace, refSpace); if(!pose)return; const p=pose.transform.position; const o=pose.transform.orientation; const origin=new THREE.Vector3(p.x,p.y,p.z); q.set(o.x,o.y,o.z,o.w); const direction=new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize(); raycaster.set(origin,direction); const isects=raycaster.intersectObjects(interactiveTargets,true); if(isects.length>0){ const hit=isects[0].object?.userData?.action||'panel'; if(hit==='place-markers' && haveHitPose){ markers.position.set(lastHitPos.x,lastHitPos.y,lastHitPos.z); if(fallbackPanel) fallbackPanel.position.set(lastHitPos.x,lastHitPos.y+0.1,lastHitPos.z); } else { const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const target=camPos.add(camDir.multiplyScalar(2)); markers.position.copy(target); markers.position.y=THREE.MathUtils.clamp(markers.position.y,-2,5); } } }catch{} };
  session.addEventListener('select', handle); session.addEventListener('selectstart', handle);
}

// Labels
function makeLabel(text){
  const cv=document.createElement('canvas'); const s=256; cv.width=cv.height=s; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0f141a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#cde3ff'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,s/2,s/2);
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(16,8,1); sp.renderOrder=999; sp.userData.baseScale={x:16,y:8}; return sp;
}
function updateLabelScales(){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const tmp=new THREE.Vector3(); for(const m of markers.children){ if(!m||!m.children) continue; m.getWorldPosition(tmp); const d=camPos.distanceTo(tmp); const s=THREE.MathUtils.clamp(1.5/Math.max(0.3,d),0.6,2.2); for(const ch of m.children){ if(ch&&ch.isSprite){ const base=ch.userData?.baseScale||{x:16,y:8}; ch.scale.set(base.x*s, base.y*s, 1); ch.renderOrder=999; } } } }

// Presets
const PRESETS_DEFAULT = [
  { name:'羽田 T1 展望', lat:35.553972, lon:139.779978, radius:30 },
  { name:'成田 B 南端', lat:35.757589, lon:140.383137, radius:30 },
  { name:'伊丹 十三側', lat:34.777094, lon:135.438095, radius:20 },
  { name:'那覇 瀬長島', lat:26.183469, lon:127.646278, radius:25 },
  { name:'中部 セントレア', lat:34.858333, lon:136.805278, radius:30 }
];
const PRESET_KEY='flightObserver.presets';
function getPresets(){ try{ return JSON.parse(localStorage.getItem(PRESET_KEY)||'[]').concat(PRESETS_DEFAULT);}catch{ return PRESETS_DEFAULT; } }
function renderPresetSelect(){ const sel=document.getElementById('preset'); if(!sel) return; sel.innerHTML=''; getPresets().forEach((p,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=p.name; sel.appendChild(o);}); }
function applyPreset(idx){ const p=getPresets()[Number(idx)]; if(!p) return; document.getElementById('lat').value=String(p.lat); document.getElementById('lon').value=String(p.lon); document.getElementById('radius').value=String(p.radius); refresh(); }
document.getElementById('preset')?.addEventListener('change', (e)=>applyPreset(e.target.value));
document.getElementById('savePreset')?.addEventListener('click', ()=>{ const mine=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]'); mine.unshift({ name:`My地点 ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) }); localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); renderPresetSelect(); });
renderPresetSelect();

// Flight placement
function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180); return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }
function makeMarkerMesh({callsign,hdg}){ const g=new THREE.ConeGeometry(3,8,12), m=new THREE.MeshStandardMaterial({color:0xffc83d}); const mesh=new THREE.Mesh(g,m); mesh.rotation.x=-Math.PI/2; const label=makeLabel(callsign||'N/A'); label.position.set(0,5,0); mesh.add(label); const yaw=THREE.MathUtils.degToRad(hdg||0); mesh.rotation.z=-yaw; return mesh; }
function placeMarkers(center, flights){ markers.clear(); flights.forEach(f=>{ const {x,y}=llDiffMeters(center.lat,center.lon,f.lat,f.lon); const m=makeMarkerMesh(f); m.position.set(x/10,0,y/10); markers.add(m); }); }

async function refresh(){ const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30); const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`; try{ const r=await fetch(url); if(!r.ok) throw new Error(`${r.status}`); const j=await r.json(); lastStates=j.states||[]; $('#src').textContent=`source: opensky | flights: ${lastStates.length}`; placeMarkers({lat,lon}, lastStates); if(!useAR) renderer.setAnimationLoop(()=>renderer.render(scene,camera)); }catch(e){ console.error('fetch failed', e); alert('取得に失敗: '+(e?.message||e)); } }

function toggleView(){ grid.visible=!grid.visible; }

// Ask (region-first)
const askBtn=$('#ask'); if(askBtn) askBtn.onclick=async ()=>{ const qEl=$('#q'); const speakEl=$('#speak'); const q=(qEl?.value||'').trim(); if(!q){ appendLog('質問を入力してください'); return; } const region={ lat:Number(latI.value), lon:Number(lonI.value), radius_km:Number(radI.value||30) }; const first=lastStates[0]; const flight=first? { callsign:first.callsign, alt_m:first.geo_alt??first.baro_alt??0, vel_ms:first.vel??0, hdg_deg:first.hdg??0, lat:first.lat, lon:first.lon } : undefined; try{ const g=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ message:q, region, flight })}); const { text }=await g.json(); appendLog(text||'(no response)'); if(speakEl?.checked && text){ const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })}); const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play(); } }catch(e){ console.error('ask failed', e); appendLog('エラー: '+(e?.message||e)); } };
function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }

// AR
async function startAR(){
  try{
    if(!navigator.xr){ alert('WebXR未対応のブラウザです'); return; }
    const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
    if(ok===false){ alert('immersive-ar未対応の環境です'); return; }
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

    // Fallback UI + controllers
    ensureFallbackUI(session); ensureControllers(session); ensureGlobalSelect(session);
    if(controllerLine0) controller0.add(controllerLine0); if(controllerLine1) controller1.add(controllerLine1);

    // Reticle
    try{ reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85 })); reticle.visible=false; scene.add(reticle);}catch(e){ console.warn('reticle init failed', e); }

    console.log('domOverlayState=', session.domOverlayState?.type, 'isPresenting=', renderer.xr.isPresenting);
    try{ const srcs=Array.from(renderer.xr.getSession()?.inputSources||[]).map(s=>({profiles:s.profiles, hand:!!s.hand, mode:s.targetRayMode})); console.log('inputSources=', srcs);}catch{}

    useAR=true; animateAR(session);
    session.addEventListener('end', ()=>{ if(fallbackPanel){ scene.remove(fallbackPanel); fallbackPanel=null; fallbackPanelMesh=null; } controller0=null; controller1=null; hitTestSource=null; viewerSpace=null; haveHitPose=false; reticle=null; });
  }catch(e){ console.error('startAR failed', e); alert('AR開始に失敗: '+(e?.message||e)); }
}

function animateAR(session){ const refSpace=renderer.xr.getReferenceSpace(); renderer.setAnimationLoop((t,frame)=>{ if(frame){ if(hitTestSource){ const results=frame.getHitTestResults(hitTestSource)||[]; if(results.length>0){ const pose=results[0].getPose(refSpace); if(pose){ const p=pose.transform.position; lastHitPos.set(p.x,p.y,p.z); haveHitPose=true; if(reticle){ reticle.visible=true; reticle.position.set(p.x,p.y,p.z); } } } else { haveHitPose=false; if(reticle) reticle.visible=false; } } } if(fallbackPanel){ const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos); const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); const pos=camPos.clone().add(camDir.multiplyScalar(0.9)); fallbackPanel.position.copy(pos); fallbackPanel.lookAt(camPos); } updateLabelScales(); renderer.render(scene,camera); }); }

// Kick-off
refresh();
