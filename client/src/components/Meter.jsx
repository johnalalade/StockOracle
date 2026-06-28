/** Horizontal progress meter (0..1 or custom range). */
export default function Meter({ label, value, display, color = 'var(--accent)' }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>{display ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
