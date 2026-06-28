import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';

/**
 * Close price with moving-average overlays and the Bollinger band envelope.
 */
export default function PriceChart({ series }) {
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
              <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#4f8cff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#232c40" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#5b6678', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#232c40' }} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#5b6678', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => `₦${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#161d2e', border: '1px solid #232c40', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: '#8b97ad' }}
            formatter={(v, n) => [v != null ? `₦${Number(v).toFixed(2)}` : '—', n]}
          />
          <Legend wrapperStyle={{ fontSize: 11.5, color: '#8b97ad' }} />
          <Area type="monotone" dataKey="bbUpper" name="BB Upper" stroke="none" fill="url(#bbFill)" />
          <Area type="monotone" dataKey="bbLower" name="BB Lower" stroke="none" fill="#0b0f17" />
          <Line type="monotone" dataKey="close" name="Close" stroke="#4f8cff" strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey="ma" name="Moving Avg" stroke="#f0b90b" strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
