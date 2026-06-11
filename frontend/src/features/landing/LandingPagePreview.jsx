import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { landingApi } from "@/features/landing/api/landingApi";
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

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Post a Load",
    desc: "List your cargo, set pickup and drop-off locations, and specify your timeline. Reach verified carriers instantly.",
  },
  {
    num: "02",
    title: "Get Matched",
    desc: "Trakvora surfaces the best-fit carriers for your route. Accept a bid and confirm — done in minutes.",
  },
  {
    num: "03",
    title: "Track & Deliver",
    desc: "Follow your shipment live on the map. Drivers upload proof of delivery the moment cargo reaches its destination.",
  },
];

const FALLBACK_COMPANIES = [
  { id: "bidco",   name: "BIDCO AFRICA",   logo_url: null },
  { id: "crown",   name: "CROWN",          logo_url: null },
  { id: "airliq",  name: "AIR LIQUIDE",    logo_url: null },
  { id: "mkulima", name: "m-kulima",       logo_url: null },
  { id: "dangote", name: "DANGOTE CEMENT", logo_url: null },
];

function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPagePreview() {
  const user = useAuthStore((s) => s.user);
  const [stats,     setStats]     = useState(null);
  const [companies, setCompanies] = useState(FALLBACK_COMPANIES);

  const howItWorksRef = useRef(null);
  const howItWorksInView = useInView(howItWorksRef);

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
      <section className="py-14 sm:py-24 bg-slate-950 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">

          {/* heading */}
          <div className="mb-14 sm:mb-20">
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: "#fe6a34" }}>
              How It Works
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight max-w-xl">
              Move freight smarter,<br className="hidden sm:block" /> from post to delivery.
            </h2>
          </div>

          {/* steps */}
          <div ref={howItWorksRef} className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-0 mb-16 sm:mb-20">
            {HOW_IT_WORKS.map(({ num, title, desc }, i) => (
              <div
                key={num}
                className={[
                  "relative opacity-0",
                  howItWorksInView ? "animate-fade-in-up" : "",
                  "lg:pr-12",
                ].join(" ")}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* connector line between steps (desktop only) */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute right-0 top-8 w-px h-16 bg-slate-700" />
                )}

                {/* large faint number */}
                <div className="relative mb-4">
                  <span className="font-heading text-7xl sm:text-8xl font-black text-white/5 select-none leading-none">
                    {num}
                  </span>
                  <span
                    className="absolute left-1 bottom-2 text-xs font-black tracking-widest uppercase"
                    style={{ color: "#fe6a34" }}
                  >
                    Step {num}
                  </span>
                </div>

                {/* accent rule */}
                <div className="w-10 border-t-2 mb-4" style={{ borderColor: "#fe6a34" }} />

                <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mb-3">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>

          {/* dual CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              to="/register?role=shipper"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#fe6a34" }}
            >
              Start as Shipper
            </Link>
            <Link
              to="/register?role=owner"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white border border-slate-600 hover:border-slate-400 transition-all active:scale-95"
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
