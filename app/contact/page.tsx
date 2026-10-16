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
    description: "Send feedback, report data corrections or contact the US Market AI team about the research platform and its market-data coverage.",
  },
};

export default function Contact() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> US Market AI</div>
          <h1>Let’s talk.</h1>
          <p className="info-lead">Questions, feedback and data-correction reports are important. This page currently provides product information, but a message-delivery form is not enabled yet.</p>
        </section>

        <div className="contact-grid">
          <section className="info-section"><div className="contact-item"><div className="contact-icon">?</div><div><h3>Questions & feedback</h3><p>Share product feedback, UX issues or suggestions for improving the research experience.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">✓</div><div><h3>Data corrections</h3><p>Report a suspicious quote, company detail or research input so it can be reviewed.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">↗</div><div><h3>Partnerships</h3><p>For data, media, research or commercial partnership conversations.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">AI</div><div><h3>Platform inquiries</h3><p>Questions about predictions, analysis, market pages or the product roadmap.</p></div></div></section>
        </div>

        <section className="info-section">
          <div className="info-kicker">Support status</div>
          <h2>Contact workflow is not yet enabled</h2>
          <p>We do not currently accept messages through this page. Please do not enter personal or financial information here. A verified contact channel will be published when message delivery and privacy handling are configured.</p>
          <div className="info-actions"><Link className="info-btn" href="/about">About US Market AI</Link><Link className="info-btn" href="/privacy">Privacy</Link></div>
        </section>
      </div>
    </div>
  );
}
