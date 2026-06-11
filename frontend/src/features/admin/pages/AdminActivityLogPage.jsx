import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { format, parseISO } from "date-fns";

const BADGE_MAP = {
  user_registered:      "bg-green-900/50 text-green-300 border-green-700/50",
  kyc_approved:         "bg-green-900/50 text-green-300 border-green-700/50",
  driver_verified:      "bg-green-900/50 text-green-300 border-green-700/50",
  withdrawal_approved:  "bg-green-900/50 text-green-300 border-green-700/50",
  truck_activated:      "bg-green-900/50 text-green-300 border-green-700/50",
  user_unsuspended:     "bg-green-900/50 text-green-300 border-green-700/50",
  user_unverified:      "bg-slate-800 text-slate-300 border-slate-600",

  user_suspended:       "bg-red-900/50 text-red-300 border-red-700/50",
  kyc_rejected:         "bg-red-900/50 text-red-300 border-red-700/50",
  driver_rejected:      "bg-red-900/50 text-red-300 border-red-700/50",
  withdrawal_rejected:  "bg-red-900/50 text-red-300 border-red-700/50",
  truck_deactivated:    "bg-red-900/50 text-red-300 border-red-700/50",

  demo_requested:       "bg-blue-900/50 text-blue-300 border-blue-700/50",

  load_cancelled:       "bg-orange-900/50 text-orange-300 border-orange-700/50",

  dispute_resolved:     "bg-purple-900/50 text-purple-300 border-purple-700/50",

  user_verified:        "bg-teal-900/50 text-teal-300 border-teal-700/50",
};

function actionBadge(action) {
  const cls = BADGE_MAP[action] ?? (action.startsWith("admin_")
    ? "bg-slate-800 text-slate-300 border-slate-600"
    : "bg-slate-700 text-slate-400 border-slate-600");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-heading ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

const ACTION_OPTIONS = [
  "demo_requested", "user_registered", "user_suspended", "user_unsuspended",
  "user_verified", "user_unverified", "kyc_approved", "kyc_rejected",
  "driver_verified", "driver_rejected", "load_cancelled", "dispute_resolved",
  "withdrawal_approved", "withdrawal_rejected", "truck_activated", "truck_deactivated",
  "admin_created", "admin_role_changed", "admin_suspended", "admin_revoked",
];

const FINANCE_ACTION_OPTIONS = [
  "withdrawal_approved", "withdrawal_rejected",
  "escrow_release", "escrow_refund",
  "payout", "platform_fee",
  "subscription_payment", "subscription_cancelled",
  "dispute_hold", "dispute_resolved",
];

export default function AdminActivityLogPage() {
  const { user } = useAuthStore();
  const isFinanceAdmin = user?.admin_role === "finance_admin";
  const actionOptions = isFinanceAdmin ? FINANCE_ACTION_OPTIONS : ACTION_OPTIONS;

  const [filters, setFilters] = useState({
    action: "",
    resource_type: "",
    from_date: "",
    to_date: "",
    page: 1,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity-log", filters],
    queryFn: () => {
      const params = { page: filters.page, page_size: 50 };
      if (filters.action)        params.action        = filters.action;
      if (filters.resource_type) params.resource_type = filters.resource_type;
      if (filters.from_date)     params.from_date     = filters.from_date;
      if (filters.to_date)       params.to_date       = filters.to_date;
      return adminApi.getActivityLog(params);
    },
    refetchInterval: 30_000,
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50) || 1;

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Activity Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isFinanceAdmin ? "Finance activity — withdrawals, payouts, escrow, and subscription events" : "Complete audit trail of all platform events"}
          </p>
        </div>
        {isFetching && (
          <span className="text-xs text-slate-500 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3">
        <select
          value={filters.action}
          onChange={e => setFilter("action", e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">{isFinanceAdmin ? "All finance actions" : "All actions"}</option>
          {actionOptions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>

        <select
          value={filters.resource_type}
          onChange={e => setFilter("resource_type", e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All resources</option>
          {["user", "driver", "load", "shipment", "transaction", "truck"].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.from_date}
          onChange={e => setFilter("from_date", e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          type="date"
          value={filters.to_date}
          onChange={e => setFilter("to_date", e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />

        {(filters.action || filters.resource_type || filters.from_date || filters.to_date) && (
          <button
            onClick={() => setFilters({ action: "", resource_type: "", from_date: "", to_date: "", page: 1 })}
            className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-500 self-center">{total} events</span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No activity found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 font-bold uppercase tracking-widest font-heading">
                  <th className="text-left px-5 py-3">Timestamp</th>
                  <th className="text-left px-5 py-3">Action</th>
                  <th className="text-left px-5 py-3">Actor</th>
                  <th className="text-left px-5 py-3">Summary</th>
                  <th className="text-left px-5 py-3">Resource</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-400 text-xs font-mono">
                      {format(parseISO(log.created_at), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {actionBadge(log.action)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-200 text-xs font-medium">{log.actor_name ?? "System"}</div>
                      {log.actor_role && (
                        <div className="text-slate-500 text-[10px]">{log.actor_role.replace(/_/g, " ")}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-xs max-w-xs">{log.summary}</td>
                    <td className="px-5 py-3">
                      {log.resource_type ? (
                        <div>
                          <div className="text-slate-400 text-xs capitalize">{log.resource_type}</div>
                          {log.resource_id && (
                            <div className="text-slate-600 text-[10px] font-mono">{log.resource_id.slice(0, 8)}…</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {filters.page} of {totalPages}
          </span>
          <button
            disabled={filters.page >= totalPages}
            onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
