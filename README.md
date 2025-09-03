# Flight Observer (WebXR + Three.js + Gemini + Aivis)

空の今を見て・聞いて・触れる。ブラウザだけで、周辺のフライトを可視化し、AR上でAIに質問・音声応答しつつ、手やコントローラで操作できます。

## デプロイ（GitHub → Vercel）

1. リポジトリを GitHub に push。
2. Vercel Dashboard → Import Project → GitHub から当該リポジトリを選択（Framework は “Other”）。
3. Project Settings → Environment Variables を設定:
   - `GEMINI_API_KEY` = <your gemini api key>
   - `AIVIS_API_KEY`  = <your aivis api key>
   - `AIVIS_BASE_URL` = https://api.aivis-project.com （省略可）
4. Deploy → `https://<project>.vercel.app` が発行されます。

## 実行方法（Run）

- 上部 UI で `lat / lon / radius` を入力して「取得」。
- 右のリストのフライトをクリックすると、Geminiで要点生成→Aivisで読み上げ。
- Quest の Meta Browser で開くと「START AR」から AR 体験（カメラ許可が必要）。

## ローカル開発（Local）

- `npm i` → `vercel dev`

## 新機能（AR×AI対話・エリアプリセット・手/コントローラ操作）

- エリア・プリセット: ヘッダーに `select#preset` と「＋現在地を保存」。既定スポット＋`localStorage` 保存（上限20件）。
- AR×AI対話（DOM Overlay）: WebXR DOM Overlay 上にチャットUIを重ね、質問→Gemini応答を表示し、Aivisで読み上げ（任意）。
- 手/コントローラ操作: 右手 squeeze=拡大、左手 squeeze=縮小、片手ピンチ=上下移動、両手ピンチ=拡縮。左スティック上下で高さ調整。

## 使い方（クイック）

- プリセット選択→中心座標と半径に反映→自動更新。
- 「START AR」で AR 開始（HTTPS/対応ブラウザ必要）。
- 画面下のオーバーレイに質問を入力→送信→応答テキストがログに表示、読み上げONで音声再生。

## 受け入れ基準（DoD）

- プリセット選択で1秒以内に表示更新。保存した「My地点」は再読込後も残る。
- ARモードで送信から3秒以内にテキスト応答が表示。読み上げONで音声が鳴る。
- squeeze/ピンチ/スティック操作が直感的に反映（±10%刻み相当）。
- DOM Overlay 上のクリックでワールドの select が誤発火しない（`beforexrselect`）。

## 実装メモ（根拠・参考）

- WebXR DOM Overlay: https://www.w3.org/TR/webxr-dom-overlays-1/
- `XRSession.domOverlayState` / `beforexrselect`: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/domOverlayState
- WebXR Hand Input (`XRHand`): https://www.w3.org/TR/webxr-hand-input-1/
- `XRSession` squeeze イベント: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/squeeze_event
- Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- three.js AR Hit Test サンプル: https://threejs.org/examples/webxr_ar_hittest.html
- Inputs（Gamepad/Source）: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs
- Meta WebXR Hands: https://developers.meta.com/horizon/documentation/web/webxr-hands/

問題があればコンソール/Networkログを添えて Issue/PR をお願いします。ARの挙動はデバイス・ブラウザの実装状況に依存します。

