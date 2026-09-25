type ResearchStock = {
  symbol: string;
  slug: string | null | undefined;
  company_name: string;
  sector: string | null | undefined;
  industry?: string | null;
};

const categories = [
  { name: 'Technology', description: 'Long-term research on software, semiconductors, cloud and technology leaders.' },
  { name: 'Financial Services', description: 'Forecast research covering banks, payments, exchanges and financial platforms.' },
  { name: 'Healthcare', description: 'Long-term research across healthcare, biotech and medical innovation.' },
  { name: 'Consumer & Communication', description: 'Research across consumer brands, retail, media and communication businesses.' },
];

export default function LongTermResearchSection({ stocks }: { stocks: readonly ResearchStock[] }) {
  const normalized = stocks.map((stock) => ({ ...stock, sector: stock.sector?.trim() || 'Consumer & Communication' }));

  return (
    <section className="section long-term-research-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">LONG-TERM RESEARCH</div>
          <h2>Stock price prediction research 2026–2050</h2>
          <p className="muted">Sector-wise long-term research with a dedicated article layout, thumbnail space and links to every stock research page.</p>
        </div>
        <a href="/blog">View all research →</a>
      </div>

      <div className="long-term-category-grid">
        {categories.map((category) => {
          const items = normalized.filter((stock) => {
            if (category.name === 'Consumer & Communication') {
              return ['Consumer Cyclical', 'Consumer Defensive', 'Communication Services'].includes(stock.sector ?? '');
            }
            return stock.sector === category.name;
          }).slice(0, 4);

          const sectorHref = category.name === 'Consumer & Communication' ? '/stocks' : `/stocks?sector=${encodeURIComponent(category.name)}`;

          return (
            <div className="long-term-category" key={category.name}>
              <div className="long-term-category-head">
                <div><span className="eyebrow">SECTOR RESEARCH</span><h3>{category.name}</h3><p>{category.description}</p></div>
                <a href={sectorHref}>More →</a>
              </div>
              <div className="long-term-article-grid">
                {(items.length ? items : [{ symbol: 'STOCK', slug: null, company_name: 'Long-term research article', sector: category.name }]).map((stock, index) => (
                  <a className="long-term-article-card" href={stock.slug ? `/blog/${stock.slug}-stock-price-prediction-2026-2050` : '/blog'} key={`${category.name}-${stock.symbol}-${index}`}>
                    <div className="long-term-thumb"><span>THUMBNAIL<br/>PLACEHOLDER</span></div>
                    <div className="long-term-article-copy">
                      <small>{stock.symbol} · {category.name}</small>
                      <h4>{stock.company_name} Stock Price Prediction 2026–2050</h4>
                      <p>Long-term forecast research, model methodology, risk factors and links to live stock intelligence.</p>
                      <b>Read research →</b>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
