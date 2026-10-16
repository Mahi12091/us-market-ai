import Link from 'next/link';

export const metadata = {
  title: "Contact",
  description: "Contact workflow status and current support options for the US Market AI research platform.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact US Market AI",
    description: "Contact workflow status and current support options for the US Market AI research platform.",
    url: "https://usmarketai.com/contact",
    siteName: 'US Market AI',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: "Contact US Market AI",
    description: "Contact workflow status and current support options for the US Market AI research platform.",
  },
};

export default function Contact() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> US Market AI</div>
          <h1>Let’s talk.</h1>
          <p className="info-lead">Questions, feedback and data-correction reports are important. A public GitHub issue tracker is available; no private contact form or support email is configured on this page.</p>
        </section>

        <div className="contact-grid">
          <section className="info-section"><div className="contact-item"><div className="contact-icon">?</div><div><h3>Questions & feedback</h3><p>Share product feedback, UX issues or suggestions for improving the research experience.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">✓</div><div><h3>Data corrections</h3><p>Report a suspicious quote, company detail or research input so it can be reviewed.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">↗</div><div><h3>Partnerships</h3><p>For data, media, research or commercial partnership conversations.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">AI</div><div><h3>Platform inquiries</h3><p>Questions about predictions, analysis, market pages or the product roadmap.</p></div></div></section>
        </div>

        <section className="info-section">
          <div className="info-kicker">Support status</div>
          <h2>Public issue tracker</h2>
          <p>You can report a product issue or data-quality concern through the public repository issue tracker. Posts may be visible to anyone and may require a GitHub account. Do not include personal, account, payment or confidential financial information. A private support channel is not currently configured.</p>
          <div className="info-actions"><a className="info-btn primary" href="https://github.com/Mahi12091/us-market-ai/issues/new" target="_blank" rel="noopener noreferrer">Report an issue on GitHub ↗</a><Link className="info-btn" href="/about">About US Market AI</Link><Link className="info-btn" href="/privacy">Privacy</Link></div>
        </section>
      </div>
    </div>
  );
}
