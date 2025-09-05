# Flight Observer | メンテナンス&復旧ガイド

本プロジェクトは UTF-8 前提で日本語ラベルを多用します。エディタや変換時の文字コード不一致があると UI/JS が壊れやすいです。以下の手順で「更新ミス」を未然防止し、万一の復旧を素早く行ってください。

## 1) 文字コード/改行の方針
- 文字コード: UTF-8（BOM なし）
- 改行コード: LF
- エディタ設定: プロジェクトのデフォルトを UTF-8/LF に固定
- 目視チェック: `rg -n "�|�E|�\uFFFD" -S` で置換文字の混入を検出

## 2) よくある症状と原因
- UI が出ない/ボタンが効かない
  - index.html のタグ崩れ、main.js の構文エラーや文字化け
  - Canvas の `pointer-events` が `none` のまま（パン/ズーム不能）
- 「(no response)」とチャット欄に出る
  - API から `text` が返っていない（例: `/api/describe-flight` のビルド/実行エラー、API キー未設定）
- AR 開始が反応しない
  - HTTPS でない、`navigator.xr` 未対応、権限未許可、`requestSession` の呼び出しがユーザー操作内に無い

## 3) クイック復旧手順（チェックリスト）
1. ブラウザ DevTools の Console でエラー確認（構文/404/ネットワーク）
2. 文字化け検出: `rg -n "�|�E|�\uFFFD" -S` で該当ファイルを UTF-8 で開き直し
3. UI 側
   - `index.html`: ラベル/閉じタグ/日本語の崩れを修正
   - `style.css`: `#c{ pointer-events:none }` を上書きするロジック確認
   - `main.js`: `updateCanvasPointer()` が `c.style.pointerEvents = 'auto'` になっているか
4. 機能別
   - 取得: `config.js` の `FLIGHT_ENDPOINT` と `/api/nearby?...&debug=1` の応答
   - DEMO: `runDemo()` が呼ばれるか（失敗時フォールバック）
   - プリセット: `renderPresetSelect()` で `<select id="preset">` に option が入るか
   - チャット: `/api/ask` が 200 を返すか（`GEMINI_API_KEY` 必須）
   - 要約: `/api/describe-flight` が 200 で `{text}` を返すか
   - AR: HTTPS / `isSessionSupported('immersive-ar')` / 権限許可

## 4) ローカル検証手順
```
npm i
vercel dev
```
- `http://localhost:3000` を開く
- 取得/DEMO/リストクリック/パン・ズーム/プリセット/チャット/AR開始 を一通り操作

## 5) 変更時のセルフレビュー観点
- 日本語ラベルを含むファイル（HTML/JS/MD）の文字化け無し
- `main.js` に構文エラー無し（保存時ビルドウォッチのエラーゼロ）
- 主要フローの軽いスモーク（上記 4)）を実施
- API キー（Gemini/Aivis/OpenSky/Google CSE）が必要な機能の劣化時、DEMO やフォールバックが動作しているか

## 6) よくある修正ポイント
- チャットで「(no response)」
  - `/api/describe-flight` を確認。例外時は `{error:...}` を返し、フロントは `(no response)` 表示になる → API 側を修正
- パン・ズームが効かない
  - Canvas の pointer-events が `none` → `main.js` の `updateCanvasPointer()` を `c.style.pointerEvents='auto'` に
- OpenSky が 429 等で落ちる
  - `api/nearby.ts` はフォールバック有。`OPENSKY_CLIENT_ID/SECRET` を設定すると改善

## 7) 推奨設定/仕組み
- エディタ: 保存時に UTF-8/LF 強制
- pre-commit (任意): `rg -n "�|�E|�\uFFFD" -S` にヒットしたらブロック
- README/この文書の参照リンクを PR テンプレートに入れる

---
困ったら `docs/AR.md` とこの文書を見直し、Console/Network のログを添えて相談してください。
