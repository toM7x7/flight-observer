import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CONFIG } from './config.js';

const $ = s=>document.querySelector(s);
const c=$('#c'), latI=$('#lat'), lonI=$('#lon'), radI=$('#radius');
$('#fetchBtn').onclick=refresh; $('#toggleBtn').onclick=()=>toggleView(); $('#startAR').onclick=startAR;

const renderer=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});
renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth,innerHeight); renderer.xr.enabled=true;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.01,2000);
const grid=new THREE.GridHelper(1000,40,0x2a3a4d,0x1a2735); grid.position.y=-1; scene.add(grid);
scene.add(new THREE.HemisphereLight(0xffffff,0x223344,1.0));
const markers=new THREE.Group(); scene.add(markers);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// 最新のフライト状態を保持（チャット用）
let lastStates = [];

// DOM overlay root と XR選択抑制
const overlayRoot = document.getElementById('overlay');
document.addEventListener('beforexrselect', (ev)=>{
  if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault();
});

// === プリセット ===
const PRESETS_DEFAULT = [
  { name:'羽田T1展望',     lat:35.553972, lon:139.779978, radius:30 },
  { name:'成田B南端',      lat:35.757589, lon:140.383137, radius:30 },
  { name:'伊丹 千里川',    lat:34.777094, lon:135.438095, radius:20 },
  { name:'那覇 瀬長島',    lat:26.183469, lon:127.646278, radius:25 },
  { name:'中部 セントレア', lat:34.858333, lon:136.805278, radius:30 }
];
const PRESET_KEY='flightObserver.presets';
function getPresets(){ return JSON.parse(localStorage.getItem(PRESET_KEY)||'[]').concat(PRESETS_DEFAULT); }
function renderPresetSelect(){
  const sel = document.getElementById('preset'); if(!sel) return; sel.innerHTML='';
  getPresets().forEach((p,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=p.name; sel.appendChild(o); });
}
function applyPreset(idx){
  const p = getPresets()[idx]; if(!p) return;
  document.getElementById('lat').value = String(p.lat);
  document.getElementById('lon').value = String(p.lon);
  document.getElementById('radius').value = String(p.radius);
  refresh();
}
document.getElementById('preset')?.addEventListener('change', e=>applyPreset(e.target.value));
document.getElementById('savePreset')?.addEventListener('click', ()=>{
  const mine = JSON.parse(localStorage.getItem(PRESET_KEY)||'[]');
  mine.unshift({ name:`My地点 ${new Date().toLocaleString()}`, lat:Number(latI.value), lon:Number(lonI.value), radius:Number(radI.value) });
  localStorage.setItem(PRESET_KEY, JSON.stringify(mine.slice(0,20))); // 上限20件
  renderPresetSelect();
});
renderPresetSelect();

// === マーカー/ラベル ===
function makeMarker({callsign,hdg}){ const g=new THREE.ConeGeometry(3,8,12), m=new THREE.MeshStandardMaterial({color:0xffc83d});
  const mesh=new THREE.Mesh(g,m); mesh.rotation.x=-Math.PI/2; const label=makeLabel(callsign||'N/A'); label.position.set(0,5,0); mesh.add(label);
  const yaw=THREE.MathUtils.degToRad(hdg||0); mesh.rotation.z=-yaw; return mesh; }
function makeLabel(text){ const cv=document.createElement('canvas'), s=256; cv.width=cv.height=s; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0f141a';ctx.fillRect(0,0,s,s);ctx.fillStyle='#cde3ff';ctx.font='bold 46px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,s/2,s/2);
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true})); sp.scale.set(16,8,1); return sp; }

let useAR=false; function toggleView(){grid.visible=!grid.visible}
async function startAR(){
  try {
    if (!navigator.xr) { alert('WebXR未対応のブラウザです'); return; }
    const opts = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay','hand-tracking','local-floor'],
      domOverlay: { root: overlayRoot }
    };
    renderer.xr.setReferenceSpaceType('local-floor');
    const session = await navigator.xr.requestSession('immersive-ar', opts);
    await renderer.xr.setSession(session);

    // コントローラ squeeze で拡縮（右=拡大、左=縮小）
    session.addEventListener('squeeze', (e)=>{
      const sign = e.inputSource?.handedness === 'right' ? 1 : -1;
      const s = THREE.MathUtils.clamp(markers.scale.x * (1 + 0.1*sign), 0.1, 10);
      markers.scale.setScalar(s);
    });

    useAR = true;
    animateWithHands(session);
  } catch (e) {
    console.error('startAR failed', e);
    alert('AR開始に失敗: '+(e?.message||e));
  }
}

function animate(){ renderer.setAnimationLoop(()=>renderer.render(scene,camera)); }

function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180);
  return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }

function placeMarkers(center,flights){ markers.clear(); flights.forEach(f=>{ const {x,y}=llDiffMeters(center.lat,center.lon,f.lat,f.lon);
  const m=makeMarker(f); m.position.set(x/10,0,y/10); markers.add(m); }); }

async function refresh(){
  const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
  const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
  try{ const r=await fetch(url); if(!r.ok) throw new Error(`${r.status}`); const j=await r.json();
    lastStates = j.states || [];
    $('#src').textContent=`source: opensky | flights: ${lastStates.length}`; placeMarkers({lat,lon},lastStates); renderList(lastStates); if(!useAR) animate();
  }catch(e){ console.error('fetch failed',e); alert('取得に失敗: '+(e?.message||e)); }
}

function renderList(states){
  const box=$('#list'); box.innerHTML='<h3>フライト一覧</h3>'+states.map((s,i)=>`<div class=\"item\" data-idx=\"${i}\"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join('');
  box.querySelectorAll('.item').forEach(el=>el.addEventListener('click',async()=>{
    const s=states[Number(el.getAttribute('data-idx'))]; const flight={callsign:s.callsign,alt_m:s.geo_alt??s.baro_alt??0,vel_ms:s.vel??0,hdg_deg:s.hdg??0,lat:s.lat,lon:s.lon};
    // 1) Gemini要点
    const g=await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flight})});
    const {text}=await g.json();
    // 2) Aivis読み上げ
    const t=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,model_uuid:CONFIG.AIVIS_MODEL_UUID,use_ssml:true})});
    const buf=await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play();
  }));
}
refresh();

// === AR×AI対話: チャット送信（DOM Overlay） ===
const askBtn = document.getElementById('ask');
if (askBtn) askBtn.onclick = async ()=>{
  const qEl = document.getElementById('q');
  const speakEl = document.getElementById('speak');
  const q = (qEl?.value||'').trim();
  if (!q) { appendLog('質問を入力してください'); return; }
  const first = document.querySelector('#list .item');
  const idx = first ? Number(first.getAttribute('data-idx')||0) : 0;
  const s = lastStates[idx];
  if (!s) { appendLog('フライトが未選択/未取得です'); return; }
  const flight = { callsign:s.callsign, alt_m:s.geo_alt??s.baro_alt??0, vel_ms:s.vel??0, hdg_deg:s.hdg??0, lat:s.lat, lon:s.lon };
  try {
    const g = await fetch('/api/describe-flight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ flight, question:q })});
    const { text } = await g.json();
    appendLog(text||'(no response)');
    if (speakEl?.checked && text) {
      const t = await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ text, model_uuid: CONFIG.AIVIS_MODEL_UUID, use_ssml:true })});
      const buf = await t.arrayBuffer(); new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}))).play();
    }
  } catch (e) {
    console.error('ask failed', e);
    appendLog('エラー: '+(e?.message||e));
  }
};

function appendLog(m){ const el=document.getElementById('log'); if(!el) return; el.innerHTML += `<div>${m}</div>`; el.scrollTop=el.scrollHeight; }

// === ハンドトラッキング: 片手ピンチ=上下, 両手ピンチ=拡縮 ===
let oneHand = { active:false, startY:0, baseY:0 };
let twoHands = { active:false, startDist:0, baseScale:1 };

function animateWithHands(session){
  const refSpace = renderer.xr.getReferenceSpace();
  renderer.setAnimationLoop((t, frame)=>{
    if (frame) {
      const hands = {};
      for (const src of session.inputSources){
        if (!src.hand) continue;
        const h = src.handedness; // 'left' | 'right'
        const tip = src.hand.get('index-finger-tip');
        const thumb = src.hand.get('thumb-tip');
        const jt = tip && frame.getJointPose(tip, refSpace);
        const jb = thumb && frame.getJointPose(thumb, refSpace);
        if(!jt || !jb) continue;
        const dx = jt.transform.position.x - jb.transform.position.x;
        const dy = jt.transform.position.y - jb.transform.position.y;
        const dz = jt.transform.position.z - jb.transform.position.z;
        const dist = Math.hypot(dx,dy,dz);
        const pinching = dist < 0.025; // ~2.5cm 目安
        hands[h] = { pinching, y: jt.transform.position.y, x: jt.transform.position.x, z: jt.transform.position.z, tipPos: jt.transform.position };
      }

      // 片手ピンチ → 上下移動
      const leftP = !!hands.left?.pinching; const rightP = !!hands.right?.pinching;
      const which = leftP ^ rightP ? (leftP ? 'left' : 'right') : null;
      if (which){
        if(!oneHand.active){ oneHand={active:true,startY:hands[which].y,baseY:markers.position.y}; }
        const dy = hands[which].y - oneHand.startY;
        markers.position.y = THREE.MathUtils.clamp(oneHand.baseY + dy * 1.5, -2, 5);
      } else if (oneHand.active) {
        oneHand.active = false;
      }

      // 両手ピンチ → 拡縮
      if (hands.left?.pinching && hands.right?.pinching){
        const lx=hands.left.tipPos.x, ly=hands.left.tipPos.y, lz=hands.left.tipPos.z;
        const rx=hands.right.tipPos.x,ry=hands.right.tipPos.y,rz=hands.right.tipPos.z;
        const d = Math.hypot(lx-rx, ly-ry, lz-rz);
        if(!twoHands.active){ twoHands={active:true,startDist:d,baseScale:markers.scale.x}; }
        const f = THREE.MathUtils.clamp(d / (twoHands.startDist||d), 0.2, 5);
        markers.scale.setScalar(twoHands.baseScale * f);
      } else if (twoHands.active) {
        twoHands.active = false;
      }

      // コントローラ入力（スティック上下で高度）
      pollControllers(frame);
    }
    renderer.render(scene,camera);
  });
}

function pollControllers(frame){
  const session = renderer.xr.getSession(); if(!session) return;
  for (const src of session.inputSources){
    const gp = src.gamepad; if(!gp) continue;
    const y = gp.axes?.[3];
    if (typeof y === 'number' && Math.abs(y)>0.2) {
      markers.position.y = THREE.MathUtils.clamp(markers.position.y + (-y)*0.02, -2, 5);
    }
  }
}

