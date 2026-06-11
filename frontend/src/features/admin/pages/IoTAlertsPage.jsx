import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  critical: { badge: "bg-red-500/20 text-red-400 border-red-700/50",    dot: "bg-red-500"    },
  high:     { badge: "bg-orange-500/20 text-orange-400 border-orange-700/50", dot: "bg-orange-500" },
  medium:   { badge: "bg-amber-500/20 text-amber-400 border-amber-700/50",  dot: "bg-amber-500"  },
  low:      { badge: "bg-slate-800 text-slate-400 border-slate-700",     dot: "bg-slate-500"  },
};

const ALERT_TYPE_LABEL = {
  no_ping:          "No Ping",
  duplicate_id:     "Duplicate ID",
  tamper:           "Tamper Detected",
  low_battery:      "Low Battery",
  signal_lost:      "Signal Lost",
  unrealistic_jump: "GPS Jump",
};

const SEVERITY_FILTERS = ["all", "critical", "high", "medium", "low"];

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, onResolve, resolving }) {
  const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.low;
  return (
    <div className={`border rounded-xl p-4 transition-colors ${style.badge}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${style.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white font-heading">
                {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${style.badge}`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-500">
              {alert.truck_registration && <span>Truck {alert.truck_registration}</span>}
              {alert.device_serial && <span>SN {alert.device_serial}</span>}
              <span>{relTime(alert.created_at)}</span>
              {alert.resolved_at && (
                <span className="text-green-500">Resolved {relTime(alert.resolved_at)}</span>
              )}
            </div>
          </div>
        </div>
        {!alert.resolved_at && (
          <button
            onClick={() => onResolve(alert.id)}
            disabled={resolving}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-400 hover:bg-green-900/50 text-xs font-bold font-heading transition-colors disabled:opacity-40"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Resolve
          </button>
        )}
        {alert.resolved_at && (
          <span className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-900/20 border border-green-700/30 text-green-500 text-xs font-heading">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IoTAlertsPage() {
  const qc = useQueryClient();
  const [resolvedFilter, setResolvedFilter] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [resolvingId, setResolvingId] = useState(null);
  const LIMIT = 30;

  const params = { page, limit: LIMIT, resolved: resolvedFilter };
  if (severityFilter !== "all") params.severity = severityFilter;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["iot-alerts", params],
    queryFn: () => adminApi.getIoTAlerts(params),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const resolveMut = useMutation({
    mutationFn: (id) => adminApi.resolveAlert(id),
    onMutate: (id) => setResolvingId(id),
    onSettled: () => setResolvingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iot-alerts"] });
      qc.invalidateQueries({ queryKey: ["iot-dashboard"] });
      toast("Alert resolved", "success");
    },
    onError: () => toast("Failed to resolve alert", "error"),
  });

  const alerts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" /> IoT Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} alert{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Resolved toggle */}
      <div className="flex gap-2">
        {[{ label: "Unresolved", value: false }, { label: "Resolved", value: true }].map(({ label, value }) => (
          <button
            key={String(value)}
            onClick={() => { setResolvedFilter(value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold font-heading uppercase tracking-widest transition-colors ${
              resolvedFilter === value ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Severity filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SEVERITY_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setSeverityFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              severityFilter === s
                ? "bg-violet-600 text-white"
                : s === "critical" ? "bg-red-900/30 text-red-400 hover:text-red-300"
                : s === "high"     ? "bg-orange-900/30 text-orange-400 hover:text-orange-300"
                : s === "medium"   ? "bg-amber-900/30 text-amber-400 hover:text-amber-300"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
          <p className="text-sm text-slate-500">
            {resolvedFilter ? "No resolved alerts found" : "No active alerts — all clear"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              onResolve={(id) => resolveMut.mutate(id)}
              resolving={resolvingId === a.id && resolveMut.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Prev</button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Next</button>
        </div>
      )}

    </div>
  );
}
