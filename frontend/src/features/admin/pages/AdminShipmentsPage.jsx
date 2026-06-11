import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ShieldCheck, Info, FileSearch, X, MapPin, Navigation2, Clock } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";

const STATUS_COLORS = {
  booked:          "bg-violet-900/40 text-violet-300 border-violet-700/40",
  en_route_pickup: "bg-orange-900/40 text-orange-300 border-orange-700/40",
  loaded:          "bg-cyan-900/40 text-cyan-300 border-cyan-700/40",
  in_transit:      "bg-indigo-900/40 text-indigo-300 border-indigo-700/40",
  delivered:       "bg-green-900/40 text-green-300 border-green-700/40",
  cancelled:       "bg-slate-800 text-slate-500 border-slate-700",
};

export default function AdminShipmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [disputesOnly, setDisputesOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmResolve, setConfirmResolve] = useState(null);
  const [resolveNote, setResolveNote] = useState("");
  const [evidenceId, setEvidenceId] = useState(null);
  const LIMIT = 15;

  const params = {
    page,
    limit: LIMIT,
    ...(disputesOnly && { disputes_only: true }),
    ...(statusFilter && { status: statusFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-shipments", params],
    queryFn: () => adminApi.getShipments(params),
    staleTime: 15_000,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, note }) => adminApi.resolveDispute(id, note),
    onSuccess: () => {
      setConfirmResolve(null);
      setResolveNote("");
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const { data: evidenceData, isLoading: evidenceLoading } = useQuery({
    queryKey: ["admin-dispute-evidence", evidenceId],
    queryFn: () => adminApi.getDisputeEvidence(evidenceId),
    enabled: Boolean(evidenceId),
    staleTime: 60_000,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const shipments = data?.items ?? [];

  return (
    <div className="py-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Shipments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total shipments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setDisputesOnly(!disputesOnly); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-heading border transition-colors ${
              disputesOnly
                ? "bg-red-900/60 border-red-700 text-red-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Disputes Only
          </button>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:border-violet-500 outline-none"
          >
            <option value="">All Statuses</option>
            {["booked", "en_route_pickup", "loaded", "in_transit", "delivered", "cancelled"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Enhanced Dispute Resolve Modal */}
      {confirmResolve && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl my-auto overflow-hidden">

            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-heading">Resolve Dispute</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{confirmResolve.route}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Shipment summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Shipper</p>
                  <p className="text-sm font-semibold text-white truncate">{confirmResolve.shipper}</p>
                </div>
                <div className="bg-slate-800 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Value</p>
                  <p className="text-sm font-semibold text-green-400">KES {(confirmResolve.value ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Escrow</p>
                  <p className={`text-sm font-semibold ${confirmResolve.escrowLocked ? "text-amber-400" : "text-slate-400"}`}>
                    {confirmResolve.escrowLocked ? "Locked" : "Unlocked"}
                    {confirmResolve.escrowReleased ? " · Released" : ""}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Delivered</p>
                  <p className="text-sm font-semibold text-slate-300">
                    {confirmResolve.deliveredAt
                      ? new Date(confirmResolve.deliveredAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Dispute reason from shipper */}
              {confirmResolve.disputeReason && (
                <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Shipper's Dispute Reason</p>
                  <p className="text-xs text-red-200 leading-relaxed">{confirmResolve.disputeReason}</p>
                  {confirmResolve.disputeOpenedAt && (
                    <p className="text-[10px] text-red-400/70 mt-1.5">
                      Opened: {new Date(confirmResolve.disputeOpenedAt).toLocaleString("en-KE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              )}

              {/* Resolution note */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Resolution Note (optional)
                </label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. GPS history confirms delivery. Releasing escrow to carrier."
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none transition-colors"
                />
              </div>

              {/* Endpoint explanation */}
              <div className="flex gap-2.5 bg-slate-800/60 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                  <p><span className="text-slate-400 font-semibold">What this does:</span> Sets <code className="text-violet-400">dispute_open = false</code> and saves your note on the shipment record.</p>
                  <p>Escrow is <span className="text-amber-400 font-semibold">not</span> auto-released — handle that separately from the Wallets page. Both parties receive a <code className="text-violet-400">dispute_resolved</code> notification.</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setConfirmResolve(null); setResolveNote(""); }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => resolveMut.mutate({ id: confirmResolve.id, note: resolveNote })}
                  disabled={resolveMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {resolveMut.isPending ? "Saving…" : "Mark Resolved"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence panel */}
      {evidenceId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl my-auto overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
              <FileSearch className="w-5 h-5 text-violet-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white font-heading">Dispute Evidence</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{evidenceData?.route ?? "Loading…"}</p>
              </div>
              <button onClick={() => setEvidenceId(null)} className="ml-auto text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {evidenceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : evidenceData ? (
                <>
                  {/* Dispute details */}
                  {evidenceData.dispute?.reason && (
                    <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Dispute Reason</p>
                      <p className="text-xs text-red-200 leading-relaxed">{evidenceData.dispute.reason}</p>
                    </div>
                  )}

                  {/* Delivery info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Delivery Method</p>
                      <p className="text-xs font-semibold text-white">{evidenceData.delivery_method ?? "—"}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">GPS Trail Points</p>
                      <p className="text-xs font-semibold text-white">{evidenceData.gps_trail_count}</p>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Key Timestamps
                    </p>
                    {[
                      ["Delivered", evidenceData.timestamps?.delivered_at],
                      ["Auto-delivered", evidenceData.timestamps?.auto_delivered_at],
                      ["Dispute opened", evidenceData.timestamps?.dispute_opened_at],
                      ["Payment confirmed", evidenceData.timestamps?.payment_confirmed_at],
                    ].map(([label, ts]) => ts && (
                      <div key={label} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-slate-300 font-mono">{new Date(ts).toLocaleString("en-KE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery location */}
                  {evidenceData.delivery_location_name && (
                    <div className="bg-slate-800 rounded-xl px-4 py-3 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Delivery Location
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">{evidenceData.delivery_location_name}</p>
                      {evidenceData.delivery_latitude && (
                        <p className="text-[10px] font-mono text-slate-500">
                          {evidenceData.delivery_latitude.toFixed(5)}, {evidenceData.delivery_longitude.toFixed(5)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* GPS trail preview (last 5 points) */}
                  {evidenceData.gps_trail?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Navigation2 className="w-3 h-3" /> GPS Trail (last {Math.min(5, evidenceData.gps_trail.length)} of {evidenceData.gps_trail_count})
                      </p>
                      <div className="space-y-1">
                        {evidenceData.gps_trail.slice(-5).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-400">{new Date(p.recorded_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            <span className="text-slate-300">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                            <span className="text-slate-500">{p.source?.replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delivery photos */}
                  {evidenceData.delivery_photos?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Delivery Photos ({evidenceData.delivery_photos.length})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {evidenceData.delivery_photos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`delivery-${i}`} className="w-full h-20 object-cover rounded-lg border border-slate-700 hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Route</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Shipper</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Value</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Escrow</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Dispute</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Delivered</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={8} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : shipments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-600">No shipments found</td></tr>
              ) : (
                shipments.map((sh) => (
                  <tr key={sh.id} className={`border-b border-slate-800 transition-colors ${sh.dispute_open ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-slate-800/30"}`}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-white leading-snug">{sh.pickup_location}</p>
                      <p className="text-[10px] text-slate-500">→ {sh.dropoff_location}</p>
                      {sh.corridor && <p className="text-[10px] text-violet-400">{sh.corridor}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-white">{sh.shipper_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-green-400 font-heading">
                        KES {(sh.price_kes ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          {sh.escrow_locked
                            ? <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            : <div className="w-3 h-3 rounded-full border border-slate-700" />}
                          <span className="text-[10px] text-slate-500">Locked</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {sh.escrow_released
                            ? <CheckCircle2 className="w-3 h-3 text-green-400" />
                            : <div className="w-3 h-3 rounded-full border border-slate-700" />}
                          <span className="text-[10px] text-slate-500">Released</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${STATUS_COLORS[sh.status] ?? "bg-slate-800 text-slate-500 border-slate-700"}`}>
                        {sh.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sh.dispute_open ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-900/50 text-red-300 border-red-700/50 uppercase tracking-widest font-heading">
                          <AlertTriangle className="w-3 h-3" /> Open
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-slate-500">
                        {sh.delivered_at ? new Date(sh.delivered_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "–"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {sh.dispute_open && (
                          <button
                            onClick={() => setEvidenceId(sh.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-violet-900/60 hover:bg-violet-800/80 text-violet-300 text-[10px] font-bold uppercase tracking-wide rounded-lg font-heading transition-colors"
                          >
                            <FileSearch className="w-3 h-3" />
                            Evidence
                          </button>
                        )}
                        {sh.dispute_open && (
                          <button
                            onClick={() => setConfirmResolve({
                              id: sh.id,
                              route: `${sh.pickup_location} → ${sh.dropoff_location}`,
                              shipper: sh.shipper_name,
                              value: sh.price_kes,
                              escrowLocked: sh.escrow_locked,
                              escrowReleased: sh.escrow_released,
                              deliveredAt: sh.delivered_at,
                              disputeReason: sh.dispute_reason,
                              disputeOpenedAt: sh.dispute_opened_at,
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-green-800/60 hover:bg-green-700/80 text-green-300 text-[10px] font-bold uppercase tracking-wide rounded-lg font-heading transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Resolve
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
            Showing {shipments.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}
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
