// Small form primitives so stage screens stay readable.

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  );
}

export function Text({ value, onChange, placeholder, type = 'text' }) {
  return <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, placeholder, rows = 3 }) {
  return <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Callout({ kind = 'note', title, children }) {
  return (
    <div className={`callout ${kind}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function StageHeader({ stage, index }) {
  return (
    <header className="stage-header">
      <span className="stage-num">Step {index + 1} of 7</span>
      <h2>{stage.label}</h2>
      <p className="tagline">{stage.tagline}</p>
      <p className="principle">{stage.principle}</p>
    </header>
  );
}
