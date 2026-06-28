const sentColor = (s) => (s > 0.15 ? 'var(--buy)' : s < -0.15 ? 'var(--sell)' : 'var(--text-faint)');
const ago = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

/**
 * News headlines. When the LLM/heuristic scored each item, merge that
 * per-headline sentiment in by title so the dots reflect real analysis.
 */
export default function NewsList({ news, scoredItems = [] }) {
  const scoreByTitle = new Map(scoredItems.map((it) => [it.title, it]));
  if (!news?.length) return <div className="card"><h3>News</h3><p className="muted">No recent news found.</p></div>;

  return (
    <div className="card">
      <h3>Market News &amp; Disclosures</h3>
      {news.slice(0, 12).map((n, i) => {
        const scored = scoreByTitle.get(n.title);
        const s = scored?.sentiment;
        return (
          <div className="news-item" key={i}>
            <div className="news-title">
              <a href={n.link} target="_blank" rel="noreferrer">{n.title}</a>
            </div>
            <div className="news-meta">
              {s != null && (
                <span className="sent-dot" style={{ background: sentColor(s) }} title={`sentiment ${s.toFixed(2)}`} />
              )}
              <span>{n.source}</span>
              <span>·</span>
              <span>{ago(n.date)}</span>
              {scored?.rationale && <span style={{ color: 'var(--text-faint)' }}>· {scored.rationale}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
