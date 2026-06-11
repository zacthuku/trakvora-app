import { Link } from "react-router-dom";
import {
  Package, Search, CheckCircle, MapPin, CreditCard, Star,
  Truck, ClipboardList, Zap, Shield, FileText, Users,
  ArrowRight, ChevronRight,
} from "lucide-react";

function Step({ number, icon: Icon, title, description, accent }) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-sm shrink-0 ${accent ? "bg-secondary text-white" : "bg-primary text-white"}`}>
          {number}
        </div>
        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-2" />
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-5 h-5 ${accent ? "text-secondary" : "text-primary"}`} />
          <h3 className="font-heading font-semibold text-slate-900 dark:text-white text-lg">{title}</h3>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">{description}</p>
      </div>
    </div>
  );
}

function RoleSection({ label, color, steps, cta, to }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
      <span className={`inline-block text-xs font-bold font-heading uppercase tracking-widest px-3 py-1 rounded-full mb-6 ${color}`}>
        {label}
      </span>
      <div>
        {steps.map((s, i) => (
          <Step key={i} number={i + 1} {...s} accent={i % 2 === 1} />
        ))}
      </div>
      <Link to={to}
        className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-heading font-semibold text-sm hover:opacity-90 transition-opacity mt-2">
        {cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function FaqItem({ q, a }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 py-5">
      <p className="font-heading font-semibold text-slate-900 dark:text-white mb-2">{q}</p>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{a}</p>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="bg-surface">
      {/* Hero */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold font-heading text-secondary border border-secondary/30 bg-secondary/10 px-3 py-1 rounded-full mb-6">
            PLATFORM OVERVIEW
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-5 leading-tight">
            How trakvora Works
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            trakvora connects every link in the East African freight chain, from cargo pickup in Nairobi to delivery confirmation in Kampala, with full visibility and clear digital records at every step.
          </p>
        </div>
      </section>

      {/* Role sections */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl font-bold text-primary mb-3">Choose Your Role</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-xl mx-auto">Each participant has a tailored workflow built around how they actually operate on the ground.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <RoleSection
              label="For Shippers"
              color="bg-primary/10 text-primary"
              to="/register?role=shipper"
              cta="Post a Load"
              steps={[
                { icon: Package, title: "Post your load", description: "Describe your cargo, pickup location, destination, weight, and required truck type. Set a fixed price or open it to competitive bidding. Takes under 2 minutes." },
                { icon: Search, title: "Receive bids", description: "Verified fleet owners and drivers submit bids on your load. Compare carriers by price, rating, trip history, and truck specs on a single screen." },
                { icon: CheckCircle, title: "Accept and book", description: "Accept the winning bid. The carrier is confirmed and dispatched to your pickup location. Settlement happens directly between you and the carrier on delivery." },
                { icon: MapPin, title: "Track in real time", description: "Watch your cargo move on a live map. Receive status updates at every stage: en route to pickup, loaded, in transit, and delivered." },
                { icon: CreditCard, title: "Confirm delivery", description: "Confirm delivery and settle payment directly with your carrier. Full digital paper trail — consignment note, POD, and delivery receipt — for every shipment." },
              ]}
            />

            <RoleSection
              label="For Fleet Owners"
              color="bg-[#1a3a5c]/10 text-[#1a3a5c]"
              to="/register?role=owner"
              cta="Register Your Fleet"
              steps={[
                { icon: Truck, title: "List your trucks", description: "Register your fleet: flatbeds, dry vans, reefers, tippers, tankers. Provide truck type, capacity, make, model, and your carrier documents." },
                { icon: Users, title: "Assign drivers", description: "Link your drivers to trucks. trakvora matches them to loads based on availability, corridor preferences, and licence class." },
                { icon: ClipboardList, title: "Bid on loads", description: "Browse the marketplace and submit competitive bids. Set your price based on corridor rates and your operational costs. Win loads on merit." },
                { icon: Zap, title: "Monitor your fleet", description: "Real-time GPS view of all your trucks. See driver status, current location, ETA to destination, and any delays from a single dashboard." },
                { icon: CreditCard, title: "Receive payment", description: "Freight payment is settled directly by the shipper on delivery confirmation. A full job record and earnings history is always visible on your dashboard." },
              ]}
            />

            <RoleSection
              label="For Drivers"
              color="bg-secondary/10 text-secondary"
              to="/register?role=driver"
              cta="Create Driver Profile"
              steps={[
                { icon: Shield, title: "Build your profile", description: "Upload your licence, PSV badge, passport photo, and police clearance. Get NTSA-verified to unlock premium job opportunities and higher trust scores." },
                { icon: Search, title: "Browse the job feed", description: "See loads matched to your location, preferred corridors, and truck type. Filter by cargo type, distance, and payment mode." },
                { icon: CheckCircle, title: "Accept a job", description: "Accept a load and confirm pickup details. A consignment note is generated automatically for all parties to sign digitally." },
                { icon: MapPin, title: "Update your status", description: "Mark: en route to pickup → loaded → in transit → delivered. Each update notifies the shipper and owner in real time." },
                { icon: Star, title: "Get paid and rated", description: "Payment is settled directly with the shipper on delivery confirmation. Build your rating with every successful run to attract better-paying loads." },
              ]}
            />

          </div>
        </div>
      </section>

      {/* Payment security explainer */}
      <section className="py-20 bg-white dark:bg-slate-900 px-6 border-y border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-primary mb-3">Clear Transaction Records, Every Time</h2>
            <p className="text-slate-600 dark:text-slate-300">How trakvora creates a complete digital trail for every shipment and payment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", who: "Shipper", action: "Books the carrier", detail: "When a bid is accepted, the carrier is dispatched and a digital consignment note is generated for all parties.", color: "bg-blue-50 border-blue-200 text-blue-700" },
              { step: "2", who: "Carrier", action: "Delivers cargo", detail: "The driver picks up, transports, and delivers. Real-time GPS tracking and photo documentation protect both parties.", color: "bg-orange-50 border-orange-200 text-orange-700" },
              { step: "3", who: "Both", action: "Delivery confirmed", detail: "The shipper confirms receipt and settles payment directly with the carrier. A digital audit trail covers every milestone of the shipment.", color: "bg-teal-50 border-teal-200 text-teal-700" },
            ].map(({ step, who, action, detail, color }) => (
              <div key={step} className={`rounded-xl border p-6 ${color}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center font-heading font-black text-sm">{step}</span>
                  <span className="font-heading font-bold text-sm uppercase tracking-wide">{who}</span>
                </div>
                <p className="font-heading font-semibold mb-2">{action}</p>
                <p className="text-sm leading-relaxed opacity-80">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FileText className="w-10 h-10 text-secondary mx-auto mb-4" />
          <h2 className="font-heading text-3xl font-bold text-primary mb-4">Auto-Generated Consignment Notes</h2>
          <p className="text-slate-600 dark:text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
            Every shipment generates a digital consignment note, signed by the shipper, fleet owner, and driver. Fully compliant with Kenya Revenue Authority and NTSA requirements.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { title: "Digital Signatures", desc: "All three parties sign electronically. No paper, no delays." },
              { title: "Audit Trail", desc: "Every status change, location ping, and payment is logged immutably." },
              { title: "KRA Compliant", desc: "Documents meet Kenya Revenue Authority freight transport standards." },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                <CheckCircle className="w-5 h-5 text-teal-500 mb-3" />
                <p className="font-heading font-semibold text-slate-900 dark:text-white mb-1">{title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-primary mb-10 text-center">Common Questions</h2>
          <FaqItem q="Do drivers pay to join trakvora?"
            a="No. Drivers create profiles, upload documents, and browse jobs for free. trakvora charges carriers a small platform commission on completed deliveries." />
          <FaqItem q="What happens if a carrier fails to deliver?"
            a="The shipper should not confirm delivery. Our support team reviews GPS data, timestamps, and photos to resolve any issue. Contact support immediately if there is a problem with your delivery." />
          <FaqItem q="Which corridors are covered?"
            a="Currently active on Nairobi–Mombasa, Nairobi–Kampala, Nairobi–Arusha, Nairobi–Eldoret, Mombasa–Dar es Salaam, and Kisumu–Kampala. More corridors are being added continuously." />
          <FaqItem q="How are drivers verified?"
            a="Drivers upload their Kenya driver's licence, PSV badge, police clearance, and passport photo. Our team cross-checks records with NTSA before granting a verified badge." />
          <FaqItem q="Can a fleet owner also be a shipper?"
            a="Not on the same account — roles are separate to maintain platform integrity. But you can register two accounts with different roles under different email addresses." />
          <FaqItem q="How does payment work on trakvora?"
            a="Shippers and carriers agree on and settle freight payment directly between themselves. Trakvora provides the digital documentation and shipment records to support every transaction. Carriers pay trakvora a platform commission on completed deliveries." />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-secondary text-white text-center px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="font-heading text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-white/80 mb-8">Join the East African freight network. Free to join, pay only on successful deliveries.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-white text-secondary px-8 py-3.5 rounded-xl font-heading font-bold hover:opacity-90 transition-opacity">
              Create Account
            </Link>
            <Link to="/pricing" className="border border-white/30 text-white px-8 py-3.5 rounded-xl font-heading font-semibold hover:bg-white/10 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
