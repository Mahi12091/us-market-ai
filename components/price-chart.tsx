'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type ChartPoint = { time: string; close: number };

export default function PriceChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return <div className="chart-empty"><div><strong>Price chart</strong><span>Historical price data will appear here after the market feed is connected.</span></div></div>;
  }

  return (
    <div className="price-chart" role="img" aria-label="Historical stock price chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 12, right: 14, left: 2, bottom: 4 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1769e0" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#1769e0" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e6edf6" strokeDasharray="3 3" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={28} />
          <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={52} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ maxWidth: 'min(240px, 70vw)', pointerEvents: 'none' }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
            labelFormatter={(value) => String(value)}
          />
          <Area type="monotone" dataKey="close" stroke="#1769e0" strokeWidth={2.5} fill="url(#priceFill)" dot={false} isAnimationActive={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
