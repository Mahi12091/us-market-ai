'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ChartPoint = { time: string; close: number };

type Props = { data: ChartPoint[] };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function PriceChart({ data }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [range, setRange] = useState<'1Y' | '6M' | '3M'>('1Y');
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => {
    const count = range === '3M' ? 63 : range === '6M' ? 126 : 250;
    return data.slice(-count);
  }, [data, range]);

  if (!data.length) {
    return <div className="chart-empty"><div><strong>Price chart</strong><span>Historical price data will appear here after the market feed is connected.</span></div></div>;
  }

  const height = width < 560 ? 270 : 330;
  const pad = { top: 18, right: 12, bottom: 30, left: 56 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  const values = points.map(p => Number(p.close)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, Math.abs(max) * 0.01, 0.01);
  const yMin = min - spread * 0.08;
  const yMax = max + spread * 0.08;
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * innerH;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(Number(p.close)).toFixed(1)}`).join(' ');
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + innerW},${pad.top + innerH}`;
  const last = points[points.length - 1];
  const selected = hover == null ? null : points[hover];
  const selectedX = hover == null ? 0 : x(hover);
  const selectedY = hover == null ? 0 : y(Number(selected?.close ?? 0));
  const yTicks = Array.from({ length: 5 }, (_, i) => yMax - ((yMax - yMin) * i) / 4);
  const xTicks = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const handlePointer = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length < 2) return;
    const local = clamp(clientX - rect.left - pad.left, 0, innerW);
    setHover(clamp(Math.round((local / innerW) * (points.length - 1)), 0, points.length - 1));
  };

  return (
    <div className="price-chart-native">
      <div className="chart-toolbar">
        <div className="chart-range-tabs" role="tablist" aria-label="Chart range">
          {(['1Y', '6M', '3M'] as const).map(r => <button key={r} type="button" className={range === r ? 'active' : ''} onClick={() => { setRange(r); setHover(null); }}>{r}</button>)}
        </div>
        <span className="chart-last">Last: ${Number(last.close).toFixed(2)}</span>
      </div>
      <div ref={wrapRef} className="chart-svg-wrap" onPointerMove={e => handlePointer(e.clientX)} onPointerLeave={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive historical stock price chart">
          <defs><linearGradient id="nativePriceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1769e0" stopOpacity=".22"/><stop offset="100%" stopColor="#1769e0" stopOpacity="0"/></linearGradient></defs>
          {yTicks.map((v, i) => <g key={`y-${i}`}><line x1={pad.left} x2={pad.left + innerW} y1={y(v)} y2={y(v)} stroke="#e6edf6" strokeDasharray="3 3"/><text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#64748b">${v.toFixed(0)}</text></g>)}
          <polygon points={area} fill="url(#nativePriceFill)" />
          <polyline points={line} fill="none" stroke="#1769e0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {xTicks.map((i, n) => <text key={`x-${n}`} x={x(i)} y={height - 8} textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'} fontSize="10" fill="#64748b">{points[i].time}</text>)}
          {hover != null && <><line x1={selectedX} x2={selectedX} y1={pad.top} y2={pad.top + innerH} stroke="#94a3b8" strokeDasharray="3 3"/><circle cx={selectedX} cy={selectedY} r="4.5" fill="#1769e0" stroke="#fff" strokeWidth="2"/><g transform={`translate(${clamp(selectedX + 10, 4, width - 154)},${clamp(selectedY - 48, 4, height - 58)})`}><rect width="150" height="54" rx="8" fill="#0b1930"/><text x="10" y="20" fontSize="10" fill="#cbd5e1">{selected?.time}</text><text x="10" y="40" fontSize="14" fontWeight="700" fill="#fff">${Number(selected?.close ?? 0).toFixed(2)}</text></g></>}
        </svg>
      </div>
      <div className="chart-hint">Move your finger or mouse across the chart to inspect price · {points.length} sessions</div>
    </div>
  );
}
