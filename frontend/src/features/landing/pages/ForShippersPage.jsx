import { Link } from "react-router-dom";
import {
  Package, CheckCircle, ArrowRight, Clock, Shield, BarChart2,
  CreditCard, MapPin, FileText, Zap, Users, Star,
} from "lucide-react";
import RoleCta from "@/components/ui/RoleCta";

const STEPS = [
  {
    step: "01",
    title: "Post Your Load",
    desc: "Fill in origin, destination, cargo type, weight, and preferred dates. Takes under 2 minutes.",
    icon: Package,
  },
  {
    step: "02",
    title: "Receive Competitive Bids",
    desc: "Vetted fleet owners and drivers bid on your load. Compare price, ratings, and truck specs side by side.",
    icon: Users,
  },
  {
    step: "03",
    title: "Track in Real-Time",
    desc: "Monitor your shipment live on a map. Get instant alerts for delays, stops, and arrival.",
    icon: MapPin,
  },
  {
    step: "04",
    title: "Confirm Delivery",
    desc: "Confirm delivery and settle payment directly with your carrier. Digital POD and full audit trail for every shipment.",
    icon: CreditCard,
  },
];

const BENEFITS = [
  { icon: Clock,     title: "Fast Matching",        desc: "Get bids from qualified carriers within minutes of posting." },
  { icon: Shield,    title: "Transparent Transactions", desc: "Every bid, route, and delivery event is logged. You know exactly what you agreed to and when it was delivered." },
  { icon: MapPin,    title: "Live Tracking",        desc: "GPS-powered map view with live ETA for every shipment." },
  { icon: FileText,  title: "Digital Documents",    desc: "Auto-generated consignment notes, PODs, and delivery receipts." },
  { icon: BarChart2, title: "Reporting",            desc: "Full shipment history, spend analytics, and lane benchmarks." },
  { icon: Zap,       title: "Instant Alerts",       desc: "SMS and app notifications for every key milestone." },
];

const WHAT_YOU_GET = [
  "Access to a growing network of verified carriers across East Africa",
  "Transparent pricing, no hidden platform fees",
  "Bid comparison with carrier ratings and trip history",
  "Automated consignment notes compliant with NTSA",
  "Real-time GPS tracking from pickup to delivery",
  "Digital proof of delivery before you settle payment with your carrier",
  "Multi-corridor coverage: Kenya, Uganda, Tanzania",
  "Dedicated shipper support team",
];

export default function ForShippersPage() {
  return (
    <div className="bg-white">
      {/* ── Hero ── */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-secondary/40 bg-secondary/10 px-4 py-1.5 rounded-full mb-6">
            <Package className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold font-heading tracking-widest uppercase text-secondary">For Shippers</span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
            Ship Freight with<br />
            <span className="text-secondary">Confidence & Control</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Post loads, receive competitive bids from verified carriers, track every shipment live, and settle payment directly with your confirmed carrier.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <RoleCta to="/register?role=shipper"
              className="bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity rounded-xl">
              <Package className="w-5 h-5" /> Post Your First Load
            </RoleCta>
            <RoleCta to="/register"
              className="border border-gray-300 text-gray-800 px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors rounded-xl">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </RoleCta>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-14 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">How It Works for Shippers</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Four simple steps from cargo to confirmed delivery.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
                <div className="absolute -top-3 left-6 bg-secondary text-white text-xs font-black font-heading px-3 py-1 rounded-full tracking-wider">
                  {step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-5 mt-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-primary mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">Built Around Your Needs</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Every tool on trakvora is designed to reduce your risk and increase your efficiency.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-6 rounded-xl border border-slate-200 hover:border-secondary/40 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-primary mb-1">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What You Get ── */}
      <section className="py-20 px-6 bg-primary text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Everything a Shipper Needs,<br />
              <span className="text-secondary">On One Platform</span>
            </h2>
            <p className="text-white/80 text-lg leading-relaxed mb-8">
              trakvora gives you full control over your freight, from the moment you post a load to the moment it's delivered and confirmed.
            </p>
            <RoleCta to="/register?role=shipper"
              className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
              Start Shipping Today <ArrowRight className="w-4 h-4" />
            </RoleCta>
          </div>
          <ul className="space-y-3">
            {WHAT_YOU_GET.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 px-6 bg-slate-50 text-center">
        <div className="max-w-2xl mx-auto">
          <Star className="w-10 h-10 text-secondary mx-auto mb-4" />
          <h2 className="font-heading text-3xl font-bold text-primary mb-3">Ready to move your first load?</h2>
          <p className="text-slate-500 mb-8">No setup fees. No monthly subscription. Pay only on successful deliveries.</p>
          <RoleCta to="/register?role=shipper"
            className="inline-flex items-center gap-2 bg-secondary text-white px-10 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl shadow-lg">
            Create Shipper Account <ArrowRight className="w-4 h-4" />
          </RoleCta>
        </div>
      </section>
    </div>
  );
}
