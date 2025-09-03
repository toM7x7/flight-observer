# Flight Observer on Vercel (WebXR + Three.js + Gemini + Aivis)

## Deploy (GitHub → Vercel)
1. GitHubにこのリポをpush
2. Vercel Dashboard → **Import Project** → GitHubからこのリポを選ぶ → Frameworkは "Other"
3. Project Settings → **Environment Variables**:
   - GEMINI_API_KEY = <your gemini api key>
   - AIVIS_API_KEY  = <your aivis api key>
   - AIVIS_BASE_URL = https://api.aivis-project.com  (省略可)
4. Deploy → `https://<project>.vercel.app` が発行される

## Run
- URLを **Quest の Meta Browser** で開く → カメラ許可 → START AR
- 上部UIで lat/lon/radius を入れて「取得」
- 右側のフライト項目をタップ → Gemini要点 → Aivis読み上げ

## Local
- `npm i` → `vercel dev`
