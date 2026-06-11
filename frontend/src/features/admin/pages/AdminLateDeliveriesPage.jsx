import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Phone, Gavel, RefreshCw, Clock, PackageX, TrendingDown } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import apiClient from "@/services/apiClient";

function SignalBadge({ hoursSilent }) {
  if (hoursSilent === null || hoursSilent === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-800 text-slate-400 border-slate-700">
        <Clock className="w-3 h-3" /> No signal
      </span>
    );
  }
  if (hoursSilent > 12) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-900/40 text-red-300 border-red-700/40">
        <Clock className="w-3 h-3" /> {hoursSilent}h ago
      </span>
    );
  }
  if (hoursSilent >= 4) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-orange-900/40 text-orange-300 border-orange-700/40">
        <Clock className="w-3 h-3" /> {hoursSilent}h ago
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-900/40 text-amber-300 border-amber-700/40">
      <Clock className="w-3 h-3" /> {hoursSilent}h ago
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    in_transit:       "bg-blue-900/40 text-blue-300 border-blue-700/40",
    loaded:           "bg-amber-900/40 text-amber-300 border-amber-700/40",
    en_route_pickup:  "bg-violet-900/40 text-violet-300 border-violet-700/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${map[status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminLateDeliveriesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-overdue-shipments"],
    queryFn: adminApi.getOverdueShipments,
    staleTime: 60_000,
  });

  const openDisputeMutation = useMutation({
    mutationFn: (loadId) => apiClient.post(`/payments/shipments/${loadId}/open-dispute`, {
      reason: "Late delivery — no driver communication"
    }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overdue-shipments"] }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const noSignal = items.filter((i) => i.hours_silent === null || i.hours_silent > 4).length;
  const mostOverdue = items.length > 0 ? Math.max(...items.map((i) => i.days_overdue)) : 0;

  return (
    <div className="py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h1 className="text-2xl font-bold text-white font-heading">Late Deliveries</h1>
          </div>
          <p className="text-sm text-slate-500">
            Active shipments past their delivery date with no driver communication (4+ hours silence)
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-red-800/40 rounded-2xl p-5">
          <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center mb-3">
            <PackageX className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 font-heading">{total}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading mt-1">Total Overdue</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Active, past delivery date</p>
        </div>
        <div className="bg-slate-900 border border-orange-800/40 rounded-2xl p-5">
          <div className="w-8 h-8 rounded-lg bg-orange-900/40 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-400 font-heading">{noSignal}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading mt-1">No Driver Signal</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Silent 4+ hours or never pinged</p>
        </div>
        <div className="bg-slate-900 border border-amber-800/40 rounded-2xl p-5">
          <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center mb-3">
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 font-heading">{mostOverdue > 0 ? `${mostOverdue}d` : "–"}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading mt-1">Most Overdue</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Maximum days past deadline</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Route</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Shipper</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Driver</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Due Date</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Overdue</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Last Signal</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-slate-700" />
                      <p className="text-slate-500 text-sm">No overdue shipments — all deliveries are on track</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-white">
                        {item.pickup_location || "?"} → {item.dropoff_location || "?"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.load_id?.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300">{item.shipper_name || "–"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300">{item.driver_name || "–"}</p>
                      {item.driver_phone && (
                        <p className="text-[10px] text-slate-500">{item.driver_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300">{item.delivery_date || "–"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold font-heading ${
                        item.days_overdue > 3 ? "text-red-400" :
                        item.days_overdue > 1 ? "text-orange-400" : "text-amber-400"
                      }`}>
                        {item.days_overdue} day{item.days_overdue !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SignalBadge hoursSilent={item.hours_silent} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {item.driver_phone && (
                          <a
                            href={`tel:${item.driver_phone}`}
                            className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] font-semibold font-heading uppercase tracking-widest transition-colors"
                            title="Call driver"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openDisputeMutation.mutate(item.load_id)}
                          disabled={openDisputeMutation.isPending}
                          className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60 text-[10px] font-semibold font-heading uppercase tracking-widest transition-colors disabled:opacity-40"
                          title="Open dispute"
                        >
                          <Gavel className="w-3 h-3" />
                          Dispute
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-500">
              Showing {items.length} overdue shipment{items.length !== 1 ? "s" : ""} · Auto-refreshes every minute
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
