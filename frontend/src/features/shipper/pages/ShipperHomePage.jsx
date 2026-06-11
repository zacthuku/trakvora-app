import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Package, CheckCircle, ArrowRight, MapPin, Clock,
  Navigation2, Wallet, Truck, ChevronRight, Star,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";

function greeting(name) {
  const h = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

const STATUS_CONFIG = {
  available:       { label: "Awaiting Bids", pill: "bg-amber-50 text-amber-700 border-amber-200" },
  booked:          { label: "Booked",         pill: "bg-sky-50 text-sky-700 border-sky-200" },
  en_route_pickup: { label: "En Route",       pill: "bg-sky-50 text-sky-700 border-sky-200" },
  loaded:          { label: "Loaded",          pill: "bg-blue-50 text-blue-700 border-blue-200" },
  in_transit:      { label: "In Transit",     pill: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered:       { label: "Delivered",      pill: "bg-teal-50 text-teal-700 border-teal-200" },
  cancelled:       { label: "Cancelled",      pill: "bg-red-50 text-red-600 border-red-200" },
};

const QUICK_ACTIONS = [
  {
    to: "/shipper/post-load",
    icon: Package,
    label: "Post a Load",
    desc: "Get competitive bids from verified carriers in minutes.",
    color: "bg-[#fe6a34]",
  },
  {
    to: "/shipper/tracking",
    icon: MapPin,
    label: "Live Tracking",
    desc: "Monitor your cargo on a live map with real-time GPS.",
    color: "bg-[#1a2b3c]",
  },
  {
    to: "/shipper/shipments",
    icon: Navigation2,
    label: "My Shipments",
    desc: "View all active loads, bids, and shipment history.",
    color: "bg-[#4fdbcc]",
  },
];

const GET_STARTED_STEPS = [
  { n: "01", text: "Fill in cargo details, route, and preferred dates." },
  { n: "02", text: "Receive bids from vetted carriers within minutes." },
  { n: "03", text: "Track live and release payment on delivery." },
];

export default function ShipperHomePage() {
  const { format } = useCurrency();
  const user = useAuthStore((s) => s.user);

  const { data: loadsData } = useQuery({
    queryKey: ["shipper-loads"],
    queryFn: () => apiClient.get("/loads/mine", { params: { page: 1, page_size: 100 } }).then((r) => r.data),
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiClient.get("/payments/wallet").then((r) => r.data),
  });

  const loads = loadsData?.items || [];

  const activeLoads = useMemo(
    () => loads.filter((l) => ["booked", "en_route_pickup", "loaded", "in_transit", "available"].includes(l.status)),
    [loads]
  );
  const delivered = useMemo(() => loads.filter((l) => l.status === "delivered"), [loads]);
  const recentLoads = loads.slice(0, 4);

  const walletBalance = wallet
    ? format(wallet.balance_kes ?? wallet.balance ?? 0, wallet.currency || "KES")
    : "—";

  const STATS = [
    { icon: Package,   iconBg: "bg-[#fe6a34]/10", iconColor: "text-[#fe6a34]", value: activeLoads.length, label: "Active Loads" },
    { icon: CheckCircle, iconBg: "bg-teal-50",    iconColor: "text-teal-600",  value: delivered.length,   label: "Delivered"     },
    { icon: Wallet,    iconBg: "bg-violet-50",     iconColor: "text-violet-600", value: walletBalance,     label: "Wallet Balance" },
  ];

  return (
    <div className="bg-white">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-[#eef5ff] via-[#f5f9ff] to-white py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-12">

            {/* Left — text */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 border border-[#fe6a34]/30 bg-[#fe6a34]/8 px-4 py-1.5 rounded-full mb-5">
                <Package className="w-3.5 h-3.5 text-[#fe6a34]" />
                <span className="text-[11px] font-bold font-heading tracking-widest uppercase text-[#fe6a34]">Shipper Portal</span>
              </div>

              <p className="text-slate-500 text-sm font-medium mb-2 flex items-center gap-3 flex-wrap">
                <span>{greeting(user?.full_name)}{user?.company_name ? ` · ${user.company_name}` : ""}</span>
                {user?.rating > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {user.rating.toFixed(1)}
                    {user.total_trips > 0 && <span className="text-amber-500 font-normal">({user.total_trips} trips)</span>}
                  </span>
                )}
              </p>

              <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-[#1a2b3c] leading-tight tracking-tight mb-4">
                Ship Freight with<br />
                <span className="text-[#fe6a34]">Confidence & Control</span>
              </h1>

              <p className="text-lg text-slate-500 max-w-md leading-relaxed mb-8">
                Post loads, receive competitive bids from verified carriers, and track every shipment live.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/shipper/post-load"
                  className="inline-flex items-center gap-2 bg-[#fe6a34] text-white px-7 py-3.5 font-heading font-bold text-sm uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#fe6a34]/25"
                >
                  <Package className="w-4 h-4" /> Post a Load
                </Link>
                <Link
                  to="/shipper/tracking"
                  className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-7 py-3.5 font-heading font-bold text-sm uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Track Shipments <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Mobile stat chips */}
              <div className="flex flex-wrap gap-2 mt-7 md:hidden">
                {STATS.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700">
                    <s.icon className={`w-3.5 h-3.5 ${s.iconColor}`} />
                    {s.value} {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — stat cards (desktop only) */}
            <div className="hidden md:flex flex-col gap-3 w-64 shrink-0">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-heading font-bold text-slate-900 leading-none">{s.value}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 space-y-12">

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="font-heading text-xl font-bold text-[#1a2b3c] mb-1">What would you like to do?</h2>
          <p className="text-sm text-slate-500 mb-6">Jump straight into your most-used tools.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className="group relative flex flex-col gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fe6a34] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />
                <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-slate-900 group-hover:text-[#fe6a34] transition-colors mb-1">{label}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#fe6a34] group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Recent Shipments (if loads exist) ── */}
        {recentLoads.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-heading text-xl font-bold text-[#1a2b3c] mb-1">Recent Activity</h2>
                <p className="text-sm text-slate-500">Your latest loads and shipments.</p>
              </div>
              <Link to="/shipper/shipments" className="flex items-center gap-1 text-sm font-semibold text-[#fe6a34] hover:underline">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-50">
                {recentLoads.map((load) => {
                  const cfg = STATUS_CONFIG[load.status] || { label: load.status, pill: "bg-slate-100 text-slate-600 border-slate-200" };
                  return (
                    <Link
                      key={load.id}
                      to={`/shipper/bids/${load.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#fe6a34]/10 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5 text-[#fe6a34]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {load.pickup_location || "—"} → {load.dropoff_location || "—"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {load.cargo_type || "General cargo"}{load.weight_tons ? ` · ${load.weight_tons}T` : ""}
                        </p>
                      </div>
                      {load.price_kes != null && (
                        <p className="text-sm font-bold text-slate-700 shrink-0">
                          {format(load.price_kes ?? 0, "KES")}
                        </p>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide shrink-0 ${cfg.pill}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#fe6a34] transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>

              {loads.length > 4 && (
                <div className="px-5 py-4 border-t border-slate-100">
                  <Link
                    to="/shipper/shipments"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#fe6a34] text-[#fe6a34] text-sm font-semibold hover:bg-[#fe6a34] hover:text-white transition-colors"
                  >
                    View all {loads.length} shipments <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Get Started (if no loads yet) ── */}
        {loads.length === 0 && (
          <section>
            <div className="bg-gradient-to-br from-[#1a2b3c] to-slate-800 rounded-2xl p-8 md:p-10">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 bg-[#fe6a34]/20 text-[#fe6a34] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
                  <Clock className="w-3 h-3" /> Under 2 minutes
                </div>
                <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
                  Post your first load
                </h2>
                <p className="text-slate-400 text-sm mb-8">
                  Get competitive bids from verified carriers across East Africa.
                </p>
                <div className="space-y-4 mb-8">
                  {GET_STARTED_STEPS.map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-4">
                      <span className="w-8 h-8 rounded-full bg-[#fe6a34] text-white text-xs font-black font-heading flex items-center justify-center shrink-0">
                        {n}
                      </span>
                      <p className="text-slate-300 text-sm leading-relaxed pt-1">{text}</p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/shipper/post-load"
                  className="inline-flex items-center gap-2 bg-[#fe6a34] text-white px-8 py-3.5 font-heading font-bold text-sm uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#fe6a34]/30"
                >
                  Post Your First Load <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
