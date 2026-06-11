import { Link } from "react-router-dom";
import {
  Truck, CheckCircle, ArrowRight, DollarSign, Shield,
  BarChart2, Wifi, RefreshCw, Globe, Zap, Star, Users,
  FileText, MapPin, Package, TrendingUp,
} from "lucide-react";
import RoleCta from "@/components/ui/RoleCta";

const JOIN_BENEFITS = [
  {
    title: "More Loads, More Revenue",
    desc: "Access a wide network of verified shippers and consistent load opportunities across East Africa.",
    icon: Package,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    title: "Backhaul Revenue",
    desc: "Get matched with return loads and turn empty trips into profit with smart backhaul matching.",
    icon: RefreshCw,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    title: "Revenue Protection",
    desc: "Prevent off-platform deals and revenue leakage with controlled job execution.",
    icon: Shield,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    title: "Verified & Trusted Customers",
    desc: "Work only with verified businesses. Less risk, more confidence on every shipment.",
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    title: "Clear Payment Records",
    desc: "Digital contracts and consignment notes give you a complete paper trail for every job and every payment.",
    icon: DollarSign,
    color: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  {
    title: "Multi-Country Growth",
    desc: "Operate across countries and expand your business beyond borders with one platform.",
    icon: Globe,
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
];

const YOUR_FLEET_FEATURES = [
  "Real-time job matching & dispatch",
  "IoT-enabled movement monitoring",
  "Route compliance & geofence alerts",
  "Driver behavior & performance insights",
  "Fleet utilization & revenue analytics",
  "Digital documents & POD capture",
  "Maintenance & cost tracking",
];

const YOU_GET = [
  "Higher earnings per truck",
  "Lower operating costs",
  "Full visibility & control",
  "Fewer empty trips",
  "Stronger customer trust",
  "Business growth at scale",
];

const FLEET_TYPES = [
  { label: "Trailer Trucks", icon: "🚛" },
  { label: "Trucks (FH)",   icon: "🚚" },
  { label: "Small Trucks",  icon: "🛻" },
  { label: "Vans",          icon: "🚐" },
  { label: "Pickups",       icon: "🚗" },
  { label: "Parcels",       icon: "📦" },
  { label: "Air Freight",   icon: "✈️" },
];

export default function ForFleetOwnersPage() {
  return (
    <div className="bg-white">
      {/* ── Hero ── */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-secondary/40 bg-secondary/10 px-4 py-1.5 rounded-full mb-6">
            <Truck className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold font-heading tracking-widest uppercase text-secondary">For Fleet Owners</span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
            Why Fleet Owners<br />
            <span className="text-secondary">Join Trakvora</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Maximize your fleet's earning potential with consistent load opportunities, real-time dispatch tools, digital documentation, and multi-country reach.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <RoleCta to="/register?role=owner"
              className="bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity rounded-xl">
              <Truck className="w-5 h-5" /> Register Your Fleet
            </RoleCta>
            <Link to="/trucks"
              className="border border-gray-300 text-gray-800 px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors rounded-xl">
              Browse Available Jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Join Benefits ── */}
      <section className="py-14 px-6 bg-[#f3f8ff]">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs font-bold font-heading text-gray-500 uppercase tracking-widest mb-12">
            Why Fleet Owners Join Trakvora
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {JOIN_BENEFITS.map(({ title, desc, icon: Icon, color, bg }) => (
              <div key={title} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-orange-300 transition-all">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-heading font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Your Fleet. Your Control. ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            {/* Left checklist */}
            <div>
              <h2 className="font-heading text-2xl font-bold text-primary mb-6">
                <span className="text-secondary">Your Fleet.</span> Your Control.
              </h2>
              <ul className="space-y-3">
                {YOUR_FLEET_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle className="w-5 h-5 text-secondary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Center dashboard mockup */}
            <div className="bg-primary rounded-2xl p-6 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span className="text-xs text-slate-400 font-heading font-bold uppercase tracking-wider">Fleet Dashboard</span>
                </div>
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider text-secondary border border-secondary/40 bg-secondary/10 px-2 py-0.5 rounded-full">Preview</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Active Trucks", value: "12" },
                  { label: "Open Loads", value: "34" },
                  { label: "Delivered Today", value: "7" },
                  { label: "On-Time Rate", value: "97%" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="font-heading text-xl font-extrabold text-white">{value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2 font-heading font-bold">Revenue This Month</p>
                <div className="flex items-end gap-1 h-12">
                  {[40, 65, 55, 80, 70, 95, 85, 100, 78, 90, 88, 96].map((h, i) => (
                    <div key={i} className="flex-1 bg-secondary rounded-t-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Right benefits */}
            <div>
              <h2 className="font-heading text-2xl font-bold text-primary mb-6">
                With Trakvora, <span className="text-secondary">You Get:</span>
              </h2>
              <ul className="space-y-3">
                {YOU_GET.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle className="w-5 h-5 text-teal-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <RoleCta to="/register?role=owner"
                  className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
                  Register Fleet Now <ArrowRight className="w-4 h-4" />
                </RoleCta>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fleet Ecosystem ── */}
      <section className="py-14 px-6 bg-[#f3f8ff]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold font-heading text-gray-500 uppercase tracking-widest mb-10">
            Our Fleet Ecosystem
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {FLEET_TYPES.map(({ label, icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-300 transition-all shadow-sm">
                <span className="text-2xl">{icon}</span>
                <p className="text-[10px] font-bold font-heading text-gray-500 uppercase tracking-wide text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-primary text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold mb-3">Ready to grow your fleet business?</h2>
          <p className="text-slate-400 mb-8">Get more loads, more visibility, and more control over your fleet — with trakvora.</p>
          <RoleCta to="/register?role=owner"
            className="inline-flex items-center gap-2 bg-secondary text-white px-10 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl shadow-lg">
            Register Your Fleet <ArrowRight className="w-4 h-4" />
          </RoleCta>
        </div>
      </section>
    </div>
  );
}
