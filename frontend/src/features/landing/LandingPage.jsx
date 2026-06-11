import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { landingApi } from "@/features/landing/api/landingApi";
import apiClient from "@/services/apiClient";
import {
  Truck, Package, Smartphone,
  LayoutGrid, ShoppingBag, Banknote,
  Globe, BarChart2,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import MainNav from "@/components/layout/MainNav";
import Footer from "@/components/layout/Footer";
import HeroSlideshow from "@/features/landing/components/HeroSlideshow";


const PLATFORM_FEATURES = [
  { iconBg: "bg-orange-500",  icon: LayoutGrid,  title: "Dispatch Operating System", desc: "Intelligent dispatching and route optimization to maximize fleet efficiency."                                     },
  { iconBg: "bg-purple-600",  icon: ShoppingBag, title: "Marketplace",           desc: "Access thousands of verified loads and capacity in real-time."                                                         },
  { iconBg: "bg-blue-500",    icon: Truck,        title: "Fleet Management",      desc: "Track vehicles, monitor performance and reduce operational costs."                                                     },
  { iconBg: "bg-emerald-500", icon: Smartphone,  title: "Driver App",            desc: "Drivers accept jobs, navigate routes, upload PODs and track earnings in one app."                                     },
  { iconBg: "bg-rose-600",    icon: Banknote,     title: "Finance & Billing",     desc: "Auto-invoiced commissions with VAT and full audit trails on every delivery."                                   },
  { iconBg: "bg-violet-600",  icon: BarChart2,    title: "Compliance & Reports",  desc: "eTIMS receipts issued for every commission Trakvora earns, with real-time analytics for smarter decisions."             },
];


function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

const FALLBACK_COMPANIES = [
  { id: "bidco",   name: "BIDCO AFRICA",   logo_url: null },
  { id: "crown",   name: "CROWN",          logo_url: null },
  { id: "airliq",  name: "AIR LIQUIDE",    logo_url: null },
  { id: "mkulima", name: "m-kulima",       logo_url: null },
  { id: "dangote", name: "DANGOTE CEMENT", logo_url: null },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
const FALLBACK_IMAGES = {
  "how-it-works-step1": "/truck-highway.jpg",
  "how-it-works-step2": "/cargo.jpg",
  "how-it-works-video": "/highway-traffic.mp4",
};

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const [stats,        setStats]        = useState(null);
  const [companies,    setCompanies]    = useState(FALLBACK_COMPANIES);
  const [landingImages, setLandingImages] = useState(FALLBACK_IMAGES);

  const howItWorksRef   = useRef(null);
  const howItWorksInView = useInView(howItWorksRef);

  useEffect(() => {
    apiClient.get("/settings/landing-assets")
      .then((r) => {
        const map = {};
        r.data.forEach((a) => {
          // Only use API URL if it's a fully external URL (e.g. CDN).
          // Relative backend paths are unreliable in production — static
          // assets in frontend/public already serve as the canonical source.
          if (a.file_url.startsWith("http")) map[a.key] = a.file_url;
        });
        setLandingImages((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const d = await landingApi.getStats();
        const deliveries = d.completed_shipments ?? 0;
        const trucks     = d.total_trucks        ?? 0;
        const countries  = d.corridors_served    ?? 0;
        if ((deliveries > 0 || trucks > 0 || countries > 0) && !cancelled) {
          setStats([
            { icon: Package, val: deliveries.toLocaleString() + "+", label: "Deliveries" },
            { icon: Truck,   val: trucks.toLocaleString()     + "+", label: "Trucks"     },
            { icon: Globe,   val: String(countries),                 label: "Countries"  },
          ]);
        }
      } catch { /* keep fallback */ }

      try {
        const list = await landingApi.getFeaturedCompanies();
        if (list.length > 0 && !cancelled) setCompanies(list);
      } catch { /* keep fallback */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const dashboardTo =
    user?.role === "shipper" ? "/shipper" :
    user?.role === "driver"  ? "/driver"  :
    user?.role === "owner"   ? "/owner"   :
    user?.role === "admin"   ? "/admin"   : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 antialiased">

      <MainNav transparent />

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <HeroSlideshow user={user} dashboardTo={dashboardTo} stats={stats} />

      {/* ══ PLATFORM FEATURES ═══════════════════════════════════════════════ */}
      <section className="py-8 sm:py-14 bg-white px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
              Everything you need to run logistics at scale
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 sm:gap-x-12 gap-y-5 sm:gap-y-10">
            {PLATFORM_FEATURES.map(({ iconBg, icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 sm:gap-4">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${iconBg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-heading text-sm sm:text-base font-bold text-slate-900 mb-0.5 sm:mb-1">{title}</h3>
                  <p className="hidden sm:block text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 overflow-hidden" ref={howItWorksRef}>

        {/* ── Section heading ─────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-24 pb-10 sm:pb-16">
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: "#fe6a34" }}>
            How It Works
          </p>
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-slate-900 leading-tight max-w-2xl">
            Move freight smarter,<br className="hidden sm:block" /> from post to delivery.
          </h2>
        </div>

        {/* ── Step 01 — Post a Load ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">

          {/* text */}
          <div
            className={["flex flex-col justify-center px-4 sm:px-6 lg:px-16 py-12 lg:py-20", howItWorksInView ? "animate-fade-in-up" : "opacity-0"].join(" ")}
            style={{ animationDelay: "0ms" }}
          >
            <div className="max-w-md">
              <div className="relative mb-5">
                <span className="font-heading text-8xl font-black text-slate-900/[0.04] select-none leading-none block">01</span>
                <span className="absolute left-1 bottom-2 text-xs font-black tracking-widest uppercase" style={{ color: "#fe6a34" }}>Step 01</span>
              </div>
              <div className="w-10 border-t-2 mb-5" style={{ borderColor: "#fe6a34" }} />
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Post a Load</h3>
              <p className="text-slate-500 text-base leading-relaxed">
                List your cargo details, set pickup and drop-off locations, and specify your timeline. Your load is instantly visible to hundreds of verified carriers across the region.
              </p>
            </div>
          </div>

          {/* visual — photo + floating card */}
          <div className="relative overflow-hidden min-h-[400px] lg:min-h-[520px]">
            <img
              src={landingImages["how-it-works-step1"]}
              alt="Cargo loading"
              className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            {/* floating load card */}
            <div className="absolute bottom-6 left-6 right-6 sm:right-auto sm:w-72 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl animate-float">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#fe6a34" }}>
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">New Load Posted</div>
                  <div className="text-[10px] text-slate-400">SHP-2847 · Just now</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Route</span>
                  <span className="font-semibold text-slate-800">Nairobi → Mombasa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cargo</span>
                  <span className="font-semibold text-slate-800">Electronics · 2.4 t</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Budget</span>
                  <span className="font-semibold text-slate-800">KES 12,500</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-medium">Awaiting carrier bids…</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Step 02 — Get Matched ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">

          {/* visual — photo + carrier cards */}
          <div className="relative overflow-hidden min-h-[400px] lg:min-h-[520px] order-2 lg:order-1">
            <img
              src={landingImages["how-it-works-step2"]}
              alt="Truck on highway"
              className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
              style={{ animationDirection: "alternate-reverse" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />

            {/* carrier match cards */}
            <div className="absolute top-6 right-4 sm:right-6 space-y-2 w-56 sm:w-64">
              {[
                { name: "James Transport",    rating: "4.8", price: "KES 12,500", delay: "0ms",   accent: true  },
                { name: "Nairobi Freight Co.", rating: "4.6", price: "KES 11,800", delay: "250ms", accent: false },
                { name: "Swift Logistics",    rating: "4.5", price: "KES 13,200", delay: "500ms", accent: false },
              ].map(({ name, rating, price, delay, accent }) => (
                <div
                  key={name}
                  className={["bg-white/92 backdrop-blur-sm rounded-xl p-3 shadow-lg animate-slide-up-fade", accent ? "ring-1 ring-orange-400" : ""].join(" ")}
                  style={{ animationDelay: delay }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 truncate pr-2">{name}</span>
                    {accent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: "#fe6a34" }}>Best</span>}
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-500 font-semibold">⭐ {rating}</span>
                    <span className="font-bold text-slate-700">{price}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* animated route line at bottom */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3">
                <svg viewBox="0 0 280 36" className="w-full" preserveAspectRatio="xMidYMid meet">
                  <circle cx="18" cy="18" r="5" fill="#fe6a34" />
                  <circle cx="18" cy="18" r="9" fill="none" stroke="#fe6a34" strokeWidth="1.5" opacity="0.4" className="animate-ping" />
                  <path d="M23,18 L257,18" stroke="#fe6a34" strokeWidth="2" strokeDasharray="200" className="animate-draw-route" fill="none" />
                  <circle cx="262" cy="18" r="5" fill="#4fdbcc" />
                  <text x="14" y="32" fontSize="8" fill="#94a3b8">Nairobi</text>
                  <text x="238" y="32" fontSize="8" fill="#94a3b8">Mombasa</text>
                </svg>
              </div>
            </div>
          </div>

          {/* text */}
          <div
            className={["flex flex-col justify-center px-4 sm:px-6 lg:px-16 py-12 lg:py-20 order-1 lg:order-2", howItWorksInView ? "animate-fade-in-up" : "opacity-0"].join(" ")}
            style={{ animationDelay: "150ms" }}
          >
            <div className="max-w-md">
              <div className="relative mb-5">
                <span className="font-heading text-8xl font-black text-slate-900/[0.04] select-none leading-none block">02</span>
                <span className="absolute left-1 bottom-2 text-xs font-black tracking-widest uppercase" style={{ color: "#fe6a34" }}>Step 02</span>
              </div>
              <div className="w-10 border-t-2 mb-5" style={{ borderColor: "#fe6a34" }} />
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Get Matched</h3>
              <p className="text-slate-500 text-base leading-relaxed">
                Trakvora surfaces the best-fit verified carriers for your route. Review bids, check ratings, and confirm — the whole process takes minutes, not days.
              </p>
            </div>
          </div>
        </div>

        {/* ── Step 03 — Track & Deliver ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">

          {/* text */}
          <div
            className={["flex flex-col justify-center px-4 sm:px-6 lg:px-16 py-12 lg:py-20", howItWorksInView ? "animate-fade-in-up" : "opacity-0"].join(" ")}
            style={{ animationDelay: "300ms" }}
          >
            <div className="max-w-md">
              <div className="relative mb-5">
                <span className="font-heading text-8xl font-black text-slate-900/[0.04] select-none leading-none block">03</span>
                <span className="absolute left-1 bottom-2 text-xs font-black tracking-widest uppercase" style={{ color: "#fe6a34" }}>Step 03</span>
              </div>
              <div className="w-10 border-t-2 mb-5" style={{ borderColor: "#fe6a34" }} />
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Track & Deliver</h3>
              <p className="text-slate-500 text-base leading-relaxed">
                Follow your shipment live on the map from pickup to drop-off. Drivers upload proof of delivery the moment cargo reaches its destination — automatic confirmation, every time.
              </p>
            </div>
          </div>

          {/* visual — real highway video background */}
          <div className="relative overflow-hidden min-h-[400px] lg:min-h-[520px] bg-slate-900">

            {/* looping highway video */}
            <video
              src={landingImages["how-it-works-video"]}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* dark overlay to keep text/cards legible */}
            <div className="absolute inset-0 bg-slate-900/55" />


            {/* floating status card */}
            <div className="absolute top-6 right-4 sm:right-6 w-56 sm:w-64 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl animate-float" style={{ animationDelay: "1s" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-900">Live Tracking</span>
                <span className="ml-auto text-[10px] text-slate-400">SHP-2847</span>
              </div>
              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="font-semibold text-emerald-600">In Transit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining</span>
                  <span className="font-semibold text-slate-800">142 km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ETA</span>
                  <span className="font-semibold text-slate-800">2h 15m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver</span>
                  <span className="font-semibold text-slate-800">Patrick M. ⭐4.9</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">POD Ready for Upload</span>
              </div>
            </div>

            {/* GPS route mini-map at bottom */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
                <svg viewBox="0 0 280 24" className="w-full">
                  <circle cx="8" cy="12" r="4" fill="#fe6a34" />
                  <line x1="12" y1="12" x2="175" y2="12" stroke="#fe6a34" strokeWidth="2" strokeDasharray="4,3" opacity="0.7" />
                  <circle cx="178" cy="12" r="5" fill="#fe6a34" opacity="0.9" className="animate-ping" />
                  <line x1="183" y1="12" x2="272" y2="12" stroke="#475569" strokeWidth="2" strokeDasharray="4,3" />
                  <circle cx="275" cy="12" r="4" fill="#4fdbcc" />
                  <text x="4" y="23" fontSize="6" fill="#64748b">NBI</text>
                  <text x="266" y="23" fontSize="6" fill="#64748b">MBA</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── dual CTAs ────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              to="/register?role=shipper"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#fe6a34" }}
            >
              Start as Shipper
            </Link>
            <Link
              to="/register?role=owner"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-slate-700 border border-slate-300 hover:border-slate-500 bg-white transition-all active:scale-95"
            >
              Join as Carrier
            </Link>
          </div>
        </div>
      </section>

      {/* ══ TRUSTED BY ══════════════════════════════════════════════════════ */}
      <section className="py-6 sm:py-10 bg-white overflow-hidden border-y border-slate-100">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-[0.18em] mb-4 sm:mb-7">
          Trusted by leading companies
        </p>
        <div className="relative">
          <div className="flex gap-16 animate-marquee whitespace-nowrap">
            {[...companies, ...companies].map((c, i) =>
              c.logo_url ? (
                <img key={i} src={c.logo_url} alt={c.name}
                  className="h-9 object-contain opacity-50 hover:opacity-80 transition-opacity shrink-0" />
              ) : (
                <span key={i}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-black text-sm shrink-0 select-none">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
