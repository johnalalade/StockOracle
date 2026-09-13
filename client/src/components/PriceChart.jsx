import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';

/** Read theme colours from the CSS custom properties on :root. */
function readThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    grid: v('--border', '#232c40'),
    axis: v('--text-faint', '#5b6678'),
    cardBg: v('--bg-card', '#161d2e'),
    pageBg: v('--bg', '#0b0f17'),
    dim: v('--text-dim', '#8b97ad'),
    accent: v('--accent', '#4f8cff'),
    hold: v('--hold', '#f0b90b'),
  };
}

/**
 * Close price with moving-average overlays and the Bollinger band envelope.
 * Colours are read from the active theme's CSS variables (re-read on toggle
 * via the `theme` dependency), so the chart works in light and dark mode.
 */
export default function PriceChart({ series, theme = 'dark' }) {
  const c = useMemo(() => readThemeColors(), [theme]);

  const data = series.map((s) => ({
    date: s.date?.slice(5), // MM-DD
    close: s.close,
    ma: s.sma20 ?? s.sma10 ?? s.smaFast,
    bbUpper: s.bbUpper ?? s.bbAdaptiveUpper,
    bbLower: s.bbLower ?? s.bbAdaptiveLower,
  }));

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={c.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: c.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => `₦${v}`}
          />
          <Tooltip
            contentStyle={{ background: c.cardBg, border: `1px solid ${c.grid}`, borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: c.dim }}
            formatter={(v, n) => [v != null ? `₦${Number(v).toFixed(2)}` : '—', n]}
          />
          <Legend wrapperStyle={{ fontSize: 11.5, color: c.dim }} />
          <Area type="monotone" dataKey="bbUpper" name="BB Upper" stroke="none" fill="url(#bbFill)" />
          <Area type="monotone" dataKey="bbLower" name="BB Lower" stroke="none" fill={c.pageBg} />
          <Line type="monotone" dataKey="close" name="Close" stroke={c.accent} strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey="ma" name="Moving Avg" stroke={c.hold} strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
