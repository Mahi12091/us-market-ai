type ResearchStock = {
  symbol: string;
  slug: string | null | undefined;
  company_name: string;
  sector: string | null | undefined;
  industry?: string | null;
};

const categories = [
  { name: 'Technology', sectors: ['Technology'], description: 'Company research across software, semiconductors, cloud and technology businesses.' },
  { name: 'Financial Services', sectors: ['Financial Services'], description: 'Company research covering banks, payments, exchanges and financial platforms.' },
  { name: 'Healthcare', sectors: ['Healthcare'], description: 'Company research across healthcare, biotech and medical innovation.' },
  { name: 'Consumer & Communication', sectors: ['Consumer', 'Consumer Discretionary', 'Communication Services'], description: 'Company research across consumer businesses, retail, media and communications.' },
];

export default function LongTermResearchSection({ stocks }: { stocks: readonly ResearchStock[] }) {
  const normalized = stocks.map((stock) => ({ ...stock, sector: stock.sector?.trim() || 'Other' }));

  return (
    <section className="section long-term-research-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">LONG-TERM RESEARCH</div>
          <h2>Explore stocks for long-term research</h2>
          <p className="muted">Explore companies by sector and continue to their stock profiles for available fundamentals, forecasts and risk context.</p>
        </div>
        <a href="/blog">View all research →</a>
      </div>

      <div className="long-term-category-grid">
        {categories.map((category) => {
          const items = normalized
            .filter((stock) => category.sectors.includes(stock.sector ?? '') && Boolean(stock.slug?.trim()))
            .slice(0, 4);

          const sectorHref = category.name === 'Consumer & Communication' ? '/stocks' : `/stocks?sector=${encodeURIComponent(category.name)}`;

          return (
            <div className="long-term-category" key={category.name}>
              <div className="long-term-category-head">
                <div><span className="eyebrow">SECTOR RESEARCH</span><h3>{category.name}</h3><p>{category.description}</p></div>
                <a href={sectorHref}>More →</a>
              </div>
              <div className="long-term-article-grid">
                {items.length ? items.map((stock, index) => (
                  <a className="long-term-article-card" href={stock.slug ? `/stocks/${stock.slug}` : '/stocks'} key={`${category.name}-${stock.symbol}-${index}`}>
                    <div className="long-term-thumb"><span>STOCK RESEARCH</span></div>
                    <div className="long-term-article-copy">
                      <small>{stock.symbol} · {category.name}</small>
                      <h4>{stock.company_name} stock research</h4>
                      <p>Review available price history, fundamentals, forecasts and risk context on the company profile.</p>
                      <b>Open stock profile →</b>
                    </div>
                  </a>
                )) : <div className="long-term-empty">No matching stocks are available in this section yet. <a href="/stocks">Browse all stocks →</a></div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
