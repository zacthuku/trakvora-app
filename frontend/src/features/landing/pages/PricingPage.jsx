import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, X, Zap, Shield, CreditCard, HelpCircle, ArrowRight, Loader2, Building2, Crown, Truck } from "lucide-react";
import { useCountryFees } from "@/hooks/useCountryFees";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { useCurrency } from "@/hooks/useCurrency";
import { subscriptionsApi } from "@/features/subscriptions/api/subscriptionsApi";

// ── Subscription plan tabs ────────────────────────────────────────────────────

const ROLE_TABS = [
  { key: "shipper", label: "Shippers" },
  { key: "owner",   label: "Fleet Owners" },
  { key: "driver",  label: "Drivers" },
];

const TIER_META = {
  free:             { label: "Free",       icon: null,      accent: false },
  fleet_basic:      { label: "Basic",      icon: Zap,       accent: false },
  fleet_pro:        { label: "Pro",        icon: Building2, accent: true  },
  enterprise:       { label: "Enterprise", icon: Crown,     accent: false },
  shipper_free:     { label: "Starter",    icon: null,      accent: false },
  shipper_growth:   { label: "Growth",     icon: Zap,       accent: true  },
  shipper_business: { label: "Business",   icon: Crown,     accent: false },
  driver_free:      { label: "Free",       icon: Truck,     accent: false },
};

const SHIPPER_FEATURES = [
  { key: "max_loads_per_month",        label: "Loads / month",    fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "includes_priority_matching", label: "Priority matching", fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_analytics",         label: "Analytics",        fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_api_access",        label: "API access",       fmt: (v) => (v ? "✓" : "—") },
];

const OWNER_FEATURES = [
  { key: "max_trucks",                 label: "Trucks",           fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "max_drivers",                label: "Drivers",          fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "includes_analytics",         label: "Analytics",        fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_api_access",        label: "API access",       fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_priority_matching", label: "Priority matching", fmt: (v) => (v ? "✓" : "—") },
];

function SubscriptionPlanCard({ plan, features }) {
  const { currency } = useCountryConfig();
  const { format } = useCurrency();
  const meta = TIER_META[plan.tier] || TIER_META.free;
  const Icon = meta.icon;
  const isAccent = meta.accent;

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 ${isAccent ? "bg-primary border-primary text-white shadow-2xl scale-[1.02]" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"}`}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className={`w-4 h-4 ${isAccent ? "text-secondary" : "text-slate-500"}`} />}
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isAccent ? "bg-secondary/20 text-secondary" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
            {meta.label}
          </span>
        </div>
        <p className={`text-3xl font-heading font-black ${isAccent ? "text-white" : "text-primary"}`}>
          {plan.price_kes === 0 ? "Free" : `${currency} ${format(plan.price_kes, "KES")}`}
          {plan.price_kes > 0 && <span className={`text-xs font-normal ml-1 ${isAccent ? "text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>/mo</span>}
        </p>
        {plan.description && (
          <p className={`text-xs mt-1 ${isAccent ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>{plan.description}</p>
        )}
      </div>

      <ul className="space-y-2 flex-1">
        {features.map(({ key, label, fmt }) => (
          <li key={key} className={`flex items-center justify-between text-xs ${isAccent ? "text-slate-300" : "text-slate-600 dark:text-slate-300"}`}>
            <span className={isAccent ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}>{label}</span>
            <span className={`font-semibold ${isAccent ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>{fmt(plan[key])}</span>
          </li>
        ))}
      </ul>

      <Link
        to={`/register?role=${plan.target_role === "owner" ? "owner" : plan.target_role}`}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-heading transition-all ${
          isAccent ? "bg-secondary text-white hover:opacity-90" : "border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
        }`}
      >
        Get Started <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function SubscriptionSection() {
  const [activeRole, setActiveRole] = useState("shipper");
  const { vatRate, formatPercent } = useCountryFees();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["public-plans", activeRole],
    queryFn: () => subscriptionsApi.listPlans(activeRole),
    staleTime: 5 * 60 * 1000,
  });

  const features = activeRole === "shipper" ? SHIPPER_FEATURES : OWNER_FEATURES;

  return (
    <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl font-bold text-primary mb-3">Subscription Plans</h2>
          <p className="text-slate-600 dark:text-slate-300">Optional plans to unlock higher limits and premium features.</p>
        </div>

        {/* Role tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 gap-1 shadow-sm">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveRole(tab.key)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold font-heading transition-all ${
                  activeRole === tab.key
                    ? "bg-primary text-white shadow"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
          </div>
        ) : activeRole === "driver" ? (
          <div className="max-w-sm mx-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center shadow-sm">
            <Truck className="w-10 h-10 text-teal-500 mx-auto mb-4" />
            <p className="font-heading font-bold text-slate-900 dark:text-white text-lg mb-2">Always Free for Drivers</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Drivers access the full job feed, active job tracking, and earnings wallet at no cost. No subscription required.
            </p>
            <Link to="/register?role=driver"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-heading font-semibold text-sm hover:opacity-90 transition-opacity">
              Create Driver Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-4 ${plans.length === 3 ? "md:grid-cols-3" : plans.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}>
            {plans.map((plan) => (
              <SubscriptionPlanCard key={plan.id} plan={plan} features={features} />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          {`All subscription prices exclude ${formatPercent(vatRate)} VAT. Plans are billed monthly and can be cancelled anytime.`}
          Prices are configurable by our team and subject to change.
        </p>
      </div>
    </section>
  );
}

// ── Existing commission fee components ────────────────────────────────────────

function PlanCard({ role, badge, price, sub, highlight, features, missing, cta, to, accent }) {
  return (
    <div className={`rounded-2xl border p-8 flex flex-col ${accent ? "bg-primary border-primary text-white shadow-2xl scale-[1.02]" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"}`}>
      <div className="mb-6">
        <span className={`text-xs font-bold font-heading uppercase tracking-widest px-3 py-1 rounded-full ${accent ? "bg-secondary/20 text-secondary" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
          {badge}
        </span>
        <p className={`font-heading text-2xl font-bold mt-4 mb-1 ${accent ? "text-white" : "text-slate-900 dark:text-white"}`}>{role}</p>
        <p className={`text-sm ${accent ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>{sub}</p>
      </div>
      <div className={`rounded-xl p-5 mb-6 ${accent ? "bg-white/5 border border-white/10" : "bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600"}`}>
        <p className={`font-heading text-4xl font-black ${accent ? "text-white" : "text-primary"}`}>{price}</p>
        {highlight && <p className={`text-xs mt-1 ${accent ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>{highlight}</p>}
      </div>
      <ul className="space-y-3 flex-1 mb-8">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2.5 text-sm ${accent ? "text-slate-300" : "text-slate-700 dark:text-slate-200"}`}>
            <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${accent ? "text-secondary" : "text-teal-500"}`} />
            {f}
          </li>
        ))}
        {missing?.map((f, i) => (
          <li key={i} className={`flex items-start gap-2.5 text-sm ${accent ? "text-slate-500" : "text-slate-400 dark:text-slate-500"}`}>
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <Link to={to}
        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm transition-all ${
          accent ? "bg-secondary text-white hover:opacity-90" : "border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
        }`}>
        {cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function FeeRow({ label, value, note }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-slate-200 dark:border-slate-700 last:border-0 gap-4">
      <div>
        <p className="font-medium text-slate-900 dark:text-white text-sm">{label}</p>
        {note && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{note}</p>}
      </div>
      <p className="font-heading font-bold text-slate-900 dark:text-white shrink-0 text-sm">{value}</p>
    </div>
  );
}

export default function PricingPage() {
  const {
    shipperCommissionRate,
    carrierCommissionRate,
    cancellationFeeRate,
    maxCommissionKes,
    vatRate,
    formatPercent,
    formatAmount,
  } = useCountryFees();
  const { revenueAuthority, transportAuthority, currency } = useCountryConfig();
  const { format } = useCurrency();

  return (
    <div className="bg-surface">
      {/* Hero */}
      <section className="bg-primary text-white py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-xs font-bold font-heading text-secondary border border-secondary/30 bg-secondary/10 px-3 py-1 rounded-full mb-6">
            TRANSPARENT PRICING
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-5">Simple, Performance-Based Fees</h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            No setup costs. trakvora earns only when you earn. A small percentage taken only on completed, confirmed deliveries.
          </p>
        </div>
      </section>

      {/* Commission plans */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

            <PlanCard
              badge="Shippers"
              role="Ship Cargo"
              sub="For businesses and individuals moving freight"
              price="Free to post"
              highlight="No upfront cost — pay only on delivery"
              cta="Post a Load"
              to="/register?role=shipper"
              features={[
                "Unlimited load postings",
                "Fixed-price and auction bidding modes",
                "Direct carrier-to-shipper payment on delivery",
                "Real-time GPS shipment tracking",
                "Bid comparison dashboard",
                "Auto-generated consignment notes",
                "Dispute resolution support",
                "Full shipment history & reports",
              ]}
            />

            <PlanCard
              accent
              badge="Most Popular"
              role="Fleet Owners"
              sub="For licensed carriers with one or more trucks"
              price="Dynamic rate"
              highlight="Login to see your personalised commission tier"
              cta="Register Your Fleet"
              to="/register?role=owner"
              features={[
                "Commission reduces as your fleet grows",
                "Solo trucker → Small fleet → Large fleet → Enterprise tiers",
                "Pay commission within 24h (solo) or 7 days (fleet)",
                "List unlimited trucks",
                "Bid on any available load",
                "Assign and monitor drivers",
                "Live fleet tracking dashboard",
                "Wallet with mobile money & bank payouts",
                `${transportAuthority ?? "Transport authority"} compliance documentation`,
              ]}
            />

            <PlanCard
              badge="Drivers"
              role="Drive & Earn"
              sub="For licensed drivers seeking freight jobs"
              price="Free"
              highlight="to join and earn per delivery"
              cta="Create Driver Profile"
              to="/register?role=driver"
              features={[
                "Create a full verified profile",
                "Browse the job feed unlimited",
                "Set route and truck preferences",
                "Accept jobs directly from owners",
                "Multi-currency earnings wallet",
                "M-Pesa payout support",
                "Rating and review system",
              ]}
              missing={[
                "Cannot bid independently (linked to owner)",
              ]}
            />

          </div>
        </div>
      </section>

      {/* Subscription plans (role-tabbed, dynamic from API) */}
      <SubscriptionSection />

      {/* Fee breakdown */}
      <section className="py-20 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-primary mb-3">Fee Breakdown</h2>
            <p className="text-slate-600 dark:text-slate-300">Exactly how fees are calculated on a completed shipment.</p>
          </div>

          {/* Commission tier table — no specific rates shown publicly */}
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-8">
            <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">How It Works</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Shipper pays trucker directly on delivery confirmation. Trucker pays Trakvora a commission within the payment window.
            </p>
            <FeeRow label="Shipper pays carrier" value="Full freight amount" note="Paid direct to carrier wallet on delivery — no deductions" />
            <FeeRow label="Carrier pays Trakvora" value="Commission invoice" note="Created on delivery, due within 24h (solo) or 7 days (fleet)" />
            <FeeRow label="Commission rate" value="Your tier" note="Sign in to see your personalised rate based on fleet size, truck type, cargo, terrain, and distance" />
            <FeeRow label={`${formatPercent(vatRate)} VAT on commissions`} value="Included" note={`Charged as a ${revenueAuthority} VAT-registered business. eTIMS receipt issued automatically.`} />
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-8">
            <p className="font-heading font-bold text-slate-900 dark:text-white mb-4 text-sm">Carrier Commission Tiers</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {[
                ["1 truck (Solo)",    "Standard rate",  "24h payment window"],
                ["2–5 trucks",        "5% discount",    "7-day payment window"],
                ["6–15 trucks",       "10% discount",   "7-day payment window"],
                ["16–50 trucks",      "15% discount",   "7-day payment window"],
                ["51+ trucks",        "20% discount",   "7-day payment window"],
              ].map(([fleet, rate, window]) => (
                <div key={fleet} className="flex items-center gap-4 py-3">
                  <span className="w-32 text-slate-700 dark:text-slate-300 font-medium text-xs">{fleet}</span>
                  <span className="flex-1 text-teal-600 dark:text-teal-400 font-semibold text-xs">{rate}</span>
                  <span className="text-slate-400 text-xs">{window}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4">Additional multipliers apply for truck type, cargo specialization, terrain difficulty, and distance. Sign in to see your exact rate.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Zap,        title: "Direct payment",     desc: "Shipper pays trucker directly on delivery. No funds held unnecessarily." },
              { icon: Shield,     title: "No hidden charges",  desc: "Commission is the only fee. No listing fees, no monthly charges for basic use." },
              { icon: CreditCard, title: "Auto-unblock",       desc: "Top up your wallet and your commission is settled automatically — account restored instantly." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                <Icon className="w-5 h-5 text-secondary mb-3" />
                <p className="font-heading font-semibold text-slate-900 dark:text-white mb-1 text-sm">{title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-primary mb-10 text-center">Platform Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 pr-4 font-heading font-semibold text-slate-600 dark:text-slate-300 w-1/2">Feature</th>
                  <th className="text-center py-3 px-3 font-heading font-semibold text-slate-600 dark:text-slate-300">Shippers</th>
                  <th className="text-center py-3 px-3 font-heading font-semibold text-secondary">Fleet Owners</th>
                  <th className="text-center py-3 px-3 font-heading font-semibold text-slate-600 dark:text-slate-300">Drivers</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Post loads",                 true,  false, false],
                  ["Browse load marketplace",    false, true,  true],
                  ["Submit bids",                false, true,  false],
                  ["Real-time GPS tracking",     true,  true,  true],
                  ["Escrow payment protection",  true,  true,  false],
                  ["Multi-currency wallet",       true,  true,  true],
                  ["Mobile money payouts",       false, true,  true],
                  ["Consignment notes",          true,  true,  true],
                  ["Driver management",          false, true,  false],
                  ["Fleet dashboard",            false, true,  false],
                  ["Shipment history",           true,  true,  true],
                  ["Dispute resolution",         true,  true,  true],
                  ["Return window listings",     false, true,  true],
                  ["National carrier verification", false, true,  true],
                ].map(([feature, shipper, owner, driver]) => (
                  <tr key={feature} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{feature}</td>
                    {[shipper, owner, driver].map((has, i) => (
                      <td key={i} className="text-center py-3 px-3">
                        {has
                          ? <CheckCircle className="w-4 h-4 text-teal-500 inline" />
                          : <X className="w-4 h-4 text-slate-300 inline" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-primary mb-10 text-center">Pricing FAQs</h2>
          {[
            { q: "Is there a free trial?", a: "Yes. All three role types can create accounts and explore the platform at no cost. Fees only apply once a load is posted and a delivery is successfully completed." },
            { q: "What if a delivery is disputed?", a: "Contact support before confirming delivery. Our resolution team reviews GPS data, timestamps, and photos from both parties. Do not confirm delivery until any issue is resolved." },
            { q: "Can I cancel a load after posting?", a: <>Yes, before a bid is accepted. Once a bid is accepted and the shipment is booked, cancellation incurs a cancellation fee (<strong>{formatPercent(cancellationFeeRate)}</strong> of load value) to compensate the carrier.</> },
            { q: "Are there volume discounts?", a: "Enterprise shippers with 50+ loads per month qualify for a reduced platform fee. Contact our team at enterprise@trakvora.com for custom rates." },
            { q: "How are payouts processed?", a: "Payouts hit your trakvora wallet immediately on confirmed delivery. You can withdraw to M-Pesa or a registered bank account at any time. Withdrawals process within 24 hours." },
          ].map(({ q, a }) => (
            <div key={q} className="flex gap-4 border-b border-slate-200 dark:border-slate-700 py-5">
              <HelpCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-semibold text-slate-900 dark:text-white mb-1">{q}</p>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-white text-center px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="font-heading text-3xl font-bold mb-4">No Risk to Get Started</h2>
          <p className="text-slate-400 mb-8">Create your account in minutes. You only pay when a delivery is completed.</p>
          <Link to="/register"
            className="inline-flex items-center gap-2 bg-secondary text-white px-10 py-4 rounded-xl font-heading font-bold hover:opacity-90 transition-opacity shadow-lg">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
