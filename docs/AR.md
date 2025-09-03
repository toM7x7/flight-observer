# Flight Observer — AR診断と即効ガイド（Godモード・ネバギバ）

いい指摘！その症状（「ARモードにしても画面が変わらない」「視界が前だけ・360度じゃない」）は、だいたい次のどれかで起きます。結論から――START ARボタンが“ARセッション開始”になっていない設計が最有力です（よくある落とし穴）。Meta Quest Browser は immersive‑ar とパススルーに対応しているので、正しくセッション開始すれば360度トラッキングの映像に切り替わります。

---

## まずは「何が起きたか」診断

可能性A：ボタンが“AR開始”していない

- three.js の `ARButton.createButton()` を押せるボタンを追加するだけに使うと、「START AR」を押した時点ではまだセッションが始まっていません。`navigator.xr.requestSession('immersive-ar', …)` をユーザー操作内で直接呼ぶのが確実です。

可能性B：DOM Overlayの想定違い

- DOM Overlay は対応環境でのみ表示されます。仕様としては AR でオーバーレイを表示でき、`session.domOverlayState.type` に head‑locked / floating / screen が入りますが、ブラウザ実装差が残っています（QuestではARで動く報告あり）。非対応時は3Dパネルにフォールバックが安全策です。

可能性C：サイト権限（手/空間）の拒否

- 初回に出る許可ダイアログで手・空間などを拒否すると機能が制限されます。サイト別の権限設定から再許可できます。

可能性D：Hit‑test/基準空間の未設定

- 置き直しや床基準がないと「前にしか見えない」感じになります。`local-floor` と Hit Test を有効化し、基準の置き直しを用意すると見失いにくくなります。

---

## すぐ直す：AR開始まわりの差し替えコード（本リポ適用済み）

これで「START AR」＝その場でセッション開始に変更します。さらに DOM Overlay（対応時）＋ 手（XRHand）＋ local‑floor ＋ 軽量Hit‑test を同時にリクエスト。非対応なら自動で無視されます。

```js
// 1) 事前に用意した overlay のルート要素
const overlayRoot = document.getElementById('overlay');

// 2) START AR をセッション開始に置き換え
async function startAR() {
  if (!navigator.xr) { alert('WebXR未対応'); return; }
  const ok = await navigator.xr?.isSessionSupported?.('immersive-ar');
  if (ok === false) { alert('immersive-ar未対応'); return; }

  const opts = {
    requiredFeatures: [],                          // 必須なし（安全）
    optionalFeatures: ['dom-overlay','hand-tracking','local-floor','hit-test'],
    domOverlay: { root: overlayRoot }
  };
  const session = await navigator.xr.requestSession('immersive-ar', opts); // ← 直接開始
  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);

  console.log('domOverlayState=', session.domOverlayState?.type); // head-locked等（対応時）
  renderer.setAnimationLoop((t, frame) => { renderer.render(scene, camera); });
}
```

- `requestSession()` をユーザー操作内で直接呼ぶのが正攻法。これで「押したのに変わらない」を潰せます。
- Meta Quest Browser は MR（パススルー / Anchors / Plane）に対応。HTTPSで配信していれば前提OK。

---

## AR中の会話UI（DOM Overlay ⇄ 3Dパネル フォールバック）

1. DOM Overlay経由（対応時）

   - すでに用意した `<div id="overlay">` を `domOverlay: { root }` に渡す。
   - `beforexrselect` でXR世界のselectを抑制（UI操作中の誤タップ防止）。

   ```js
   document.addEventListener('beforexrselect', (ev) => {
     if (overlayRoot.contains(ev.target)) ev.preventDefault(); // UI操作を優先
   });
   ```

2. 非対応時のフォールバック

   - 同じUIをThree.jsの3Dパネル（平面メッシュ＋テクスチャ）に描画して頭に追従。本リポはトリガーで「ここに置く」（Hit-test対応時は結果座標、非対応時はカメラ前方）を実装済み。

> DOM Overlay は端末/ブラウザの実装差が残っているので、“両対応”がベストプラクティスです。

---

## 拡縮・上下移動の手とコントローラ

- 手（XRHand）: 親指と人差し指の距離でピンチ判定（~2.5cm）。
  - 片手ピンチ＝上下移動、両手ピンチ＝スケール。
- コントローラ: `squeeze`（左右）で拡縮、スティックYで上下。

---

## 置き直し（Hit‑test）で“前だけ問題”を解消

- optionalFeaturesに `hit-test` を指定し、対応時のみ結果を使用。得られたポーズに `markers` グループを配置。

---

## 使い方チェック（Meta Quest 3 向け）

1. Meta Quest BrowserでVercelのHTTPS URLを開く（Webページ自体がimmersive‑arに入る必要あり）。
2. START AR を押す → 画面がパススルーに切り替わる（本修正で必ずセッション開始）。
3. 権限が出たら許可（手・空間）。拒否してしまったらサイト権限から再許可。
4. DOM Overlayが効いていれば下部のチャットUIがhead‑lockedで付いてくる。非対応なら3Dパネルに自動フォールバック。

---

## 仕様アップデート（確定案）

- [MUST] セッション開始の直接呼び出し（上記コード）
- [MUST] DOM Overlay ⇄ 3D パネルの自動フォールバック
- [MUST] 権限エラーのUI（権限を再許可する導線を表示）
- [WANT] Hit‑testによる“置き直し”（初回起動時に床へ配置）
- [WANT] XRHand + squeeze / stick の両入力（自動切替）

---

## もし再発したら（切り分けフロー）

1. WebXR Samplesの「immersive‑ar – hit‑test」をQuestで開く→動けばブラウザ・端末はOK。
2. コンソールに `domOverlayState` と `renderer.xr.isPresenting` を出す。
3. サイト権限（手・空間）を見直し。

---

## 参考リンク

- Mixed Reality Support in Browser: https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- XRSystem: requestSession(): https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession
- WebXR DOM Overlays Module: https://www.w3.org/TR/webxr-dom-overlays-1/
- XRSession: domOverlayState: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/domOverlayState
- Element: beforexrselect: https://developer.mozilla.org/en-US/docs/Web/API/Element/beforexrselect_event
- WebXR Hands | Meta: https://developers.meta.com/horizon/documentation/web/webxr-hands/
- WebXR Device API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- WebXR Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- XRHitTestResult: https://developer.mozilla.org/en-US/docs/Web/API/XRHitTestResult
- WebXR Samples: https://immersive-web.github.io/webxr-samples/

