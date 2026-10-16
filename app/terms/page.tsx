import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing access to US Market AI market data, research tools, forecasts, and educational content.',
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms of Use | US Market AI', description: 'Terms governing access to US Market AI market data, research tools, forecasts, and educational content.', url: 'https://usmarketai.com/terms', siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: 'Terms of Use | US Market AI', description: 'Terms governing access to US Market AI market data, research tools, forecasts, and educational content.' },
};

export default function Terms() {
  return (
    <div className="info-page">
      <div className="info-shell legal-layout">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Legal</div>
          <h1>Terms of Use</h1>
          <p className="info-lead">These terms describe the basic conditions for accessing US Market AI and using its market data, research, and analysis features.</p>
        </section>
        <section className="info-section">
          <div className="legal-note">These website terms should be reviewed and completed by the operator before commercial launch. The site content currently does not specify a contracting legal entity, governing-law jurisdiction, or formal dispute process; none is invented here.</div>
          <h2>Permitted use</h2>
          <p>You may access the site for lawful personal, educational, and research purposes. You must comply with applicable law and must not interfere with site operation, bypass access controls, overload the service, probe systems without authorization, or use the site to distribute malicious code or unlawful material.</p>
          <h2>Research is informational only</h2>
          <p>Market information, screeners, rankings, company metrics, forecasts, AI-generated explanations, and other materials are general information. They are not personalized investment, trading, tax, accounting, or legal advice, and they do not consider your objectives, financial situation, or risk tolerance. You remain responsible for independent research and decisions.</p>
          <h2>Accuracy, delays, and availability</h2>
          <p>Data may be delayed, incomplete, revised by its source, unavailable, or incorrectly mapped. A displayed timestamp or source label should be checked before relying on a figure. We do not promise uninterrupted availability, error-free calculations, complete coverage, or that a model output will match a future outcome.</p>
          <h2>Third-party services and content</h2>
          <p>The service may display or rely on third-party market data, news, links, infrastructure, and other content. Third-party services remain subject to their own terms and availability. A link or inclusion is not an endorsement, and external sites are outside the control of US Market AI.</p>
          <h2>Intellectual property and data use</h2>
          <p>Site design, original text, and software are protected to the extent provided by applicable law. Source data and third-party content may carry separate rights and license conditions. Do not systematically scrape, republish, resell, or redistribute site content or data in a way that violates applicable law, third-party rights, or source-provider terms.</p>
          <h2>No warranty</h2>
          <p>To the extent permitted by applicable law, the service and its content are provided on an “as is” and “as available” basis, without a promise that they are complete, suitable for a particular purpose, or free from errors. Nothing here excludes a right or liability that cannot lawfully be excluded.</p>
          <h2>Liability and changes</h2>
          <p>To the extent permitted by applicable law, the operator is not responsible for losses arising from reliance on general market content, data interruptions, third-party content, or model estimates. The precise allocation of liability and any mandatory consumer protections depend on applicable law and require jurisdiction-specific review.</p>
          <h2>Changes and termination</h2>
          <p>Features, data coverage, and these terms may change as the service evolves. Access may be limited where reasonably necessary for security, maintenance, legal compliance, or protection of the service.</p>
          <h2>Operator details and legal review</h2>
          <p>The site content currently does not identify the legal operator, registered address, governing law, or a verified legal-notice contact. These details and a dispute-resolution process should be added by the operator and reviewed by qualified counsel before these terms are treated as final.</p>
        </section>
      </div>
    </div>
  );
}
