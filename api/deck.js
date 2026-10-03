// Vercel serverless function: optional "Draft with built-in AI" for the Create Deck tab.
// Uses the same ANTHROPIC_API_KEY as /api/coach. Without a key, students use any AI tool
// via the copy/paste flow in the app instead.

const SYSTEM = `You draft management presentations for business students from CRM data they provide.
Rules:
- Use only numbers that appear in the data brief, or simple calculations from them (show the calculation briefly).
- Cite the source file in parentheses on every bullet that contains a number, e.g. "(crm_opportunities.csv)".
- Where files disagree or the data cannot answer a question, say so on the slide instead of guessing.
- Answer each required question with a clear position. Keep slides to 3–5 short bullets.
- Output only the outline in the exact format requested. No preamble.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(501).json({ error: 'The built-in AI is not set up on this site. Use step 1 (copy) and step 2 (paste) with ChatGPT, Claude, Copilot or Gemini instead.' });
  }
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const prompt = String(body.prompt || '').slice(0, 60000);
  if (!prompt) return res.status(400).json({ error: 'No data to draft from.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'The AI could not respond.' });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return res.status(200).json({ text });
  } catch {
    return res.status(502).json({ error: 'The AI could not be reached.' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
