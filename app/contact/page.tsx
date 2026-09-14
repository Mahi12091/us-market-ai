import Link from 'next/link';

export const metadata = { title: 'Contact', description: 'Contact US Market AI for questions, feedback, corrections or partnerships.' };

export default function Contact() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> US Market AI</div>
          <h1>Let’s talk.</h1>
          <p className="info-lead">Questions, feedback, data corrections and partnership ideas are all welcome. The contact workflow will be connected before production launch.</p>
        </section>

        <div className="contact-grid">
          <section className="info-section"><div className="contact-item"><div className="contact-icon">?</div><div><h3>Questions & feedback</h3><p>Share product feedback, UX issues or suggestions for improving the research experience.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">✓</div><div><h3>Data corrections</h3><p>Report a suspicious quote, company detail or research input so it can be reviewed.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">↗</div><div><h3>Partnerships</h3><p>For data, media, research or commercial partnership conversations.</p></div></div></section>
          <section className="info-section"><div className="contact-item"><div className="contact-icon">AI</div><div><h3>Platform inquiries</h3><p>Questions about predictions, analysis, market pages or the product roadmap.</p></div></div></section>
        </div>

        <section className="info-section">
          <div className="info-kicker">Before launch</div>
          <h2>Contact form coming next</h2>
          <p>The production contact form and delivery channel will be enabled before public launch. Until then, this page intentionally avoids displaying a placeholder email address.</p>
          <div className="info-actions"><Link className="info-btn" href="/about">About US Market AI</Link><Link className="info-btn" href="/privacy">Privacy</Link></div>
        </section>
      </div>
    </div>
  );
}
