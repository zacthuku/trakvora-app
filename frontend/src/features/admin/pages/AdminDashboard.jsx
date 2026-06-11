import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import {
  Users, Package, Truck, CreditCard, ShieldCheck,
  AlertTriangle, Navigation2, CheckCircle2, TrendingUp,
  Clock, Activity, ArrowRight, ClipboardList, CheckSquare,
  Wrench, WifiOff, Globe, XCircle, Wifi, ShieldAlert, Zap,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
}

function fmtKes(n) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n ?? 0}`;
}

function timeSince(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_META = {
  super_admin:        { label: "Super Admin",        greeting: "Full platform overview" },
  operations_admin:   { label: "Operations Admin",   greeting: "Operational overview" },
  field_inspector:    { label: "Field Inspector",    greeting: "Your field tasks and fleet status" },
  iot_technician:     { label: "IoT Technician",     greeting: "Device installation tasks" },
  compliance_officer: { label: "Compliance Officer", greeting: "Inspections awaiting your review" },
  support_agent:      { label: "Support Agent",      greeting: "User and shipment support overview" },
};

// Which sections each role can see
const ROLE_SECTIONS = {
  super_admin: {
    kpi: ["users", "loads", "shipments", "revenue", "drivers", "disputes", "trucks", "wallet"],
    charts: ["users_chart", "loads_chart"],
    panels: ["activity", "driver_panel", "finance_panel"],
  },
  operations_admin: {
    kpi: ["users", "loads", "shipments", "drivers", "disputes", "trucks"],
    charts: ["users_chart", "loads_chart"],
    panels: ["activity", "driver_panel"],
  },
  field_inspector: {
    kpi: ["trucks", "shipments"],
    charts: [],
    panels: ["field_ops_panel", "activity"],
  },
  iot_technician: {
    kpi: ["trucks"],
    charts: [],
    panels: ["field_ops_panel", "activity"],
  },
  compliance_officer: {
    kpi: ["trucks", "shipments"],
    charts: [],
    panels: ["compliance_panel", "activity"],
  },
  support_agent: {
    kpi: ["users", "loads", "shipments", "disputes", "drivers"],
    charts: ["users_chart", "loads_chart"],
    panels: ["activity", "driver_panel"],
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, to }) {
  const inner = (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group ${to ? "cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {to && <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />}
      </div>
      <p className="text-2xl font-bold text-white font-heading mb-1">{value}</p>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-heading">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function HBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-slate-400 capitalize shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs text-slate-300 text-right font-heading font-semibold">{value}</span>
    </div>
  );
}

const ACTIVITY_ICON = {
  bid_received:    { icon: Package,      color: "text-blue-400 bg-blue-900/40" },
  bid_accepted:    { icon: CheckCircle2, color: "text-green-400 bg-green-900/40" },
  bid_rejected:    { icon: AlertTriangle,color: "text-red-400 bg-red-900/40" },
  shipment_booked: { icon: Navigation2,  color: "text-violet-400 bg-violet-900/40" },
  in_transit:      { icon: Activity,     color: "text-amber-400 bg-amber-900/40" },
  delivered:       { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-900/40" },
  payment_released:{ icon: CreditCard,   color: "text-teal-400 bg-teal-900/40" },
  default:         { icon: Clock,        color: "text-slate-400 bg-slate-800" },
};

function ActivityItem({ item }) {
  const { icon: Icon, color } = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.default;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white leading-snug">{item.title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.body}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">{item.user_name} · {timeSince(item.created_at)}</p>
      </div>
    </div>
  );
}

function LoadStatusBar({ status, count, total }) {
  const COLORS = {
    available: "bg-blue-500", bidding: "bg-amber-500", booked: "bg-violet-500",
    en_route_pickup: "bg-orange-500", loaded: "bg-cyan-500", in_transit: "bg-indigo-500",
    delivered: "bg-green-500", cancelled: "bg-red-500",
  };
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-400 truncate capitalize shrink-0">{status.replace("_", " ")}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${COLORS[status] ?? "bg-slate-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-300 font-heading">{count}</span>
      <span className="w-8 text-right text-[10px] text-slate-600">{pct}%</span>
    </div>
  );
}

// ── Super admin helpers ───────────────────────────────────────────────────────

function ageH(iso) {
  if (!iso) return 999;
  return (Date.now() - new Date(iso)) / 3_600_000;
}

const XB_KW = ["kampala","uganda","dar","tanzania","arusha","namanga","kigali","rwanda","rusumo","malaba","busia","burundi","tunduma","kobero"];
function isXBorder(corridor) {
  if (!corridor) return false;
  const low = corridor.toLowerCase();
  return XB_KW.some((kw) => low.includes(kw));
}

// ── Super admin sub-components ────────────────────────────────────────────────

function AlertChip({ icon: Icon, count, label, to }) {
  if (!count) return null;
  return (
    <Link to={to ?? "#"}
      className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1.5 rounded-full text-xs font-semibold font-heading hover:bg-red-500/30 transition-colors">
      <Icon className="w-3 h-3 text-red-400" />
      <span className="text-red-400 font-black">{count}</span>
      {label}
    </Link>
  );
}

function RiskCard({ icon: Icon, value, label, sub, colorCls }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${colorCls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-xl font-black font-heading">{value}</p>
        <p className="text-[10px] uppercase tracking-widest font-bold leading-tight">{label}</p>
        {sub && <p className="text-[9px] mt-0.5 opacity-70">{sub}</p>}
      </div>
    </div>
  );
}

function OpsRow({ icon: Icon, label, value, sub, alertCls, neutralCls }) {
  const isAlert = value > 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isAlert ? alertCls : neutralCls ?? "bg-slate-800 text-slate-500"}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-sm font-black font-heading shrink-0 ${isAlert ? "text-red-400" : "text-emerald-400"}`}>{value}</span>
    </div>
  );
}

function HealthMetric({ label, value, unit, status }) {
  const bar  = status === "good" ? "bg-emerald-500" : status === "warn" ? "bg-amber-500" : "bg-red-500";
  const text = status === "good" ? "text-emerald-400" : status === "warn" ? "text-amber-400" : "text-red-400";
  const pct  = unit === "%" ? Math.min(value, 100) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-xs text-slate-400 shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {pct !== null && <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />}
      </div>
      <span className={`text-xs font-bold font-heading w-16 text-right ${text}`}>{value}{unit}</span>
    </div>
  );
}

function GeoBar({ flag, label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-base shrink-0">{flag}</span>
      <span className="w-20 text-xs text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-xs text-slate-300 text-right font-heading font-bold">{count}</span>
    </div>
  );
}

function FraudSignal({ icon: Icon, label, count, severity, detail }) {
  const cls = severity === "high"
    ? "text-red-400 bg-red-900/30 border-red-800/50"
    : severity === "warn"
    ? "text-amber-400 bg-amber-900/30 border-amber-800/50"
    : "text-slate-400 bg-slate-800 border-slate-700";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold font-heading">{label}</p>
        {detail && <p className="text-[10px] opacity-70 mt-0.5 leading-relaxed">{detail}</p>}
      </div>
      <span className="text-lg font-black font-heading shrink-0">{count}</span>
    </div>
  );
}

// ── KPI definitions (built from data) ────────────────────────────────────────

function buildKpis(data) {
  const u = data?.users ?? {};
  const l = data?.loads ?? {};
  const s = data?.shipments ?? {};
  const d = data?.drivers ?? {};
  const t = data?.trucks ?? {};
  const f = data?.finance ?? {};
  const byStatus = l.by_status ?? {};

  return {
    users:     { icon: Users,       label: "Total Users",          value: fmt(u.total),                      sub: `${u.suspended ?? 0} suspended`,                           color: "bg-blue-900/50 text-blue-400",    to: "/admin/users" },
    loads:     { icon: Package,     label: "Total Loads",          value: fmt(l.total),                      sub: `${(byStatus.available ?? 0) + (byStatus.bidding ?? 0)} open`, color: "bg-amber-900/50 text-amber-400", to: "/admin/loads" },
    shipments: { icon: Navigation2, label: "Active Shipments",     value: fmt(s.active),                     sub: `${s.delivered ?? 0} delivered`,                           color: "bg-violet-900/50 text-violet-400",to: "/admin/shipments" },
    revenue:   { icon: CreditCard,  label: "Platform Revenue",     value: fmtKes(f.platform_revenue_kes),    sub: `${f.total_transactions ?? 0} transactions`,               color: "bg-green-900/50 text-green-400",  to: "/admin/wallets" },
    drivers:   { icon: ShieldCheck, label: "Pending Verification", value: fmt(d.pending_verifications),      sub: `${d.verified ?? 0} verified drivers`,                     color: "bg-orange-900/50 text-orange-400",to: "/admin/drivers" },
    disputes:  { icon: AlertTriangle,label:"Open Disputes",        value: fmt(s.open_disputes),              sub: `${s.total ?? 0} total shipments`,                         color: "bg-red-900/50 text-red-400",      to: "/admin/shipments" },
    trucks:    { icon: Truck,       label: "Active Trucks",        value: fmt(t.active),                     sub: `${t.total ?? 0} registered`,                              color: "bg-cyan-900/50 text-cyan-400",    to: "/admin/trucks" },
    wallet:    { icon: TrendingUp,  label: "Wallet Float",         value: fmtKes(f.total_wallet_balance_kes),sub: `${fmtKes(f.total_escrow_kes)} in escrow`,                 color: "bg-teal-900/50 text-teal-400",    to: "/admin/wallets" },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const adminRole = user?.admin_role ?? "super_admin";

  // Derived (not hooks) — safe before hooks
  const isSuperAdmin = adminRole === "super_admin";
  const isRedirectRole = ["field_inspector", "iot_technician", "support_agent", "operations_admin"].includes(adminRole);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminApi.getDashboard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const SA_Q = { staleTime: 30_000, refetchInterval: 60_000, enabled: isSuperAdmin };

  const { data: saShipmentsRaw } = useQuery({
    queryKey: ["sa-shipments"],
    queryFn: () => adminApi.getShipments({ limit: 200 }).catch(() => ({ items: [] })),
    ...SA_Q,
  });
  const { data: saTrucksRaw } = useQuery({
    queryKey: ["sa-trucks"],
    queryFn: () => adminApi.getTrucks({ limit: 200 }).catch(() => ({ items: [] })),
    ...SA_Q,
  });
  const { data: saDriversRaw } = useQuery({
    queryKey: ["sa-drivers"],
    queryFn: () => adminApi.getDrivers({ limit: 200 }).catch(() => ({ items: [] })),
    ...SA_Q,
  });
  const { data: saTransactionsRaw } = useQuery({
    queryKey: ["sa-transactions"],
    queryFn: () => adminApi.getTransactions({ limit: 100 }).catch(() => ({ items: [] })),
    ...SA_Q,
  });

  // ── Super admin computed state (must be before any early return) ─────────
  const saShipments    = useMemo(() => saShipmentsRaw?.items ?? [], [saShipmentsRaw]);
  const saTrucks       = useMemo(() => saTrucksRaw?.items    ?? [], [saTrucksRaw]);
  const saDrivers      = useMemo(() => saDriversRaw?.items   ?? [], [saDriversRaw]);
  const saTransactions = useMemo(() => saTransactionsRaw?.items ?? [], [saTransactionsRaw]);

  // Risk: shipment health
  const saDisputes      = useMemo(() => saShipments.filter(sh => sh.dispute_open), [saShipments]);
  const saDelayed6h     = useMemo(() => saShipments.filter(sh => sh.status === "in_transit" && ageH(sh.last_seen_at ?? sh.created_at) > 6), [saShipments]);
  const saNoGPSSignal   = useMemo(() => saShipments.filter(sh => sh.status === "in_transit" && !sh.last_seen_at), [saShipments]);
  const saNoGPS15m      = useMemo(() => saShipments.filter(sh => sh.status === "in_transit" && ageH(sh.last_seen_at ?? sh.created_at) > 0.25), [saShipments]);

  // Fleet health
  const saActiveTrucks    = useMemo(() => saTrucks.filter(tr => tr.is_active), [saTrucks]);
  const saTrackerOnline   = useMemo(() => saTrucks.filter(tr => tr.is_active && tr.current_lat != null), [saTrucks]);
  const saNonCompliant    = useMemo(() => saTrucks.filter(tr => tr.is_active && !["approved", "not_required"].includes(tr.inspection_status)), [saTrucks]);
  const saFleetUtil       = saTrucks.length > 0 ? Math.round((saActiveTrucks.length / saTrucks.length) * 100) : 0;
  const saTrackerPct      = saActiveTrucks.length > 0 ? Math.round((saTrackerOnline.length / saActiveTrucks.length) * 100) : 0;

  // Driver compliance
  const saPendingDrivers  = useMemo(() => saDrivers.filter(dr => dr.verification_status === "pending"), [saDrivers]);
  const saRejectedDrivers = useMemo(() => saDrivers.filter(dr => dr.verification_status === "rejected"), [saDrivers]);
  const saVerifiedDrivers = useMemo(() => saDrivers.filter(dr => dr.verification_status === "verified"), [saDrivers]);
  const saUnverifiedTrucks= useMemo(() => saTrucks.filter(tr => !tr.is_verified), [saTrucks]);

  // Financial
  const saFailedTxns   = useMemo(() => saTransactions.filter(tx => tx.status === "failed"), [saTransactions]);
  const saPendingTxns  = useMemo(() => saTransactions.filter(tx => tx.status === "pending"), [saTransactions]);

  // Geographic intelligence (by corridor keywords)
  const saGeoData = useMemo(() => {
    const active = saShipments.filter(sh => ["in_transit", "loaded", "en_route_pickup"].includes(sh.status));
    return [
      { flag: "🇰🇪", label: "Kenya",    color: "bg-green-500",  count: active.filter(sh => !isXBorder(sh.corridor)).length },
      { flag: "🇺🇬", label: "Uganda",   color: "bg-yellow-500", count: active.filter(sh => ["malaba","busia","kampala","uganda"].some(kw => (sh.corridor ?? "").toLowerCase().includes(kw))).length },
      { flag: "🇹🇿", label: "Tanzania", color: "bg-blue-500",   count: active.filter(sh => ["namanga","dar","tanzania","arusha","tunduma"].some(kw => (sh.corridor ?? "").toLowerCase().includes(kw))).length },
      { flag: "🇷🇼", label: "Rwanda",   color: "bg-indigo-500", count: active.filter(sh => ["kigali","rwanda","rusumo","katuna","gatuna"].some(kw => (sh.corridor ?? "").toLowerCase().includes(kw))).length },
      { flag: "🇧🇮", label: "Burundi",  color: "bg-rose-500",   count: active.filter(sh => ["bujumbura","burundi","kobero","nemba"].some(kw => (sh.corridor ?? "").toLowerCase().includes(kw))).length },
    ];
  }, [saShipments]);
  const saGeoMax = useMemo(() => Math.max(...saGeoData.map(g => g.count), 1), [saGeoData]);

  // Fraud / anomaly signals
  const saGPSGaps        = saNoGPSSignal;
  const saSameDayCancel  = useMemo(() => saShipments.filter(sh => sh.status === "cancelled" && ageH(sh.created_at) < 24), [saShipments]);
  const saHighValueDis   = useMemo(() => saShipments.filter(sh => sh.dispute_open && (sh.escrow_amount_kes ?? 0) > 50_000), [saShipments]);

  const hasAlerts = isSuperAdmin && (saDisputes.length > 0 || saDelayed6h.length > 0 || saNoGPS15m.length > 0);

  // System health derived rates
  const saDriverVerifRate = saDrivers.length > 0 ? Math.round((saVerifiedDrivers.length / saDrivers.length) * 100) : 0;
  const saDisputeRate     = saShipments.length > 0 ? parseFloat(((saDisputes.length / saShipments.length) * 100).toFixed(1)) : 0;
  const saTxSuccessRate   = saTransactions.length > 0 ? Math.round(((saTransactions.length - saFailedTxns.length) / saTransactions.length) * 100) : 100;

  // Role-based redirects — placed AFTER all hooks to satisfy Rules of Hooks
  if (isRedirectRole) {
    const redirectMap = {
      field_inspector:  "/admin/field-inspector",
      iot_technician:   "/admin/iot",
      support_agent:    "/admin/support",
      operations_admin: "/admin/ops",
    };
    return <Navigate to={redirectMap[adminRole]} replace />;
  }

  const sections = ROLE_SECTIONS[adminRole] ?? ROLE_SECTIONS.super_admin;
  const meta = ROLE_META[adminRole] ?? ROLE_META.super_admin;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const u = data?.users ?? {};
  const l = data?.loads ?? {};
  const s = data?.shipments ?? {};
  const d = data?.drivers ?? {};
  const t = data?.trucks ?? {};
  const f = data?.finance ?? {};
  const fo = data?.field_ops ?? {};
  const comp = data?.compliance ?? {};
  const activity = data?.recent_activity ?? [];
  const byStatus = l.by_status ?? {};
  const byRole = u.by_role ?? {};
  const totalLoads = l.total ?? 0;
  const totalUsers = u.total ?? 0;

  const kpiDefs = buildKpis(data);
  const visibleKpis = sections.kpi.map((k) => kpiDefs[k]).filter(Boolean);

  const show = (panel) => sections.panels.includes(panel);
  const showChart = (chart) => sections.charts.includes(chart);

  return (
    <div className="py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{meta.greeting} · live data</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Auto-refreshes every 60s
        </div>
      </div>

      {/* ── SA: GLOBAL ALERT BAR ── */}
      {hasAlerts && (
        <div className="bg-red-950/40 border border-red-900/50 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-[11px] font-black text-red-400 uppercase tracking-widest font-heading">Alerts</span>
          </div>
          <AlertChip icon={AlertTriangle}  count={saDisputes.length}   label="open disputes"     to="/admin/shipments" />
          <AlertChip icon={Clock}          count={saDelayed6h.length}  label="delayed >6h"       to="/admin/shipments" />
          <AlertChip icon={WifiOff}        count={saNoGPS15m.length}   label="GPS offline >15m"  to="/admin/shipments" />
          <span className="ml-auto text-[10px] text-red-800 font-heading italic">Requires immediate attention</span>
        </div>
      )}

      {/* KPI grid — adapts to number of visible cards */}
      {visibleKpis.length > 0 && (
        <div className={`grid gap-4 ${
          visibleKpis.length <= 2 ? "grid-cols-2" :
          visibleKpis.length <= 4 ? "grid-cols-2 lg:grid-cols-4" :
          "grid-cols-2 lg:grid-cols-4"
        }`}>
          {visibleKpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      {/* ── SA: SECONDARY KPIS + LIVE RISK INDICATORS ── */}
      {isSuperAdmin && (
        <div className="space-y-4">
          {/* Secondary KPIs — Fleet Util · Tracker % · Cross-border · Failed Txns */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/trucks">
              <div className={`bg-slate-900 rounded-2xl p-5 border hover:border-slate-700 transition-all ${saFleetUtil >= 70 ? "border-emerald-800/40" : saFleetUtil >= 40 ? "border-amber-800/40" : "border-red-800/40"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saFleetUtil >= 70 ? "bg-emerald-900/50 text-emerald-400" : "bg-amber-900/50 text-amber-400"}`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className={`text-xl font-black font-heading ${saFleetUtil >= 70 ? "text-emerald-400" : "text-amber-400"}`}>{saFleetUtil}%</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-heading">Fleet Utilization</p>
                <p className="text-xs text-slate-500 mt-1">{saActiveTrucks.length} / {saTrucks.length} trucks active</p>
              </div>
            </Link>

            <div className={`bg-slate-900 rounded-2xl p-5 border ${saTrackerPct >= 80 ? "border-teal-800/40" : "border-amber-800/40"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saTrackerPct >= 80 ? "bg-teal-900/50 text-teal-400" : "bg-amber-900/50 text-amber-400"}`}>
                  <Wifi className="w-5 h-5" />
                </div>
                <span className={`text-xl font-black font-heading ${saTrackerPct >= 80 ? "text-teal-400" : "text-amber-400"}`}>{saTrackerPct}%</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-heading">Trackers Online</p>
              <p className="text-xs text-slate-500 mt-1">{saTrackerOnline.length} GPS active trucks</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-900/50 text-violet-400">
                  <Globe className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white font-heading mb-1">{saShipments.filter(s => isXBorder(s.corridor)).length}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-heading">Cross-Border Loads</p>
              <p className="text-xs text-slate-500 mt-1">active corridors</p>
            </div>

            <div className={`bg-slate-900 rounded-2xl p-5 border ${saFailedTxns.length > 0 ? "border-red-800/40" : "border-slate-800"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saFailedTxns.length > 0 ? "bg-red-900/50 text-red-400" : "bg-slate-800 text-slate-500"}`}>
                  <XCircle className="w-5 h-5" />
                </div>
                {saFailedTxns.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
              </div>
              <p className={`text-2xl font-bold font-heading mb-1 ${saFailedTxns.length > 0 ? "text-red-400" : "text-white"}`}>{saFailedTxns.length}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-heading">Failed Transactions</p>
              <p className="text-xs text-slate-500 mt-1">{saPendingTxns.length} pending</p>
            </div>
          </div>

          {/* Live Risk Indicators */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading mb-3">Live Risk Indicators</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RiskCard icon={Clock}       value={saDelayed6h.length}    label="Delayed > 6h"     sub="GPS silent or stalled"  colorCls={saDelayed6h.length   > 0 ? "bg-red-900/40 border border-red-800/60 text-red-400"     : "bg-slate-900 border border-slate-800 text-slate-500"} />
              <RiskCard icon={AlertTriangle} value={saDisputes.length}   label="Active Disputes"  sub="customer disputes open" colorCls={saDisputes.length    > 0 ? "bg-orange-900/40 border border-orange-800/60 text-orange-400" : "bg-slate-900 border border-slate-800 text-slate-500"} />
              <RiskCard icon={WifiOff}     value={saNoGPSSignal.length}  label="No GPS Signal"    sub="in transit, no ping"    colorCls={saNoGPSSignal.length > 0 ? "bg-amber-900/40 border border-amber-800/60 text-amber-400"  : "bg-slate-900 border border-slate-800 text-slate-500"} />
              <RiskCard icon={ShieldAlert} value={saNonCompliant.length} label="Non-Compliant"    sub="trucks fleet"           colorCls={saNonCompliant.length> 0 ? "bg-violet-900/40 border border-violet-800/60 text-violet-400": "bg-slate-900 border border-slate-800 text-slate-500"} />
            </div>
          </div>
        </div>
      )}

      {/* Field Ops panel — field_inspector + iot_technician */}
      {show("field_ops_panel") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-900/50 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white font-heading">{fo.pending_tasks ?? 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-heading font-semibold">Pending Tasks</p>
              </div>
            </div>
            {fo.in_progress_tasks > 0 && (
              <p className="text-xs text-slate-500 mb-4">{fo.in_progress_tasks} in progress</p>
            )}
            <Link to="/admin/field-ops/tasks"
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
              View My Tasks
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-900/50 flex items-center justify-center">
                <Truck className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white font-heading">{t.active ?? 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-heading font-semibold">Active Trucks</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t.total ?? 0} registered in fleet</p>
            <Link to="/admin/trucks"
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
              View Fleet
            </Link>
          </div>

          {adminRole === "iot_technician" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-900/50 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white font-heading">Device Setup</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-heading font-semibold">GPS Trackers</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">Configure and pair GPS tracker devices to fleet trucks.</p>
              <Link to="/admin/field-ops/device-setup"
                className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 text-white text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
                Device Setup
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Compliance panel — compliance_officer */}
      {show("compliance_panel") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-900/50 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white font-heading">{comp.pending_reviews ?? 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-heading font-semibold">Pending Reviews</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">Submitted inspections awaiting your compliance decision.</p>
            <Link to="/admin/compliance"
              className={`w-full flex items-center justify-center gap-2 text-white text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading ${
                (comp.pending_reviews ?? 0) > 0
                  ? "bg-teal-600 hover:bg-teal-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}>
              {(comp.pending_reviews ?? 0) > 0 ? "Review Now" : "View History"}
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-900/50 flex items-center justify-center">
                <Truck className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white font-heading">{t.active ?? 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-heading font-semibold">Active Trucks</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t.total ?? 0} trucks registered. Review vehicle compliance records.</p>
            <Link to="/admin/trucks"
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
              View Fleet
            </Link>
          </div>
        </div>
      )}

      {/* Charts row */}
      {(showChart("users_chart") || showChart("loads_chart")) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {showChart("users_chart") && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white font-heading uppercase tracking-widest">Users by Role</h2>
                <Link to="/admin/users" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">View all</Link>
              </div>
              <div className="space-y-4">
                <HBar label="Shippers" value={byRole.shipper ?? 0} max={totalUsers} color="bg-blue-500" />
                <HBar label="Owners"   value={byRole.owner ?? 0}   max={totalUsers} color="bg-amber-500" />
                <HBar label="Drivers"  value={byRole.driver ?? 0}  max={totalUsers} color="bg-emerald-500" />
                <HBar label="Admins"   value={byRole.admin ?? 0}   max={totalUsers} color="bg-violet-500" />
              </div>
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white font-heading">{u.verified ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white font-heading">{u.active ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-400 font-heading">{u.suspended ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Suspended</p>
                </div>
              </div>
            </div>
          )}

          {showChart("loads_chart") && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white font-heading uppercase tracking-widest">Loads by Status</h2>
                <Link to="/admin/loads" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">View all</Link>
              </div>
              <div className="space-y-3">
                {Object.entries(byStatus).length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">No load data</p>
                ) : (
                  Object.entries(byStatus).map(([st, cnt]) => (
                    <LoadStatusBar key={st} status={st} count={cnt} total={totalLoads} />
                  ))
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white font-heading">{(byStatus.available ?? 0) + (byStatus.bidding ?? 0)}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Open</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white font-heading">{s.active ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">In Transit</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-400 font-heading">{byStatus.delivered ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Delivered</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom panels */}
      {(show("activity") || show("driver_panel") || show("finance_panel")) && (
        <div className={`grid grid-cols-1 gap-6 ${
          show("driver_panel") || show("finance_panel") ? "lg:grid-cols-3" : ""
        }`}>

          {/* Activity feed */}
          {show("activity") && (
            <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              show("driver_panel") || show("finance_panel") ? "lg:col-span-2" : ""
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white font-heading uppercase tracking-widest">Recent Activity</h2>
                <span className="text-[10px] text-slate-600 font-heading uppercase">Live feed</span>
              </div>
              {activity.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-8">No recent activity</p>
              ) : (
                <div className="max-h-80 overflow-y-auto pr-1">
                  {activity.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right column panels */}
          {(show("driver_panel") || show("finance_panel")) && (
            <div className="space-y-4">

              {show("driver_panel") && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest mb-4">Driver Verification</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Pending review</span>
                      <span className="text-sm font-bold text-amber-400 font-heading">{d.pending_verifications ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Approved</span>
                      <span className="text-sm font-bold text-green-400 font-heading">{d.verified ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Available now</span>
                      <span className="text-sm font-bold text-blue-400 font-heading">{d.available ?? 0}</span>
                    </div>
                  </div>
                  {(d.pending_verifications ?? 0) > 0 && (
                    <Link to="/admin/drivers?verification_status=pending"
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
                      Review Queue
                    </Link>
                  )}
                </div>
              )}

              {show("finance_panel") && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest mb-4">Financial Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Platform revenue</span>
                      <span className="text-xs font-bold text-green-400 font-heading">{fmtKes(f.platform_revenue_kes)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Total wallet float</span>
                      <span className="text-xs font-bold text-white font-heading">{fmtKes(f.total_wallet_balance_kes)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Escrowed</span>
                      <span className="text-xs font-bold text-amber-400 font-heading">{fmtKes(f.total_escrow_kes)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Transactions</span>
                      <span className="text-xs font-bold text-white font-heading">{f.total_transactions ?? 0}</span>
                    </div>
                  </div>
                  <Link to="/admin/wallets"
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold uppercase tracking-widest py-2.5 rounded-lg transition-colors font-heading">
                    View Finance
                  </Link>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── SA: OPERATIONS HEALTH + GEOGRAPHIC INTELLIGENCE ── */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Operations Health */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest">Operations Health</h2>
              <Link to="/admin/shipments" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">View all</Link>
            </div>
            <OpsRow icon={Clock}       label="Delayed > 6h"            value={saDelayed6h.length}    sub="GPS silent or stalled in transit" alertCls="bg-red-900/50 text-red-400" />
            <OpsRow icon={WifiOff}     label="No GPS Signal"           value={saNoGPSSignal.length}  sub="in-transit without any ping"      alertCls="bg-amber-900/50 text-amber-400" />
            <OpsRow icon={AlertTriangle} label="Active Disputes"       value={saDisputes.length}     sub="customer disputes open"           alertCls="bg-orange-900/50 text-orange-400" />
            <OpsRow icon={ShieldAlert} label="Non-Compliant Trucks"    value={saNonCompliant.length} sub="failed or expired inspection"     alertCls="bg-violet-900/50 text-violet-400" />
            <OpsRow icon={XCircle}     label="Failed Transactions"     value={saFailedTxns.length}   sub="payment failures"                 alertCls="bg-red-900/50 text-red-400" />
            <OpsRow icon={ShieldCheck} label="Pending Driver Reviews"  value={saPendingDrivers.length} sub="awaiting verification"          alertCls="bg-amber-900/50 text-amber-400" />
          </div>

          {/* Geographic Intelligence */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest">Geographic Intelligence</h2>
              <Link to="/admin/fleet-map" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">Fleet Map</Link>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading mb-4">Active Shipments by Region</p>
            <div className="space-y-4">
              {saGeoData.map((g) => (
                <GeoBar key={g.label} flag={g.flag} label={g.label} count={g.count} max={saGeoMax} color={g.color} />
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-white font-heading">{saShipments.filter(s => isXBorder(s.corridor)).length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Cross-border</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white font-heading">{saShipments.filter(s => ["in_transit","loaded"].includes(s.status)).length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">In Motion</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400 font-heading">{saShipments.filter(s => s.status === "delivered").length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Delivered</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SA: COMPLIANCE OVERVIEW + SYSTEM HEALTH ── */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Compliance Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest">Compliance Overview</h2>
              <Link to="/admin/compliance" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">Review</Link>
            </div>
            <div className="space-y-1">
              {[
                { label: "Drivers Pending Verification", value: saPendingDrivers.length,   col: "text-amber-400", sub: "awaiting review",              to: "/admin/drivers" },
                { label: "Drivers Rejected",             value: saRejectedDrivers.length,  col: "text-red-400",   sub: "need resubmission",            to: "/admin/drivers" },
                { label: "Non-Compliant Trucks",         value: saNonCompliant.length,     col: "text-orange-400",sub: "failed or expired inspection",  to: "/admin/trucks" },
                { label: "Unverified Trucks",            value: saUnverifiedTrucks.length, col: "text-amber-400", sub: "not yet verified",             to: "/admin/trucks" },
              ].map(({ label, value, col, sub, to }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-300 truncate">{label}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`text-sm font-black font-heading ${value > 0 ? col : "text-slate-600"}`}>{value}</span>
                    {value > 0 && (
                      <Link to={to} className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold">Act</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest">System Health</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400 font-semibold font-heading">Operational</span>
              </div>
            </div>
            <div className="space-y-4">
              <HealthMetric label="GPS Tracker Coverage"    value={saTrackerPct}       unit="%" status={saTrackerPct >= 80 ? "good" : saTrackerPct >= 50 ? "warn" : "critical"} />
              <HealthMetric label="Driver Verification Rate" value={saDriverVerifRate}  unit="%" status={saDriverVerifRate >= 80 ? "good" : "warn"} />
              <HealthMetric label="Fleet Active Rate"        value={saFleetUtil}        unit="%" status={saFleetUtil >= 70 ? "good" : "warn"} />
              <HealthMetric label="Dispute Rate"             value={saDisputeRate}      unit="%" status={saDisputeRate === 0 ? "good" : saDisputeRate < 5 ? "warn" : "critical"} />
              <HealthMetric label="Transaction Success Rate" value={saTxSuccessRate}    unit="%" status={saTxSuccessRate >= 95 ? "good" : saTxSuccessRate >= 80 ? "warn" : "critical"} />
            </div>
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <p className="text-[10px] text-slate-600">API latency · WebSocket clients · Job queue require server-side telemetry</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SA: FRAUD & ANOMALY DETECTION ── */}
      {isSuperAdmin && (saGPSGaps.length > 0 || saSameDayCancel.length > 0 || saHighValueDis.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-white font-heading uppercase tracking-widest">Fraud &amp; Anomaly Detection</h2>
            <span className="text-[10px] text-amber-400 font-heading font-bold">Signals requiring review</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FraudSignal
              icon={WifiOff}
              label="GPS Signal Gaps"
              count={saGPSGaps.length}
              severity={saGPSGaps.length > 5 ? "high" : "warn"}
              detail="in-transit shipments with no GPS history: possible tampering or tracker failure"
            />
            <FraudSignal
              icon={XCircle}
              label="Same-Day Cancellations"
              count={saSameDayCancel.length}
              severity={saSameDayCancel.length > 10 ? "high" : "warn"}
              detail="loads cancelled within 24h of posting: investigate for abuse or duplicate bookings"
            />
            <FraudSignal
              icon={Zap}
              label="High-Value Disputes"
              count={saHighValueDis.length}
              severity={saHighValueDis.length > 0 ? "high" : "good"}
              detail="escrow value >KES 50K currently disputed: prioritize manual review"
            />
          </div>
          <p className="text-[10px] text-slate-700 mt-3 italic">
            Advanced signals (GPS velocity anomalies, duplicate accounts, escrow timing attacks) require ML backend integration.
          </p>
        </div>
      )}

    </div>
  );
}
