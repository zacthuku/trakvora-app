import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Layers, Store, Users, Wallet, Truck, Package,
  TrendingUp, TrendingDown, ChevronRight, ArrowRight,
  BarChart2, Navigation2, MapPin,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ownerApi } from "@/features/owner/api/ownerApi";
import { useCurrency } from "@/hooks/useCurrency";

function greeting(name) {
  const h = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

const PERIOD_DAYS   = { "7d": 7, "30d": 30, "90d": 90 };
const PERIOD_LABELS = { "7d": "7 Days", "30d": "30 Days", "90d": "90 Days" };

const TRUCK_STATUS_CONFIG = {
  available:   { label: "Available",   dot: "bg-emerald-400",         bar: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  on_trip:     { label: "On Trip",     dot: "bg-sky-400 animate-pulse", bar: "bg-sky-400",   text: "text-sky-700",     bg: "bg-sky-50"     },
  maintenance: { label: "Maintenance", dot: "bg-amber-400",            bar: "bg-amber-400",  text: "text-amber-700",   bg: "bg-amber-50"   },
  inactive:    { label: "Inactive",    dot: "bg-slate-400",            bar: "bg-slate-300",  text: "text-slate-500",   bg: "bg-slate-100"  },
};

export default function OwnerHomePage() {
  const { format } = useCurrency();
  const user = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState("30d");

  const { data: trucks } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => ownerApi.getMyTrucks(),
  });

  const { data: team } = useQuery({
    queryKey: ["owner-team"],
    queryFn: () => ownerApi.getMyTeam(),
  });

  const { data: fleetLoadsData } = useQuery({
    queryKey: ["owner-fleet-loads"],
    queryFn: () => ownerApi.getFleetLoads({ page: 1, page_size: 100 }),
  });

  const { data: wallet } = useQuery({
    queryKey: ["owner-wallet"],
    queryFn: () => ownerApi.getWallet(),
  });

  const { data: commissionsData } = useQuery({
    queryKey: ["owner-commissions"],
    queryFn: () => ownerApi.getCommissions(),
    retry: false,
  });

  const allTrucks   = Array.isArray(trucks)          ? trucks          : (trucks?.items          || []);
  const allDrivers  = Array.isArray(team)            ? team            : (team?.items            || []);
  const fleetLoads  = Array.isArray(fleetLoadsData)  ? fleetLoadsData  : (fleetLoadsData?.items  || []);
  const commissions = Array.isArray(commissionsData) ? commissionsData : (commissionsData?.items  || []);

  const activeTrucks = useMemo(() => allTrucks.filter((t) => t.is_active), [allTrucks]);
  const activeLoads  = useMemo(
    () => fleetLoads.filter((l) => ["booked", "en_route_pickup", "loaded", "in_transit"].includes(l.status)),
    [fleetLoads]
  );

  const truckStatusGroups = useMemo(() => {
    const groups = { available: 0, on_trip: 0, maintenance: 0, inactive: 0 };
    for (const t of allTrucks) {
      const s = t.availability_status || (t.is_active ? "available" : "inactive");
      if (s in groups) groups[s]++;
      else groups.inactive++;
    }
    return groups;
  }, [allTrucks]);

  const periodLoads = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    return fleetLoads.filter((l) => l.status === "delivered" && new Date(l.created_at) >= cutoff);
  }, [fleetLoads, period]);

  const periodRevenue  = useMemo(() => periodLoads.reduce((s, l) => s + (l.price_kes  || 0), 0), [periodLoads]);
  const periodDistance = useMemo(() => periodLoads.reduce((s, l) => s + (l.distance_km || 0), 0), [periodLoads]);

  const pendingCommissions = useMemo(
    () => commissions.filter((c) => c.status === "pending").reduce((s, c) => s + (c.amount || 0), 0),
    [commissions]
  );
  const paidCommissions = useMemo(
    () => commissions.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount || 0), 0),
    [commissions]
  );

  const walletDisplay = wallet
    ? format(wallet.balance_kes ?? wallet.balance ?? 0, wallet.currency || "KES")
    : "—";

  const HERO_STATS = [
    { icon: Truck,       value: activeTrucks.length, label: "Active Trucks"  },
    { icon: Navigation2, value: activeLoads.length,  label: "Loads In Transit" },
    { icon: Users,       value: allDrivers.length,   label: "Drivers"        },
    { icon: Wallet,      value: walletDisplay,        label: "Wallet"         },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

      {/* ── Hero ── */}
      <section className="relative rounded-2xl overflow-hidden mb-8">
        <div className="absolute inset-0">
          <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/96 via-slate-900/88 to-slate-900/60" />
        </div>
        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-[#4fdbcc] text-xs font-bold uppercase tracking-widest mb-2 font-heading">
                Fleet Owner Portal
              </p>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white leading-tight">
                {greeting(user?.full_name)}
              </h1>
              {user?.company_name && (
                <p className="text-slate-300 text-sm mt-1">{user.company_name}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
                  <Truck className="w-3 h-3" /> {allTrucks.length} trucks
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
                  <Users className="w-3 h-3" /> {allDrivers.length} drivers
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/owner/fleet"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#fe6a34] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#fe6a34]/30"
              >
                <Layers className="w-4 h-4" /> Manage Fleet
              </Link>
              <Link
                to="/owner/marketplace"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/25 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Store className="w-4 h-4" /> Marketplace
              </Link>
              <Link
                to="/owner/drivers"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/25 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Users className="w-4 h-4" /> My Drivers
              </Link>
            </div>
          </div>

          {/* Glass stat pills */}
          <div className="mt-8 flex flex-wrap gap-3">
            {HERO_STATS.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3"
              >
                <Icon className="w-4 h-4 text-white/60 shrink-0" />
                <div>
                  <p className="text-lg font-heading font-bold text-white leading-none">{value}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fleet Status + Revenue Report ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Fleet status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-heading font-bold text-slate-900">Fleet Status</h2>
              <p className="text-xs text-slate-400 mt-0.5">Live overview of your trucks</p>
            </div>
            <Link to="/owner/fleet" className="flex items-center gap-1 text-xs font-semibold text-[#fe6a34] hover:underline">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {allTrucks.length === 0 ? (
              <div className="text-center py-6">
                <Truck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No trucks added yet</p>
                <Link to="/owner/fleet" className="text-xs text-[#fe6a34] font-semibold hover:underline mt-1 inline-block">
                  Add your first truck
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {Object.entries(truckStatusGroups).map(([status, count]) => {
                    const cfg = TRUCK_STATUS_CONFIG[status] || TRUCK_STATUS_CONFIG.inactive;
                    return (
                      <div key={status} className={`rounded-xl p-4 ${cfg.bg}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <p className={`text-2xl font-heading font-bold ${cfg.text}`}>{count}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {allTrucks.slice(0, 3).map((t) => {
                    const s = t.availability_status || (t.is_active ? "available" : "inactive");
                    const cfg = TRUCK_STATUS_CONFIG[s] || TRUCK_STATUS_CONFIG.inactive;
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Truck className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700">{t.plate_number || "No plate"} · {t.truck_type}</p>
                          <p className="text-[11px] text-slate-400">{t.capacity_tons}T capacity</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      </div>
                    );
                  })}
                  {allTrucks.length > 3 && (
                    <Link to="/owner/fleet" className="text-xs text-[#fe6a34] font-semibold hover:underline block text-center pt-1">
                      +{allTrucks.length - 3} more trucks
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Period revenue report */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#fe6a34]" />
              <h2 className="text-sm font-heading font-bold text-slate-900">Fleet Revenue Report</h2>
            </div>
            <div className="flex gap-1">
              {Object.keys(PERIOD_LABELS).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    period === p ? "bg-[#fe6a34] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Revenue</p>
                <p className="text-2xl font-heading font-bold text-slate-900">
                  {periodRevenue > 0 ? format(periodRevenue) : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">from {periodLoads.length} trips</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Distance</p>
                <p className="text-2xl font-heading font-bold text-slate-900">
                  {periodDistance > 0 ? periodDistance.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">km covered</p>
              </div>
            </div>

            {commissions.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Commissions</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-heading font-bold text-teal-700">{format(paidCommissions)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Paid out</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-heading font-bold text-amber-700">{format(pendingCommissions)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Pending</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">{periodLoads.length} deliveries in {PERIOD_LABELS[period].toLowerCase()}</span>
              <Link to="/owner/commissions" className="text-xs font-semibold text-[#fe6a34] hover:underline flex items-center gap-1">
                View commissions <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { to: "/owner/fleet",       icon: Layers,   label: "Manage Fleet",  desc: "Add trucks, assign drivers, track availability",  color: "bg-[#fe6a34]" },
          { to: "/owner/marketplace", icon: Store,    label: "Marketplace",   desc: "Browse loads and place competitive bids",         color: "bg-[#4fdbcc]" },
          { to: "/owner/fleet-map",   icon: MapPin,   label: "Fleet Map",     desc: "See your trucks' live positions on the map",      color: "bg-violet-500" },
        ].map(({ to, icon: Icon, label, desc, color }) => (
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
    </div>
  );
}
