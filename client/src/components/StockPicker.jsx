import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Searchable NGX equity picker. Loads the full list once, filters client-side.
 */
export default function StockPicker({ equities, onSelect, loading }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? equities.filter(
          (e) => e.ticker.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
        )
      : equities;
    return list.slice(0, 50);
  }, [query, equities]);

  const choose = (eq) => {
    setQuery(`${eq.ticker} — ${eq.name}`);
    setOpen(false);
    onSelect(eq.ticker);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        className="search-input"
        placeholder={loading ? 'Loading NGX equities…' : `Search ${equities.length} NGX stocks (e.g. GTCO, Dangote, MTN)…`}
        value={query}
        disabled={loading}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <div className="dropdown">
          {results.map((eq, i) => (
            <div
              key={eq.ticker}
              className={`dropdown-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(eq)}
            >
              <span className="tk">{eq.ticker}</span>
              <span className="nm">{eq.name}</span>
              <span className="pr">
                {eq.price != null ? `₦${eq.price.toLocaleString()}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
