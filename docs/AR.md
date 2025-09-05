# Flight Observer | AR 診断・運用ガイド（Quest 3 向け）

AR モードで「画面が切り替わらない」「前方向にしか見えない」などが発生する場合の診断と、安定運用のガイドです。基本は「ボタン押下中に `navigator.xr.requestSession('immersive-ar')` を直接呼ぶ」「DOM Overlay と 3D パネルの両対応」「`local-floor` + hit-test（optional）」です。

---

## まずは状況診断
- セッション未開始: ボタン表示はあるが AR に切り替わらない
  - 対策: ユーザー操作内で `requestSession('immersive-ar')` を直接呼ぶ
- DOM Overlay 期待ズレ: 端末/ブラウザで挙動差あり
  - 対策: 非対応時は 3D パネルにフォールバック
- 権限拒否: カメラ/空間/手トラッキングの権限を拒否
  - 対策: サイト権限から再許可（Meta Quest Browser のサイト設定）
- 基準空間/Hit Test 未設定
  - 対策: `local-floor` と hit-test を有効化し、置き直しの導線を用意

---

## セッション開始（本リポ適用済みの考え方）
```js
const overlayRoot = document.getElementById('overlay');

async function startAR(){
  if(!navigator.xr){ alert('WebXR未対応のブラウザです'); return; }
  const ok = await navigator.xr.isSessionSupported?.('immersive-ar');
  if(ok===false){ alert('immersive-ar未対応の環境です'); return; }
  const optsStrict={ requiredFeatures:['dom-overlay','local-floor'], optionalFeatures:['hit-test'], domOverlay:{ root: overlayRoot } };
  const optsLoose={ requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay','hit-test'], domOverlay:{ root: overlayRoot } };
  let session; try{ session=await navigator.xr.requestSession('immersive-ar', optsStrict);}catch{ session=await navigator.xr.requestSession('immersive-ar', optsLoose);}  
  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);
  renderer.setAnimationLoop((t,frame)=>{ /* render */ });
}
```

要点
- 押下中に `requestSession()` を直接呼ぶ（中継 UI を挟まない）
- `local-floor` を使い、hit-test は optional で安全に（対応時のみ活用）

---

## 会話 UI | DOM Overlay ⇄ 3D パネル
1) DOM Overlay（対応時）
- `<div id="overlay">` を `domOverlay: { root }` に渡す
- `beforexrselect` で XR ワールドの select を抑制（UI 操作中の誤選択回避）

```js
document.addEventListener('beforexrselect', (ev)=>{
  if (overlayRoot && overlayRoot.contains(ev.target)) ev.preventDefault();
});
```

2) 非対応時フォールバック
- three.js の 3D パネル（平面＋CanvasTexture）を頭に追従 or 配置
- Hit Test 結果が得られる場合は、その座標へ「置き直し」

---

## 入力（手・コントローラ）
- ハンドトラッキング: 片手ピンチ＝中心移動、両手ピンチ＝スケール
- コントローラ: squeeze＝拡縮、スティックY＝上下

---

## 置き直し（Hit Test）
- `hit-test` は optionalFeatures に指定（対応時のみ利用）
- 得た `XRHitTestResult` の pose をターゲットグループに適用

---

## 使い方（Quest 3）
1. HTTPS のアプリ URL を Meta Quest Browser で開く
2. 「AR開始」を押す → パススルーに切替（権限許可）
3. DOM Overlay が効く環境では下部チャット UI、効かない場合は 3D パネル
4. 置き直し（ヒットテスト）が可能なら、床面に合わせて配置

---

## 推奨仕様（Minimums / Best Practices）
- [MUST] セッション開始はボタン押下内で直接呼ぶ
- [MUST] DOM Overlay ⇄ 3D パネルの自動フォールバック
- [MUST] 権限エラー時の UI と再許可の導線
- [WANT] hit-test による“置き直し”（初回起動時に床へ）
- [WANT] XRHand + squeeze / stick の両入力（自動切替）

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
