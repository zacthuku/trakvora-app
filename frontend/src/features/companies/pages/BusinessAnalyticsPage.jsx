import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Truck, Users, DollarSign, CheckCircle2,
  XCircle, Route, Package, Star, Loader,
} from "lucide-react";
import { companiesApi } from "../api/companiesApi";
import { useCompanyStore } from "@/store/companyStore";
import { useCurrency } from "@/hooks/useCurrency";

const PERIODS = [
  { label: "30 days",  value: 30  },
  { label: "90 days",  value: 90  },
  { label: "1 year",   value: 365 },
];

function KpiCard({ icon: Icon, bgColor, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-heading font-bold text-slate-900 dark:text-white mt-0.5">{value ?? "—"}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function BusinessAnalyticsPage() {
  const { format } = useCurrency();
  const { activeCompanyId } = useCompanyStore();
  const [period, setPeriod] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["company-analytics", activeCompanyId, period],
    queryFn: () => companiesApi.getAnalytics(activeCompanyId, { period }),
    enabled: !!activeCompanyId,
    staleTime: 60_000,
  });

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Create or select a company to view analytics.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  const completionRate = data?.total_loads
    ? Math.round((data.completed_loads / data.total_loads) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Business Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{data?.company_name} · {data?.member_count} team members</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p.value
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={Truck}
          bgColor="bg-violet-500"
          label="Total Loads"
          value={data?.total_loads ?? 0}
          sub={`${data?.completed_loads ?? 0} completed`}
        />
        <KpiCard
          icon={DollarSign}
          bgColor="bg-emerald-500"
          label="Transport Value"
          value={data?.total_transport_value_kes ? format(data.total_transport_value_kes) : "KES 0"}
          sub="from completed loads"
        />
        <KpiCard
          icon={CheckCircle2}
          bgColor="bg-sky-500"
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${data?.cancelled_loads ?? 0} cancelled`}
        />
        <KpiCard
          icon={TrendingUp}
          bgColor="bg-amber-500"
          label="On-Time Rate"
          value={`${data?.on_time_delivery_rate_pct ?? 0}%`}
          sub="of completed loads"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top corridors */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-violet-500" /> Top Corridors
          </h2>
          {(data?.top_corridors?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No completed routes yet.</p>
          ) : (
            <div className="space-y-3">
              {data.top_corridors.map((c, i) => {
                const max = data.top_corridors[0].trips;
                const pct = Math.round((c.trips / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-700 dark:text-slate-200 truncate mr-2">{c.route}</span>
                      <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                        {c.trips} trips · {format(c.value_kes)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cargo breakdown */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-500" /> Cargo Types
          </h2>
          {(data?.cargo_type_breakdown?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No cargo data yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.cargo_type_breakdown.map((c) => (
                <div
                  key={c.type}
                  className="px-3 py-2 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl"
                >
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 capitalize">{c.type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-sky-500 mt-0.5">{c.trips} loads · {format(c.value_kes)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top carriers table */}
      {(data?.top_carriers?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" /> Top Carriers
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {["Carrier", "Trips", "Rating", "Value"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.top_carriers.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{c.carrier_name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{c.trips}</td>
                    <td className="px-5 py-3">
                      {c.avg_rating != null ? (
                        <span className="flex items-center gap-1 text-sm text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {c.avg_rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{format(c.value_kes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
