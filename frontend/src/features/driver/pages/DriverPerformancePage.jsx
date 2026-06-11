import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Star, CheckCircle2, XCircle, Zap, TrendingUp, Route,
  Package, Trophy, Loader, AlertCircle,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";

function KpiCard({ icon: Icon, iconColor, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-heading font-bold text-slate-900 dark:text-white mt-0.5">{value ?? "—"}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"}`}
        />
      ))}
      <span className="ml-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function DriverPerformancePage() {
  const { driverId } = useParams();
  const user = useAuthStore((s) => s.user);

  const { data: driverProfile } = useQuery({
    queryKey: ["driver-me"],
    queryFn: () => apiClient.get("/drivers/me").then((r) => r.data),
    enabled: !driverId,
  });

  const resolvedDriverId = driverId ?? driverProfile?.id;

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["driver-stats", resolvedDriverId],
    queryFn: () => apiClient.get(`/drivers/${resolvedDriverId}/stats`).then((r) => r.data),
    enabled: !!resolvedDriverId,
    staleTime: 60_000,
  });

  if (isLoading || (!stats && !isError)) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader className="w-6 h-6 animate-spin mr-2" /> Loading performance…
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <AlertCircle className="w-5 h-5" /> Could not load performance data.
      </div>
    );
  }

  const completionColor =
    stats.completion_rate_pct >= 90 ? "text-emerald-500" :
    stats.completion_rate_pct >= 70 ? "text-amber-500" :
    "text-red-500";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Performance Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your delivery statistics and service quality metrics.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={CheckCircle2}
          iconColor="bg-emerald-500"
          label="Total Trips"
          value={stats.total_trips}
          sub={`${stats.completed_trips} completed`}
        />
        <KpiCard
          icon={TrendingUp}
          iconColor="bg-violet-500"
          label="Completion Rate"
          value={<span className={completionColor}>{stats.completion_rate_pct}%</span>}
          sub={`${stats.cancelled_trips} cancelled`}
        />
        <KpiCard
          icon={Star}
          iconColor="bg-amber-500"
          label="Avg Rating"
          value={stats.avg_rating != null ? stats.avg_rating.toFixed(1) : "N/A"}
          sub={stats.avg_rating ? "from shippers" : "No ratings yet"}
        />
        <KpiCard
          icon={Zap}
          iconColor="bg-sky-500"
          label="This Month"
          value={stats.trips_this_month}
          sub="trips completed"
        />
      </div>

      {/* Rating */}
      {stats.avg_rating != null && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" /> Shipper Rating
          </h2>
          <StarRow rating={stats.avg_rating} />
          <p className="text-xs text-slate-400 mt-2">Based on ratings from shippers after completed deliveries.</p>
        </div>
      )}

      {/* Top corridors */}
      {stats.top_corridors?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-violet-500" /> Top Corridors
          </h2>
          <div className="space-y-3">
            {stats.top_corridors.map((c, i) => {
              const maxTrips = stats.top_corridors[0].trips;
              const pct = Math.round((c.trips / maxTrips) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate mr-2">{c.route}</span>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">{c.trips} trip{c.trips !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cargo type breakdown */}
      {stats.cargo_type_breakdown?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-500" /> Cargo Types Handled
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.cargo_type_breakdown.map((c) => (
              <div
                key={c.type}
                className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg"
              >
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 capitalize">
                  {c.type.replace(/_/g, " ")}
                </span>
                <span className="ml-1.5 text-[10px] text-sky-500">{c.trips}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disputes */}
      {stats.disputes_raised > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-6 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            <span className="font-semibold">{stats.disputes_raised} dispute{stats.disputes_raised !== 1 ? "s" : ""}</span> raised on your shipments.
            Contact support if you believe any were unfair.
          </p>
        </div>
      )}
    </div>
  );
}
