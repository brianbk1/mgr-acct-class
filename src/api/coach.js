// Vercel serverless function: optional AI "challenge my thinking" coach.
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: ANTHROPIC_MODEL (defaults below).

const SYSTEM = `You are a management coach inside a decision-making tool called Decision Loop.
The user is working through: Question → Data → KPI → Analysis → Decision → Measurement → Pivot.
Your job is to strengthen their judgment, not to replace it.

Rules:
- Never tell them what to decide, which option is best, or what their KPIs should be.
- Ask 3 to 4 sharp, specific questions that expose gaps, untested assumptions, missing evidence, or weak logic in what they wrote for the CURRENT stage.
- Ground each question in their own words or numbers. Quote a number when you can.
- If two of their numbers or files seem to disagree, point at the disagreement and ask about it.
- If something they wrote is genuinely strong, you may say so in one short line.
- Plain text. Number the questions. No preamble, no headings, under 180 words total.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(501).json({ error: 'The AI coach is not configured on this deployment. The site owner can add an ANTHROPIC_API_KEY to enable it.' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const context = String(body.context || '').slice(0, 12000);
  const stage = String(body.stage || '').slice(0, 40);
  if (!context) return res.status(400).json({ error: 'Nothing to review yet — write something in this step first.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Stage to challenge: ${stage}\n\nWhat the user has so far:\n${context}` }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: data?.error?.message || 'The coach could not respond.' });
    }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'The coach could not be reached.' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
