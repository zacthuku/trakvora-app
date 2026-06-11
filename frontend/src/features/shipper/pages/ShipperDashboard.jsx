import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Truck, CreditCard, Clock, Package, ArrowRight,
  PackagePlus, History, Wallet, Navigation2,
  TrendingUp, TrendingDown, Eye, AlertCircle,
  CheckCircle2, Loader2, MapPin, Zap, Star,
} from "lucide-react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";

const STATUS_CONFIG = {
  available:       { label: "Pending",      bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400",  bar: "bg-amber-400"  },
  booked:          { label: "Booked",       bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-500", bar: "bg-violet-500" },
  en_route_pickup: { label: "En Route",     bg: "bg-sky-50",     text: "text-sky-700",    dot: "bg-sky-500",    bar: "bg-sky-500"    },
  loaded:          { label: "Loaded",       bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500",   bar: "bg-blue-500"   },
  in_transit:      { label: "In Transit",   bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-[#4fdbcc]",  bar: "bg-[#4fdbcc]"  },
  delivered:       { label: "Delivered",    bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary",    bar: "bg-primary"    },
  cancelled:       { label: "Cancelled",    bg: "bg-secondary/10", text: "text-secondary", dot: "bg-secondary", bar: "bg-secondary"  },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "in_transit" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function greeting(name) {
  const h = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function MetricCard({ label, value, sub, icon: Icon, topColor, trend, trendLabel }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${topColor}`} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-heading font-bold text-slate-900 leading-none">{value}</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {trend && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-teal-50 text-teal-700" : trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
          }`}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
            {trendLabel}
          </span>
        )}
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

const NAIROBI = [-1.2921, 36.8219];

function LiveNetworkMap({ activeCount }) {
  return (
    <div className="rounded-xl overflow-hidden relative h-full min-h-[200px]">
      <MapContainer
        center={NAIROBI}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      </MapContainer>

      {/* Overlay badge */}
      <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-heading">East Africa Corridor</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Nairobi · Mombasa · Kampala · Dar</p>
        </div>
        {activeCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" />
            {activeCount} moving
          </span>
        )}
      </div>
    </div>
  );
}

export default function ShipperDashboard() {
  const { format } = useCurrency();
  const user = useAuthStore((s) => s.user);

  const { data: loadsData } = useQuery({
    queryKey: ["shipper-loads"],
    queryFn: () => apiClient.get("/loads/mine", { params: { page: 1, page_size: 50 } }).then((r) => r.data),
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiClient.get("/payments/wallet").then((r) => r.data),
  });

  const loads = loadsData?.items || [];

  const activeLoads = useMemo(() =>
    loads.filter((l) => ["booked", "en_route_pickup", "loaded", "in_transit", "available"].includes(l.status)),
    [loads]
  );
  const inTransit = useMemo(() => loads.filter((l) => l.status === "in_transit"), [loads]);
  const awaitingBids = useMemo(() => loads.filter((l) => l.status === "available"), [loads]);
  const delivered = useMemo(() => loads.filter((l) => l.status === "delivered"), [loads]);
  const totalSpend = useMemo(() => delivered.reduce((s, l) => s + (l.price_kes || 0), 0), [delivered]);

  const recentLoads = loads.slice(0, 6);

  return (
    <div className="w-full">
      {/* Greeting header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">
            {greeting(user?.full_name)}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Here's what's happening with your shipments today.
          </p>
        </div>
        <Link
          to="/shipper/post-load"
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.3)]"
        >
          <PackagePlus className="w-4 h-4" /> Post a Load
        </Link>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Loads"
          value={activeLoads.length}
          sub={`${inTransit.length} in transit`}
          icon={Truck}
          topColor="bg-secondary"
          trend={activeLoads.length > 0 ? "up" : null}
          trendLabel={activeLoads.length > 0 ? "Active" : ""}
        />
        <MetricCard
          label="Awaiting Bids"
          value={awaitingBids.length}
          sub="open on marketplace"
          icon={Package}
          topColor="bg-amber-400"
          trend={awaitingBids.length > 0 ? "up" : null}
          trendLabel={awaitingBids.length > 0 ? "Pending" : ""}
        />
        <MetricCard
          label="Wallet Balance"
          value={wallet ? format(wallet.balance_kes ?? wallet.balance ?? 0, wallet.currency || "KES") : "—"}
          sub="available funds"
          icon={Wallet}
          topColor="bg-[#4fdbcc]"
        />
        <MetricCard
          label="Deliveries"
          value={delivered.length}
          sub={delivered.length > 0 ? `${format(totalSpend)} total` : "none yet"}
          icon={CheckCircle2}
          topColor="bg-primary"
          trend={delivered.length > 0 ? "up" : null}
          trendLabel={delivered.length > 0 ? "Completed" : ""}
        />
      </div>

      {/* ── Attention banner if loads need action ── */}
      {awaitingBids.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-6">
          <Zap className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium flex-1">
            <span className="font-bold">{awaitingBids.length} load{awaitingBids.length > 1 ? "s" : ""}</span> waiting for carrier bids. Check the comparison view to accept the best offer.
          </p>
          <Link to="/shipper/shipments"
            className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 shrink-0">
            Review <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Shipments table — 8 cols */}
        <section className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h2 className="font-heading font-semibold text-slate-900">Recent Shipments</h2>
              <Link to="/shipper/shipments"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-secondary transition-colors uppercase tracking-wider">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentLoads.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium mb-1">No shipments yet</p>
                <p className="text-slate-400 text-sm mb-5">Post your first load to start moving freight.</p>
                <Link to="/shipper/post-load"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                  <PackagePlus className="w-4 h-4" /> Post a Load
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Load ID / Route</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Cargo</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Value</th>
                      <th className="py-3 px-4 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLoads.map((load) => {
                      const cfg = STATUS_CONFIG[load.status];
                      return (
                        <tr key={load.id} className="group hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dot || "bg-slate-300"}`} />
                              <span className="font-mono text-xs font-bold text-primary tracking-wide">
                                TRK-{load.id.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 ml-4">
                              <span className="truncate max-w-[80px]">{load.pickup_location.split(",")[0]}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[80px]">{load.dropoff_location.split(",")[0]}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-600 capitalize hidden sm:table-cell">
                            {load.cargo_type}
                            <span className="block text-xs text-slate-400">{load.weight_tonnes}t</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusPill status={load.status} />
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-slate-900 whitespace-nowrap">
                            {format(load.price_kes)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                              <Link to={`/shipper/bids/${load.id}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-secondary hover:bg-slate-100 transition-colors">
                                <Eye className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right sidebar — 4 cols */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          {/* Quick actions */}
          <div className="bg-slate-900 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="font-heading font-semibold text-white">Quick Actions</h3>
              <p className="text-slate-500 text-xs mt-0.5">Most common tasks at a glance</p>
            </div>
            <div className="p-4 space-y-2">
              {[
                { to: "/shipper/post-load",  icon: PackagePlus,  label: "Post New Load",     sub: "Create a new freight order"   },
                { to: "/shipper/tracking",   icon: Navigation2,  label: "Live Tracking",     sub: "Track active shipments"       },
                { to: "/shipper/history",    icon: History,      label: "Shipment History",  sub: "View completed deliveries"    },
                { to: "/shipper/wallet",     icon: Wallet,       label: "Wallet",            sub: wallet ? format(wallet.balance_kes ?? wallet.balance ?? 0, wallet.currency || "KES") : "—" },
              ].map(({ to, icon: Icon, label, sub }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                    <Icon className="w-4 h-4 text-slate-300 group-hover:text-secondary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-400 truncate">{sub}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Live network mini-map */}
          <div className="h-48 rounded-xl overflow-hidden">
            <LiveNetworkMap activeCount={inTransit.length} />
          </div>

          {/* In-transit summary */}
          {inTransit.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4fdbcc] animate-pulse" />
                  Currently Moving
                </h4>
                <span className="text-xs text-slate-400">{inTransit.length} truck{inTransit.length > 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {inTransit.slice(0, 3).map((load) => (
                  <Link key={load.id} to={`/shipper/bids/${load.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold text-primary">TRK-{load.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-slate-400 truncate">{load.pickup_location.split(",")[0]} → {load.dropoff_location.split(",")[0]}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-secondary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Onboarding tip if no loads */}
          {loads.length === 0 && (
            <div className="bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-secondary" />
                <p className="text-sm font-semibold text-slate-800">Getting started</p>
              </div>
              <ol className="space-y-2">
                {[
                  "Post your first load with pickup & drop-off",
                  "Carriers on the marketplace will bid on it",
                  "Compare bids and accept the best offer",
                  "Track your shipment in real-time",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-secondary text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
