import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn what information US Market AI may process, how it is used, and the limits of the current website contact and analytics features.',
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Privacy Policy | US Market AI', description: 'Learn what information US Market AI may process and how it is used.', url: 'https://usmarketai.com/privacy', siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: 'Privacy Policy | US Market AI', description: 'Learn what information US Market AI may process and how it is used.' },
};

export default function Privacy() {
  return (
    <div className="info-page">
      <div className="info-shell legal-layout">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Legal</div>
          <h1>Privacy Policy</h1>
          <p className="info-lead">This policy explains the categories of information that may be processed when you visit US Market AI and the choices available to you.</p>
        </section>
        <section className="info-section">
          <div className="legal-note">Important: the website’s features and third-party integrations may change. Before enabling analytics, advertising, accounts, or a contact form, the operator must update this policy to name the relevant providers, purposes, retention periods, and applicable user choices.</div>
          <h2>Information processed to operate the site</h2>
          <p>When you visit the website, the hosting and security infrastructure may process technical request information such as IP address, browser and device details, requested pages, timestamps, and error or security logs. These records help deliver pages, diagnose failures, prevent abuse, and maintain service reliability. The exact fields and retention periods depend on the active infrastructure configuration.</p>
          <h2>Market and research data</h2>
          <p>Searches and page requests may be used to retrieve market, company, news, and research records from the platform’s data services. Public market information displayed on the site is not, by itself, a request for or record of your personal financial circumstances.</p>
          <h2>Forms, accounts, and sensitive information</h2>
          <p>The Contact page currently does not submit or deliver messages. Do not send personal, account, payment, or financial information through a feature that does not explicitly confirm secure submission. If accounts or forms are introduced, this policy must be updated before they are enabled.</p>
          <h2>Cookies and similar technologies</h2>
          <p>Essential technologies may be used by the site or its infrastructure to provide security and core functionality. Do not assume that optional analytics or advertising cookies are enabled. If they are introduced, the operator should identify the providers, explain their purposes, and provide any consent or opt-out controls required by applicable law.</p>
          <h2>Service providers and disclosures</h2>
          <p>Hosting, database, security, and data providers may process information as necessary to deliver the service. Information may also be disclosed when required by law or when reasonably necessary to protect the service and its users. This page does not claim that any specific optional analytics or advertising vendor is currently active.</p>
          <h2>Retention and security</h2>
          <p>Information should be retained only for the operational, security, legal, or other disclosed purposes for which it is needed. No website can guarantee absolute security; avoid transmitting confidential information through public pages.</p>
          <h2>Your choices and requests</h2>
          <p>Privacy rights depend on your location and the applicable law. The site does not currently provide a working privacy-request submission form. Before collecting personal information through new features, the operator should publish a verified contact channel and procedures for applicable access, correction, deletion, objection, and consent-withdrawal requests.</p>
          <h2>Children and policy changes</h2>
          <p>The service is designed as a general market-research resource, not as a service directed to children. This policy may be updated when functionality or legal requirements change; material changes should be reflected on this page.</p>
          <h2>Operator and legal review</h2>
          <p>This page describes the current product posture but does not identify a legal entity, jurisdiction, or verified privacy contact because those details have not been configured in the site content supplied for this update. Publish those details and obtain jurisdiction-appropriate legal review before relying on this policy as a final compliance document.</p>
        </section>
      </div>
    </div>
  );
}
