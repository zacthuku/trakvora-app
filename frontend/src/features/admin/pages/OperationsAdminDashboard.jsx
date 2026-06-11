import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Truck, Package, Navigation2, Clock, AlertTriangle,
  WifiOff, Users, CheckCircle2, XCircle,
  ArrowRight, Flame, Snowflake, ShieldAlert, Activity,
  RefreshCw, ChevronDown, ChevronUp, Map,
  TrendingDown, Globe, Zap,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const safe     = (fn) => fn().catch(() => ({ items: [], total: 0 }));
const safePlain = (fn) => fn().catch(() => ({}));

function ageHours(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso)) / 3_600_000;
}

function fmtAge(iso) {
  if (!iso) return "—";
  const m = (Date.now() - new Date(iso)) / 60_000;
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${Math.floor(h / 24)}d`;
}

const CROSS_BORDER_KW = ["kampala", "uganda", "dar", "tanzania", "arusha", "namanga", "kigali", "rwanda", "rusumo", "malaba", "busia", "mombasa-kampala"];

function isCrossBorder(corridor) {
  if (!corridor) return false;
  const low = corridor.toLowerCase();
  return CROSS_BORDER_KW.some((kw) => low.includes(kw));
}

function priorityScore(load) {
  let score = 0;
  if (load.cargo_type === "hazardous")    score += 100;
  if (load.cargo_type === "refrigerated") score += 80;
  if (load.requires_insurance)            score += 30;
  if (isCrossBorder(load.corridor))       score += 20;
  score += Math.min(ageHours(load.created_at) * 2, 60);
  return score;
}

function delayEstimate(shipment) {
  const h = ageHours(shipment.last_seen_at ?? shipment.created_at);
  if (h < 4) return null;
  const extra = Math.round((h - 4) * 0.6);
  if (extra < 1) return "~30m late";
  return `~${extra}h late`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD       = "bg-slate-900 border border-slate-800 rounded-xl";
const SEC_HEADER = "text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, to, urgent }) {
  const inner = (
    <div className={`${CARD} p-4 hover:border-slate-700 transition-all ${urgent ? "border-red-800/60" : ""} ${to ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      </div>
      <p className="text-2xl font-black text-white font-heading">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function CargoBadge({ type }) {
  if (type === "hazardous") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
      <Flame className="w-2.5 h-2.5" /> Hazmat
    </span>
  );
  if (type === "refrigerated") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
      <Snowflake className="w-2.5 h-2.5" /> Cold Chain
    </span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400 border border-slate-600 shrink-0 capitalize">
      {type || "General"}
    </span>
  );
}

function PriorityDot({ score }) {
  if (score >= 100) return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-0.5" title="Critical" />;
  if (score >= 80)  return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-0.5" title="High" />;
  if (score >= 40)  return <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-0.5" title="Normal" />;
  return <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0 mt-0.5" title="Low" />;
}

function FlowStep({ label, count, colorCard, colorIcon, icon: Icon }) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border flex-1 min-w-0 ${count > 0 ? colorCard : "bg-slate-900 border-slate-800"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorIcon}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-black text-white font-heading">{count}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 font-heading text-center leading-tight">{label}</p>
    </div>
  );
}

// ── Regional border crossing data ─────────────────────────────────────────────

const REGIONAL_BORDERS = {
  kenya: {
    label: "Kenya", flag: "🇰🇪",
    accent: { dot: "bg-green-400", tab: "text-green-400 border-green-500 bg-green-900/20", summary: "bg-green-900/20 border-green-800/50 text-green-400" },
    crossings: [
      { id: "malaba-ke",  name: "Malaba",      route: "KE ↔ UG", avg_hours: 6.5,  kws: ["malaba", "kampala", "uganda"] },
      { id: "busia-ke",   name: "Busia",        route: "KE ↔ UG", avg_hours: 5.5,  kws: ["busia"] },
      { id: "namanga-ke", name: "Namanga",      route: "KE ↔ TZ", avg_hours: 4.0,  kws: ["namanga", "arusha", "moshi"] },
      { id: "isebania",   name: "Isebania",     route: "KE ↔ TZ", avg_hours: 5.0,  kws: ["isebania", "sirare"] },
      { id: "taveta",     name: "Taveta",        route: "KE ↔ TZ", avg_hours: 3.5,  kws: ["taveta", "holili"] },
      { id: "lungalunga", name: "Lungalunga",   route: "KE ↔ TZ", avg_hours: 4.5,  kws: ["lungalunga", "horohoro"] },
      { id: "moyale-ke",  name: "Moyale",        route: "KE ↔ ET", avg_hours: 12.0, kws: ["moyale", "ethiopia", "addis"] },
    ],
  },
  uganda: {
    label: "Uganda", flag: "🇺🇬",
    accent: { dot: "bg-yellow-400", tab: "text-yellow-400 border-yellow-500 bg-yellow-900/20", summary: "bg-yellow-900/20 border-yellow-800/50 text-yellow-400" },
    crossings: [
      { id: "malaba-ug",   name: "Malaba",      route: "UG ↔ KE", avg_hours: 6.5,  kws: ["malaba", "kampala", "eldoret"] },
      { id: "busia-ug",    name: "Busia",        route: "UG ↔ KE", avg_hours: 5.5,  kws: ["busia"] },
      { id: "mutukula-ug", name: "Mutukula",    route: "UG ↔ TZ", avg_hours: 7.0,  kws: ["mutukula", "kyotera"] },
      { id: "katuna",      name: "Katuna",        route: "UG ↔ RW", avg_hours: 3.0,  kws: ["katuna", "gatuna", "kabale"] },
      { id: "cyanika",     name: "Cyanika",      route: "UG ↔ RW", avg_hours: 3.5,  kws: ["cyanika", "kisoro"] },
      { id: "nimule",      name: "Nimule",        route: "UG ↔ SS", avg_hours: 10.0, kws: ["nimule", "south sudan", "juba"] },
    ],
  },
  tanzania: {
    label: "Tanzania", flag: "🇹🇿",
    accent: { dot: "bg-blue-400", tab: "text-blue-400 border-blue-500 bg-blue-900/20", summary: "bg-blue-900/20 border-blue-800/50 text-blue-400" },
    crossings: [
      { id: "namanga-tz",  name: "Namanga",      route: "TZ ↔ KE", avg_hours: 4.0,  kws: ["namanga"] },
      { id: "sirare",      name: "Sirare",        route: "TZ ↔ KE", avg_hours: 5.0,  kws: ["sirare", "isebania"] },
      { id: "mutukula-tz", name: "Mutukula",    route: "TZ ↔ UG", avg_hours: 7.0,  kws: ["mutukula"] },
      { id: "rusumo-tz",   name: "Rusumo",        route: "TZ ↔ RW", avg_hours: 8.0,  kws: ["rusumo", "rwanda", "kigali"] },
      { id: "tunduma",     name: "Tunduma",      route: "TZ ↔ ZM", avg_hours: 9.5,  kws: ["tunduma", "zambia", "lusaka"] },
      { id: "kobero-tz",   name: "Kobero",        route: "TZ ↔ BI", avg_hours: 7.5,  kws: ["kobero", "burundi", "bujumbura"] },
      { id: "kasumulu",    name: "Kasumulu",    route: "TZ ↔ MW", avg_hours: 8.0,  kws: ["kasumulu", "malawi", "blantyre"] },
    ],
  },
  rwanda: {
    label: "Rwanda", flag: "🇷🇼",
    accent: { dot: "bg-indigo-400", tab: "text-indigo-400 border-indigo-500 bg-indigo-900/20", summary: "bg-indigo-900/20 border-indigo-800/50 text-indigo-400" },
    crossings: [
      { id: "rusumo-rw",   name: "Rusumo",        route: "RW ↔ TZ", avg_hours: 8.0, kws: ["rusumo"] },
      { id: "gatuna",      name: "Gatuna",          route: "RW ↔ UG", avg_hours: 3.0, kws: ["gatuna", "katuna", "kabale"] },
      { id: "kagitumba",   name: "Kagitumba",    route: "RW ↔ UG", avg_hours: 4.5, kws: ["kagitumba"] },
      { id: "nemba-rw",    name: "Nemba",            route: "RW ↔ BI", avg_hours: 5.0, kws: ["nemba", "burundi"] },
      { id: "cyanika-rw",  name: "Cyanika",        route: "RW ↔ UG", avg_hours: 3.5, kws: ["cyanika"] },
    ],
  },
  burundi: {
    label: "Burundi", flag: "🇧🇮",
    accent: { dot: "bg-rose-400", tab: "text-rose-400 border-rose-500 bg-rose-900/20", summary: "bg-rose-900/20 border-rose-800/50 text-rose-400" },
    crossings: [
      { id: "kobero-bi",   name: "Kobero",        route: "BI ↔ TZ", avg_hours: 7.5, kws: ["kobero", "tanzania"] },
      { id: "nemba-bi",    name: "Nemba",          route: "BI ↔ RW", avg_hours: 5.0, kws: ["nemba", "rwanda"] },
      { id: "kanyaru",     name: "Kanyaru",        route: "BI ↔ RW", avg_hours: 4.5, kws: ["kanyaru"] },
      { id: "gatumba",     name: "Gatumba",        route: "BI ↔ DRC",avg_hours: 9.0, kws: ["gatumba", "drc", "congo"] },
    ],
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

const Q = { staleTime: 30_000, refetchInterval: 60_000 };

export default function OperationsAdminDashboard() {
  const [expandedLoad, setExpandedLoad]       = useState(null);
  const [showAllQueue, setShowAllQueue]       = useState(false);
  const [showAllProblems, setShowAllProblems] = useState(false);
  const [activeRegion, setActiveRegion]       = useState("all");

  const { data: shipmentsRaw, isLoading } = useQuery({
    queryKey: ["ops-shipments"],
    queryFn: () => safe(() => adminApi.getShipments({ limit: 200 })),
    ...Q,
  });
  const { data: loadsRaw } = useQuery({
    queryKey: ["ops-loads"],
    queryFn: () => safe(() => adminApi.getLoads({ limit: 200 })),
    ...Q,
  });
  const { data: driversRaw } = useQuery({
    queryKey: ["ops-drivers"],
    queryFn: () => safe(() => adminApi.getDrivers({ limit: 200 })),
    ...Q,
  });
  const { data: trucksRaw } = useQuery({
    queryKey: ["ops-trucks"],
    queryFn: () => safe(() => adminApi.getTrucks({ limit: 200 })),
    ...Q,
  });
  const { data: fleetPositions } = useQuery({
    queryKey: ["ops-fleet"],
    queryFn: () => safePlain(() => adminApi.getActiveFleetPositions()),
    ...Q,
  });

  // ── Derived state ───────────────────────────────────────────────────────────

  const allShipments = useMemo(() => shipmentsRaw?.items ?? [], [shipmentsRaw]);
  const allLoads     = useMemo(() => loadsRaw?.items ?? [], [loadsRaw]);
  const allDrivers   = useMemo(() => driversRaw?.items ?? [], [driversRaw]);
  const allTrucks    = useMemo(() => trucksRaw?.items ?? [], [trucksRaw]);

  // Today's ops stat cards
  const activeShipments  = useMemo(() => allShipments.filter(s => ["en_route_pickup", "loaded", "in_transit"].includes(s.status)), [allShipments]);
  const awaitingDispatch = useMemo(() => allLoads.filter(l => ["available", "bidding"].includes(l.status)), [allLoads]);
  const pickupArrivals   = useMemo(() => allShipments.filter(s => s.status === "en_route_pickup"), [allShipments]);
  const delayed          = useMemo(() => allShipments.filter(s => s.status === "in_transit" && ageHours(s.last_seen_at ?? s.created_at) > 4), [allShipments]);
  const borderHolds      = useMemo(() => allLoads.filter(l => isCrossBorder(l.corridor) && ["available", "bidding", "booked"].includes(l.status)), [allLoads]);

  // Problem shipments
  const noGPS          = useMemo(() => allShipments.filter(s => s.status === "in_transit" && !s.last_seen_at), [allShipments]);
  const driverInactive = useMemo(() => allShipments.filter(s => s.status === "in_transit" && s.last_seen_at && ageHours(s.last_seen_at) > 4), [allShipments]);
  const disputes       = useMemo(() => allShipments.filter(s => s.dispute_open), [allShipments]);

  // Priority-sorted dispatch queue
  const dispatchQueue = useMemo(() =>
    [...awaitingDispatch].sort((a, b) => priorityScore(b) - priorityScore(a)),
    [awaitingDispatch]);

  // Driver buckets
  const availableDrivers = useMemo(() => allDrivers.filter(d => d.availability_status === "available" && d.verification_status === "verified"), [allDrivers]);
  const assignedDrivers  = useMemo(() => allDrivers.filter(d => ["busy", "on_trip"].includes(d.availability_status)), [allDrivers]);
  const restingDrivers   = useMemo(() => allDrivers.filter(d => d.availability_status === "resting"), [allDrivers]);
  const suspendedDrivers = useMemo(() => allDrivers.filter(d => ["suspended", "rejected"].includes(d.verification_status)), [allDrivers]);

  // Load flow pipeline
  const flowCounts = useMemo(() => ({
    awaiting:  allLoads.filter(l => ["available", "bidding"].includes(l.status)).length,
    loaded:    allShipments.filter(s => s.status === "loaded").length,
    transit:   allShipments.filter(s => s.status === "in_transit").length,
    delivered: allShipments.filter(s => s.status === "delivered").length,
  }), [allLoads, allShipments]);

  // Available trucks for dispatch suggestions
  const availableTrucks = useMemo(() =>
    allTrucks.filter(t => t.is_active && t.is_verified && t.inspection_status !== "rejected").slice(0, 6),
    [allTrucks]);

  // Regional border data — each crossing gets a live load count
  const regionBorderData = useMemo(() => {
    const countFor = (kws) =>
      allLoads.filter(l => kws.some(kw => (l.corridor ?? "").toLowerCase().includes(kw))).length;
    return Object.fromEntries(
      Object.entries(REGIONAL_BORDERS).map(([key, region]) => [
        key,
        {
          ...region,
          crossings: region.crossings.map(c => ({ ...c, count: countFor(c.kws) })),
          get totalLoads() { return this.crossings.reduce((s, c) => s + c.count, 0); },
          get activeCount() { return this.crossings.filter(c => c.count > 0).length; },
        },
      ])
    );
  }, [allLoads]);

  // De-duplicated problem list
  const allProblems = useMemo(() => {
    const seen = new Set();
    return [...delayed, ...noGPS, ...disputes].filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id); return true;
    });
  }, [delayed, noGPS, disputes]);

  const shownQueue    = showAllQueue    ? dispatchQueue : dispatchQueue.slice(0, 6);
  const shownProblems = showAllProblems ? allProblems   : allProblems.slice(0, 5);

  const livePositions = Array.isArray(fleetPositions) ? fleetPositions.length
    : (fleetPositions?.positions?.length ?? 0);

  if (isLoading && allShipments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const timeStr = new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white font-heading">Operations Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dateStr} · {timeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/fleet-map"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white transition-colors text-xs font-semibold font-heading">
            <Map className="w-3.5 h-3.5" /> Fleet Map
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <RefreshCw className="w-3 h-3 animate-spin [animation-duration:4s]" />
            <span>60s</span>
          </div>
        </div>
      </div>

      {/* ── TODAY'S OPERATIONS ── */}
      <section>
        <p className={`${SEC_HEADER} mb-3`}>Today's Operations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            icon={Navigation2} label="Active Shipments" value={activeShipments.length}
            sub={`${pickupArrivals.length} en route pickup`}
            color="bg-blue-900/50 text-blue-400" to="/admin/shipments"
          />
          <StatCard
            icon={Package} label="Awaiting Dispatch" value={awaitingDispatch.length}
            sub="needs truck assignment"
            color="bg-amber-900/50 text-amber-400" to="/admin/loads"
            urgent={awaitingDispatch.length > 0}
          />
          <StatCard
            icon={Truck} label="Pickup Arrivals" value={pickupArrivals.length}
            sub="trucks en route"
            color="bg-violet-900/50 text-violet-400"
          />
          <StatCard
            icon={Clock} label="Delayed" value={delayed.length}
            sub={delayed.length > 0 ? "GPS dark >4h" : "all on time"}
            color="bg-red-900/50 text-red-400"
            urgent={delayed.length > 0}
          />
          <StatCard
            icon={Globe} label="Border Holds" value={borderHolds.length}
            sub="cross-border loads"
            color="bg-teal-900/50 text-teal-400"
          />
        </div>
      </section>

      {/* ── DISPATCH QUEUE + DRIVER AVAILABILITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dispatch Queue — priority sorted */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className={SEC_HEADER}>Dispatch Queue</p>
            <span className="text-[10px] text-amber-400 font-heading font-bold">
              {dispatchQueue.length} unassigned · sorted by urgency
            </span>
          </div>

          <div className={`${CARD} divide-y divide-slate-800`}>
            {dispatchQueue.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">All loads dispatched</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[12px_1fr_auto_auto_56px] gap-3 px-4 py-2">
                  <div />
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Load / Route</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Type</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Age</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Action</p>
                </div>

                {shownQueue.map((load) => {
                  const score      = priorityScore(load);
                  const isExpanded = expandedLoad === load.id;
                  const from       = load.pickup_location?.split(",")[0] ?? "?";
                  const to_        = load.dropoff_location?.split(",")[0] ?? "?";

                  return (
                    <div key={load.id}>
                      <div
                        className="grid grid-cols-[12px_1fr_auto_auto_56px] gap-3 items-center px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setExpandedLoad(isExpanded ? null : load.id)}
                      >
                        <PriorityDot score={score} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white font-heading truncate">{from} → {to_}</p>
                          {load.corridor && (
                            <p className="text-[10px] text-violet-400 truncate">{load.corridor}</p>
                          )}
                          <p className="text-[10px] text-slate-600 font-data-mono">
                            {load.weight_tonnes ? `${load.weight_tonnes}t` : ""}
                            {load.requires_insurance ? " · insured" : ""}
                            {isCrossBorder(load.corridor) ? " · cross-border" : ""}
                          </p>
                        </div>
                        <CargoBadge type={load.cargo_type} />
                        <span className="text-[10px] text-slate-400 shrink-0">{fmtAge(load.created_at)}</span>
                        <Link
                          to="/admin/loads"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 font-heading uppercase tracking-widest shrink-0 flex items-center justify-end gap-0.5"
                        >
                          Assign <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      </div>

                      {/* Nearby truck suggestions */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-slate-800/30 border-t border-slate-800/60">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Suggested Trucks: Available &amp; Compliant
                          </p>
                          {availableTrucks.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">No verified trucks available right now</p>
                          ) : (
                            <div className="space-y-1.5">
                              {availableTrucks.map((truck) => (
                                <div key={truck.id} className="flex items-center justify-between gap-3 bg-slate-800 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="text-xs font-bold text-white font-data-mono">
                                      {truck.plate ?? `TRK-${String(truck.id ?? "").slice(0, 6).toUpperCase()}`}
                                    </span>
                                    {truck.cargo_type && (
                                      <span className="text-[9px] text-slate-500 capitalize">{truck.cargo_type}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {truck.inspection_status === "approved" && (
                                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                        Compliant
                                      </span>
                                    )}
                                    <Link
                                      to="/admin/trucks"
                                      className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                                    >
                                      Assign
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {dispatchQueue.length > 6 && (
                  <button
                    onClick={() => setShowAllQueue(v => !v)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors font-heading"
                  >
                    {showAllQueue
                      ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                      : <><ChevronDown className="w-3.5 h-3.5" /> {dispatchQueue.length - 6} more loads</>}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Driver Availability */}
        <section>
          <p className={`${SEC_HEADER} mb-3`}>Driver Availability</p>
          <div className={`${CARD} p-5 space-y-4`}>
            {[
              { label: "Available",  count: availableDrivers.length,  dot: "bg-emerald-400", value_color: "text-emerald-400", sub: "ready to dispatch" },
              { label: "Assigned",   count: assignedDrivers.length,   dot: "bg-blue-400",    value_color: "text-blue-400",    sub: "on active trips" },
              { label: "Resting",    count: restingDrivers.length,    dot: "bg-amber-400",   value_color: "text-amber-400",   sub: "off-duty / HOS rest" },
              { label: "Suspended",  count: suspendedDrivers.length,  dot: "bg-red-400",     value_color: "text-red-400",     sub: "blocked or rejected" },
            ].map(({ label, count, dot, value_color, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 text-right">
                  <span className={`text-lg font-black font-heading ${value_color}`}>{count}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    <p className="text-xs font-bold text-white font-heading">{label}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
                </div>
                {count > 0 && (
                  <Link to="/admin/drivers" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors shrink-0">View →</Link>
                )}
              </div>
            ))}

            {/* Stacked bar */}
            {allDrivers.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-500">Total drivers</p>
                  <p className="text-sm font-bold text-white font-heading">{allDrivers.length}</p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${(availableDrivers.length / allDrivers.length) * 100}%` }} />
                  <div className="h-full bg-blue-500"    style={{ width: `${(assignedDrivers.length  / allDrivers.length) * 100}%` }} />
                  <div className="h-full bg-amber-500"   style={{ width: `${(restingDrivers.length   / allDrivers.length) * 100}%` }} />
                  <div className="h-full bg-red-500"     style={{ width: `${(suspendedDrivers.length / allDrivers.length) * 100}%` }} />
                </div>
              </div>
            )}

            <Link to="/admin/drivers"
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
              Manage Drivers
            </Link>
          </div>
        </section>
      </div>

      {/* ── PROBLEM SHIPMENTS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className={SEC_HEADER}>Problem Shipments</p>
          {allProblems.length > 0 && (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
              {allProblems.length} require attention
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Delayed",         count: delayed.length,         icon: Clock,        cls: "bg-red-900/40 border-red-800/60 text-red-400" },
            { label: "No GPS Signal",   count: noGPS.length,           icon: WifiOff,      cls: "bg-amber-900/40 border-amber-800/60 text-amber-400" },
            { label: "Open Disputes",   count: disputes.length,        icon: ShieldAlert,  cls: "bg-orange-900/40 border-orange-800/60 text-orange-400" },
            { label: "Driver Inactive", count: driverInactive.length,  icon: Users,        cls: "bg-slate-800 border-slate-700 text-slate-400" },
          ].map(({ label, count, icon: Icon, cls }) => (
            <div key={label} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cls}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <div>
                <p className="text-xl font-black font-heading">{count}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold leading-tight mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {allProblems.length > 0 ? (
          <div className={`${CARD} divide-y divide-slate-800`}>
            {shownProblems.map((sh) => {
              const isDelayed = delayed.some(d => d.id === sh.id);
              const isNoGPS   = noGPS.some(d => d.id === sh.id);
              const isDispute = disputes.some(d => d.id === sh.id);
              const est       = isDelayed ? delayEstimate(sh) : null;
              const from      = sh.pickup_location?.split(",")[0] ?? "?";
              const to_       = sh.dropoff_location?.split(",")[0] ?? "?";

              return (
                <div key={sh.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    {isDelayed  && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                    {isNoGPS    && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    {isDispute  && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{from} → {to_}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {isDelayed  && <span className="text-[10px] text-red-400 font-bold">{est ?? "Delayed"}</span>}
                      {isNoGPS    && <span className="text-[10px] text-amber-400 font-bold">No GPS</span>}
                      {isDispute  && <span className="text-[10px] text-orange-400 font-bold">Dispute open</span>}
                      {sh.corridor && <span className="text-[10px] text-slate-600">{sh.corridor}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500">{fmtAge(sh.last_seen_at ?? sh.created_at)}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      sh.status === "in_transit" ? "text-blue-400" : "text-slate-400"
                    }`}>{sh.status?.replace(/_/g, " ")}</p>
                  </div>
                  <Link to="/admin/shipments"
                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest font-heading shrink-0">
                    Act
                  </Link>
                </div>
              );
            })}
            {allProblems.length > 5 && (
              <button
                onClick={() => setShowAllProblems(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors font-heading"
              >
                {showAllProblems
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> {allProblems.length - 5} more</>}
              </button>
            )}
          </div>
        ) : (
          <div className={`${CARD} p-8 text-center`}>
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400">No problem shipments. Fleet running smoothly.</p>
          </div>
        )}
      </section>

      {/* ── LOAD FLOW ── */}
      <section>
        <p className={`${SEC_HEADER} mb-3`}>Load Flow</p>
        <div className="flex gap-2 items-stretch">
          <FlowStep label="Awaiting Pickup" count={flowCounts.awaiting}  icon={Package}      colorCard="bg-amber-900/20 border-amber-800/50"    colorIcon="bg-amber-900/50 text-amber-400" />
          <div className="flex items-center text-slate-700 shrink-0 self-center pb-5"><ArrowRight className="w-3 h-3" /></div>
          <FlowStep label="Loaded"          count={flowCounts.loaded}    icon={Truck}        colorCard="bg-violet-900/20 border-violet-800/50"  colorIcon="bg-violet-900/50 text-violet-400" />
          <div className="flex items-center text-slate-700 shrink-0 self-center pb-5"><ArrowRight className="w-3 h-3" /></div>
          <FlowStep label="In Transit"      count={flowCounts.transit}   icon={Navigation2}  colorCard="bg-blue-900/20 border-blue-800/50"      colorIcon="bg-blue-900/50 text-blue-400" />
          <div className="flex items-center text-slate-700 shrink-0 self-center pb-5"><ArrowRight className="w-3 h-3" /></div>
          <FlowStep label="Delivered"       count={flowCounts.delivered} icon={CheckCircle2} colorCard="bg-emerald-900/20 border-emerald-800/50" colorIcon="bg-emerald-900/50 text-emerald-400" />
        </div>

        {delayed.length > 0 && (
          <div className="mt-3 bg-red-950/30 border border-red-900/50 rounded-xl px-4 py-3 flex items-start gap-3">
            <TrendingDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">Delay Prediction</p>
              {delayed.slice(0, 3).map((s) => (
                <p key={s.id} className="text-[11px] text-slate-400 leading-relaxed">
                  · {s.pickup_location?.split(",")[0] ?? "?"} → {s.dropoff_location?.split(",")[0] ?? "?"}: <span className="text-red-300 font-semibold">{delayEstimate(s) ?? "status unknown"}</span>
                </p>
              ))}
              {delayed.length > 3 && (
                <p className="text-[10px] text-slate-600 mt-1">+{delayed.length - 3} more delayed</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── BORDER INTELLIGENCE ── */}
      <section>
        {/* Header + region tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-3 shrink-0">
            <p className={SEC_HEADER}>Border Intelligence</p>
            <span className="text-[10px] text-teal-400 font-heading font-bold">
              {Object.values(regionBorderData).reduce((s, r) => s + r.crossings.length, 0)} crossings monitored
            </span>
          </div>
          {/* Tab pills */}
          <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
            <button
              onClick={() => setActiveRegion("all")}
              className={`px-3 py-1 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest border transition-all ${
                activeRegion === "all"
                  ? "bg-teal-900/30 border-teal-600 text-teal-400"
                  : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              All Regions
            </button>
            {Object.entries(REGIONAL_BORDERS).map(([key, region]) => {
              const rd = regionBorderData[key];
              const isActive = activeRegion === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveRegion(key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest border transition-all ${
                    isActive ? region.accent.tab : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <span>{region.flag}</span>
                  <span>{region.label}</span>
                  {rd.totalLoads > 0 && (
                    <span className={`ml-0.5 px-1 rounded-full text-[9px] font-black ${isActive ? "" : "bg-amber-500/20 text-amber-400"}`}>
                      {rd.totalLoads}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* All Regions — summary grid */}
        {activeRegion === "all" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(regionBorderData).map(([key, region]) => (
              <button
                key={key}
                onClick={() => setActiveRegion(key)}
                className={`${CARD} p-4 text-left hover:border-slate-700 transition-all group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl leading-none">{region.flag}</span>
                  {region.totalLoads > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Zap className="w-2 h-2" />{region.totalLoads}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white font-heading">{region.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{region.crossings.length} crossings</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${region.totalLoads > 0 ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
                  <p className={`text-[10px] font-bold ${region.totalLoads > 0 ? "text-amber-400" : "text-slate-600"}`}>
                    {region.totalLoads > 0 ? `${region.activeCount} active` : "All clear"}
                  </p>
                </div>
                <p className="text-[9px] text-slate-600 mt-1 group-hover:text-slate-500 transition-colors">View crossings →</p>
              </button>
            ))}
          </div>
        )}

        {/* Region detail — crossings table */}
        {activeRegion !== "all" && regionBorderData[activeRegion] && (() => {
          const region = regionBorderData[activeRegion];
          return (
            <div className={`${CARD} overflow-hidden`}>
              {/* Region header */}
              <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{region.flag}</span>
                  <p className="text-sm font-bold text-white font-heading">{region.label} Border Crossings</p>
                  <span className="text-[10px] text-slate-500">{region.crossings.length} monitored</span>
                </div>
                {region.totalLoads > 0 && (
                  <span className="text-[10px] font-bold text-amber-400">
                    {region.totalLoads} total loads across crossings
                  </span>
                )}
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-4 px-4 py-2 border-b border-slate-800">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Crossing</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Route</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Avg Time</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Loads</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Status</p>
              </div>

              {region.crossings.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-4 items-center px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <p className="text-xs font-bold text-white font-heading truncate">{c.name}</p>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded font-heading whitespace-nowrap">
                    {c.route}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    ~{c.avg_hours}h
                  </span>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${c.count > 0 ? "text-amber-400" : "text-slate-600"}`}>
                    {c.count > 0 ? `${c.count} loads` : "—"}
                  </span>
                  <div className="flex justify-end">
                    {c.count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-400 whitespace-nowrap">
                        <Zap className="w-2 h-2" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600">Clear</span>
                    )}
                  </div>
                </div>
              ))}

              <div className="px-4 py-2.5 bg-slate-800/20 border-t border-slate-800">
                <p className="text-[10px] text-slate-600 italic">
                  Avg crossing times are corridor estimates. Real-time queue requires TMEA / {region.label.toUpperCase().slice(0, 2)}RA integration.
                </p>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── FLEET MAP SHORTCUT ── */}
      <section className={`${CARD} p-5 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-800/50 flex items-center justify-center shrink-0">
            <Map className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-heading">Live Fleet Map</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {livePositions > 0 ? `${livePositions} trucks broadcasting position` : `${allTrucks.filter(t => t.is_active).length} active trucks in fleet`} · real-time GPS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {allTrucks.filter(t => t.is_active).length} active
          </div>
          <Link to="/admin/fleet-map"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-colors font-heading">
            Open Map <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

    </div>
  );
}
