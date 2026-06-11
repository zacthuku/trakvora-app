import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, XCircle, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";

const STATUS_COLORS = {
  available:      "bg-blue-900/40 text-blue-300 border-blue-700/40",
  bidding:        "bg-amber-900/40 text-amber-300 border-amber-700/40",
  booked:         "bg-violet-900/40 text-violet-300 border-violet-700/40",
  en_route_pickup:"bg-orange-900/40 text-orange-300 border-orange-700/40",
  loaded:         "bg-cyan-900/40 text-cyan-300 border-cyan-700/40",
  in_transit:     "bg-indigo-900/40 text-indigo-300 border-indigo-700/40",
  delivered:      "bg-green-900/40 text-green-300 border-green-700/40",
  cancelled:      "bg-slate-800 text-slate-500 border-slate-700",
};

const CARGO_COLORS = {
  general:        "text-slate-300",
  refrigerated:   "text-cyan-400",
  hazardous:      "text-red-400",
  livestock:      "text-green-400",
  construction:   "text-amber-400",
  agricultural:   "text-lime-400",
  electronics:    "text-violet-400",
};

const STATUSES = ["", "available", "bidding", "booked", "en_route_pickup", "loaded", "in_transit", "delivered", "cancelled"];

export default function AdminLoadsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(null);
  const LIMIT = 15;

  const params = {
    page,
    limit: LIMIT,
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-loads", params],
    queryFn: () => adminApi.getLoads(params),
    staleTime: 15_000,
  });

  const cancelMut = useMutation({
    mutationFn: (id) => adminApi.cancelLoad(id),
    onSuccess: () => {
      setConfirmCancel(null);
      qc.invalidateQueries({ queryKey: ["admin-loads"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const loads = data?.items ?? [];

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">Load Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">{total} total loads</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search pickup or dropoff…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:border-violet-500 outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace("_", " ") : "All Statuses"}</option>
          ))}
        </select>
      </div>

      {/* Cancel confirm */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl my-auto">
            <h3 className="text-base font-bold text-white font-heading mb-2">Cancel Load</h3>
            <p className="text-sm text-slate-400 mb-5">
              Cancel the load from <strong className="text-white">{confirmCancel.pickup}</strong> → <strong className="text-white">{confirmCancel.dropoff}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700">
                Keep Load
              </button>
              <button onClick={() => cancelMut.mutate(confirmCancel.id)} disabled={cancelMut.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold">
                {cancelMut.isPending ? "Cancelling…" : "Cancel Load"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Route</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Shipper</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Cargo</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Weight</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Price</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Mode</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Date</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={9} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : loads.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-600">No loads found</td></tr>
              ) : (
                loads.map((lo) => (
                  <tr key={lo.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-white leading-snug">{lo.pickup_location}</p>
                      <p className="text-[10px] text-slate-500">→ {lo.dropoff_location}</p>
                      {lo.corridor && <p className="text-[10px] text-violet-400">{lo.corridor}</p>}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <p className="text-xs text-white">{lo.shipper_name}</p>
                      <p className="text-[10px] text-slate-500">{lo.shipper_email}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className={`text-xs font-semibold capitalize ${CARGO_COLORS[lo.cargo_type] ?? "text-slate-300"}`}>
                        {lo.cargo_type}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className="text-xs text-slate-300">{lo.weight_tonnes}t</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-green-400 font-heading">
                        KES {(lo.price_kes ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase font-heading ${lo.booking_mode === "auction" ? "text-amber-400" : "text-slate-400"}`}>
                        {lo.booking_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${STATUS_COLORS[lo.status] ?? "bg-slate-800 text-slate-500 border-slate-700"}`}>
                        {lo.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span className="text-[10px] text-slate-500">
                        {lo.pickup_date || (lo.created_at ? new Date(lo.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "–")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {!["cancelled", "delivered"].includes(lo.status) && (
                          <button
                            onClick={() => setConfirmCancel({ id: lo.id, pickup: lo.pickup_location, dropoff: lo.dropoff_location })}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors"
                            title="Cancel load"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            Showing {loads.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 min-w-[60px] text-center">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
