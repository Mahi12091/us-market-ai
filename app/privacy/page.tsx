export const metadata = { title: 'Privacy', description: 'Privacy information for US Market AI.' };

export default function Privacy() {
  return (
    <div className="info-page">
      <div className="info-shell legal-layout">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Legal</div>
          <h1>Privacy</h1>
          <p className="info-lead">A clear overview of the information US Market AI may process as the platform evolves toward production.</p>
        </section>
        <section className="info-section">
          <div className="legal-note">This page is a structured draft for the production privacy policy. Final legal language, retention periods and jurisdiction-specific disclosures should be completed before public launch.</div>
          <h2>Information we may process</h2>
          <p>The production service may process information needed to operate the website, understand usage, protect the service and respond to support requests. This can include technical logs, device or browser information, analytics data and information you voluntarily submit.</p>
          <h2>Cookies and analytics</h2>
          <p>Analytics and advertising technologies may use cookies or similar technologies to measure traffic, improve the product and, where applicable, support advertising. The final policy will describe the vendors and controls used at launch.</p>
          <h2>Advertising</h2>
          <p>If advertising is enabled, third-party advertising providers may process information according to their own policies and applicable consent requirements. US Market AI will document the relevant choices and disclosures before monetization.</p>
          <h2>Data retention and rights</h2>
          <p>The final policy will specify retention periods and explain applicable rights, requests and contact procedures based on the jurisdictions in which the service operates.</p>
        </section>
      </div>
    </div>
  );
}
