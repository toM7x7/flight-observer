# Flight Observer — AR Minimum Requirements and Fail‑Safes

目的: 「飛んでいる飛行機を自由自在に観察して感動できる」体験を、壊れにくく提供する。

## Minimums（最低要件）

- 配信: HTTPS（window.isSecureContext === true）
- ブラウザ: Meta Quest Browser（最新）。デスクトップは開発用として Immersive Web Emulator で代用可
- WebXR: 
avigator.xr が存在、xr.isSessionSupported('immersive-ar') === true
- パーミッション: サイトのカメラ/空間アクセスを許可（拒否→許可の再設定手順を提示）
- JavaScriptモジュール: three を importmap で一意化（多重ロード警告が出ない）
- 静的ファイル: Content-Type: text/javascript で提供（strict MIME type エラー回避）
- ヘッダ（推奨）: Permissions-Policy: xr-spatial-tracking=(self)

## Button Contract（START ARの契約）

- START AR 押下（ユーザー操作内）で 
avigator.xr.requestSession('immersive-ar', opts) を直接呼ぶ
- opts: equiredFeatures: ['local-floor'], optionalFeatures: ['dom-overlay','hand-tracking','hit-test']
- 失敗時は理由をUIに明示（未対応/許可なし/HTTPSでない等）
- サポート判定の結果でボタンを無効化し、タイトルに理由を表示

## Fail‑Safes（破綻保障）

- AR開始不可: ボタン無効化（理由表示）＋ブラウザ3D/HUD/DEMOで代替
- Hit Test不可: レティクル非表示→Placeは前方2mに配置
- データ失敗: /api/nearby はフォールバック（グローバル→ローカル絞り込み→空配列200）でUIを止めない
- UI競合: DOM Overlay操作時は eforexrselect でXR selectを抑止／未対応時は3Dカードへ

## Troubleshooting（切り分け）

1) Consoleに isPresenting, domOverlayState, inputSources が出るか
2) three の多重ロード警告が出ていないか（importmapを確認）
3) /api/nearby?...&debug=1 の応答（bbox/token/x-cache/件数）
4) サイトの権限（カメラ/空間）を再許可

## 操作（AR / Browser）

- HUD: Place / Follow / Chat / Hide（頭部追従）
- Dock: 置いた後はワールド固定の小カードで最小表示
- ピンチ: 片手=中心座標の移動、両手=半径の拡縮（解除でrefresh）
- リスト: クリックで選択/非選択、右下にミニカード、3Dハイライト

## 目的（常に戻る）

- 空を“邪魔しない”UI（HUD主装備、必要な時だけカード）
- 自由に“置ける/戻せる/話せる”操作（Place/Follow/Chat）
- 失敗しても止まらない（Fail‑Safes とデバッグ導線）
