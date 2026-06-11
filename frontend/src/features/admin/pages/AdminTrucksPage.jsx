import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Power, CheckCircle2, X,
  ShieldCheck, ShieldX, ShieldAlert, ExternalLink, FileText, RefreshCw,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const TRUCK_TYPE_COLORS = {
  flatbed:  "text-amber-400",
  dry_van:  "text-blue-400",
  reefer:   "text-cyan-400",
  tanker:   "text-orange-400",
  lowbed:   "text-violet-400",
  tipper:   "text-green-400",
};

const INSPECTION_LABEL = {
  not_requested: { label: "Not Submitted", cls: "text-slate-500" },
  pending:       { label: "Pending",       cls: "text-amber-400"  },
  in_progress:   { label: "In Progress",   cls: "text-sky-400"    },
  submitted:     { label: "Submitted",     cls: "text-sky-300 font-bold" },
  approved:      { label: "Approved",      cls: "text-emerald-400 font-bold" },
  rejected:      { label: "Rejected",      cls: "text-red-400 font-bold"    },
  re_inspection: { label: "Re-inspect",    cls: "text-orange-400"  },
};

// ── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ truck, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-heading font-bold text-white flex items-center gap-2">
            <ShieldX className="w-5 h-5 text-red-400" /> Reject Truck Verification
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-300">
            Rejecting <span className="font-mono font-bold text-white">{truck.registration_number}</span>.
            The owner will be notified with your reason.
          </p>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Rejection Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Insurance certificate expired, please resubmit with a valid document."
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={!reason.trim() || isPending}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Rejecting…</>
                : <><ShieldX className="w-4 h-4" /> Confirm Reject</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Links Panel (list view) ─────────────────────────────────────────
function DocLinks({ truck }) {
  const docs = [
    { label: "Logbook", url: truck.logbook_url },
    { label: "Insurance", url: truck.insurance_url },
    { label: "Inspection Cert", url: truck.ntsa_inspection_url },
  ].filter(d => d.url);
  if (!docs.length) return <span className="text-[10px] text-slate-600">No documents</span>;
  return (
    <div className="flex flex-col gap-1">
      {docs.map(d => (
        <a key={d.label} href={d.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline">
          <ExternalLink className="w-3 h-3 shrink-0" /> {d.label}
        </a>
      ))}
    </div>
  );
}

// ── Truck Detail Drawer ───────────────────────────────────────────────────────
function DocRow({ label, url, expiry }) {
  return (
    <div className="py-2.5 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FileText className={`w-3.5 h-3.5 shrink-0 ${url ? "text-green-400" : "text-slate-600"}`} />
          <span className="text-xs text-slate-300">{label}</span>
        </div>
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-semibold transition-colors">
              View <ExternalLink className="w-3 h-3" />
            </a>
          : <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 text-[10px] font-bold border border-slate-700">Missing</span>
        }
      </div>
      {expiry && <p className="text-[10px] text-slate-500 ml-5">Expires: {expiry}</p>}
    </div>
  );
}

function AdminTruckDetailDrawer({ truckId, onClose, onApprove, onReject, onToggle, onRetrigger, verifyIsPending, toggleIsPending }) {
  const { transportAuthority } = useCountryConfig();
  const { data: truck, isLoading } = useQuery({
    queryKey: ["admin-truck-detail", truckId],
    queryFn: () => adminApi.getTruck(truckId),
    enabled: !!truckId,
  });

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-base font-bold text-white font-heading">Truck Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 py-16">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : truck ? (
          <div className="px-5 py-4 space-y-5 flex-1">
            {/* Truck identity */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-white font-mono">{truck.registration_number}</p>
                  <p className="text-xs text-slate-400 capitalize">{truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t</p>
                  {(truck.make || truck.model || truck.year) && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{[truck.make, truck.model, truck.year].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${truck.is_active ? "bg-green-900/40 text-green-300 border-green-700/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
                    {truck.is_active ? "Active" : "Inactive"}
                  </span>
                  {truck.is_driver_owned && (
                    <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">Owner-operated</span>
                  )}
                </div>
              </div>

              {truck.verification_notes && (
                <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-300 mt-2">
                  <span className="font-semibold">Rejection reason:</span> {truck.verification_notes}
                </div>
              )}
            </div>

            {/* Owner */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Owner</p>
              <p className="text-sm text-white">{truck.owner_name}</p>
              <p className="text-xs text-slate-400">{truck.owner_email}</p>
              {truck.owner_phone && <p className="text-xs text-slate-500">{truck.owner_phone}</p>}
            </div>

            {/* Transport Authority Plate Check */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{`${transportAuthority} Plate Check`}</p>
              {truck.reg_check_status === "passed" && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <ShieldCheck className="w-4 h-4" /> Passed
                  {truck.reg_check_owner && <span className="text-[10px] text-slate-400">· Owner on record: {truck.reg_check_owner}</span>}
                </div>
              )}
              {truck.reg_check_status === "failed" && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <ShieldAlert className="w-4 h-4" /> Failed{truck.reg_check_detail ? ` — ${truck.reg_check_detail}` : ""}
                </div>
              )}
              {truck.reg_check_status === "pending" && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Checking…
                </div>
              )}
              {(!truck.reg_check_status || truck.reg_check_status === "unverified") && (
                <p className="text-slate-500 text-xs">Not yet checked</p>
              )}
              {truck.reg_check_at && (
                <p className="text-[10px] text-slate-600 mt-1">Last checked: {new Date(truck.reg_check_at).toLocaleString()}</p>
              )}
            </div>

            {/* Inspection status */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Inspection Status</p>
              {truck.is_verified ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <ShieldCheck className="w-4 h-4" /> Verified
                </div>
              ) : (
                <p className={`text-sm ${(INSPECTION_LABEL[truck.inspection_status] ?? INSPECTION_LABEL.not_requested).cls}`}>
                  {(INSPECTION_LABEL[truck.inspection_status] ?? INSPECTION_LABEL.not_requested).label}
                </p>
              )}
              {truck.verification_score != null && (
                <p className="text-[10px] text-slate-500 mt-1">Score: {truck.verification_score}</p>
              )}
            </div>

            {/* Documents */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Documents</p>
              <DocRow label="Logbook" url={truck.logbook_url} />
              <DocRow label="Insurance Certificate" url={truck.insurance_url} expiry={truck.insurance_expiry} />
              <DocRow label={`${transportAuthority} Inspection Certificate`} url={truck.ntsa_inspection_url} expiry={truck.ntsa_inspection_expiry} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pb-4">
              {truck.inspection_status === "submitted" && !truck.is_verified && (
                <button
                  onClick={() => onApprove(truck)}
                  disabled={verifyIsPending}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
              )}
              {(truck.inspection_status === "submitted" || truck.is_verified) && (
                <button
                  onClick={() => onReject(truck)}
                  disabled={verifyIsPending}
                  className="flex-1 py-2.5 bg-red-800 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => onToggle(truck.id)}
                disabled={toggleIsPending}
                title={truck.is_active ? "Deactivate" : "Activate"}
                className={`px-3 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${truck.is_active ? "bg-slate-700 hover:bg-red-900/60 text-slate-300 hover:text-red-300" : "bg-slate-700 hover:bg-green-900/60 text-slate-300 hover:text-green-300"}`}
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRetrigger(truck.id)}
                title={`Re-run ${transportAuthority} plate check`}
                className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm px-5 py-8">Truck not found.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminTrucksPage() {
  const { transportAuthority } = useCountryConfig();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [detailTruck, setDetailTruck] = useState(null);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-trucks", { page, limit: LIMIT }],
    queryFn: () => adminApi.getTrucks({ page, limit: LIMIT }),
    staleTime: 15_000,
  });

  const toggleMut = useMutation({
    mutationFn: (id) => adminApi.toggleTruckActive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-trucks"] });
      qc.invalidateQueries({ queryKey: ["admin-truck-detail"] });
    },
  });

  const verifyMut = useMutation({
    mutationFn: ({ id, action, reason }) => adminApi.verifyTruck(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-trucks"] });
      qc.invalidateQueries({ queryKey: ["admin-truck-detail"] });
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const allTrucks = data?.items ?? [];

  const trucks = filterStatus
    ? allTrucks.filter(t => t.inspection_status === filterStatus)
    : allTrucks;

  const pendingCount = allTrucks.filter(t => t.inspection_status === "submitted").length;

  return (
    <div className="py-8 space-y-6">
      {rejectTarget && (
        <RejectModal
          truck={rejectTarget}
          onClose={() => setRejectTarget(null)}
          isPending={verifyMut.isPending}
          onConfirm={(reason) => {
            verifyMut.mutate(
              { id: rejectTarget.id, action: "reject", reason },
              { onSuccess: () => setRejectTarget(null) }
            );
          }}
        />
      )}

      {detailTruck && (
        <AdminTruckDetailDrawer
          truckId={detailTruck.id}
          onClose={() => setDetailTruck(null)}
          verifyIsPending={verifyMut.isPending}
          toggleIsPending={toggleMut.isPending}
          onApprove={(tr) => verifyMut.mutate({ id: tr.id, action: "approve", reason: null })}
          onReject={(tr) => { setDetailTruck(null); setRejectTarget(tr); }}
          onToggle={(id) => toggleMut.mutate(id)}
          onRetrigger={(id) => adminApi.retriggerTruckCheck(id)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Fleet Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} registered trucks</p>
        </div>
        {pendingCount > 0 && (
          <span className="flex items-center gap-2 px-3 py-2 bg-sky-900/40 border border-sky-700/40 rounded-xl text-xs font-bold text-sky-300">
            <ShieldAlert className="w-4 h-4" /> {pendingCount} awaiting verification
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "", label: "All" },
          { key: "submitted", label: `Pending Review${pendingCount ? ` (${pendingCount})` : ""}` },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStatus === key
                ? "bg-secondary text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Truck</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Owner</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Type / Cap.</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Documents</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Active</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={7} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : trucks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">No trucks found</td></tr>
              ) : (
                trucks.map((tr) => {
                  const inspMeta = INSPECTION_LABEL[tr.inspection_status] ?? { label: tr.inspection_status, cls: "text-slate-500" };
                  return (
                    <tr
                      key={tr.id}
                      className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setDetailTruck(tr)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-white font-heading">{tr.registration_number}</p>
                        <p className="text-[10px] text-slate-500">{[tr.make, tr.model, tr.year].filter(Boolean).join(" · ")}</p>
                        {tr.is_driver_owned && (
                          <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">Owner-operated</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white">{tr.owner_name}</p>
                        <p className="text-[10px] text-slate-500">{tr.owner_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize font-heading ${TRUCK_TYPE_COLORS[tr.truck_type] ?? "text-slate-300"}`}>
                          {tr.truck_type?.replace("_", " ")}
                        </span>
                        <p className="text-[10px] text-slate-500">{tr.capacity_tonnes}t</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <DocLinks truck={tr} />
                        {tr.verification_notes && (
                          <p className="text-[10px] text-red-400 mt-1 line-clamp-2" title={tr.verification_notes}>
                            ✗ {tr.verification_notes}
                          </p>
                        )}
                        {tr.reg_check_status === "passed" && (
                          <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1" title={tr.reg_check_detail}>
                            <ShieldCheck className="w-3 h-3" /> {transportAuthority} ✓
                            {tr.reg_check_owner && (
                              <span className="text-slate-400 ml-1 truncate max-w-[80px]" title={tr.reg_check_owner}>
                                {tr.reg_check_owner}
                              </span>
                            )}
                          </p>
                        )}
                        {tr.reg_check_status === "failed" && (
                          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1" title={tr.reg_check_detail}>
                            <ShieldAlert className="w-3 h-3" /> {transportAuthority} ✗
                          </p>
                        )}
                        {tr.reg_check_status === "pending" && (
                          <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Checking…
                          </p>
                        )}
                        {tr.reg_check_status === "unverified" && (
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Not checked
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tr.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className={`text-[10px] capitalize ${inspMeta.cls}`}>
                            {inspMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${
                          tr.is_active
                            ? "bg-green-900/40 text-green-300 border-green-700/40"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}>
                          {tr.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {tr.inspection_status === "submitted" && !tr.is_verified && (
                            <button
                              onClick={() => verifyMut.mutate({ id: tr.id, action: "approve", reason: null })}
                              disabled={verifyMut.isPending}
                              title="Approve verification"
                              className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 transition-colors disabled:opacity-40"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {(tr.inspection_status === "submitted" || tr.is_verified) && (
                            <button
                              onClick={() => setRejectTarget(tr)}
                              disabled={verifyMut.isPending}
                              title="Reject / revoke verification"
                              className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-400 transition-colors disabled:opacity-40"
                            >
                              <ShieldX className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleMut.mutate(tr.id)}
                            title={tr.is_active ? "Deactivate" : "Activate"}
                            className={`p-1.5 rounded-lg hover:bg-slate-700 transition-colors ${tr.is_active ? "text-green-400 hover:text-red-400" : "text-slate-600 hover:text-green-400"}`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => adminApi.retriggerTruckCheck(tr.id)}
                            title={`Re-run ${transportAuthority} plate check`}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-blue-300 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            Showing {trucks.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}
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
