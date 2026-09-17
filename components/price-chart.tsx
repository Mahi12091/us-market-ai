'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type ChartPoint = { time: string; close: number };

export default function PriceChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return <div className="chart-empty"><div><strong>Price chart</strong><span>Historical price data will appear here after the market feed is connected.</span></div></div>;
  }

  return (
    <div className="price-chart" role="img" aria-label="Historical stock price chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart width={800} height={300} data={data} margin={{ top: 10, right: 14, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity={0.28} />
              <stop offset="100%" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={28} />
          <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={48} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ maxWidth: 'min(240px, 70vw)', pointerEvents: 'none' }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
            labelFormatter={(value) => String(value)}
          />
          <Area type="monotone" dataKey="close" stroke="var(--blue)" strokeWidth={2.5} fill="url(#priceFill)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
