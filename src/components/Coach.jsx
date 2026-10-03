import { useState } from 'react';
import { stageScore } from '../lib/stages.js';
import { coachContext } from '../lib/brief.js';

export default function Coach({ stage, state }) {
  const score = stageScore(stage, state);
  const [ai, setAi] = useState({ loading: false, text: '', error: '' });
  const [openTrap, setOpenTrap] = useState(null);

  async function challenge() {
    setAi({ loading: true, text: '', error: '' });
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stage.id, context: coachContext(state, stage.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The coach is not available right now.');
      setAi({ loading: false, text: data.text, error: '' });
    } catch (e) {
      setAi({ loading: false, text: '', error: e.message });
    }
  }

  return (
    <aside className="coach" aria-label="Coaching panel">
      <div className="coach-block">
        <div className="coach-title">
          <h3>Readiness</h3>
          <span className={`badge ${score.done === score.total ? 'good' : ''}`}>{score.done}/{score.total}</span>
        </div>
        <ul className="gates">
          {score.gates.map((g) => (
            <li key={g.label} className={g.ok ? 'ok' : ''}>
              <span className="gate-dot" aria-hidden="true">{g.ok ? '✓' : ''}</span>
              {g.label}
            </li>
          ))}
        </ul>
        <p className="muted small">These checks describe the quality of your thinking, not the answer. You can move on at any time.</p>
      </div>

      <div className="coach-block">
        <h3>Questions to sit with</h3>
        <ol className="coach-qs">
          {stage.coach.map((q) => <li key={q}>{q}</li>)}
        </ol>
      </div>

      <div className="coach-block">
        <h3>Common traps</h3>
        {stage.traps.map((t, i) => (
          <div key={t.name} className="trap">
            <button onClick={() => setOpenTrap(openTrap === i ? null : i)} aria-expanded={openTrap === i}>
              {t.name} <span aria-hidden="true">{openTrap === i ? '−' : '+'}</span>
            </button>
            {openTrap === i && <p>{t.tip}</p>}
          </div>
        ))}
      </div>

      <div className="coach-block ai">
        <h3>Challenge my thinking</h3>
        <p className="muted small">An AI coach reads what you have written and summary numbers (never your raw rows) and asks hard questions. It will not make the decision for you.</p>
        <button className="btn" onClick={challenge} disabled={ai.loading}>{ai.loading ? 'Thinking…' : 'Ask for a challenge'}</button>
        {ai.error && <p className="warn-text small">{ai.error}</p>}
        {ai.text && <div className="ai-text">{ai.text.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>}
      </div>
    </aside>
  );
}
