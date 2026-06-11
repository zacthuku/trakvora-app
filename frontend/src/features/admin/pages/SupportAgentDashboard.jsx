import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search, AlertCircle, Clock, CheckCircle2, Navigation2,
  WifiOff, CreditCard, Phone, ExternalLink, Copy,
  AlertTriangle, Package, ChevronRight, User, Flag,
  Truck, ArrowRight, Activity, Bell, MessageSquare,
  RefreshCw, XCircle,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/Toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const Q = { refetchInterval: 60_000, staleTime: 30_000 };
const safe = (fn) => fn().catch(() => ({ items: [] }));
const safePlain = (fn) => fn().catch(() => ({}));
const toArray = (raw) => raw?.items ?? (Array.isArray(raw) ? raw : []);

function timeSince(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ageHours(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso)) / 3600000;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  booked:          { label: "Booked",    cls: "bg-violet-500/20 text-violet-400" },
  en_route_pickup: { label: "En Route",  cls: "bg-sky-500/20 text-sky-400" },
  loaded:          { label: "Loaded",    cls: "bg-blue-500/20 text-blue-400" },
  in_transit:      { label: "In Transit",cls: "bg-teal-500/20 text-teal-400" },
  delivered:       { label: "Delivered", cls: "bg-green-500/20 text-green-400" },
  cancelled:       { label: "Cancelled", cls: "bg-red-500/20 text-red-400" },
};

const ACTIVITY_EVENT = {
  bid_received:    { label: "Bid received",    dot: "bg-blue-400",    color: "text-blue-400" },
  bid_accepted:    { label: "Bid accepted",    dot: "bg-green-400",   color: "text-green-400" },
  bid_rejected:    { label: "Bid rejected",    dot: "bg-red-400",     color: "text-red-400" },
  shipment_booked: { label: "Shipment booked", dot: "bg-violet-400",  color: "text-violet-400" },
  in_transit:      { label: "In transit",      dot: "bg-teal-400",    color: "text-teal-400" },
  delivered:       { label: "Delivered",       dot: "bg-emerald-400", color: "text-emerald-400" },
  payment_released:{ label: "Payment released",dot: "bg-amber-400",   color: "text-amber-400" },
  default:         { label: "Event",           dot: "bg-slate-600",   color: "text-slate-400" },
};

const JOURNEY_STEPS = [
  { key: "booked",          label: "Booked",            icon: Package },
  { key: "en_route_pickup", label: "En Route to Pickup", icon: Navigation2 },
  { key: "loaded",          label: "Cargo Loaded",       icon: Truck },
  { key: "in_transit",      label: "In Transit",         icon: Activity },
  { key: "delivered",       label: "Delivered",          icon: CheckCircle2 },
];
const JOURNEY_ORDER = JOURNEY_STEPS.map((s) => s.key);

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading">{children}</h2>
      {right}
    </div>
  );
}

function StatCard({ icon: Icon, count, label, sub, level }) {
  const styles = {
    critical: { card: "border-red-500/30 bg-red-500/10",     icon: "text-red-400",    count: "text-red-300" },
    warning:  { card: "border-amber-500/30 bg-amber-500/10", icon: "text-amber-400",  count: "text-amber-300" },
    info:     { card: "border-sky-500/30 bg-sky-500/10",     icon: "text-sky-400",    count: "text-sky-300" },
    safe:     { card: "border-teal-500/30 bg-teal-500/10",   icon: "text-teal-400",   count: "text-teal-300" },
    neutral:  { card: "border-slate-700 bg-slate-800/60",    icon: "text-slate-500",  count: "text-slate-300" },
  };
  const s = styles[level] ?? styles.neutral;
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${s.card}`}>
      <Icon className={`w-4 h-4 ${s.icon} mb-1`} />
      <div className={`text-3xl font-bold font-mono ${s.count}`}>{count}</div>
      <div className="text-xs font-bold text-white font-heading">{label}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function EscFlag({ text, level }) {
  const cls = level === "critical"
    ? "bg-red-500/20 text-red-400 border-red-500/30"
    : level === "warning"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-violet-500/20 text-violet-400 border-violet-500/30";
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cls}`}>
      {text}
    </span>
  );
}

function CaseRow({ shipment, selected, onSelect }) {
  const age = ageHours(shipment.created_at);
  const isCritical = age >= 48;
  const isUrgent   = age >= 24;
  const ss = STATUS_STYLE[shipment.status] ?? { label: shipment.status, cls: "bg-slate-700 text-slate-400" };

  return (
    <div
      onClick={() => onSelect(shipment)}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0 ${
        selected ? "bg-violet-900/20" : "hover:bg-slate-700/20"
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isCritical ? "bg-red-500" : isUrgent ? "bg-amber-500" : "bg-slate-600"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-bold text-white font-mono">{shipment.id.slice(0, 8).toUpperCase()}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ss.cls}`}>{ss.label}</span>
          {isCritical && <EscFlag text="48h+" level="critical" />}
          {!isCritical && isUrgent && <EscFlag text="Urgent" level="warning" />}
          {shipment.dispute_open && <EscFlag text="Dispute" level="critical" />}
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Driver: {shipment.driver_id?.slice(0, 8) ?? "Unassigned"} · {timeSince(shipment.created_at)}
        </p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
    </div>
  );
}

function QuickActions({ shipment, navigate }) {
  const copyLink = () => {
    const url = `${window.location.origin}/tracking/${shipment.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast("Tracking link copied", "success"))
      .catch(() => toast("Copy failed. Check browser permissions.", "error"));
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={copyLink}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
      >
        <Copy className="w-3.5 h-3.5" /> Copy Tracking
      </button>
      <button
        onClick={() => navigate(`/tracking/${shipment.id}`)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
      >
        <Navigation2 className="w-3.5 h-3.5" /> Live Map
      </button>
      <button
        onClick={() => navigate("/admin/drivers")}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
      >
        <Phone className="w-3.5 h-3.5" /> Contact Driver
      </button>
      <button
        onClick={() => navigate("/admin/shipments")}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Open Shipment
      </button>
      {shipment.dispute_open && (
        <button
          onClick={() => navigate("/admin/shipments")}
          className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-heading font-bold transition-colors"
        >
          <Bell className="w-3.5 h-3.5" /> Escalate to Operations
        </button>
      )}
    </div>
  );
}

function CustomerTimeline({ shipment }) {
  const currentIdx = JOURNEY_ORDER.indexOf(shipment.status);

  return (
    <div className="space-y-2">
      {JOURNEY_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              done ? "bg-teal-500/20 border border-teal-500/50" : "bg-slate-800 border border-slate-700"
            }`}>
              <Icon className={`w-3.5 h-3.5 ${done ? "text-teal-400" : "text-slate-600"}`} />
            </div>
            <span className={`text-xs font-heading flex-1 ${done ? "text-white font-semibold" : "text-slate-600"}`}>
              {step.label}
            </span>
            {done && idx === currentIdx && (
              <span className="text-[9px] font-bold text-teal-400 bg-teal-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Current
              </span>
            )}
          </div>
        );
      })}

      {shipment.dispute_open && (
        <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-400 font-heading">Dispute Open</p>
            <p className="text-[10px] text-slate-500">Requires resolution before payout</p>
          </div>
        </div>
      )}

      {shipment.eta && (
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1">
          <Clock className="w-3 h-3" />
          ETA: <span className={new Date(shipment.eta) < Date.now() && shipment.status !== "delivered" ? "text-red-400 font-bold" : "text-white"}> {/* eslint-disable-line react-hooks/purity */}
            {fmtDate(shipment.eta)}
          </span>
        </p>
      )}
    </div>
  );
}

// ── SLA bar row ───────────────────────────────────────────────────────────────

function SlaRow({ icon: Icon, label, sub, value, level, maxVal }) {
  const colors = {
    critical: { bar: "bg-red-500",   text: "text-red-400",   icon: "text-red-400" },
    warning:  { bar: "bg-amber-500", text: "text-amber-400", icon: "text-amber-400" },
    safe:     { bar: "bg-teal-500",  text: "text-teal-400",  icon: "text-teal-400" },
  };
  const c = colors[level] ?? colors.safe;
  const pct = maxVal > 0 ? Math.min(100, Math.round((value / maxVal) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${c.icon} shrink-0`} />
          <span className="text-xs text-slate-300 font-heading">{label}</span>
        </div>
        <span className={`text-sm font-bold font-mono ${c.text}`}>{value}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-600">{sub}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportAgentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [activeQueue, setActiveQueue] = useState("disputes");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data: shipmentsRaw, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["support-shipments"],
    queryFn: () => safe(() => adminApi.getShipments({ limit: 100 })),
    ...Q,
  });

  const { data: dashRaw } = useQuery({
    queryKey: ["support-dashboard"],
    queryFn: () => safePlain(() => adminApi.getDashboard()),
    ...Q,
  });

  const allShipments = toArray(shipmentsRaw);
  const recentActivity = dashRaw?.recent_activity ?? [];

  // ── Derived ──────────────────────────────────────────────────────────────

  const disputes   = useMemo(() => allShipments.filter((s) => s.dispute_open), [allShipments]);
  const urgent     = useMemo(() => disputes.filter((s) => ageHours(s.created_at) >= 24), [disputes]);
  const critical   = useMemo(() => disputes.filter((s) => ageHours(s.created_at) >= 48), [disputes]);
  const unassigned = useMemo(() => allShipments.filter((s) => !s.driver_id && !["delivered", "cancelled"].includes(s.status)), [allShipments]);
  const gpsOffline = useMemo(() => allShipments.filter((s) => s.status === "in_transit" && s.last_seen_at && ageHours(s.last_seen_at) > 0.5), [allShipments]);
  // eslint-disable-next-line react-hooks/purity
  const nowMs   = Date.now();
  const delayed = useMemo(() => allShipments.filter((s) => s.eta && new Date(s.eta) < nowMs && !["delivered", "cancelled"].includes(s.status)), [allShipments, nowMs]);

  const repeatComplainers = useMemo(() => {
    const counts = {};
    disputes.forEach((s) => { if (s.shipper_id) counts[s.shipper_id] = (counts[s.shipper_id] ?? 0) + 1; });
    return Object.values(counts).filter((c) => c >= 2).length;
  }, [disputes]);

  const queueShipments = useMemo(() => {
    const base = activeQueue === "urgent"     ? urgent
               : activeQueue === "critical"   ? critical
               : activeQueue === "unassigned" ? unassigned
               : disputes;
    return base.slice(0, 20);
  }, [activeQueue, disputes, urgent, critical, unassigned]);

  const searchResults = useMemo(() => {
    if (searchQuery.length < 3) return [];
    const q = searchQuery.toLowerCase();
    return allShipments.filter((s) =>
      s.id?.toLowerCase().includes(q) ||
      s.driver_id?.toLowerCase().includes(q) ||
      s.truck_id?.toLowerCase().includes(q) ||
      s.load_id?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, allShipments]);

  const maxSla = Math.max(10, disputes.length + 2);
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-white font-heading">
            {greeting}, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Support Command · {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
            {lastUpdated && <span className="ml-2 text-slate-600">· Updated {lastUpdated}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-600 animate-spin" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-500 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full font-heading">
            Support Agent
          </span>
        </div>
      </div>

      {/* Panel 1 — Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Bell}          count={critical.length}   label="Critical Cases"    sub="> 48h unresolved"      level={critical.length   > 0 ? "critical" : "safe"} />
        <StatCard icon={AlertTriangle} count={urgent.length}     label="Urgent Cases"      sub="> 24h unresolved"      level={urgent.length     > 0 ? "warning"  : "safe"} />
        <StatCard icon={User}          count={unassigned.length} label="Unassigned"         sub="No driver allocated"   level={unassigned.length > 0 ? "info"     : "safe"} />
        <StatCard icon={MessageSquare} count={disputes.length}   label="Open Disputes"      sub={`${repeatComplainers} repeat complainants`} level={disputes.length > 0 ? "warning" : "safe"} />
      </div>

      {/* Panels 2+3 — Case Queue + Live Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Panel 2 — Case Queue */}
        <div className="lg:col-span-2">
          <SectionHeader
            right={
              <div className="flex gap-1">
                {[
                  { key: "disputes",  label: "Disputes" },
                  { key: "urgent",    label: "Urgent" },
                  { key: "critical",  label: "Critical" },
                  { key: "unassigned",label: "No Driver" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveQueue(tab.key)}
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg font-heading transition-colors ${
                      activeQueue === tab.key
                        ? "bg-violet-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          >
            Open Support Cases
          </SectionHeader>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-700/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : queueShipments.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto mb-2" />
                <p className="text-sm text-teal-400 font-heading font-bold">Queue clear</p>
                <p className="text-[11px] text-slate-600 mt-1">No cases in this category</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {queueShipments.map((s) => (
                  <CaseRow
                    key={s.id}
                    shipment={s}
                    selected={selectedShipment?.id === s.id}
                    onSelect={setSelectedShipment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel 3 — Live Issues */}
        <div>
          <SectionHeader>Live Customer Issues</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-1">
            {[
              { icon: Clock,        label: "Shipment Delays",   count: delayed.length,          level: delayed.length > 0 ? "text-amber-400" : "text-teal-400",   sub: "ETA overdue" },
              { icon: WifiOff,      label: "GPS Offline",       count: gpsOffline.length,       level: gpsOffline.length > 0 ? "text-red-400" : "text-teal-400",   sub: "> 30 min no signal" },
              { icon: AlertCircle,  label: "Open Disputes",     count: disputes.length,         level: disputes.length > 0 ? "text-amber-400" : "text-teal-400",   sub: "Unresolved" },
              { icon: CreditCard,   label: "Repeat Complaints", count: repeatComplainers,       level: repeatComplainers > 0 ? "text-red-400" : "text-teal-400",   sub: "Same user, 2+ disputes" },
              { icon: User,         label: "No Driver Assigned",count: unassigned.length,       level: unassigned.length > 3 ? "text-amber-400" : "text-teal-400", sub: "Needs allocation" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <item.icon className={`w-4 h-4 ${item.level} shrink-0`} />
                  <div>
                    <p className="text-xs text-white font-heading font-semibold">{item.label}</p>
                    <p className="text-[10px] text-slate-600">{item.sub}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold font-mono ${item.level}`}>{item.count}</span>
              </div>
            ))}
            <button
              onClick={() => navigate("/admin/shipments")}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
            >
              All Shipments <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel 4 — Customer Lookup */}
      <section>
        <SectionHeader>Customer Lookup</SectionHeader>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by shipment ID, driver ID, truck ID…"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>

          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <p className="text-[11px] text-slate-600 text-center py-2">Type at least 3 characters…</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-0.5">
              {searchResults.map((s) => {
                const ss = STATUS_STYLE[s.status] ?? { label: s.status, cls: "bg-slate-700 text-slate-400" };
                return (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedShipment(s); setSearchQuery(""); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700/60 cursor-pointer transition-colors"
                  >
                    <Package className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white font-mono">{s.id.slice(0, 16).toUpperCase()}</p>
                      <p className="text-[10px] text-slate-500">
                        Driver: {s.driver_id?.slice(0, 8) ?? "None"} · {timeSince(s.created_at)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${ss.cls}`}>{ss.label}</span>
                    {s.dispute_open && <Flag className="w-3 h-3 text-red-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 3 && searchResults.length === 0 && (
            <p className="text-[11px] text-slate-600 text-center py-3">No results. Try a shorter ID fragment.</p>
          )}
        </div>
      </section>

      {/* Panel 5 — Unified Customer Timeline (shows when a case is selected) */}
      {selectedShipment && (
        <section>
          <SectionHeader>
            Customer Timeline · {selectedShipment.id.slice(0, 8).toUpperCase()}
          </SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            {/* Case header with escalation flags */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-white font-mono">{selectedShipment.id.toUpperCase()}</p>
                  {selectedShipment.dispute_open && <EscFlag text="Dispute Open" level="critical" />}
                  {ageHours(selectedShipment.created_at) >= 48 && <EscFlag text="48h+" level="critical" />}
                  {ageHours(selectedShipment.created_at) >= 24 && ageHours(selectedShipment.created_at) < 48 && <EscFlag text="Urgent" level="warning" />}
                  {!selectedShipment.driver_id && <EscFlag text="No Driver" level="warning" />}
                </div>
                <p className="text-[10px] text-slate-500">
                  Created: {fmtDate(selectedShipment.created_at)} · Driver: {selectedShipment.driver_id?.slice(0, 8) ?? "Unassigned"}
                </p>
              </div>
              <button onClick={() => setSelectedShipment(null)} className="text-slate-600 hover:text-slate-300 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Journey timeline */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading mb-3">Journey Status</p>
                <CustomerTimeline shipment={selectedShipment} />

                {/* Shipment metadata */}
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-slate-500">Dispute</span>
                    <span className={`text-[10px] font-bold ${selectedShipment.dispute_open ? "text-red-400" : "text-teal-400"}`}>
                      {selectedShipment.dispute_open ? "OPEN" : "None"}
                    </span>
                  </div>
                  {selectedShipment.current_latitude && (
                    <div className="flex justify-between">
                      <span className="text-[10px] text-slate-500">GPS</span>
                      <span className="text-[10px] text-white font-mono">
                        {selectedShipment.current_latitude.toFixed(4)}, {selectedShipment.current_longitude.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {selectedShipment.last_seen_at && (
                    <div className="flex justify-between">
                      <span className="text-[10px] text-slate-500">Last GPS Signal</span>
                      <span className={`text-[10px] font-semibold ${ageHours(selectedShipment.last_seen_at) > 0.5 ? "text-red-400" : "text-teal-400"}`}>
                        {timeSince(selectedShipment.last_seen_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading mb-3">Quick Actions</p>
                <QuickActions shipment={selectedShipment} navigate={navigate} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bottom row — Recent Events + SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Customer Events */}
        <section>
          <SectionHeader>Recent Customer Events</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-sm">No recent events</div>
            ) : (
              <div className="divide-y divide-slate-700/60 max-h-72 overflow-y-auto">
                {recentActivity.slice(0, 12).map((item) => {
                  const ev = ACTIVITY_EVENT[item.type] ?? ACTIVITY_EVENT.default;
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{item.title}</p>
                        {item.body && (
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{item.body}</p>
                        )}
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {item.user_name} · {timeSince(item.created_at)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold shrink-0 ${ev.color}`}>{ev.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* SLA Panel */}
        <section>
          <SectionHeader>SLA Tracking</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <SlaRow
              icon={AlertCircle}
              label="Open Disputes"
              sub="Total unresolved"
              value={disputes.length}
              level={disputes.length > 5 ? "critical" : disputes.length > 0 ? "warning" : "safe"}
              maxVal={maxSla}
            />
            <SlaRow
              icon={Clock}
              label="Overdue > 24h"
              sub="Exceed SLA threshold"
              value={urgent.length}
              level={urgent.length > 0 ? "warning" : "safe"}
              maxVal={maxSla}
            />
            <SlaRow
              icon={Bell}
              label="Critical > 48h"
              sub="Immediate escalation needed"
              value={critical.length}
              level={critical.length > 0 ? "critical" : "safe"}
              maxVal={maxSla}
            />
            <SlaRow
              icon={WifiOff}
              label="GPS Offline (In Transit)"
              sub="Tracker signal lost > 30 min"
              value={gpsOffline.length}
              level={gpsOffline.length > 0 ? "warning" : "safe"}
              maxVal={maxSla}
            />
            <SlaRow
              icon={User}
              label="Unassigned Shipments"
              sub="No driver allocated"
              value={unassigned.length}
              level={unassigned.length > 3 ? "warning" : "safe"}
              maxVal={maxSla}
            />

            <div className="pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/admin/shipments")}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-xs font-heading font-bold transition-colors"
              >
                All Shipments
              </button>
              <button
                onClick={() => navigate("/admin/users")}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-heading font-bold transition-colors"
              >
                User Lookup
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
