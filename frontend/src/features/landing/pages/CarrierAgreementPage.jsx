import { Link } from "react-router-dom";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { useCountryFees } from "@/hooks/useCountryFees";
import { useCountryConfig } from "@/hooks/useCountryConfig";

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-heading text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{title}</h2>
      <div className="text-slate-600 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function Req({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

function Warn({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

export default function CarrierAgreementPage() {
  const { carrierCommissionRate, maxCommissionKes, formatPercent, formatAmount } = useCountryFees();
  const {
    transportAuthority,
    policeService,
    jurisdiction,
    arbitrationCity,
    arbitrationAct,
    trafficAct,
  } = useCountryConfig();

  return (
    <div className="bg-surface">
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-secondary text-xs font-bold font-heading uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-heading text-4xl font-bold mb-3">Carrier Agreement</h1>
          <p className="text-gray-600 text-sm">Applicable to all Fleet Owners and Drivers · Last updated: 8 June 2026</p>
          <div className="flex items-center gap-2 mt-4">
            <Shield className="w-5 h-5 text-teal-600" />
            <span className="text-teal-600 text-sm font-medium">{`${transportAuthority} Compliance Required`}</span>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-10 text-sm text-amber-800">
          <strong>Carrier Agreement:</strong> This agreement applies to all Fleet Owners and Drivers ("Carriers") who register on the Trakvora platform. By completing registration, you confirm you have read, understood, and agree to the terms below. This agreement supplements our <Link to="/terms" className="font-semibold underline">Terms of Service</Link>.
        </div>

        <Section title="1. Eligibility Requirements">
          <p>To operate as a Carrier on Trakvora, you must meet all of the following requirements at all times:</p>
          <ul className="space-y-2 mt-3">
            <Req>{`Hold a valid ${jurisdiction} driving licence of the appropriate class for the vehicles you operate (Class B, C, CE, or BCE as applicable)`}</Req>
            <Req>Hold a valid PSV (Public Service Vehicle) badge where required by law for the cargo or route</Req>
            <Req>{`Be registered with the ${transportAuthority}`}</Req>
            <Req>Maintain valid third-party motor vehicle insurance at minimum; cargo insurance strongly recommended</Req>
            <Req>For cross-border operations, hold a valid COMESA Yellow Card or equivalent international transit permit</Req>
            <Req>Provide a valid police clearance certificate not older than 12 months at time of registration</Req>
            <Req>{`Provide a certificate of good conduct issued by the ${policeService}`}</Req>
            <Req>{`For Fleet Owners: hold a valid ${transportAuthority} carrier licence`}</Req>
          </ul>
        </Section>

        <Section title="2. Vehicle Standards">
          <p>All vehicles used on the Trakvora platform must:</p>
          <ul className="space-y-2 mt-3">
            <Req>{`Hold a valid ${transportAuthority} inspection certificate (annually renewed)`}</Req>
            <Req>Be roadworthy and mechanically fit for the cargo type and weight being transported</Req>
            <Req>Be equipped with functional speedometer, mirrors, lights, brakes, and safety equipment</Req>
            <Req>Have a functional mobile device capable of running the Trakvora mobile app for GPS tracking</Req>
            <Req>For reefer loads: cooling unit maintained and calibrated to deliver the required temperature range</Req>
            <Req>For tankers: proper manifold and valve sealing certified by the relevant authority</Req>
            <Req>For hazardous materials: KEBS-approved containment and placarding as per ADR standards</Req>
          </ul>
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <ul className="space-y-2">
              <Warn>{`Vehicles with expired ${transportAuthority} inspection certificates will be suspended from the platform without notice`}</Warn>
              <Warn>Operating a vehicle that is unroadworthy and causing cargo damage may result in permanent account termination</Warn>
            </ul>
          </div>
        </Section>

        <Section title="3. Operational Obligations">
          <p>As a Carrier, you agree to:</p>
          <ul className="space-y-2 mt-3">
            <Req>Accept only loads you are equipped and licensed to carry</Req>
            <Req>Arrive at the pickup location within the agreed pickup window</Req>
            <Req>Inspect cargo at pickup and document any pre-existing damage with photographs before loading</Req>
            <Req>Sign (or accept digitally) the Trakvora consignment note before departing the pickup location</Req>
            <Req>Update shipment status in real time via the Trakvora app: en route → loaded → in transit → delivered</Req>
            <Req>Maintain GPS location sharing throughout the active shipment</Req>
            <Req>Deliver cargo in the same condition as received, within the agreed timeframe</Req>
            <Req>Notify the Platform immediately of any accident, breakdown, or delay exceeding 2 hours</Req>
            <Req>Not consume alcohol or controlled substances while operating a vehicle</Req>
            <Req>{`Adhere to ${jurisdiction} road traffic regulations including posted speed limits`}</Req>
          </ul>
        </Section>

        <Section title="4. Payment and Fee Structure">
          <p><strong>Payment for freight services is a direct transaction between the Shipper and the Carrier.</strong> Trakvora does not collect, hold, transfer, or process freight payments on behalf of either party. Shippers pay Carriers through their agreed method (mobile money, bank transfer, cash, or other) outside the Platform. Trakvora has no financial stake in freight transactions between parties.</p>
          <p className="mt-3">Trakvora charges platform fees for use of the service. Fees may apply to any registered user depending on services used:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Carrier Platform Fee:</strong> <strong>{formatPercent(carrierCommissionRate)}</strong> of the agreed freight value per completed shipment, capped at <strong>{formatAmount(maxCommissionKes)}</strong>; invoiced to the Carrier after delivery confirmation and charged to the Carrier's Trakvora account</li>
            <li><strong>Shipper Platform Fee:</strong> may also apply depending on services used (see Terms of Service Section 4)</li>
            <li>Withdrawals from the Carrier's Trakvora account to M-Pesa or bank are processed within 24 hours</li>
          </ul>
          <p className="mt-3">Platform fees are Trakvora's only financial interest in any transaction and are non-refundable for completed deliveries. For disputed deliveries, Trakvora makes no financial determination and takes no action on freight payments. Parties must resolve payment disputes directly.</p>
          <p className="mt-4"><strong>Fee Modifications.</strong> Trakvora reserves the right to modify carrier commission rates and any other charges at any time in its sole discretion. Carriers will be notified via email and in-app notification at least <strong>30 days</strong> before revised rates take effect. Revised rates apply only to loads accepted <strong>after</strong> the effective date; loads already accepted at the time of notification are not affected. If you do not accept the revised rates, you may close your Trakvora account before the effective date without penalty. Continuing to accept loads after the effective date constitutes binding acceptance of the revised rates.</p>
        </Section>

        <Section title="5. Insurance and Liability">
          <p>Carriers are <strong>solely and exclusively responsible</strong> for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Third-party liability arising from vehicle operation</li>
            <li>Cargo loss, damage, deterioration, or theft whilst in their care, custody, and control</li>
            <li>Any fines, penalties, or seizures arising from non-compliance with applicable laws</li>
            <li>Fuel, accommodation, tolls, and all operational costs of the journey</li>
          </ul>
          <p className="mt-3"><strong>Trakvora bears no liability whatsoever for cargo loss, damage, deterioration, or theft under any circumstances.</strong> Trakvora does not provide, arrange, broker, or guarantee any cargo, goods-in-transit, or vehicle insurance. Carriers are strongly advised to obtain appropriate goods-in-transit insurance independently.</p>
          <p className="mt-2">Trakvora's maximum aggregate liability to any Carrier is limited to the platform fees paid by that Carrier in the 3 months preceding the event giving rise to any claim.</p>
        </Section>

        <Section title="6. Prohibited Conduct">
          <p>Carriers must not:</p>
          <div className="mt-3">
            <ul className="space-y-2">
              <Warn>Subcontract or relay a load to a third party without the Shipper's express written consent</Warn>
              <Warn>Falsify GPS data, consignment signatures, or delivery photos</Warn>
              <Warn>Demand payment outside the Trakvora platform from any Shipper</Warn>
              <Warn>Transport prohibited goods (see Terms of Service Section 7)</Warn>
              <Warn>Open cargo unless required by a legitimate customs or regulatory inspection</Warn>
              <Warn>Solicit Shippers to conduct freight business outside Trakvora after meeting through the platform</Warn>
              <Warn>Create multiple accounts to circumvent suspension or rating penalties</Warn>
            </ul>
          </div>
          <p className="mt-4">{`Violation of any item above may result in immediate account suspension, outstanding platform fee invoices becoming immediately due, and referral to ${transportAuthority} or law enforcement authorities.`}</p>
        </Section>

        <Section title="7. Ratings and Performance">
          <p>Shippers rate Carriers after every delivery on a 1–5 star scale. Your rating affects your visibility in load matching and search rankings. Trakvora may suspend accounts that:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Fall below a 3.0 rating average (calculated over the last 10 trips)</li>
            <li>Accumulate 3 or more cancellations in a 30-day period after bid acceptance</li>
            <li>Receive 2 or more upheld disputes in a 90-day period</li>
          </ul>
          <p className="mt-2">Suspended Carriers may appeal by contacting <a href="mailto:carriers@trakvora.com" className="text-secondary hover:underline font-semibold">carriers@trakvora.com</a>.</p>
        </Section>

        <Section title="8. Document Renewal">
          <p>Carriers are responsible for keeping all required documents current. Trakvora will send renewal reminders 30 days before document expiry based on the dates on file. Expired documents will result in automatic suspension until updated copies are provided and verified.</p>
        </Section>

        <Section title="9. Termination">
          <p>Either party may terminate this Agreement at any time by closing their Trakvora account. Any outstanding platform fee invoices remain due and payable upon termination. Freight payment obligations between the Carrier and Shipper for deliveries completed before termination are unaffected and must be settled directly between those parties.</p>
          <p className="mt-3"><strong>Termination by Trakvora — Due Process.</strong> Except where immediate action is necessary (see below), Trakvora will provide at least <strong>7 days' written notice</strong> of intent to terminate, specifying the reason and giving the Carrier an opportunity to remedy the breach within that period. If the breach is remedied to Trakvora's satisfaction, the termination notice lapses.</p>
          <p className="mt-3"><strong>Immediate Termination.</strong> Trakvora may terminate this Agreement with immediate effect and without prior notice for any of the following:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Criminal conduct, fraud, or wilful misrepresentation</li>
            <li>Provision of false or fabricated identity, vehicle, or licence documents</li>
            <li>A safety violation that poses an immediate risk to persons or cargo</li>
            <li>Bribery or corruption of a public official (see Section 12)</li>
            <li>Transporting prohibited or illegal goods</li>
          </ul>
          <p className="mt-3"><strong>Appeals.</strong> A Carrier whose account has been terminated may submit an appeal to <a href="mailto:legal@trakvora.com" className="text-secondary hover:underline font-semibold">legal@trakvora.com</a> within <strong>14 days</strong> of the termination notice, providing any evidence or explanation they consider relevant. Trakvora will review and respond within 14 days of receiving the appeal. Trakvora's decision on appeal is final.</p>
        </Section>

        <Section title="10. Dispute Process">
          <p>Trakvora is <strong>not a party to any freight contract</strong> between a Shipper and a Carrier and does not mediate, adjudicate, or make financial determinations in disputes between them.</p>
          <p className="mt-3">Where a dispute is raised on the Platform, Trakvora may make available to both parties delivery evidence that was uploaded during the shipment — including delivery photographs, GPS location records, and digitally signed consignment notes — <strong>where such evidence exists</strong>. Trakvora does not guarantee the accuracy, completeness, or availability of any such evidence and has no obligation to investigate or rule on any disputed delivery.</p>
          <p className="mt-3">Carriers should protect themselves by:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Photographing cargo condition at pickup before loading</li>
            <li>Obtaining the Shipper's signature on the consignment note before departing the pickup location</li>
            <li>Photographing cargo at delivery and uploading proof through the Platform</li>
            <li>Ensuring all transported goods are legal and accompanied by required documentation</li>
          </ul>
          <p className="mt-3">Carriers and Shippers must resolve disputes directly between themselves through negotiation or applicable legal channels. Where goods are found to be illegal or lack required documentation, Trakvora may report the matter to relevant authorities without prior notice.</p>
        </Section>

        <Section title="11. Governing Law">
          <p>{`This Agreement is governed by the laws of ${jurisdiction}. Disputes between Trakvora and a Carrier that cannot be resolved through direct negotiation are subject to binding arbitration in ${arbitrationCity} under the ${arbitrationAct}, conducted by a single arbitrator in confidence. Claims must be filed within 12 months of the event giving rise to the claim. For regulatory matters, ${transportAuthority} rules and the ${trafficAct} apply.`}</p>
        </Section>

        <Section title="12. Anti-Bribery and Anti-Corruption">
          <p>{`Trakvora maintains zero tolerance for bribery and corruption. In compliance with the Prevention of Corruption and Economic Crimes Act (Chapter 65, Laws of ${jurisdiction}), Carriers must not offer, promise, give, or agree to give anything of value — money, gifts, hospitality, or favours — directly or indirectly to any government official, ${transportAuthority} officer, police officer, customs official, county transport inspector, or any other public servant to facilitate: checkpoint passage; cargo clearance; permit or licence issuance; or any other regulatory or administrative action connected with a Trakvora shipment.`}</p>
          <p className="mt-3">If a Carrier is approached by or aware of a demand for a bribe from any public official in connection with a Trakvora-facilitated shipment, they must report it to Trakvora at <a href="mailto:legal@trakvora.com" className="text-secondary hover:underline font-semibold">legal@trakvora.com</a> within 24 hours.</p>
          <p className="mt-3">Violation of this section will result in immediate account termination and referral to the Ethics and Anti-Corruption Commission (EACC) and relevant law enforcement authorities. Trakvora may share account data, GPS records, and transaction history with authorities in connection with any corruption investigation without prior notice to the Carrier.</p>
        </Section>

        <div className="mt-10 p-6 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="font-heading font-semibold text-primary mb-2">Carrier Support</p>
          <p className="text-sm text-slate-600 mb-3">Questions about this agreement or your obligations on the platform?</p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:carriers@trakvora.com" className="text-sm font-semibold text-secondary hover:underline">carriers@trakvora.com</a>
            <Link to="/help" className="text-sm font-semibold text-secondary hover:underline">Help Center</Link>
            <Link to="/register?role=driver" className="text-sm font-semibold text-secondary hover:underline">Register as Driver</Link>
            <Link to="/register?role=owner" className="text-sm font-semibold text-secondary hover:underline">Register Fleet</Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap gap-6 text-xs text-slate-500">
          <Link to="/terms"   className="hover:text-secondary transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-secondary transition-colors">Privacy Policy</Link>
          <Link to="/help"    className="hover:text-secondary transition-colors">Help Center</Link>
        </div>
      </div>
    </div>
  );
}
