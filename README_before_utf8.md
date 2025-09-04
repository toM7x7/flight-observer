# Flight Observer (WebXR + Three.js + Gemini + Aivis)

空の今を見て・聞いて・触れる。ブラウザだけで周辺のフライトを可視化し、AR上でAIに質問�E音声応答しながら、手めE��ントローラで操作できます、E
ARモード�E詳細な診断・対処ガイド�E `docs/AR.md` を参照してください�E�Eeta Quest Browser対応、DOM Overlayフォールバック、手/コントローラ入力、Hit-test配置などを網羁E��、E
## チE�Eロイ�E�EitHub ↁEVercel�E�E1. リポジトリめEGitHub に push
2. Vercel Dashboard ↁEImport Project ↁEGitHub から当該リポジトリを選択！Eramework は “Other”！E3. Project Settings ↁEEnvironment Variables を設宁E   - `GEMINI_API_KEY` = <your gemini api key>
   - `AIVIS_API_KEY`  = <your aivis api key>
   - `AIVIS_BASE_URL` = https://api.aivis-project.com�E�省略可�E�E   - �E�任意推奨�E�`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`�E�EpenSky OAuth2�E�E   - �E�任意）`GOOGLE_API_KEY`, `GOOGLE_CSE_ID`�E�Eeb検索用�E�E4. Deploy ↁE`https://<project>.vercel.app` が発行されまぁE
## 使ぁE���E�Eeb/Quest�E�E- 上部 UI で `lat / lon / radius` を�E力して「取得、E- 右のリストでフライトをクリチE�� ↁEGemini 要点生�E ↁEAivis 読み上げ
- Quest の Meta Browser で「START AR」�E パススルーAR�E�カメラ許可忁E��！E- 画面下�Eオーバ�Eレイから質問すると、E��択なしでも「地域�E空」を斁E��に回答（忁E��時はWeb検索も実行！E
## ローカル開発
- `npm i` ↁE`vercel dev`

## 主な機�E
- エリア・プリセチE��: `select#preset` と「＋現在地を保存」。既定スポット＋`localStorage` 保存（上限20件�E�E- AR×AI対話�E�EOM Overlay�E�E WebXR DOM Overlay 上にチャチE��UIを重ね、質問�EGemini 応答�EAivisで読み上げ
- 入劁E 右squeeze=拡大、左squeeze=縮小、片手ピンチE上下移動、両手ピンチE拡縮。左スチE��チE��Yで高度調整

## バックエンド強化！EpenSky・Ask API・検索�E�E- OpenSky `/api/nearby` は bbox + SWR + �E�任意）OAuth2。匿名でも動作し、上流失敗時は「グローバル取得でフィルタ」�E「空配�E200返却」にフォールバック�E�EIが止まらなぁE��E- 新要E`/api/ask` で機体未選択でも地域文脈で回答。忁E��時だぁEWeb 検索�E�Eoogle Programmable Search�E�を行い、�E典を添えて応筁E
## 参老E��ンク
- WebXR DOM Overlay: https://www.w3.org/TR/webxr-dom-overlays-1/
- XRSession.domOverlayState / beforexrselect: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/domOverlayState
- WebXR Hand Input (XRHand): https://www.w3.org/TR/webxr-hand-input-1/
- XRSession squeeze: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/squeeze_event
- WebXR Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- three.js AR Hit Test: https://threejs.org/examples/webxr_ar_hittest.html
- WebXR Device API Inputs: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs
- Meta WebXR Hands: https://developers.meta.com/horizon/documentation/web/webxr-hands/

不�E合�Eコンソール/Networkログを添えて Issue/PR をお願いします、ER/チE�Eタ取得�E挙動はチE��イス・ブラウザ・上流APIの実裁E��況に依存します、E
## 技術スタチE�� / 設計方針（更新�E�E
- WebXR: three.js WebXRManager�E�Euest Browser�E�。`immersive-ar` + `local-floor` + `hit-test`
- UI: DOM Overlay�E�対応時�E�E 3Dパネル�E�非対応時フォールバック�E�E- 入劁E hand-tracking�E�ERHand、片手ピンチE上下、両手ピンチE拡縮�E�E コントローラ�E�Equeeze/スチE��チE���E�E- 3D可視化: コントローラモチE���E�ERControllerModelFactory�E�E レイ表示 + レチE��クル�E�Eit-test照準！E- チE�Eタ: OpenSky `/states/all` めEbbox で取得、SWRキャチE��ュ、指数バックオフ、フォールバック�E�グローバル→ローカル絞り込み→空配�E200�E�E- AI: Gemini 2.x�E�要点/会話�E�E Aivis�E�ETS�E�。任意で Google CSE を使ったWeb検索チE�Eル

## Known Issues / 注意事頁E
- three の二重ロード�E厳禁E��EaycastめE��ラス比輁E��破綻�E�。importmap で `three` を固定し、アプリ側は `import * as THREE from 'three'` を使用、E- START AR は忁E��ユーザー操作（クリチE���E��Eで `requestSession('immersive-ar')` を呼ぶ、E- DOM Overlay が無ぁE��墁E��は 3D パネルを使用。select はレイキャストで処琁E��E- OpenSky は匿名利用時にレート制限�Eタイムアウトがあり得る。`/api/nearby?...&debug=1` で診断、E
## Quest でのログ収集

1. 開発老E��ードをON�E�Eetaアプリ→�EチE��セチE��→開発老E��ード！E2. USB接続�EPCのChromeで `chrome://inspect/#devices` を開ぁE3. Meta Quest Browser のタブを Inspect ↁEConsole/Network を取征E4. 併せて `https://<app>/api/health` と `/api/nearby?...&debug=1` の結果を�E朁E
## AR Minimums / Fail?safes�i�K�ǁj

docs/AR_MINIMUMS.md �ɁuAR�J�n�̍Œ�v���v�uSTART AR �̌_��v�u�j�]�ۏ�iFail?safes�j�v�u�؂蕪���菇�v���܂Ƃ߂Ă��܂��B���₷���ӏ��iHTTPS/permissions/three���d���[�h/strict MIME �Ȃǁj�̍Ĕ��h�~�ɂ��g���܂��B


