'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ChartPoint = { time: string; close: number };
type Props = { data: ChartPoint[] };
type Range = '1Y' | '6M' | '3M';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function PriceChart({ data }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [range, setRange] = useState<Range>('1Y');
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

  useEffect(() => {
    const panel = wrapRef.current?.closest('.chart-panel');
    if (!panel) return;
    const controls = panel.querySelector<HTMLElement>('.range-tabs');
    const buttons = Array.from(panel.querySelectorAll<HTMLElement>('.range-tabs span'));
    if (controls) {
      controls.style.display = 'flex';
      controls.style.cursor = 'pointer';
    }
    const activate = (target: HTMLElement) => {
      const next = target.textContent?.trim() as Range;
      if (next !== '1Y' && next !== '6M' && next !== '3M') return;
      setRange(next);
      setHover(null);
      buttons.forEach(button => button.classList.toggle('active', button === target));
    };
    const handlers = buttons.map(button => {
      const handler = () => activate(button);
      button.style.cursor = 'pointer';
      button.addEventListener('click', handler);
      return [button, handler] as const;
    });
    return () => handlers.forEach(([button, handler]) => button.removeEventListener('click', handler));
  }, [data]);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root || !data.length) return;
    const page = root.closest('.stock-page');
    const hero = page?.querySelector<HTMLElement>('.stock-hero');
    const quoteBlock = page?.querySelector<HTMLElement>('.quote-block');
    const metricStrip = page?.querySelector<HTMLElement>('.metric-strip');
    if (!page || !hero || !quoteBlock || !metricStrip) return;

    const old = page.querySelector('.stock-performance-inline');
    old?.remove();

    const metricValues = Array.from(metricStrip.children).map(node => ({
      label: node.querySelector('span')?.textContent?.trim() ?? '',
      value: node.querySelector('b')?.textContent?.trim() ?? '—',
    }));
    const metric = (label: string) => metricValues.find(item => item.label === label)?.value ?? '—';
    const values = data.map(point => Number(point.close)).filter(Number.isFinite);
    if (!values.length) return;

    const low52 = Math.min(...values);
    const high52 = Math.max(...values);
    const first = values[0];
    const last = values[values.length - 1];
    const oneYearChange = first ? ((last - first) / first) * 100 : 0;
    const oneYearLabel = `${oneYearChange >= 0 ? '+' : ''}${oneYearChange.toFixed(2)}%`;

    const section = document.createElement('section');
    section.className = 'stock-performance-inline';
    section.innerHTML = `
      <div class="stock-performance-head">
        <div><h2>Performance</h2><span class="stock-performance-info">i</span></div>
        <small>US market data · Eastern Time (ET)</small>
      </div>
      <div class="stock-performance-ranges">
        <div class="performance-range-card">
          <div><span>Today's Low</span><b>${metric('Day Low')}</b></div>
          <div class="performance-range-right"><span>Today's High</span><b>${metric('Day High')}</b></div>
          <div class="performance-range-track"><i></i></div>
        </div>
        <div class="performance-range-card">
          <div><span>52 Week Low</span><b>${moneyValue(low52)}</b></div>
          <div class="performance-range-right"><span>52 Week High</span><b>${moneyValue(high52)}</b></div>
          <div class="performance-range-track"><i></i></div>
        </div>
      </div>
      <div class="stock-performance-grid">
        <div><span>Open</span><b>${metric('Open')}</b></div>
        <div><span>Prev. Close</span><b>${metric('Prev. Close')}</b></div>
        <div><span>Volume</span><b>${metric('Volume')}</b></div>
        <div><span>Market Cap</span><b>${metric('Market Cap')}</b></div>
        <div><span>1Y Change</span><b class="${oneYearChange >= 0 ? 'positive' : 'negative'}">${oneYearLabel}</b></div>
        <div><span>Price Status</span><b>Verified</b></div>
      </div>
    `;

    const styleId = 'stock-performance-inline-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .stock-performance-inline{margin:0 0 22px;padding:24px 0 0;border-top:1px solid #e5edf7}
        .stock-performance-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:20px}
        .stock-performance-head>div{display:flex;align-items:center;gap:9px}
        .stock-performance-head h2{margin:0;font-size:24px;line-height:1.1;color:#10213b}
        .stock-performance-head small{font-size:10px;color:#64748b;font-weight:650}
        .stock-performance-info{width:20px;height:20px;border:2px solid #9aa8ba;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#6d7c8e}
        .stock-performance-ranges{display:grid;gap:22px;margin-bottom:22px}
        .performance-range-card{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-bottom:17px}
        .performance-range-card span,.stock-performance-grid span{display:block;color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px}
        .performance-range-card b,.stock-performance-grid b{display:block;color:#10213b;font-size:19px;line-height:1.15}
        .performance-range-right{text-align:right}
        .performance-range-track{position:absolute;left:0;right:0;bottom:0;height:8px;border-radius:999px;background:#e8edf3}
        .performance-range-track i{position:absolute;right:3%;top:-5px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid #10213b}
        .stock-performance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 18px;padding-top:2px}
        .stock-performance-grid b{font-size:16px}
        @media (max-width:560px){.stock-performance-inline{padding-top:20px}.stock-performance-head{align-items:flex-start;flex-direction:column;gap:6px}.stock-performance-head h2{font-size:22px}.stock-performance-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 12px}.stock-performance-grid span{font-size:10px}.stock-performance-grid b{font-size:14px}.performance-range-card b{font-size:17px}}
      `;
      document.head.appendChild(style);
    }

    hero.insertAdjacentElement('afterend', section);

    const updated = quoteBlock.querySelector('small');
    if (updated?.textContent?.startsWith('Updated ')) {
      const raw = updated.textContent.replace(/^Updated\s+/, '').trim();
      const parsed = new Date(`${raw} UTC`);
      if (!Number.isNaN(parsed.getTime())) {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).formatToParts(parsed);
        const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
        updated.textContent = `As of ${get('month')} ${get('day')}, ${get('year')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')} ${get('timeZoneName')}`;
      }
    }
  }, [data]);

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
    </div>
  );
}

function moneyValue(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
