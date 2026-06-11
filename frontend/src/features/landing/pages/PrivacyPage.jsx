import { Link } from "react-router-dom";

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-heading text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{title}</h2>
      <div className="text-slate-600 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function DataRow({ category, examples, purpose, retention }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3 pr-4 font-medium text-slate-800 text-sm align-top">{category}</td>
      <td className="py-3 pr-4 text-slate-600 text-sm align-top">{examples}</td>
      <td className="py-3 pr-4 text-slate-600 text-sm align-top">{purpose}</td>
      <td className="py-3 text-slate-600 text-sm align-top">{retention}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-surface">
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-secondary text-xs font-bold font-heading uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-heading text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-gray-600 text-sm">Last updated: 29 April 2026 · Compliant with Kenya Data Protection Act 2019</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-10 text-sm text-teal-800">
          Trakvora is committed to protecting the personal data of every user on our platform. This Policy explains what data we collect, how we use it, and your rights under the Kenya Data Protection Act 2019 (KDPA) and applicable East African data protection frameworks.
        </div>

        <Section title="1. Data Controller">
          <p>Intellora Solutions Limited, incorporated in Kenya, is the Data Controller for personal data processed through the Trakvora platform. For data protection enquiries, contact our Data Protection Officer at: <a href="mailto:privacy@trakvora.com" className="text-secondary hover:underline font-semibold">privacy@trakvora.com</a>.</p>
        </Section>

        <Section title="2. Data We Collect">
          <p>The table below describes the categories of personal data we collect, why we collect it, and how long we retain it.</p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 pr-4 font-heading font-semibold text-slate-600 text-xs uppercase">Category</th>
                  <th className="text-left py-3 pr-4 font-heading font-semibold text-slate-600 text-xs uppercase">Examples</th>
                  <th className="text-left py-3 pr-4 font-heading font-semibold text-slate-600 text-xs uppercase">Purpose</th>
                  <th className="text-left py-3 font-heading font-semibold text-slate-600 text-xs uppercase">Retention</th>
                </tr>
              </thead>
              <tbody>
                <DataRow
                  category="Identity"
                  examples="Full name, national ID number, passport photo, date of birth"
                  purpose="KYC verification, NTSA cross-check, account authentication"
                  retention="Active account + 7 years post-closure (regulatory requirement)"
                />
                <DataRow
                  category="Contact"
                  examples="Email address, phone number, physical address"
                  purpose="Account management, notifications, support communications"
                  retention="Active account + 3 years"
                />
                <DataRow
                  category="Professional"
                  examples="Driver's licence, PSV badge, vehicle registration, NTSA status"
                  purpose="Carrier verification, compliance monitoring"
                  retention="Active account + 7 years"
                />
                <DataRow
                  category="Financial"
                  examples="M-Pesa number, bank account details, transaction history, account balance"
                  purpose="Payment processing, payout disbursement, fraud prevention"
                  retention="7 years (Kenya Revenue Authority requirement)"
                />
                <DataRow
                  category="Location"
                  examples="Real-time GPS coordinates during active shipments"
                  purpose="Shipment tracking, route verification, dispute resolution"
                  retention="90 days post-delivery"
                />
                <DataRow
                  category="Usage"
                  examples="Login times, pages visited, features used, device type"
                  purpose="Platform improvement, security monitoring, fraud detection"
                  retention="12 months"
                />
                <DataRow
                  category="Communications"
                  examples="Support tickets, in-platform messages, dispute evidence"
                  purpose="Customer support, dispute resolution"
                  retention="3 years"
                />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="3. Legal Bases for Processing">
          <p>We process personal data under the following legal bases as provided by the KDPA 2019:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Contract performance:</strong> Processing necessary to fulfil the services you request (e.g., load posting, payment processing, tracking)</li>
            <li><strong>Legal obligation:</strong> Processing required by Kenyan law (e.g., KRA reporting, NTSA compliance, anti-money laundering checks)</li>
            <li><strong>Legitimate interests:</strong> Fraud prevention, platform security, product improvement — where these interests do not override your fundamental rights</li>
            <li><strong>Consent:</strong> Marketing communications and optional analytics (you may withdraw consent at any time)</li>
          </ul>
        </Section>

        <Section title="4. How We Share Your Data">
          <p>We do not sell your personal data. We may share it with:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Other platform users:</strong> Shippers can see a Carrier's professional profile (rating, licence class, trip history). Sensitive data (ID numbers, financial details) is never shared between users.</li>
            <li><strong>Payment processors:</strong> IntaSend for M-Pesa and card transactions. Subject to IntaSend's privacy policy.</li>
            <li><strong>Verification partners:</strong> Smile Identity for NTSA document verification.</li>
            <li><strong>Cloud infrastructure:</strong> AWS (data stored in the EU-West region with Standard Contractual Clauses in place).</li>
            <li><strong>Regulatory authorities:</strong> Kenya Revenue Authority, NTSA, or law enforcement, when legally required or in response to a valid court order.</li>
          </ul>
        </Section>

        <Section title="5. Location Data">
          <p>For Drivers and Fleet Owners with active shipments, we collect GPS location data every 30 seconds. This data is:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Visible to the Shipper and Fleet Owner assigned to that shipment</li>
            <li>Used for ETA calculation, route deviation alerts, and dispute evidence</li>
            <li>Retained for 90 days after delivery, then anonymised and aggregated</li>
            <li>Never shared with third-party advertisers</li>
          </ul>
          <p className="mt-2">Location tracking is only active when you have an accepted active shipment. Outside of active shipments, we collect only your coarse availability location (city-level) as you set it on your profile.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Under the Kenya Data Protection Act 2019 you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Access</strong> — request a copy of personal data we hold about you</li>
            <li><strong>Rectification</strong> — correct inaccurate or incomplete data</li>
            <li><strong>Erasure</strong> — request deletion of your data (subject to legal retention obligations)</li>
            <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
            <li><strong>Withdraw consent</strong> — for any processing based on consent, at any time</li>
          </ul>
          <p className="mt-3">To exercise any right, email <a href="mailto:privacy@trakvora.com" className="text-secondary hover:underline font-semibold">privacy@trakvora.com</a>. We will respond within 30 days. You may also lodge a complaint with the Office of the Data Protection Commissioner of Kenya.</p>
        </Section>

        <Section title="7. Cookies" id="cookies">
          <p>We use the following types of cookies:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Essential cookies:</strong> Required for authentication and session management. Cannot be disabled.</li>
            <li><strong>Analytics cookies:</strong> Used to understand how users interact with the platform (anonymised). You can opt out.</li>
            <li><strong>Preference cookies:</strong> Remember your language and display preferences.</li>
          </ul>
          <p className="mt-2">You can manage cookie preferences through your browser settings or by contacting us.</p>
        </Section>

        <Section title="8. Data Security">
          <p>We implement the following security measures: AES-256 encryption at rest; TLS 1.3 in transit; bcrypt password hashing; multi-factor authentication available for all accounts; regular penetration testing; access controls limiting employee access to personal data on a need-to-know basis.</p>
          <p className="mt-2">In the event of a data breach, we will notify affected users and the Office of the Data Protection Commissioner within 72 hours, as required by the KDPA.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this Policy periodically. Material changes will be communicated by email and in-platform notification at least 14 days before taking effect. Continued use of the Platform constitutes acceptance of the updated Policy.</p>
        </Section>

        <Section title="10. Contact">
          <p>Data Protection Officer<br />
          Intellora Solutions Limited · Nairobi, Kenya<br />
          Email: <a href="mailto:privacy@trakvora.com" className="text-secondary hover:underline">privacy@trakvora.com</a></p>
        </Section>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-6 text-xs text-slate-500">
          <Link to="/terms"             className="hover:text-secondary transition-colors">Terms of Service</Link>
          <Link to="/carrier-agreement" className="hover:text-secondary transition-colors">Carrier Agreement</Link>
          <Link to="/help"              className="hover:text-secondary transition-colors">Help Center</Link>
        </div>
      </div>
    </div>
  );
}
