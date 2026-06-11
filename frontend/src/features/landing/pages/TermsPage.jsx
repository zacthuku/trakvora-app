import { Link } from "react-router-dom";
import { useCountryFees } from "@/hooks/useCountryFees";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { useCurrency } from "@/hooks/useCurrency";

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-heading text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{title}</h2>
      <div className="text-slate-600 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function Sub({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="font-heading font-semibold text-slate-800 mb-2">{title}</h3>
      <div className="text-slate-600 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  const {
    shipperCommissionRate,
    carrierCommissionRate,
    cancellationFeeRate,
    maxCommissionKes,
    formatPercent,
    formatAmount,
  } = useCountryFees();
  const {
    jurisdiction,
    arbitrationCity,
    arbitrationAct,
    transportAuthority,
    policeService,
  } = useCountryConfig();
  const { format } = useCurrency();

  return (
    <div className="bg-surface">
      {/* Header */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-secondary text-xs font-bold font-heading uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-heading text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-gray-600 text-sm">Last updated: 8 June 2026 · Effective: 8 June 2026</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Intro */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-10 text-sm text-amber-800">
          <strong>Important:</strong> These Terms of Service ("Terms") constitute a legally binding agreement between you and Intellora Solutions Limited. By accessing or using our platform, you agree to be bound by these Terms. Please read them carefully.
        </div>

        <Section title="1. The Platform and Parties">
          <p>Intellora Solutions Limited ("Trakvora", "we", "us", or "our"), incorporated in Kenya, operates an online freight exchange platform accessible at trakvora.com and via mobile applications ("the Platform").</p>
          <p>The Platform facilitates freight transactions between:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Shippers</strong> — individuals or entities posting cargo for transport</li>
            <li><strong>Fleet Owners</strong> — licensed operators offering truck capacity and drivers</li>
            <li><strong>Drivers</strong> — licensed individuals operating vehicles to transport cargo</li>
          </ul>
          <p className="mt-3">Trakvora is a technology platform and marketplace operator. We are not a freight forwarder, carrier, logistics provider, or party to any freight contract between a Shipper and a Carrier. The freight contract is formed directly between the Shipper and the Fleet Owner/Driver upon bid acceptance.</p>
        </Section>

        <Section title="2. Platform Relationship">
          <p>Trakvora is a technology platform only. No employment, agency, joint venture, or partnership relationship exists between Trakvora and any Shipper, Fleet Owner, or Driver.</p>
          <Sub title="2.1 Independent Contractor Status">
            {`Fleet Owners and Drivers ("Carriers") are independent contractors and are not employees, agents, or representatives of Trakvora. Trakvora does not direct, supervise, or control how Carriers perform transportation services. Carriers are solely responsible for all statutory obligations including but not limited to: income tax, Value Added Tax (VAT), National Social Security Fund (NSSF) contributions, National Health Insurance Fund (NHIF) contributions, and any other levies required under the laws of ${jurisdiction}. No Carrier is entitled to any employment benefits, severance pay, leave, or protections afforded to employees under the Kenya Employment Act 2007 or any applicable employment legislation.`}
          </Sub>
          <Sub title="2.2 No Agency">
            Nothing in these Terms shall be construed to create any agency, representation, or authority between Trakvora and any user. No user may enter into any contract, incur any liability, or make any representation on behalf of Trakvora.
          </Sub>
        </Section>

        <Section title="3. Eligibility and Account Registration">
          <p>{`To use the Platform you must: (a) be at least 18 years of age; (b) have legal capacity to enter into binding contracts under the laws of ${jurisdiction}; (c) for Drivers and Fleet Owners, hold all required licences, permits, and authorisations required by the laws of ${jurisdiction} and any country in which you operate.`}</p>
          <Sub title="3.1 Account Security">
            You are responsible for maintaining the confidentiality of your account credentials. You must immediately notify Trakvora of any unauthorised use of your account. Trakvora will not be liable for any loss arising from unauthorised access resulting from your failure to secure your credentials.
          </Sub>
          <Sub title="3.2 Account Verification">
            {`Drivers and Fleet Owners must complete ${transportAuthority} verification before transacting on the Platform. Trakvora reserves the right to suspend accounts that provide false, misleading, or outdated documentation.`}
          </Sub>
        </Section>

        <Section title="4. Platform Fees and Payment">
          <p><strong>Trakvora does not collect, hold, transfer, or process freight payments between Shippers and Carriers.</strong> Payment for freight services is a direct obligation between the Shipper and the Carrier, settled outside the Platform by the parties' chosen payment method (mobile money, bank transfer, cash, or other agreed means). Trakvora has no financial stake in the freight transaction between parties.</p>
          <p className="mt-3">Trakvora charges platform fees for access to and use of the Platform. Fees may apply to any registered user category depending on the services used:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Shipper Platform Fee:</strong> <strong>{formatPercent(shipperCommissionRate)}</strong> of the agreed load value, capped at <strong>{formatAmount(maxCommissionKes)}</strong> per shipment</li>
            <li><strong>Carrier Platform Fee:</strong> <strong>{formatPercent(carrierCommissionRate)}</strong> of the agreed freight value per completed shipment, capped at <strong>{formatAmount(maxCommissionKes)}</strong>; invoiced after delivery confirmation and charged to the Carrier's Trakvora account</li>
          </ul>
          <p className="mt-3">Platform fees represent Trakvora's sole financial interest in any transaction. Fees are non-refundable for completed deliveries.</p>
          <Sub title="4.1 Cancellation Fees">
            Cancellation of a load after bid acceptance incurs a <strong>{formatPercent(cancellationFeeRate)}</strong> cancellation fee on the load value, payable to the Carrier as compensation for reserved capacity. Cancellations before bid acceptance are free of charge.
          </Sub>
          <Sub title="4.2 Fee Modifications">
            <p>Trakvora reserves the right to modify commission rates, platform fees, cancellation fees, and any other charges at any time in its sole discretion. Any modification will be communicated to registered users via email and in-platform notification at least <strong>30 days</strong> before the revised rates take effect.</p>
            <p className="mt-2">Revised rates apply only to loads posted, bids accepted, or services initiated <strong>after</strong> the effective date. Loads already accepted before the effective date retain the rates applicable at the time of bid acceptance. If you do not agree with a fee change, you may close your account before the effective date without penalty, provided no active shipments are outstanding. Continued use of the Platform after the effective date constitutes your binding acceptance of the revised fees.</p>
          </Sub>
          <Sub title="4.3 Tax Compliance">
            {`Trakvora's platform fees are subject to applicable Kenya Revenue Authority (KRA) taxation. Shippers may be required under Kenyan law to withhold 15% Withholding Tax (WHT) on freight payments to Carriers under Section 35 of the Income Tax Act (Cap. 470). Trakvora is not responsible for calculating, deducting, or enforcing WHT obligations. Each party is solely responsible for their own KRA compliance, tax registration, and filing obligations. Trakvora files transaction data with KRA as required by law.`}
          </Sub>
        </Section>

        <Section title="5. Carrier Obligations">
          <p>Fleet Owners and Drivers agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>{`Maintain valid ${transportAuthority} registration, vehicle insurance (minimum third-party), and all applicable permits`}</li>
            <li>Ensure trucks are roadworthy and suitable for the cargo type accepted</li>
            <li>Comply with weight limits, hazardous material regulations, and cross-border transit rules</li>
            <li>Maintain real-time GPS availability during active shipments</li>
            <li>Not subcontract freight without the Shipper's prior written consent</li>
            <li>Deliver cargo in the condition received, within the agreed timeframe</li>
          </ul>
        </Section>

        <Section title="6. Shipper Obligations">
          <p>Shippers agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Accurately describe cargo type, weight, dimensions, and any hazardous or sensitive characteristics</li>
            <li>Ensure cargo is properly packaged and labelled for transport</li>
            <li>Confirm or dispute delivery within 48 hours of the driver marking a shipment as delivered</li>
            <li>Not use the Platform to move prohibited goods (see Section 7)</li>
          </ul>
        </Section>

        <Section title="7. Prohibited Goods">
          <p>{`The Platform may not be used to transport: (a) illegal narcotics or controlled substances; (b) weapons, ammunition, or explosives without required licences; (c) counterfeit goods; (d) live animals without veterinary certification; (e) currency or negotiable instruments above ${format(1000000, "KES")} without declaration; (f) any goods prohibited by the laws of ${jurisdiction} or the laws of transit countries.`}</p>
          <p className="mt-2">Trakvora may report suspected illegal activity to relevant authorities without prior notice.</p>
        </Section>

        <Section title="8. Liability and Indemnification">
          <Sub title="8.1 Platform Liability">
            Trakvora is a technology platform only. Trakvora is <strong>not</strong> a party to, guarantor of, insurer under, or participant in any freight contract between a Shipper and a Carrier. Trakvora expressly disclaims all liability for:
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Cargo loss, damage, deterioration, or theft at any stage of transit</li>
              <li>Personal injury, death, or property damage arising from vehicle operation</li>
              <li>Delivery delays, failures, or route deviations</li>
              <li>Disputes between Shippers and Carriers and their outcomes</li>
              <li>Any consequential, indirect, incidental, punitive, or exemplary damages</li>
              <li>Acts or omissions of any Shipper, Carrier, Driver, or third party</li>
            </ul>
            <p className="mt-3">Trakvora's maximum aggregate liability to any party, for any claim arising from use of the Platform, is limited to the platform fees paid by that party in the 3 months immediately preceding the event giving rise to the claim.</p>
            <p className="mt-2">The foregoing liability cap does <strong>not</strong> apply to Trakvora's own gross negligence, fraud, or wilful misconduct, nor to Trakvora's breach of obligations under the Kenya Data Protection Act 2019. In such cases, liability is limited to direct, proven damages only, excluding any consequential or punitive damages.</p>
          </Sub>
          <Sub title="8.2 Indemnification">
            You agree to indemnify, defend, and hold harmless Trakvora and its officers, directors, employees, and agents against any claims, losses, liabilities, damages, or expenses (including reasonable legal fees) arising from: (a) your breach of these Terms; (b) your negligence or wilful misconduct; (c) your violation of any applicable law or third-party right; (d) any freight transaction you enter into through the Platform; or (e) any fines, penalties, or sanctions imposed by NTSA, KRA, Kenya Customs and Border Control, or any government authority arising from your non-compliance with vehicle standards, licensing, cargo regulations, or tax obligations.
          </Sub>
          <Sub title="8.3 Force Majeure">
            {`Neither Trakvora nor any user shall be liable for any failure or delay in performing obligations caused by circumstances beyond their reasonable control, including but not limited to: acts of war or terrorism; civil unrest or riots; strikes or labour disputes; pandemic or epidemic; acts of government or regulatory authority; border closures or lockdowns; road closures or impassable routes; natural disasters; or critical infrastructure or equipment failure. Where a force majeure event occurs, the affected party's obligations under any freight contract are suspended for the duration of the event plus 48 hours. Freight contracts remain between Shippers and Carriers; Trakvora assumes no liability for losses arising from force majeure events. Parties affected by a force majeure event should notify each other and Trakvora as soon as reasonably practicable.`}
          </Sub>
        </Section>

        <Section title="9. Dispute Resolution">
          <Sub title="9.1 Shipper–Carrier Disputes">
            <p>Trakvora is <strong>not a party to any freight contract</strong> between a Shipper and a Carrier and does not mediate, adjudicate, arbitrate, or determine the outcome of any commercial dispute between them. Trakvora accepts no liability for the outcome of any such dispute.</p>
            <p className="mt-2">Where a dispute arises between a Shipper and a Carrier, Trakvora's only role is to make available, upon request from either party, delivery evidence that was uploaded to the Platform during the shipment — including delivery photographs, GPS location records, and digitally signed consignment notes — <strong>where such evidence exists on the Platform</strong>. Trakvora does not guarantee the accuracy, completeness, or availability of any such evidence.</p>
            <p className="mt-2">Shippers and Carriers are solely responsible for resolving any dispute between themselves through direct negotiation, civil proceedings, or applicable regulatory channels.</p>
          </Sub>
          <Sub title="9.2 Compliance and Illegal Goods">
            All goods transported through the Platform must be lawful and must be accompanied by all required regulatory, customs, or transit documentation. Where Trakvora becomes aware of goods that appear to be illegal, prohibited, or improperly documented, Trakvora may provide relevant information to law enforcement, regulatory, or customs authorities without prior notice to any party.
          </Sub>
          <Sub title="9.3 Governing Law and Arbitration">
            {`These Terms are governed by and construed in accordance with the laws of ${jurisdiction}. Any legal dispute between a user and Trakvora that cannot be resolved through direct negotiation shall be referred to binding arbitration in ${arbitrationCity} under the ${arbitrationAct}. Arbitration shall be conducted by a single arbitrator, in confidence, and each party shall bear its own legal costs unless the arbitrator orders otherwise. All claims must be filed within 12 months of the event giving rise to the claim; claims filed after this period are permanently barred.`}
          </Sub>
        </Section>

        <Section title="10. Privacy">
          <p>Your use of the Platform is subject to our <Link to="/privacy" className="text-secondary hover:underline font-semibold">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>Changes to platform fees and commission rates are governed by Section 4.2 and require at least 30 days' advance notice. All other material changes to these Terms will be communicated to registered users by email and in-platform notice at least 14 days before taking effect. Continued use of the Platform after the effective date of any change constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="12. Acceptable Use">
          <p>In addition to complying with all sections of these Terms, users must not:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Provide false, misleading, or fabricated information in registration, identity verification, or vehicle documentation</li>
            <li>Manipulate ratings, reviews, or load pricing through collusion, false accounts, or automated means</li>
            <li>Solicit Shippers or Carriers met through the Platform to conduct freight transactions outside Trakvora in order to circumvent platform fees</li>
            <li>Access the Platform through automated bots, scrapers, or scripts without prior written consent from Trakvora</li>
            <li>Reverse-engineer, copy, decompile, or exploit any part of Trakvora's proprietary technology, algorithms, or software</li>
            <li>Create multiple accounts to circumvent suspension, rating penalties, or verification requirements</li>
            <li>Harass, threaten, or abuse other users, Trakvora staff, or any third party in connection with Platform use</li>
          </ul>
          <p className="mt-3">Violation of this section may result in immediate account suspension, forfeiture of outstanding fees, and referral to law enforcement.</p>
        </Section>

        <Section title="13. Anti-Bribery and Anti-Corruption">
          <p>{`Trakvora maintains a strict zero-tolerance policy toward bribery and corruption. In compliance with the Prevention of Corruption and Economic Crimes Act (Chapter 65, Laws of ${jurisdiction}), users must not offer, promise, give, request, or receive anything of value — directly or indirectly — to or from any government official, public officer, ${transportAuthority} personnel, police officer, customs official, or any other public servant to facilitate checkpoint passage, cargo clearance, permit issuance, or any other regulatory action.`}</p>
          <p className="mt-2">Any user who becomes aware of a demand for a bribe from a public official in connection with a Trakvora-facilitated shipment must report it to Trakvora at <a href="mailto:legal@trakvora.com" className="text-secondary hover:underline">legal@trakvora.com</a> within 24 hours.</p>
          <p className="mt-2">Violation of this section will result in immediate account termination and referral to the Ethics and Anti-Corruption Commission (EACC) and relevant law enforcement authorities. Trakvora may share user data and transaction records with authorities without prior notice in connection with any corruption investigation.</p>
        </Section>

        <Section title="14. General Provisions">
          <Sub title="14.1 Severability">
            If any provision of these Terms is found by a court, arbitrator, or competent authority to be invalid, illegal, or unenforceable under the applicable laws, such provision shall be severed from these Terms and the remaining provisions shall continue in full force and effect. The parties agree that any severed provision shall be modified to the minimum extent necessary to make it enforceable while preserving its original intent.
          </Sub>
          <Sub title="14.2 Entire Agreement">
            These Terms of Service, the Carrier Agreement (for Carriers), and the Privacy Policy constitute the entire agreement between Trakvora and each user regarding use of the Platform, and supersede all prior negotiations, representations, understandings, and agreements — whether written or oral — relating to the subject matter herein. No course of dealing, trade usage, or verbal promise shall modify these Terms.
          </Sub>
          <Sub title="14.3 Assignment">
            You may not assign, transfer, sub-licence, or delegate any of your rights or obligations under these Terms without Trakvora's prior written consent and completion of applicable re-verification. Any attempted assignment without consent is null and void. Trakvora may freely assign its rights and obligations under these Terms to any successor entity, acquirer, or affiliate without prior notice to users.
          </Sub>
          <Sub title="14.4 Warranty Disclaimer">
            The Platform is provided on an "as-is" and "as-available" basis. Trakvora makes no representations or warranties, express or implied, regarding the Platform's uninterrupted availability, freedom from errors or security vulnerabilities, accuracy of GPS or tracking data, accuracy of user-provided load descriptions or vehicle details, or fitness for any particular purpose. Users rely on the Platform and its data at their own risk and exercise independent judgement in selecting Carriers or Shippers.
          </Sub>
        </Section>

        <Section title="15. Contact">
          <p>Intellora Solutions Limited<br />
          Nairobi, Kenya<br />
          Email: <a href="mailto:legal@trakvora.com" className="text-secondary hover:underline">legal@trakvora.com</a><br />
          Phone: +254 700 000 000</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-6 text-xs text-slate-500">
          <Link to="/privacy"           className="hover:text-secondary transition-colors">Privacy Policy</Link>
          <Link to="/carrier-agreement" className="hover:text-secondary transition-colors">Carrier Agreement</Link>
          <Link to="/help"              className="hover:text-secondary transition-colors">Help Center</Link>
        </div>
      </div>
    </div>
  );
}
