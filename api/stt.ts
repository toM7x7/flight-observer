import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') { return res.status(405).json({ error: 'method_not_allowed' }); }
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

    const chunks: Buffer[] = [];
    for await (const ch of req as any as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch as any));
    }
    const buf = Buffer.concat(chunks);

    const fd = new FormData();
    const blob = new Blob([buf], { type: 'audio/webm' });
    fd.append('file', blob, 'audio.webm');
    fd.append('model', 'whisper-1');
    // fd.append('language', 'ja'); // optional hint

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd as any,
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const j: any = await r.json();
    const text = (j?.text || '').toString();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'stt_failed' });
  }
}

