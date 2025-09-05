# Flight Observer (WebXR + Three.js + Gemini + Aivis)

遨ｺ縺ｮ窶懊＞縺ｾ窶昴ｒ隕九※繝ｻ閨槭＞縺ｦ繝ｻ隗ｦ繧九ゅヶ繝ｩ繧ｦ繧ｶ縺縺代〒蜻ｨ霎ｺ繝輔Λ繧､繝医ｒ蜿ｯ隕門喧縺励、R荳翫〒AI縺ｫ雉ｪ蝠擾ｼ磯浹螢ｰ蠢懃ｭ費ｼ峨＠縺ｪ縺後ｉ縲∵焔繝ｻ繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ縺ｧ謫堺ｽ懊〒縺阪∪縺吶・eta Quest Browser 蟇ｾ蠢懊・OM Overlay 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縲∵焔/繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ蜈･蜉帙？it Test 縺ｫ蟇ｾ蠢懊・
- AR 縺ｮ隧ｳ縺励＞險ｺ譁ｭ繝ｻ驕狗畑繧ｬ繧､繝・ `docs/AR.md`
- 譛蟆剰ｦ∽ｻｶ / Fail-Safes: `docs/AR_MINIMUMS.md`
- 繝｡繝ｳ繝・リ繝ｳ繧ｹ&蠕ｩ譌ｧ繧ｬ繧､繝・ `docs/MAINTENANCE.md`

## 繝・・繝ｭ繧､・・itHub 竊・Vercel・・1. 繝ｪ繝昴ず繝医Μ繧・GitHub 縺ｫ push
2. Vercel Dashboard 竊・Import Project 竊・GitHub 繝ｪ繝昴ず繝医Μ繧帝∈謚橸ｼ・ramework 縺ｯ 窶廾ther窶晢ｼ・3. Project Settings 竊・Environment Variables 繧定ｨｭ螳・   - `GEMINI_API_KEY`・・emini API・・   - `AIVIS_API_KEY` / `AIVIS_BASE_URL`・・ivis TTS・・   - 莉ｻ諢乗耳螂ｨ: `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`・・penSky OAuth2・・   - 莉ｻ諢・ `GOOGLE_API_KEY` / `GOOGLE_CSE_ID`・・eb 讀懃ｴ｢・・4. Deploy 竊・`https://<project>.vercel.app` 縺檎匱陦・
## 菴ｿ縺・婿・・eb/Quest 蜈ｱ騾夲ｼ・- 荳企Κ UI 縺ｧ荳ｭ蠢・`lat / lon` 縺ｨ `蜊雁ｾ・km)` 繧定ｨｭ螳・竊・蜿門ｾ・- 蜿ｳ縺ｮ繝輔Λ繧､繝井ｸ隕ｧ繧偵け繝ｪ繝・け縺吶ｋ縺ｨ隕∫ｴ・ｼ・emini・峨ｒ陦ｨ遉ｺ縲りｪｭ縺ｿ荳翫￡ ON 縺ｧ髻ｳ螢ｰ蜀咲函
- DEMO 繝懊ち繝ｳ縺ｧ繧ｵ繝ｳ繝励Ν 3 讖溘ｒ蜊ｳ陦ｨ遉ｺ・亥叙蠕怜､ｱ謨玲凾繧り・蜍輔ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ・・- 繝槭ャ繝玲桃菴懶ｼ医く繝｣繝ｳ繝舌せ荳奇ｼ・  - 繝峨Λ繝・げ: 繝代Φ / 繝帙う繝ｼ繝ｫ: 繧ｺ繝ｼ繝・亥濠蠕・､画峩・・ 遏｢蜊ｰ繧ｭ繝ｼ: 繝代Φ
  - 繝代Φ騾溷ｺｦ繝ｻ繧ｺ繝ｼ繝諢溷ｺｦ縺ｯ UI 縺ｮ繧ｹ繝ｩ繧､繝繝ｼ縺ｧ隱ｿ謨ｴ
- 鬮伜ｺｦ陦ｨ遉ｺ
  - GNSS(geo) / 豌怜悸(baro) / AGL(蝨ｰ陦ｨ蟾ｮ) 縺ｮ蛻・崛
  - 蛟咲紫繧ｹ繝ｩ繧､繝繝ｼ縺ｧ鬮倥＆縺ｮ隕九°縺大咲紫・郁｡ｨ遉ｺ縺ｯ蝓ｺ貅匁ｯ・x1.xx・・  - 蝨ｰ髱｢鬮伜ｺｦ(m) 縺ｯ縲瑚・蜍募叙蠕励阪〒荳ｭ蠢・ｺｧ讓吶・讓咎ｫ倥ｒ蜿肴丐・・RTM/Open窶薦levation・・
## AR 繝｢繝ｼ繝会ｼ・eta Quest Browser・・- 縲窟R髢句ｧ九阪ｒ謚ｼ縺吶→繝代せ繧ｹ繝ｫ繝ｼ AR 縺ｫ蛻・崛・・TTPS 蠢・・/ 讓ｩ髯占ｨｱ蜿ｯ・・- DOM Overlay 蟇ｾ蠢懈凾縺ｯ荳矩Κ縺ｫ繝√Ε繝・ヨ UI縲・撼蟇ｾ蠢懈凾縺ｯ 3D 繝代ロ繝ｫ縺ｫ閾ｪ蜍輔ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ
- 3D 遨ｺ髢薙〒繝輔Λ繧､繝医ｒ譽偵げ繝ｩ繝慕噪縺ｫ陦ｨ遉ｺ・磯ｫ伜ｺｦﾃ怜咲紫 / 繝｢繝ｼ繝牙挨濶ｲ・・
## 繝ｭ繝ｼ繧ｫ繝ｫ髢狗匱
```
npm i
vercel dev
```

## API 縺ｮ讎りｦ・- `GET /api/nearby?lat&lon&radius_km` 蜻ｨ霎ｺ繝輔Λ繧､繝茨ｼ・penSky 竊・SWR 竊・繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・- `POST /api/describe-flight` 讖滉ｽ楢ｦ∫ｴ・ｼ・emini・・- `POST /api/ask` 蝨ｰ蝓・讖滉ｽ薙↓髢｢縺吶ｋ Q&A・亥ｿ・ｦ√↓蠢懊§ Web 讀懃ｴ｢・・- `POST /api/tts` 繝・く繧ｹ繝郁ｪｭ縺ｿ荳翫￡・・ivis・・- `GET /api/elevation?lat&lon` 荳ｭ蠢・ｺｧ讓吶・讓咎ｫ倥ｒ蜿門ｾ暦ｼ・RTM/Open窶薦levation・・- `GET /api/health` 迺ｰ蠅・ｨｺ譁ｭ

## 險ｭ險医Γ繝｢
- WebXR: `immersive-ar` + `local-floor` + `hit-test`・・ptional・・- UI: DOM Overlay 竊・髱槫ｯｾ蠢懈凾縺ｯ 3D 繝代ロ繝ｫ縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
- 蜈･蜉・ 繝上Φ繝峨ヨ繝ｩ繝・く繝ｳ繧ｰ・医ヴ繝ｳ繝・ｼ・ 繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ・・queeze/繧ｹ繝・ぅ繝・け・・- 蜿ｯ隕門喧: three.js縲∵｣偵げ繝ｩ繝暮｢ｨ繝槭・繧ｫ繝ｼ・郁ｷ晞屬縺ｧ繝ｩ繝吶Ν繧ｹ繧ｱ繝ｼ繝ｫ・・- 繝・・繧ｿ: OpenSky `/states/all`・・box/SWR/谿ｵ髫守噪繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・- AI: Gemini 2.x 隕∫ｴ・莨夊ｩｱ + Aivis TTS縲∽ｻｻ諢上〒 Google CSE 讀懃ｴ｢

## Known Issues / 豕ｨ諢丈ｺ矩・- three 縺ｮ莠碁㍾繝ｭ繝ｼ繝峨・荳榊庄・・mportmap 縺ｧ蝗ｺ螳壹＠縲～import * as THREE from 'three'` 繧剃ｽｿ逕ｨ・・- AR 髢句ｧ九・繝ｦ繝ｼ繧ｶ繝ｼ謫堺ｽ懊〒 `navigator.xr.requestSession('immersive-ar')` 繧貞他縺ｳ蜃ｺ縺吝ｿ・ｦ√≠繧・- DOM Overlay 縺檎┌縺・腸蠅・〒縺ｯ 3D 繝代ロ繝ｫ縺ｧ莉｣譖ｿ・・beforexrselect` 縺ｧ隱､驕ｸ謚樊椛蛻ｶ・・- OpenSky 縺ｯ蛹ｿ蜷榊茜逕ｨ譎ゅ↓繝ｬ繝ｼ繝亥宛髯舌・繧ｿ繧､繝繧｢繧ｦ繝医・蜿ｯ閭ｽ諤ｧ・・/api/nearby?...&debug=1` 縺ｧ險ｺ譁ｭ・・
## Quest 縺ｧ縺ｮ繝ｭ繧ｰ蜿朱寔
1. 髢狗匱閠・Δ繝ｼ繝・ON 竊・PC Chrome 縺ｮ `chrome://inspect/#devices` 縺九ｉ Quest Browser 繧・Inspect
2. Console/Network 繧呈治蜿悶Ａ/api/health` 繧・`/api/nearby?...&debug=1` 縺ｮ邨先棡繧よｷｻ莉・
---
隧ｳ縺励＞ AR 縺ｮ謇矩・・繝医Λ繝悶Ν蟇ｾ蠢懊・ `docs/AR.md` 繧貞盾辣ｧ縺励※縺上□縺輔＞縲・
## Changelog
- 譖ｴ譁ｰ螻･豁ｴ縺ｯ `CHANGELOG.md` 繧貞盾辣ｧ

## Persona
- 莨夊ｩｱ逕ｨ繧ｭ繝｣繝ｩ繧ｯ繧ｿ繝ｼ縺ｯ `docs/PERSONA.md` 繧貞盾辣ｧ


## STT (Speech-To-Text) Setup
- Add environment variable OPENAI_API_KEY in Vercel Project Settings.
- Client posts audio/webm to POST /api/stt which proxies to Whisper and returns { text } only.
- Quest/AR uses PTT (press-to-talk): recording -> uploading -> transcribing -> replying -> idle, with HUD indicators.

