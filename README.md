# Flight Observer (WebXR + Three.js + Gemini + Aivis)

空の今を見て・聞いて・触れる。ブラウザだけで周辺のフライトを可視化し、AR上でAIに質問・音声応答しながら、手やコントローラで操作できます。

ARモードの詳細な診断・対処ガイドは `docs/AR.md` を参照してください（Meta Quest Browser対応、DOM Overlayフォールバック、手/コントローラ入力、Hit-test配置などを網羅）。

## デプロイ（GitHub → Vercel）
1. リポジトリを GitHub に push
2. Vercel Dashboard → Import Project → GitHub から当該リポジトリを選択（Framework は “Other”）
3. Project Settings → Environment Variables を設定
   - `GEMINI_API_KEY` = <your gemini api key>
   - `AIVIS_API_KEY`  = <your aivis api key>
   - `AIVIS_BASE_URL` = https://api.aivis-project.com（省略可）
   - （任意推奨）`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`（OpenSky OAuth2）
   - （任意）`GOOGLE_API_KEY`, `GOOGLE_CSE_ID`（Web検索用）
4. Deploy → `https://<project>.vercel.app` が発行されます

## 使い方（Web/Quest）
- 上部 UI で `lat / lon / radius` を入力して「取得」
- 右のリストでフライトをクリック → Gemini 要点生成 → Aivis 読み上げ
- Quest の Meta Browser で「START AR」→ パススルーAR（カメラ許可必須）
- 画面下のオーバーレイから質問すると、選択なしでも「地域の空」を文脈に回答（必要時はWeb検索も実行）

## ローカル開発
- `npm i` → `vercel dev`

## 主な機能
- エリア・プリセット: `select#preset` と「＋現在地を保存」。既定スポット＋`localStorage` 保存（上限20件）
- AR×AI対話（DOM Overlay）: WebXR DOM Overlay 上にチャットUIを重ね、質問→Gemini 応答→Aivisで読み上げ
- 入力: 右squeeze=拡大、左squeeze=縮小、片手ピンチ=上下移動、両手ピンチ=拡縮。左スティックYで高度調整

## バックエンド強化（OpenSky・Ask API・検索）
- OpenSky `/api/nearby` は bbox + SWR + （任意）OAuth2。匿名でも動作し、上流失敗時は「グローバル取得でフィルタ」→「空配列200返却」にフォールバック（UIが止まらない）
- 新規 `/api/ask` で機体未選択でも地域文脈で回答。必要時だけ Web 検索（Google Programmable Search）を行い、出典を添えて応答

## 参考リンク
- WebXR DOM Overlay: https://www.w3.org/TR/webxr-dom-overlays-1/
- XRSession.domOverlayState / beforexrselect: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/domOverlayState
- WebXR Hand Input (XRHand): https://www.w3.org/TR/webxr-hand-input-1/
- XRSession squeeze: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/squeeze_event
- WebXR Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- three.js AR Hit Test: https://threejs.org/examples/webxr_ar_hittest.html
- WebXR Device API Inputs: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs
- Meta WebXR Hands: https://developers.meta.com/horizon/documentation/web/webxr-hands/

不具合はコンソール/Networkログを添えて Issue/PR をお願いします。AR/データ取得の挙動はデバイス・ブラウザ・上流APIの実装状況に依存します。
