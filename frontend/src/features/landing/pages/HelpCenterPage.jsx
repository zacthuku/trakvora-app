import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, Package, Truck, Users, CreditCard, MapPin,
  AlertCircle, ChevronDown, ChevronUp, Mail, Phone,
  MessageSquare, FileText, Shield, Zap,
} from "lucide-react";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const STATIC_CATEGORIES = [
  {
    icon: Package,
    label: "Posting Loads",
    color: "bg-blue-50 text-blue-600",
    faqs: [
      { q: "How do I post a load?", a: "From your shipper dashboard, click 'Post a Load'. Fill in pickup location, destination, cargo type, weight, and your preferred price. You can choose Fixed Price (carrier accepts or declines) or Auction (carriers bid competitively). Once published, the load appears in the marketplace immediately." },
      { q: "Can I edit a load after posting?", a: "Yes, as long as no bid has been accepted. Go to your dashboard, find the load, and click Edit. Once a bid is accepted and the shipment is booked, the load details are frozen." },
      { q: "What cargo types are supported?", a: "General, Refrigerated, Hazardous, Livestock, Construction, Agricultural, and Electronics. Each type has specific carrier requirements. For example, refrigerated loads only match to reefer trucks." },
      { q: "How do I cancel a posted load?", a: "Find the load in your dashboard and click Cancel. If no bid has been accepted, cancellation is free. Post-acceptance cancellation incurs a 5% fee to compensate the carrier for their reserved capacity." },
    ],
  },
  {
    icon: Truck,
    label: "For Drivers",
    color: "bg-orange-50 text-secondary",
    faqs: [
      { q: "How do I create a driver profile?", a: "Register with a driver account, then navigate to My Profile. Upload your driver's licence, PSV badge, passport photo, police clearance, and certificate of good conduct. Once submitted, our team initiates NTSA verification within 24 hours." },
      { q: "Why can't I see loads in the job feed?", a: "The job feed shows loads matched to your preferences and location. Make sure you've set your availability status to 'Available', entered your preferred routes and truck types, and set an availability location. If you're still not seeing loads, check that your profile is fully completed." },
      { q: "How do I update my shipment status?", a: "From the Active Job screen, use the status buttons to move through: En Route to Pickup → Loaded → In Transit → Delivered. Each update sends a real-time notification to the shipper and fleet owner." },
      { q: "When will I receive payment?", a: "Payment hits your trakvora wallet the moment the shipper confirms delivery. If you have an issue with a delayed confirmation, contact support and our team will assist." },
    ],
  },
  {
    icon: Users,
    label: "Fleet Owners",
    color: "bg-slate-100 text-slate-600",
    faqs: [
      { q: "How do I register my trucks?", a: "Go to Fleet Management in your dashboard and click 'Add Truck'. Enter registration number, truck type, capacity, make, and model. You can register multiple trucks and assign drivers to each." },
      { q: "How do I assign a driver to a truck?", a: "In Fleet Management, click on a truck and select 'Assign Driver'. You can search by driver name or user ID. The driver must already have a registered trakvora account." },
      { q: "Can I bid on loads without a driver assigned?", a: "You can browse the marketplace and prepare bids, but to submit a bid you must select an available truck and an assigned driver. The load will be matched to that driver when the bid is accepted." },
      { q: "How do I track my fleet in real time?", a: "Your owner dashboard shows a fleet overview with the last known location of each active truck. Click any truck to see the full route, current status, ETA, and driver details." },
    ],
  },
  // Payments & Wallet inserted dynamically — see buildPaymentCategory below
  {
    icon: MapPin,
    label: "Tracking",
    color: "bg-purple-50 text-purple-600",
    faqs: [
      { q: "How does real-time tracking work?", a: "Drivers update their location through the trakvora app, and fleet owners / shippers see live positions on the map. Updates occur every 30 seconds when a shipment is active." },
      { q: "What if a driver goes off-route?", a: "An alert is generated in the shipper and owner dashboard when the vehicle deviates more than 5 km from the expected route. You can contact the driver directly via the in-app messaging." },
      { q: "Can I share a tracking link with my customer?", a: "Yes. From the active shipment screen, click 'Share Tracking Link'. This generates a read-only link your end customer can use to follow the cargo. No trakvora account required." },
    ],
  },
  {
    icon: AlertCircle,
    label: "Disputes",
    color: "bg-red-50 text-red-600",
    faqs: [
      { q: "How do I open a dispute?", a: "From the shipment page, click 'Open Dispute' and describe the issue. You can attach photos and documents. Disputes can be opened up to 48 hours after a delivery is marked complete." },
      { q: "How long does dispute resolution take?", a: "Our team aims to resolve disputes within 3 business days. Complex cases involving insurance claims may take up to 10 business days. Escrow is held frozen during the process." },
      { q: "What evidence should I submit?", a: "Provide photos of cargo at pickup and delivery, timestamps, communications with the driver/owner, and any deviation from the agreed route or schedule shown in GPS history." },
    ],
  },
];

function buildPaymentCategory({ currency, payments }) {
  const mobile       = payments.filter((p) => p.name !== "Banks");
  const primary      = mobile[0]?.name ?? "your payment provider";
  const topUpOptions = mobile.length > 0
    ? `${mobile.map((p) => p.name).join(", ")} or bank transfer`
    : "bank transfer";

  return {
    icon: CreditCard,
    label: "Payments & Wallet",
    color: "bg-green-50 text-green-600",
    faqs: [
      {
        q: "How do I top up my wallet?",
        a: `From the Wallet page, click 'Top Up' and choose ${topUpOptions}. ${mobile.length > 0 ? `${primary} top-ups reflect within 60 seconds. ` : ""}Bank transfers take 1–2 business days. Minimum top-up is ${currency} 1,000.`,
      },
      {
        q: "How do I withdraw my earnings?",
        a: `Navigate to Wallet > Withdraw. Choose ${primary} (instant to registered number) or bank account (1–2 days). Minimum withdrawal is ${currency} 500. Withdrawals are processed between 8 AM and 6 PM EAT.`,
      },
      {
        q: "How does trakvora protect payments?",
        a: "trakvora's payment system ensures funds are only released to the carrier once the shipper confirms delivery. This guarantees payment for carriers and protects shippers until delivery is complete.",
      },
      {
        q: "Are there transaction fees?",
        a: "No transaction fees for wallet top-ups or withdrawals. Platform fees (3% from shippers, 7% from carriers) are only charged on completed deliveries. All other wallet operations are free.",
      },
    ],
  };
}

function FaqAccordion({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="mt-4 space-y-2">
      {faqs.map((faq, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <span className="font-heading font-semibold text-slate-900 dark:text-white text-sm">{faq.q}</span>
            {open === i
              ? <ChevronUp className="w-4 h-4 text-secondary shrink-0" />
              : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
          {open === i && (
            <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-3">
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HelpCenterPage() {
  const { currency, payments } = useCountryConfig();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const CATEGORIES = useMemo(() => {
    const paymentCat = buildPaymentCategory({ currency, payments });
    return [...STATIC_CATEGORIES.slice(0, 3), paymentCat, ...STATIC_CATEGORIES.slice(3)];
  }, [currency, payments]);

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    faqs: cat.faqs.filter(
      ({ q, a }) =>
        !search ||
        q.toLowerCase().includes(search.toLowerCase()) ||
        a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => !search || cat.faqs.length > 0);

  return (
    <div className="bg-surface">
      {/* Hero */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-5">Help Center</h1>
          <p className="text-gray-600 text-lg mb-8">Find answers, guides, and support for every part of the trakvora platform.</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help articles…"
              className="w-full pl-12 pr-4 py-4 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-secondary shadow-lg bg-white border border-gray-200"
            />
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-10 px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {CATEGORIES.map(({ icon: Icon, label, color }) => (
              <button
                key={label}
                onClick={() => {
                  setActiveCategory(activeCategory === label ? null : label);
                  setSearch("");
                }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                  activeCategory === label
                    ? "border-secondary bg-orange-50 dark:bg-orange-500/10"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/40 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-heading font-semibold text-slate-700 dark:text-slate-200 leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {(search
            ? filteredCategories
            : activeCategory
              ? CATEGORIES.filter((c) => c.label === activeCategory)
              : CATEGORIES
          ).map(({ icon: Icon, label, color, faqs }) => (
            faqs.length === 0 ? null :
            <div key={label}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-white">{label}</h2>
              </div>
              <FaqAccordion faqs={faqs} />
            </div>
          ))}
          {filteredCategories.every((c) => c.faqs.length === 0) && (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="font-heading font-semibold text-slate-700 dark:text-slate-200 mb-1">No results for "{search}"</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Try a different search term or browse the categories above.</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick guides */}
      <section className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700 px-6" id="guides">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl font-bold text-primary mb-8 text-center">Quick Start Guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: Package, title: "Post Your First Load", desc: "Step-by-step guide for shippers, from cargo details to bid acceptance.", time: "3 min read", to: "/how-it-works" },
              { icon: Shield, title: "Get NTSA Verified", desc: "What documents drivers need and how the verification process works.", time: "2 min read", to: "/how-it-works" },
              { icon: Zap,    title: "Set Up Escrow Payments", desc: "How to top up your wallet and protect payments on every shipment.", time: "2 min read", to: "/pricing" },
            ].map(({ icon: Icon, title, desc, time, to }) => (
              <Link key={title} to={to}
                className="group flex flex-col gap-3 p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-secondary/50 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-secondary transition-colors">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{desc}</p>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{time}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 px-6" id="contact">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-primary mb-3">Still Need Help?</h2>
            <p className="text-slate-600 dark:text-slate-300">Our support team is available Monday – Friday, 8 AM – 6 PM EAT.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:shadow-sm transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">Email Support</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Response within 4 business hours</p>
              <a href="mailto:support@trakvora.com"
                className="text-sm font-semibold text-secondary hover:underline">
                support@trakvora.com
              </a>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:shadow-sm transition-shadow">
              <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">Phone Support</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Mon–Fri, 8 AM – 6 PM EAT</p>
              <a href="tel:+254700000000"
                className="text-sm font-semibold text-secondary hover:underline">
                +254 700 000 000
              </a>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:shadow-sm transition-shadow">
              <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">Live Chat</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Available in your dashboard</p>
              <Link to="/login" className="text-sm font-semibold text-secondary hover:underline">
                Log in to chat
              </Link>
            </div>
          </div>
          <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-start gap-4">
            <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-slate-900 dark:text-white text-sm mb-1">Carrier & Legal Documents</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Looking for our terms of service, privacy policy, or carrier agreement?</p>
              <div className="flex flex-wrap gap-4 mt-2">
                <Link to="/terms"              className="text-xs font-semibold text-secondary hover:underline">Terms of Service</Link>
                <Link to="/privacy"            className="text-xs font-semibold text-secondary hover:underline">Privacy Policy</Link>
                <Link to="/carrier-agreement"  className="text-xs font-semibold text-secondary hover:underline">Carrier Agreement</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
