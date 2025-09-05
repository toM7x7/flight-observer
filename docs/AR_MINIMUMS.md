# Flight Observer | AR Minimums / Fail-Safes

目的: 「押したら確実に動く / すぐ復帰できる」ための最小要件と安全策を整理します。

## Minimums（最低ライン）
- 配信: HTTPS（`window.isSecureContext === true`）
- ブラウザ: Meta Quest Browser（最新）
- WebXR: `navigator.xr` が存在し、`xr.isSessionSupported('immersive-ar') === true`
- パーミッション: カメラ/空間/手（必要に応じて）を許可
- three の読込: importmap で固定し、アプリ側は `import * as THREE from 'three'`
- MIME: `Content-Type: text/javascript`（strict MIME でエラー回避）
- ヘッダ: `Permissions-Policy: xr-spatial-tracking=(self)`（必要に応じて）

## Button Contract（AR開始ボタン）
- 「AR開始」はユーザー操作中に `navigator.xr.requestSession('immersive-ar', opts)` を直接呼ぶ
- `opts`
  - `requiredFeatures: ['local-floor']`
  - `optionalFeatures: ['dom-overlay','hand-tracking','hit-test']`
- 非対応機能は無視される前提で UI は壊さない
- 未対応/権限未許可/HTTPS でない等はボタン無効化＋理由をツールチップ表示

## Fail-Safes（失敗時の安全策）
- AR開始失敗: ボタンを再度有効化、HUD/3D/DEMO のガイドを表示
- Hit Test 不可: レティクル非表示、Place はカメラ前方 2m に配置
- データ障害: `/api/nearby` はフォールバック（グローバル→ローカル絞り込み→空配200）
- UI保護: DOM Overlay 操作中は `beforexrselect` で XR select を抑制、非対応は 3D カードで代替

## Troubleshooting（確認観点）
1) Console に `isPresenting`, `domOverlayState`, `inputSources` を出せているか
2) three の二重ロードなし（importmap を確認）
3) `/api/nearby?...&debug=1`（bbox/token/x-cache）で上流状況を確認
4) サイト権限（カメラ/空間/手）の再許可

## UI（AR / Browser）
- HUD: Place / Follow / Chat / Hide（最小の頭部追従ツールバー）
- Dock: ワールド内に固定できるカード状 UI
- 入力: 片手ピンチ=移動、両手ピンチ=スケール（離したら refresh）
- リスト: クリック or レイで選択、ミニカードと 3D ハイライト

## 目標（段階的）
- 説明がなくても迷わない HUD（最少の語彙、必要十分なカード）
- “置く/追従/チャット” の 3 モードを明確化
- 失敗しても詰まらない（Fail-Safes とデバッグ導線）
