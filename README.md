# Flight Observer (WebXR + Three.js + Gemini + Aivis)

空の“いま”を見て・聞いて・触る。ブラウザだけで周辺フライトを可視化し、AR上でAIに質問（音声応答）しながら、手・コントローラで操作できます。Meta Quest Browser 対応。DOM Overlay フォールバック、手/コントローラ入力、Hit Test に対応。

- AR の詳しい診断・運用ガイド: `docs/AR.md`
- 最小要件 / Fail-Safes: `docs/AR_MINIMUMS.md`

## デプロイ（GitHub → Vercel）
1. リポジトリを GitHub に push
2. Vercel Dashboard → Import Project → GitHub リポジトリを選択（Framework は “Other”）
3. Project Settings → Environment Variables を設定
   - `GEMINI_API_KEY`（Gemini API）
   - `AIVIS_API_KEY` / `AIVIS_BASE_URL`（Aivis TTS）
   - 任意推奨: `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`（OpenSky OAuth2）
   - 任意: `GOOGLE_API_KEY` / `GOOGLE_CSE_ID`（Web 検索）
4. Deploy → `https://<project>.vercel.app` が発行

## 使い方（Web/Quest 共通）
- 上部 UI で中心 `lat / lon` と `半径(km)` を設定 → 取得
- 右のフライト一覧をクリックすると要約（Gemini）を表示。読み上げ ON で音声再生
- DEMO ボタンでサンプル 3 機を即表示（取得失敗時も自動フォールバック）
- マップ操作（キャンバス上）
  - ドラッグ: パン / ホイール: ズーム（半径変更）/ 矢印キー: パン
  - パン速度・ズーム感度は UI のスライダーで調整
- 高度表示
  - GNSS(geo) / 気圧(baro) / AGL(地表差) の切替
  - 倍率スライダーで高さの見かけ倍率（表示は基準比 x1.xx）
  - 地面高度(m) は「自動取得」で中心座標の標高を反映（SRTM/Open‑Elevation）

## AR モード（Meta Quest Browser）
- 「AR開始」を押すとパススルー AR に切替（HTTPS 必須 / 権限許可）
- DOM Overlay 対応時は下部にチャット UI、非対応時は 3D パネルに自動フォールバック
- 3D 空間でフライトを棒グラフ的に表示（高度×倍率 / モード別色）

## ローカル開発
```
npm i
vercel dev
```

## API の概要
- `GET /api/nearby?lat&lon&radius_km` 周辺フライト（OpenSky → SWR → フォールバック）
- `POST /api/describe-flight` 機体要約（Gemini）
- `POST /api/ask` 地域/機体に関する Q&A（必要に応じ Web 検索）
- `POST /api/tts` テキスト読み上げ（Aivis）
- `GET /api/elevation?lat&lon` 中心座標の標高を取得（SRTM/Open‑Elevation）
- `GET /api/health` 環境診断

## 設計メモ
- WebXR: `immersive-ar` + `local-floor` + `hit-test`（optional）
- UI: DOM Overlay → 非対応時は 3D パネルにフォールバック
- 入力: ハンドトラッキング（ピンチ）/ コントローラ（squeeze/スティック）
- 可視化: three.js、棒グラフ風マーカー（距離でラベルスケール）
- データ: OpenSky `/states/all`（bbox/SWR/段階的フォールバック）
- AI: Gemini 2.x 要約/会話 + Aivis TTS、任意で Google CSE 検索

## Known Issues / 注意事項
- three の二重ロードは不可（importmap で固定し、`import * as THREE from 'three'` を使用）
- AR 開始はユーザー操作で `navigator.xr.requestSession('immersive-ar')` を呼び出す必要あり
- DOM Overlay が無い環境では 3D パネルで代替（`beforexrselect` で誤選択抑制）
- OpenSky は匿名利用時にレート制限・タイムアウトの可能性（`/api/nearby?...&debug=1` で診断）

## Quest でのログ収集
1. 開発者モード ON → PC Chrome の `chrome://inspect/#devices` から Quest Browser を Inspect
2. Console/Network を採取。`/api/health` や `/api/nearby?...&debug=1` の結果も添付

---
詳しい AR の手順・トラブル対応は `docs/AR.md` を参照してください。

## Changelog
- 更新履歴は `CHANGELOG.md` を参照

## Persona
- 会話用キャラクターは `docs/PERSONA.md` を参照
