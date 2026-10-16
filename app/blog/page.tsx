import type { Metadata } from 'next';
import { createDatabaseClient } from '@/lib/neon';
import { filterCommonEquityRows } from '@/lib/stock-universe';
import './blog.css';

export const metadata: Metadata = {
  title: 'Stock Price Predictions 2026–2050 | Long-Term Research',
  description: 'Explore sector-wise US stock price prediction research for 2026, 2030, 2035, 2040 and 2050, with quantitative methodology, risks and live stock intelligence.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Stock Price Predictions 2026–2050 | Long-Term Research',
    description: 'Explore sector-wise US stock price prediction research with quantitative methodology, risks and links to company research.',
    url: 'https://usmarketai.com/blog',
    siteName: 'US Market AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Price Predictions 2026–2050 | Long-Term Research',
    description: 'Long-term US stock forecast research, methodology and risk context.',
  },
};

type StockRow = {
  symbol: string;
  slug: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
};

const researchGuides = [
  {slug:'read-stock-valuation-metrics',category:'FUNDAMENTALS',title:'How to Read Stock Valuation Metrics',description:'Interpret P/E, cash flow, growth and debt without relying on a single ratio.'},
  {slug:'interpret-earnings-reports',category:'EARNINGS',title:'How to Interpret a Company Earnings Report',description:'Separate revenue, margins, reported periods, guidance and source facts.'},
  {slug:'understand-ai-stock-predictions',category:'QUANTITATIVE RESEARCH',title:'How to Evaluate AI Stock Predictions',description:'Understand forecast horizons, confidence, historical validation and model risk.'},
  {slug:'market-breadth-and-sector-rotation',category:'MARKET STRUCTURE',title:'Market Breadth and Sector Rotation Explained',description:'Learn what breadth and sector averages can tell you—and what they cannot.'},
];

const categories = [
  { name: 'Technology', description: 'Software, semiconductors, cloud, AI and technology leaders.' },
  { name: 'Financial Services', description: 'Banks, payments, exchanges, brokers and financial platforms.' },
  { name: 'Healthcare', description: 'Healthcare services, medical technology, biotech and pharma research.' },
  { name: 'Consumer & Communication', description: 'Consumer brands, retail, media, advertising and communication businesses.' },
];

function categoryMatch(category: string, sector: string | null) {
  if (category === 'Consumer & Communication') return ['Consumer Cyclical', 'Consumer Defensive', 'Communication Services'].includes(sector ?? '');
  return sector === category;
}

export default async function BlogPage() {
  const supabase = createDatabaseClient();
  const result = await supabase
    .from('stocks')
    .select('symbol,slug,company_name,sector,industry,market_cap')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .order('market_cap', { ascending: false, nullsFirst: false })
    .limit(80);

  const stocks = filterCommonEquityRows((result.data ?? []) as StockRow[]);

  return <main className="blog-page">
    <div className="container">
      <section className="blog-hero">
        <div className="eyebrow">US MARKET AI · FORECAST RESEARCH</div>
        <h1>Stock Price Predictions <span>2026–2050</span></h1>
        <p>Long-term stock research organized by sector, with dedicated article pages, thumbnail space, model methodology, risk factors and links back to live stock intelligence.</p>
        <div className="blog-actions"><a className="button primary" href="/predictions">Explore AI Predictions →</a><a className="button" href="/stocks">Browse US Stocks</a></div>
      </section>

      <section className="blog-directory blog-guides-directory">
        <div className="section-head"><div><div className="eyebrow">RESEARCH GUIDES</div><h2>Practical investing research guides</h2><p className="muted">Original educational explainers on valuation, earnings, quantitative forecasts and market structure.</p></div></div>
        <div className="blog-article-grid">{researchGuides.map(guide=><a className="blog-article-card" href={`/blog/${guide.slug}`} key={guide.slug}><div className="blog-article-thumbnail" aria-hidden="true"><span>{guide.category.slice(0,3)}</span></div><div className="blog-article-card-body"><small>{guide.category}</small><h3>{guide.title}</h3><p>{guide.description}</p><b>Read guide →</b></div></a>)}</div>
      </section>

      <section className="blog-principles">
        <article><b>Quantitative first</b><span>Short-term forecast values come from the prediction engine. Long-term article pages never invent numerical forecasts when validated long-horizon data is unavailable.</span></article>
        <article><b>Historical validation</b><span>Prediction outcomes are displayed only after the relevant horizon has matured and been evaluated against actual market data.</span></article>
        <article><b>Connected research</b><span>Every article links to the underlying stock page, technical signals, news and related companies for a deeper research journey.</span></article>
      </section>

      <section className="blog-directory">
        <div className="section-head"><div><div className="eyebrow">FORECAST LIBRARY</div><h2>Sector-wise long-term stock research</h2><p className="muted">Only companies with a valid research destination are shown. No placeholder articles or invented forecast pages are published.</p></div></div>

        <div className="blog-category-stack">
          {categories.map((category) => {
            const items = stocks.filter((stock) => categoryMatch(category.name, stock.sector)).slice(0, 6);
            const cards: StockRow[] = items.filter((stock) => Boolean(stock.slug?.trim()));
            const sectorHref = category.name === 'Consumer & Communication' ? '/stocks' : `/stocks?sector=${encodeURIComponent(category.name)}`;
            return <section className="blog-category" key={category.name}>
              <div className="blog-category-head"><div><div className="eyebrow">SECTOR RESEARCH</div><h2>{category.name}</h2><p>{category.description}</p></div><a href={sectorHref}>Browse sector →</a></div>
              {cards.length ? <div className="blog-article-grid">
                {cards.map((stock) => <a className="blog-article-card" href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`} key={`${category.name}-${stock.symbol}`}>
                  <div className="blog-article-thumbnail" aria-hidden="true"><span>{stock.symbol}</span></div>
                  <div className="blog-article-card-body"><small>{stock.symbol} · {stock.sector || category.name}</small><h3>{stock.company_name} Stock Price Prediction 2026–2050</h3><p>Long-term research framework, methodology, assumptions and risk factors. Forecast figures are shown only when validated model data exists.</p><b>Read research →</b></div>
                </a>)}
              </div> : <div className="research-empty"><strong>No verified articles in this sector yet</strong><p>We do not publish placeholder articles or unsupported price targets. Browse the available company directory while research coverage is prepared.</p><a className="research-open" href={sectorHref}>Browse sector companies →</a></div>}
            </section>;
          })}
        </div>
      </section>

      <section className="blog-methodology">
        <div><div className="eyebrow">METHODOLOGY</div><h2>Forecasts should be measurable, not mysterious.</h2><p className="muted">The long-term library is a research layer around the quantitative data platform, not a place for fabricated price targets.</p></div>
        <div className="method-grid"><span>Price &amp; volume history</span><span>Technical indicators</span><span>Fundamentals &amp; earnings</span><span>Market &amp; sector context</span><span>News &amp; sentiment</span><span>Prediction evaluation</span></div>
      </section>

      <div className="blog-disclaimer">Forecasts are estimates generated from available data and models. They are not financial advice and are not guarantees of future performance.</div>
    </div>
  </main>;
}
