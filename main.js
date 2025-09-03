import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/ARButton.js';
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

function makeMarker({callsign,hdg}){ const g=new THREE.ConeGeometry(3,8,12), m=new THREE.MeshStandardMaterial({color:0xffc83d});
  const mesh=new THREE.Mesh(g,m); mesh.rotation.x=-Math.PI/2; const label=makeLabel(callsign||'N/A'); label.position.set(0,5,0); mesh.add(label);
  const yaw=THREE.MathUtils.degToRad(hdg||0); mesh.rotation.z=-yaw; return mesh; }
function makeLabel(text){ const cv=document.createElement('canvas'), s=256; cv.width=cv.height=s; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0f141a';ctx.fillRect(0,0,s,s);ctx.fillStyle='#cde3ff';ctx.font='bold 46px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,s/2,s/2);
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true})); sp.scale.set(16,8,1); return sp; }
let useAR=false; function toggleView(){grid.visible=!grid.visible}
async function startAR(){ document.body.appendChild(ARButton.createButton(renderer,{optionalFeatures:['dom-overlay'],domOverlay:{root:document.body}})); useAR=true; animate(); }
function animate(){ renderer.setAnimationLoop(()=>renderer.render(scene,camera)); }

function llDiffMeters(lat0,lon0,lat,lon){ const Rlat=111132, Rlon=111320*Math.cos(lat0*Math.PI/180);
  return { x:(lon-lon0)*Rlon, y:(lat-lat0)*Rlat }; }

function placeMarkers(center,flights){ markers.clear(); flights.forEach(f=>{ const {x,y}=llDiffMeters(center.lat,center.lon,f.lat,f.lon);
  const m=makeMarker(f); m.position.set(x/10,0,y/10); markers.add(m); }); }

async function refresh(){
  const lat=Number(latI.value), lon=Number(lonI.value), radius=Number(radI.value||30);
  const url=`${CONFIG.FLIGHT_ENDPOINT}?lat=${lat}&lon=${lon}&radius_km=${radius}`;
  try{ const r=await fetch(url); if(!r.ok) throw new Error(`${r.status}`); const j=await r.json();
    $('#src').textContent=`source: opensky | flights: ${j.states.length}`; placeMarkers({lat,lon},j.states); renderList(j.states); if(!useAR) animate();
  }catch(e){ console.error('fetch failed',e); alert('取得に失敗: '+e.message); }
}

function renderList(states){
  const box=$('#list'); box.innerHTML='<h3>フライト一覧</h3>'+states.map((s,i)=>`<div class="item" data-idx="${i}"><span>${s.callsign||'(unknown)'}</span><span>#${i+1}</span></div>`).join('');
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
