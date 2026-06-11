import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert, AlertTriangle, XCircle, CheckCircle2,
  FileWarning, Truck, Users, Clock, ChevronRight,
  FlaskConical, Thermometer, Globe, RefreshCw,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useCountryConfig } from "@/hooks/useCountryConfig";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITION_ORDER = { poor: 0, fair: 1, good: 2, clean: 3 };

const CONDITION_STYLE = {
  poor:  { pill: "bg-red-500/20 text-red-400 border border-red-500/30",  dot: "bg-red-400" },
  fair:  { pill: "bg-amber-500/20 text-amber-400 border border-amber-500/30", dot: "bg-amber-400" },
  good:  { pill: "bg-sky-500/20 text-sky-400 border border-sky-500/30",  dot: "bg-sky-400" },
  clean: { pill: "bg-teal-500/20 text-teal-400 border border-teal-500/30", dot: "bg-teal-400" },
};

const DECISION_STYLE = {
  approved:  { label: "Approved",   cls: "bg-teal-500/20 text-teal-400 border border-teal-500/30" },
  rejected:  { label: "Rejected",   cls: "bg-red-500/20 text-red-400 border border-red-500/30" },
  reinspect: { label: "Re-inspect", cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
};

const CROSS_BORDER_KW = ["kampala", "dar", "tanzania", "uganda", "mombasa"];

const Q_OPTS = { refetchInterval: 60_000, staleTime: 30_000 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const toArray = (raw) => raw?.items ?? (Array.isArray(raw) ? raw : []);

const safe = (fn) => fn().catch(() => ({ items: [] }));

const fmtDate = (iso, locale = "en") => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading mb-3">
      {children}
    </h2>
  );
}

function AlertCard({ icon: Icon, count, label, sub, level, href, navigate }) {
  const styles = {
    critical: "border-red-500/30 bg-red-500/10",
    warning:  "border-amber-500/30 bg-amber-500/10",
    safe:     "border-teal-500/30 bg-teal-500/10",
    neutral:  "border-slate-700 bg-slate-800/60",
  };
  const iconStyles = {
    critical: "text-red-400",
    warning:  "text-amber-400",
    safe:     "text-teal-400",
    neutral:  "text-slate-500",
  };
  const countStyles = {
    critical: "text-red-300",
    warning:  "text-amber-300",
    safe:     "text-teal-300",
    neutral:  "text-slate-300",
  };

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${styles[level]} ${href ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      onClick={href ? () => navigate(href) : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <Icon className={`w-4 h-4 ${iconStyles[level]}`} />
        {href && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
      </div>
      <div className={`text-3xl font-bold font-mono ${countStyles[level]}`}>{count}</div>
      <div className="text-xs font-bold text-white font-heading">{label}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function RiskLoadRow({ load }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
      <div>
        <p className="text-xs font-bold text-white font-heading">#{load.id?.slice(0, 8).toUpperCase()}</p>
        <p className="text-[10px] text-slate-500 capitalize">
          {[load.corridor, load.cargo_weight_kg && `${load.cargo_weight_kg} kg`, load.status].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
        load.status === "booked" ? "bg-slate-700 text-slate-300" :
        load.status === "in_transit" ? "bg-teal-500/20 text-teal-400" :
        "bg-slate-700 text-slate-400"
      }`}>{load.status?.replace("_", " ")}</span>
    </div>
  );
}

function RiskSection({ icon: Icon, label, color, items, navigate }) {
  const colorMap = {
    red:    { header: "text-red-400",    badge: "bg-red-500/20 text-red-400 border border-red-500/30" },
    sky:    { header: "text-sky-400",    badge: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
    violet: { header: "text-violet-400", badge: "bg-violet-500/20 text-violet-400 border border-violet-500/30" },
  };
  const c = colorMap[color] ?? colorMap.sky;
  const shown = items.slice(0, 5);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${c.header}`} />
          <span className="text-xs font-bold text-white font-heading">{label}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
          {items.length}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="text-[11px] text-slate-600 py-2">None at this time</p>
      ) : (
        <>
          {shown.map((l) => <RiskLoadRow key={l.id} load={l} />)}
          {items.length > 5 && (
            <button
              onClick={() => navigate("/admin/loads")}
              className="mt-2 text-[11px] text-violet-400 hover:text-violet-300 font-semibold"
            >
              +{items.length - 5} more · View all
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DocRow({ label, count, total, level }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = level === "critical" ? "bg-red-500" : level === "warning" ? "bg-amber-500" : "bg-teal-500";
  const textColor = level === "critical" ? "text-red-400" : level === "warning" ? "text-amber-400" : "text-teal-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300 font-heading">{label}</span>
        <span className={`text-xs font-bold font-mono ${textColor}`}>{count} <span className="text-slate-600 font-normal">/ {total}</span></span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const cfg = useCountryConfig();

  const { data: pendingRaw, isLoading: pendingLoading, dataUpdatedAt } = useQuery({
    queryKey: ["compliance-pending"],
    queryFn: () => safe(() => adminApi.getPendingReviews({ page: 1, limit: 50 })),
    ...Q_OPTS,
  });

  const { data: historyRaw } = useQuery({
    queryKey: ["compliance-history"],
    queryFn: () => safe(() => adminApi.getReviewHistory({ page: 1, limit: 50 })),
    ...Q_OPTS,
  });

  const { data: trucksRaw } = useQuery({
    queryKey: ["compliance-trucks"],
    queryFn: () => safe(() => adminApi.getTrucks({ page: 1, limit: 200 })),
    ...Q_OPTS,
  });

  const { data: driversRaw } = useQuery({
    queryKey: ["compliance-drivers"],
    queryFn: () => safe(() => adminApi.getDrivers({ page: 1, limit: 200 })),
    ...Q_OPTS,
  });

  const { data: loadsRaw } = useQuery({
    queryKey: ["compliance-loads"],
    queryFn: () => safe(() => adminApi.getLoads({ page: 1, limit: 200 })),
    ...Q_OPTS,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const pendingReviews = toArray(pendingRaw).sort(
    (a, b) => (CONDITION_ORDER[a.condition] ?? 99) - (CONDITION_ORDER[b.condition] ?? 99)
  );

  const history = toArray(historyRaw);
  const recentHistory = history.slice(0, 10);

  const rejections = history.filter((h) => h.decision === "rejected");
  const rejectionCounts = rejections.reduce((acc, h) => {
    acc[h.truck_id] = (acc[h.truck_id] ?? 0) + 1;
    return acc;
  }, {});
  const repeatedOffenders = Object.entries(rejectionCounts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);

  const trucks = toArray(trucksRaw);
  const needsInspection = trucks.filter((t) => t.inspection_status === "not_requested" || t.inspection_status === "re_inspection");
  const failedInspection = trucks.filter((t) => t.inspection_status === "rejected");
  const unverifiedTrucks = trucks.filter((t) => !t.is_verified);

  const drivers = toArray(driversRaw);
  const pendingDrivers = drivers.filter((d) => d.verification_status === "pending");
  const rejectedDrivers = drivers.filter((d) => d.verification_status === "rejected");
  const unntsa = drivers.filter((d) => !d.ntsa_verified);
  const DOC_FIELDS = ["licence_photo_url", "psv_badge_url", "police_clearance_url", "good_conduct_url", "medical_cert_url"];
  const missingDocs = drivers.filter((d) => DOC_FIELDS.some((f) => !d[f]));

  const loads = toArray(loadsRaw);
  const hazmatLoads = loads.filter((l) => l.cargo_type === "hazardous");
  const coldChainLoads = loads.filter((l) => l.cargo_type === "refrigerated");
  const crossBorderLoads = loads.filter((l) =>
    CROSS_BORDER_KW.some((kw) =>
      [l.pickup_location, l.dropoff_location, l.corridor].join(" ").toLowerCase().includes(kw)
    )
  );

  const totalDrivers = drivers.length || 1;
  const compliancePct = Math.max(0, Math.round(
    ((totalDrivers - missingDocs.length - unntsa.length) / totalDrivers) * 100
  ));

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(cfg.locale, { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* Page header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-white font-heading">Compliance Command Center</h1>
          </div>
          <p className="text-xs text-slate-500">
            Regulatory monitoring · Risk-first view
            {lastUpdated && <span className="ml-2 text-slate-600">· Updated {lastUpdated}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-600 animate-spin" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full font-heading">
            Compliance Officer
          </span>
        </div>
      </div>

      {/* Panel 1 — Compliance Alerts */}
      <section>
        <SectionHeader>Compliance Alerts</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AlertCard
            icon={Truck}
            count={needsInspection.length}
            label="Inspection Required"
            sub={`${unverifiedTrucks.length} unverified trucks`}
            level={needsInspection.length > 0 ? "critical" : "safe"}
            href="/admin/trucks"
            navigate={navigate}
          />
          <AlertCard
            icon={XCircle}
            count={failedInspection.length}
            label="Failed Inspections"
            sub="Immediate action needed"
            level={failedInspection.length > 0 ? "critical" : "safe"}
            href="/admin/trucks"
            navigate={navigate}
          />
          <AlertCard
            icon={AlertTriangle}
            count={pendingReviews.length}
            label="Pending Reviews"
            sub="Awaiting compliance sign-off"
            level={pendingReviews.length > 5 ? "warning" : pendingReviews.length > 0 ? "warning" : "safe"}
            navigate={navigate}
          />
          <AlertCard
            icon={Users}
            count={pendingDrivers.length}
            label="Unverified Drivers"
            sub={`${rejectedDrivers.length} rejected`}
            level={pendingDrivers.length > 0 ? "warning" : "safe"}
            href="/admin/drivers"
            navigate={navigate}
          />
        </div>
      </section>

      {/* Panels 2 + 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Panel 2 — Pending Reviews */}
        <section>
          <SectionHeader>Pending Reviews ({pendingReviews.length})</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {pendingLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-700/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingReviews.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto mb-2" />
                <p className="text-sm text-teal-400 font-heading font-bold">All reviews complete</p>
                <p className="text-[11px] text-slate-600 mt-1">No pending inspections</p>
              </div>
            ) : (
              <>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/60">
                  {pendingReviews.slice(0, 10).map((insp) => {
                    const cond = insp.condition ?? "good";
                    const cs = CONDITION_STYLE[cond] ?? CONDITION_STYLE.good;
                    return (
                      <div
                        key={insp.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/admin/compliance/${insp.id}`)}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white font-heading font-mono">
                            TRK-{insp.truck_id?.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-[10px] text-slate-500">{fmtDate(insp.submitted_at, cfg.locale)}</p>
                        </div>
                        <span className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full shrink-0 ${cs.pill}`}>
                          {cond}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      </div>
                    );
                  })}
                </div>
                {pendingReviews.length > 10 && (
                  <div className="border-t border-slate-700 px-4 py-2.5">
                    <p className="text-[11px] text-slate-500">
                      Showing 10 of {pendingReviews.length} ·{" "}
                      <span className="text-violet-400 font-semibold cursor-pointer hover:text-violet-300">
                        View all
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Panel 3 — High-Risk Shipments */}
        <section>
          <SectionHeader>High-Risk Shipments</SectionHeader>
          <div className="space-y-3">
            <RiskSection icon={FlaskConical} label="Hazardous Cargo" color="red" items={hazmatLoads} navigate={navigate} />
            <RiskSection icon={Thermometer} label="Cold Chain" color="sky" items={coldChainLoads} navigate={navigate} />
            <RiskSection icon={Globe} label="Cross-Border" color="violet" items={crossBorderLoads} navigate={navigate} />
          </div>
        </section>
      </div>

      {/* Panels 4 + 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Panel 4 — Audit Log */}
        <section>
          <SectionHeader>Audit Log</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {recentHistory.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-sm">No review history yet</div>
            ) : (
              <div className="divide-y divide-slate-700/60">
                {recentHistory.map((rev) => {
                  const ds = DECISION_STYLE[rev.decision] ?? { label: rev.decision ?? "—", cls: "bg-slate-700 text-slate-400" };
                  return (
                    <div key={rev.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white font-mono">
                          TRK-{rev.truck_id?.slice(0, 8).toUpperCase()}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span className="text-[10px] text-slate-500">{fmtDate(rev.reviewed_at ?? rev.submitted_at, cfg.locale)}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ds.cls}`}>
                        {ds.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Repeated Offenders */}
            {repeatedOffenders.length > 0 && (
              <div className="border-t border-slate-700 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 font-heading mb-2">
                  Repeated Offenders
                </p>
                <div className="flex flex-wrap gap-2">
                  {repeatedOffenders.slice(0, 6).map(([truckId, count]) => (
                    <span
                      key={truckId}
                      className="text-[10px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full"
                    >
                      {truckId.slice(0, 8).toUpperCase()} ×{count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unverified trucks callout */}
            {unverifiedTrucks.length > 0 && (
              <div className="border-t border-slate-700 px-4 py-3 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <FileWarning className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-300 font-heading font-semibold">
                    {unverifiedTrucks.length} truck{unverifiedTrucks.length !== 1 ? "s" : ""} operating without verification
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Panel 5 — Document Status */}
        <section>
          <SectionHeader>Document Status</SectionHeader>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <DocRow label="Missing Documents" count={missingDocs.length} total={drivers.length || 1} level="critical" />
            <DocRow label={`${cfg.transportAuthority} Unverified`} count={unntsa.length} total={drivers.length || 1} level="warning" />
            <DocRow label="Rejected Drivers" count={rejectedDrivers.length} total={drivers.length || 1} level="critical" />
            <DocRow label="Pending Approval" count={pendingDrivers.length} total={drivers.length || 1} level="warning" />

            <div className="pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-heading font-bold">Overall Compliance</span>
                <span className={`text-sm font-bold font-mono ${compliancePct >= 80 ? "text-teal-400" : compliancePct >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {compliancePct}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${compliancePct >= 80 ? "bg-teal-500" : compliancePct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${compliancePct}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => navigate("/admin/drivers")}
              className="w-full mt-1 text-center text-xs font-bold text-violet-400 hover:text-violet-300 font-heading transition-colors"
            >
              View all drivers
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
