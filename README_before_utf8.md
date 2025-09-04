# Flight Observer (WebXR + Three.js + Gemini + Aivis)

遨ｺ縺ｮ莉翫ｒ隕九※繝ｻ閨槭＞縺ｦ繝ｻ隗ｦ繧後ｋ縲ゅヶ繝ｩ繧ｦ繧ｶ縺縺代〒蜻ｨ霎ｺ縺ｮ繝輔Λ繧､繝医ｒ蜿ｯ隕門喧縺励、R荳翫〒AI縺ｫ雉ｪ蝠上・髻ｳ螢ｰ蠢懃ｭ斐＠縺ｪ縺後ｉ縲∵焔繧・さ繝ｳ繝医Ο繝ｼ繝ｩ縺ｧ謫堺ｽ懊〒縺阪∪縺吶・
AR繝｢繝ｼ繝峨・隧ｳ邏ｰ縺ｪ險ｺ譁ｭ繝ｻ蟇ｾ蜃ｦ繧ｬ繧､繝峨・ `docs/AR.md` 繧貞盾辣ｧ縺励※縺上□縺輔＞・・eta Quest Browser蟇ｾ蠢懊．OM Overlay繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縲∵焔/繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ蜈･蜉帙？it-test驟咲ｽｮ縺ｪ縺ｩ繧堤ｶｲ鄒・ｼ峨・
## 繝・・繝ｭ繧､・・itHub 竊・Vercel・・1. 繝ｪ繝昴ず繝医Μ繧・GitHub 縺ｫ push
2. Vercel Dashboard 竊・Import Project 竊・GitHub 縺九ｉ蠖楢ｩｲ繝ｪ繝昴ず繝医Μ繧帝∈謚橸ｼ・ramework 縺ｯ 窶廾ther窶晢ｼ・3. Project Settings 竊・Environment Variables 繧定ｨｭ螳・   - `GEMINI_API_KEY` = <your gemini api key>
   - `AIVIS_API_KEY`  = <your aivis api key>
   - `AIVIS_BASE_URL` = https://api.aivis-project.com・育怐逡･蜿ｯ・・   - ・井ｻｻ諢乗耳螂ｨ・荏OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`・・penSky OAuth2・・   - ・井ｻｻ諢擾ｼ荏GOOGLE_API_KEY`, `GOOGLE_CSE_ID`・・eb讀懃ｴ｢逕ｨ・・4. Deploy 竊・`https://<project>.vercel.app` 縺檎匱陦後＆繧後∪縺・
## 菴ｿ縺・婿・・eb/Quest・・- 荳企Κ UI 縺ｧ `lat / lon / radius` 繧貞・蜉帙＠縺ｦ縲悟叙蠕励・- 蜿ｳ縺ｮ繝ｪ繧ｹ繝医〒繝輔Λ繧､繝医ｒ繧ｯ繝ｪ繝・け 竊・Gemini 隕∫せ逕滓・ 竊・Aivis 隱ｭ縺ｿ荳翫￡
- Quest 縺ｮ Meta Browser 縺ｧ縲郡TART AR縲坂・ 繝代せ繧ｹ繝ｫ繝ｼAR・医き繝｡繝ｩ險ｱ蜿ｯ蠢・茨ｼ・- 逕ｻ髱｢荳九・繧ｪ繝ｼ繝舌・繝ｬ繧､縺九ｉ雉ｪ蝠上☆繧九→縲・∈謚槭↑縺励〒繧ゅ悟慍蝓溘・遨ｺ縲阪ｒ譁・ц縺ｫ蝗樒ｭ費ｼ亥ｿ・ｦ∵凾縺ｯWeb讀懃ｴ｢繧ょｮ溯｡鯉ｼ・
## 繝ｭ繝ｼ繧ｫ繝ｫ髢狗匱
- `npm i` 竊・`vercel dev`

## 荳ｻ縺ｪ讖溯・
- 繧ｨ繝ｪ繧｢繝ｻ繝励Μ繧ｻ繝・ヨ: `select#preset` 縺ｨ縲鯉ｼ狗樟蝨ｨ蝨ｰ繧剃ｿ晏ｭ倥阪よ里螳壹せ繝昴ャ繝茨ｼ義localStorage` 菫晏ｭ假ｼ井ｸ企剞20莉ｶ・・- ARﾃ輸I蟇ｾ隧ｱ・・OM Overlay・・ WebXR DOM Overlay 荳翫↓繝√Ε繝・ヨUI繧帝㍾縺ｭ縲∬ｳｪ蝠鞘・Gemini 蠢懃ｭ披・Aivis縺ｧ隱ｭ縺ｿ荳翫￡
- 蜈･蜉・ 蜿ｳsqueeze=諡｡螟ｧ縲∝ｷｦsqueeze=邵ｮ蟆上∫援謇九ヴ繝ｳ繝・荳贋ｸ狗ｧｻ蜍輔∽ｸ｡謇九ヴ繝ｳ繝・諡｡邵ｮ縲ょｷｦ繧ｹ繝・ぅ繝・けY縺ｧ鬮伜ｺｦ隱ｿ謨ｴ

## 繝舌ャ繧ｯ繧ｨ繝ｳ繝牙ｼｷ蛹厄ｼ・penSky繝ｻAsk API繝ｻ讀懃ｴ｢・・- OpenSky `/api/nearby` 縺ｯ bbox + SWR + ・井ｻｻ諢擾ｼ碓Auth2縲ょ諺蜷阪〒繧ょ虚菴懊＠縲∽ｸ頑ｵ∝､ｱ謨玲凾縺ｯ縲後げ繝ｭ繝ｼ繝舌Ν蜿門ｾ励〒繝輔ぅ繝ｫ繧ｿ縲坂・縲檎ｩｺ驟榊・200霑泌唆縲阪↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・I縺梧ｭ｢縺ｾ繧峨↑縺・ｼ・- 譁ｰ隕・`/api/ask` 縺ｧ讖滉ｽ捺悴驕ｸ謚槭〒繧ょ慍蝓滓枚閼医〒蝗樒ｭ斐ょｿ・ｦ∵凾縺縺・Web 讀懃ｴ｢・・oogle Programmable Search・峨ｒ陦後＞縲∝・蜈ｸ繧呈ｷｻ縺医※蠢懃ｭ・
## 蜿り・Μ繝ｳ繧ｯ
- WebXR DOM Overlay: https://www.w3.org/TR/webxr-dom-overlays-1/
- XRSession.domOverlayState / beforexrselect: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/domOverlayState
- WebXR Hand Input (XRHand): https://www.w3.org/TR/webxr-hand-input-1/
- XRSession squeeze: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/squeeze_event
- WebXR Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- three.js AR Hit Test: https://threejs.org/examples/webxr_ar_hittest.html
- WebXR Device API Inputs: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs
- Meta WebXR Hands: https://developers.meta.com/horizon/documentation/web/webxr-hands/

荳榊・蜷医・繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ/Network繝ｭ繧ｰ繧呈ｷｻ縺医※ Issue/PR 繧偵♀鬘倥＞縺励∪縺吶・R/繝・・繧ｿ蜿門ｾ励・謖吝虚縺ｯ繝・ヰ繧､繧ｹ繝ｻ繝悶Λ繧ｦ繧ｶ繝ｻ荳頑ｵ、PI縺ｮ螳溯｣・憾豕√↓萓晏ｭ倥＠縺ｾ縺吶・
## 謚陦薙せ繧ｿ繝・け / 險ｭ險域婿驥晢ｼ域峩譁ｰ・・
- WebXR: three.js WebXRManager・・uest Browser・峨Ａimmersive-ar` + `local-floor` + `hit-test`
- UI: DOM Overlay・亥ｯｾ蠢懈凾・・ 3D繝代ロ繝ｫ・磯撼蟇ｾ蠢懈凾繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・- 蜈･蜉・ hand-tracking・・RHand縲∫援謇九ヴ繝ｳ繝・荳贋ｸ九∽ｸ｡謇九ヴ繝ｳ繝・諡｡邵ｮ・・ 繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ・・queeze/繧ｹ繝・ぅ繝・け・・- 3D蜿ｯ隕門喧: 繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ繝｢繝・Ν・・RControllerModelFactory・・ 繝ｬ繧､陦ｨ遉ｺ + 繝ｬ繝・ぅ繧ｯ繝ｫ・・it-test辣ｧ貅厄ｼ・- 繝・・繧ｿ: OpenSky `/states/all` 繧・bbox 縺ｧ蜿門ｾ励ヾWR繧ｭ繝｣繝・す繝･縲∵欠謨ｰ繝舌ャ繧ｯ繧ｪ繝輔√ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ・医げ繝ｭ繝ｼ繝舌Ν竊偵Ο繝ｼ繧ｫ繝ｫ邨槭ｊ霎ｼ縺ｿ竊堤ｩｺ驟榊・200・・- AI: Gemini 2.x・郁ｦ∫せ/莨夊ｩｱ・・ Aivis・・TS・峨ゆｻｻ諢上〒 Google CSE 繧剃ｽｿ縺｣縺欷eb讀懃ｴ｢繝・・繝ｫ

## Known Issues / 豕ｨ諢丈ｺ矩・
- three 縺ｮ莠碁㍾繝ｭ繝ｼ繝峨・蜴ｳ遖・ｼ・aycast繧・け繝ｩ繧ｹ豈碑ｼ・′遐ｴ邯ｻ・峨Ｊmportmap 縺ｧ `three` 繧貞崋螳壹＠縲√い繝励Μ蛛ｴ縺ｯ `import * as THREE from 'three'` 繧剃ｽｿ逕ｨ縲・- START AR 縺ｯ蠢・★繝ｦ繝ｼ繧ｶ繝ｼ謫堺ｽ懶ｼ医け繝ｪ繝・け・牙・縺ｧ `requestSession('immersive-ar')` 繧貞他縺ｶ縲・- DOM Overlay 縺檎┌縺・腸蠅・〒縺ｯ 3D 繝代ロ繝ｫ繧剃ｽｿ逕ｨ縲Ｔelect 縺ｯ繝ｬ繧､繧ｭ繝｣繧ｹ繝医〒蜃ｦ逅・・- OpenSky 縺ｯ蛹ｿ蜷榊茜逕ｨ譎ゅ↓繝ｬ繝ｼ繝亥宛髯舌・繧ｿ繧､繝繧｢繧ｦ繝医′縺ゅｊ蠕励ｋ縲Ａ/api/nearby?...&debug=1` 縺ｧ險ｺ譁ｭ縲・
## Quest 縺ｧ縺ｮ繝ｭ繧ｰ蜿朱寔

1. 髢狗匱閠・Δ繝ｼ繝峨ｒON・・eta繧｢繝励Μ竊偵・繝・ラ繧ｻ繝・ヨ竊帝幕逋ｺ閠・Δ繝ｼ繝会ｼ・2. USB謗･邯壺・PC縺ｮChrome縺ｧ `chrome://inspect/#devices` 繧帝幕縺・3. Meta Quest Browser 縺ｮ繧ｿ繝悶ｒ Inspect 竊・Console/Network 繧貞叙蠕・4. 菴ｵ縺帙※ `https://<app>/api/health` 縺ｨ `/api/nearby?...&debug=1` 縺ｮ邨先棡繧貞・譛・
## AR Minimums / Fail?safes（必読）

docs/AR_MINIMUMS.md に「AR開始の最低要件」「START AR の契約」「破綻保障（Fail?safes）」「切り分け手順」をまとめています。壊れやすい箇所（HTTPS/permissions/three多重ロード/strict MIME など）の再発防止にも使えます。


