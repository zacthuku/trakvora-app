import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gavel, MapPin, Package, CheckCircle2, XCircle,
  Clock, ChevronRight, AlertCircle, AlertTriangle, X,
  Truck, Send, ArrowRight, RefreshCw, Loader2, UserCircle2, Building2,
  Zap, MessageSquare,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { loadsApi } from "@/features/loads/api/loadsApi";
import { useCurrency } from "@/hooks/useCurrency";
import { PageSpinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "bg-amber-50",  text: "text-amber-700",  icon: Clock,         dot: "bg-amber-400"  },
  accepted:  { label: "Accepted",  bg: "bg-green-50",  text: "text-green-700",  icon: CheckCircle2,  dot: "bg-green-500"  },
  rejected:  { label: "Rejected",  bg: "bg-red-50",    text: "text-red-600",    icon: XCircle,       dot: "bg-red-400"    },
  withdrawn: { label: "Withdrawn", bg: "bg-slate-100", text: "text-slate-500",  icon: AlertCircle,   dot: "bg-slate-400"  },
};

const TABS = ["all", "pending", "accepted", "rejected", "withdrawn"];

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function TrkCode({ loadId, status }) {
  if (status === "accepted") {
    return (
      <span className="font-mono text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
        TRK-{loadId.slice(0, 8).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className="font-mono text-xs text-slate-300 tracking-widest"
      title="Reference code revealed after acceptance"
    >
      TRK-••••••••
    </span>
  );
}

function WithdrawConfirmModal({ bid, onClose, onConfirm, isPending }) {
  const { format, formatWithSource } = useCurrency();
  const pickup = bid.load?.pickup_location?.split(",")[0] || bid.load?.pickup_location;
  const dropoff = bid.load?.dropoff_location?.split(",")[0] || bid.load?.dropoff_location;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white">Cancel Bid?</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 rounded-lg px-4 py-3 text-center">
            <p className="text-sm font-semibold text-red-800">
              Cancel your bid of <span className="font-bold">{formatWithSource(bid.amount_kes)}</span>?
            </p>
            {pickup && (
              <p className="text-xs text-red-600 mt-1">{pickup} → {dropoff}</p>
            )}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              Your bid will be withdrawn and cannot be undone.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              The load remains open for other carriers.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Keep Bid
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <XCircle className="w-4 h-4" />}
            Cancel Bid
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplaceTruckModal({ bid, onClose }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!reason.trim()) return;
    setSending(true);
    try {
      await apiClient.post("/notifications/send", {
        load_id: bid.load?.id,
        message: reason.trim(),
        type: "truck_replacement_request",
      }).catch(() => {});
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={sent ? onClose : undefined}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <h2 className="font-heading font-bold text-slate-900 dark:text-white">Replace Truck</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-teal-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white mb-1">Request sent</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">The shipper will be notified and must agree before the truck is changed.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90">Close</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">Explain why you need to replace the truck. The shipper must approve before the change takes effect.</p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Original truck broke down — replacing with same type truck KBB 123Z"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-secondary resize-none"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!reason.trim() || sending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DISPATCH_CONDITIONS = [
  "Cargo is ready and accessible at pickup location",
  "Driver has been informed and confirmed availability",
  "Truck is roadworthy, fuelled, and inspected",
];

function DispatchReviewModal({ bid, truck, onClose, onDispatched }) {
  const [checked, setChecked] = useState([false, false, false]);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [error, setError] = useState("");

  // Pre-fetch shipment so we have driver_id for name lookup + ready for dispatch
  const [shipmentData, setShipmentData] = useState(null);
  const [driverUser,   setDriverUser]   = useState(null);
  const [loadingMeta,  setLoadingMeta]  = useState(true);

  useEffect(() => {
    if (!bid.load?.id) { setLoadingMeta(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false;
    async function fetchMeta() {
      try {
        const { data: s } = await apiClient.get(`/shipments/by-load/${bid.load.id}`);
        if (cancelled) return;
        setShipmentData(s);
        // Resolve driver name via truck.assigned_driver_id (not shipment.driver_id,
        // which may be the fleet owner's ID when no driver was assigned at bid time)
        if (truck?.assigned_driver_id) {
          try {
            const { data: driverProfile } = await apiClient.get(`/drivers/${truck.assigned_driver_id}`);
            if (cancelled) return;
            const { data: u } = await apiClient.get(`/users/${driverProfile.user_id}/public`);
            if (!cancelled) setDriverUser(u);
          } catch { /* name optional */ }
        }
      } catch { /* silently — dispatch can still proceed */ }
      finally { if (!cancelled) setLoadingMeta(false); }
    }
    fetchMeta();
    return () => { cancelled = true; };
  }, [bid.load?.id, truck?.assigned_driver_id]);

  const noDriverAssigned = truck && !truck.assigned_driver_id && !truck.is_driver_owned;
  const allChecked = checked.every(Boolean);

  function toggle(i) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));
  }

  async function handleConfirm() {
    if (!shipmentData || noDriverAssigned) return;
    setDispatching(true);
    setError("");
    try {
      await apiClient.patch(`/shipments/${shipmentData.id}/status`, { status: "en_route_pickup" });
      setDispatched(true);
      toast("Truck dispatched — job started");
      setTimeout(onDispatched, 1200);
    } catch (e) {
      setError(e?.response?.data?.detail || "Dispatch failed. Try again.");
    } finally {
      setDispatching(false);
    }
  }

  const load = bid.load;
  const pickup = load?.pickup_location?.split(",")[0] || load?.pickup_location;
  const dropoff = load?.dropoff_location?.split(",")[0] || load?.dropoff_location;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={dispatched ? onClose : undefined}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md my-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#4fdbcc]/10 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-[#4fdbcc]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-900 dark:text-white leading-tight">Review Before Dispatch</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Confirm truck details and conditions</p>
            </div>
          </div>
          {!dispatched && (
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Route summary */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 text-sm">
            <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{pickup}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="font-semibold text-slate-700 truncate">{dropoff}</span>
          </div>

          {/* Truck details */}
          {truck ? (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Truck Being Dispatched</p>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-[#4fdbcc]/10 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-[#4fdbcc]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-slate-900 dark:text-white">{truck.registration_number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{truck.truck_type?.replace("_", " ")}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${truck.is_active ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                    {truck.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
                  {[
                    ["Capacity", `${truck.capacity_tonnes}t`],
                    ["Type", truck.truck_type?.replace("_", " ")],
                    ["Make", truck.make || "—"],
                    ["Model / Year", truck.model ? `${truck.model}${truck.year ? ` (${truck.year})` : ""}` : truck.year || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="px-4 py-2.5">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Driver row */}
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
                  <UserCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Assigned Driver</p>
                    {loadingMeta ? (
                      <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                    ) : noDriverAssigned ? (
                      <span className="text-sm font-semibold text-amber-600">No driver assigned</span>
                    ) : driverUser ? (
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{driverUser.full_name}</span>
                    ) : truck.is_driver_owned ? (
                      <span className="text-sm font-medium text-slate-500">Self-operated</span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Driver info unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          )}

          {/* Block if no driver assigned */}
          {noDriverAssigned && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Assign a driver first</p>
                <p className="text-xs text-amber-600 mt-0.5">This truck has no driver. Go to Fleet Management to assign one before you can dispatch.</p>
                <a href="/owner/fleet" className="inline-block mt-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2">
                  Go to Fleet Management →
                </a>
              </div>
            </div>
          )}

          {/* Conditions checklist */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Confirm Conditions</p>
            <div className="space-y-2">
              {DISPATCH_CONDITIONS.map((condition, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                    checked[i] ? "bg-teal-50 border-teal-200" : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    checked[i] ? "bg-[#4fdbcc] border-[#4fdbcc]" : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600"
                  }`}>
                    {checked[i] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input type="checkbox" className="sr-only" checked={checked[i]} onChange={() => toggle(i)} />
                  <span className={`text-sm leading-snug ${checked[i] ? "text-teal-800 font-medium" : "text-slate-600 dark:text-slate-300"}`}>
                    {condition}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {!dispatched && (
            <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
          )}
          <button
            onClick={dispatched ? onClose : handleConfirm}
            disabled={(!allChecked || noDriverAssigned) && !dispatched || dispatching}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              dispatched
                ? "bg-teal-500 text-white cursor-default"
                : allChecked && !noDriverAssigned
                ? "bg-[#4fdbcc] text-white hover:opacity-90"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            } disabled:opacity-60`}
          >
            {dispatching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Dispatching…</>
            ) : dispatched ? (
              <><CheckCircle2 className="w-4 h-4" /> Truck Dispatched</>
            ) : (
              <><Truck className="w-4 h-4" /> Confirm Dispatch</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptedBidActions({ bid }) {
  const [showReview, setShowReview] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const { data: truck } = useQuery({
    queryKey: ["truck", bid.truck_id],
    queryFn: () => apiClient.get(`/trucks/${bid.truck_id}`).then(r => r.data),
    enabled: !!bid.truck_id,
  });

  if (dispatched) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <p className="text-sm font-semibold text-teal-800">Truck Dispatched — job is now in progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {/* Truck summary */}
      {truck && (
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white font-heading">{truck.registration_number}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t</p>
          </div>
          <span className="ml-auto text-[10px] font-bold uppercase text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">Bid truck</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowReview(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#4fdbcc] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Truck className="w-4 h-4" /> Dispatch Truck
        </button>
        <button
          onClick={() => setShowReplace(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Replace
        </button>
      </div>

      {showReview && (
        <DispatchReviewModal
          bid={bid}
          truck={truck}
          onClose={() => setShowReview(false)}
          onDispatched={() => { setShowReview(false); setDispatched(true); }}
        />
      )}
      {showReplace && <ReplaceTruckModal bid={bid} onClose={() => setShowReplace(false)} />}
    </div>
  );
}

// ── Direct Offer: Reject Modal ────────────────────────────────────────────────
function RejectOfferModal({ offer, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      loadsApi.respondToDirectOffer(offer.id, { accept: false, reason: reason.trim() || null }),
    onSuccess: () => {
      toast("Offer declined");
      qc.invalidateQueries({ queryKey: ["my-direct-offers"] });
      onDone();
    },
    onError: () => toast("Could not decline offer", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white">Decline Offer</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Optionally let the shipper know why you're declining.</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Trucks unavailable for those dates…"
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-secondary resize-none"
          />
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Direct Offer: Accept Modal (truck picker) ─────────────────────────────────
function AcceptOfferModal({ offer, onClose, onDone }) {
  const qc = useQueryClient();
  const [selectedTruckId, setSelectedTruckId] = useState(null);

  const { data: trucks = [] } = useQuery({
    queryKey: ["my-trucks"],
    queryFn: () => apiClient.get("/trucks").then(r => r.data),
  });

  const activeTrucks = trucks.filter(t => t.is_active);

  useEffect(() => {
    if (activeTrucks.length === 1) setSelectedTruckId(activeTrucks[0].id); // eslint-disable-line react-hooks/set-state-in-effect
  }, [activeTrucks.length]);

  const mutation = useMutation({
    mutationFn: () =>
      loadsApi.respondToDirectOffer(offer.id, { accept: true, truck_id: selectedTruckId }),
    onSuccess: () => {
      toast("Offer accepted — shipment created!");
      qc.invalidateQueries({ queryKey: ["my-direct-offers"] });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      onDone();
    },
    onError: (e) => toast(e?.response?.data?.detail || "Could not accept offer", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4fdbcc]/10 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-[#4fdbcc]" />
            </div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white">Accept Offer</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Select the truck you'll use for this job.</p>
          {activeTrucks.length === 0 ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No active trucks. Activate a truck in Fleet Management first.
            </div>
          ) : (
            <div className="space-y-2">
              {activeTrucks.map(truck => (
                <label
                  key={truck.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedTruckId === truck.id
                      ? "border-[#4fdbcc] bg-[#4fdbcc]/5"
                      : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={selectedTruckId === truck.id}
                    onChange={() => setSelectedTruckId(truck.id)}
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedTruckId === truck.id ? "border-[#4fdbcc]" : "border-slate-300"}`}>
                    {selectedTruckId === truck.id && <div className="w-2 h-2 rounded-full bg-[#4fdbcc]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-slate-900 dark:text-white text-sm">{truck.registration_number}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedTruckId || mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4fdbcc] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Accept Job
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Direct Offer Card ─────────────────────────────────────────────────────────
function DirectOfferCard({ offer }) {
  const { formatWithSource } = useCurrency();
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [done, setDone] = useState(false);

  const pickup = offer.pickup_location?.split(",")[0] || offer.pickup_location;
  const dropoff = offer.dropoff_location?.split(",")[0] || offer.dropoff_location;

  if (done) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border-2 border-[#4fdbcc]/40 rounded-xl p-5 hover:shadow-md transition-shadow relative">
      {/* Direct tag */}
      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4fdbcc]/10 text-[10px] font-bold text-[#2cb5a8] uppercase tracking-wider border border-[#4fdbcc]/30">
        <Zap className="w-2.5 h-2.5" /> Direct Offer
      </span>

      {/* Route */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2 pr-24">
        <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
        <span className="truncate">{pickup}</span>
        <span className="text-slate-300 shrink-0">→</span>
        <span className="truncate">{dropoff}</span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider">
          <Package className="w-2.5 h-2.5" />
          {offer.cargo_type}
        </span>
        {offer.weight_tonnes && (
          <span className="text-[10px] text-slate-400">{offer.weight_tonnes}t</span>
        )}
        {offer.distance_km && (
          <span className="text-[10px] text-slate-400">{offer.distance_km.toLocaleString()} km</span>
        )}
      </div>

      {/* Shipper */}
      {(offer.shipper_company || offer.shipper_name) && (
        <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
          <Building2 className="w-3 h-3 shrink-0" />
          <span>{offer.shipper_company || offer.shipper_name}</span>
        </div>
      )}

      {/* Price + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
        <div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Offered Price</p>
          <p className="text-xl font-heading font-bold text-slate-900 dark:text-white">{formatWithSource(offer.price_kes)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReject(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Decline
          </button>
          <button
            onClick={() => setShowAccept(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4fdbcc] text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Accept
          </button>
        </div>
      </div>

      {showAccept && (
        <AcceptOfferModal
          offer={offer}
          onClose={() => setShowAccept(false)}
          onDone={() => { setShowAccept(false); setDone(true); }}
        />
      )}
      {showReject && (
        <RejectOfferModal
          offer={offer}
          onClose={() => setShowReject(false)}
          onDone={() => { setShowReject(false); setDone(true); }}
        />
      )}
    </div>
  );
}

function BidCard({ bid }) {
  const { format, formatWithSource } = useCurrency();
  const qc = useQueryClient();
  const [showWithdraw, setShowWithdraw] = useState(false);

  const withdrawMutation = useMutation({
    mutationFn: () => loadsApi.withdrawBid(bid.id),
    onSuccess: () => {
      toast("Bid cancelled");
      setShowWithdraw(false);
      qc.invalidateQueries({ queryKey: ["my-bids"] });
    },
    onError: () => {
      setShowWithdraw(false);
      toast("Could not cancel bid", "error");
    },
  });

  const load = bid.load;
  const pickup = load.pickup_location?.split(",")[0] || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="truncate">{pickup}</span>
            <span className="text-slate-300">→</span>
            <span className="truncate">{dropoff}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold uppercase tracking-wider">
              <Package className="w-2.5 h-2.5" />
              {load.cargo_type}
            </span>
            <TrkCode loadId={load.id} status={bid.status} />
          </div>
          {(load.shipper_company || load.shipper_name) && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <Building2 className="w-3 h-3 shrink-0" />
              <span>{load.shipper_company || load.shipper_name}</span>
              {load.shipper_company && load.shipper_name && (
                <span className="text-slate-300">· {load.shipper_name}</span>
              )}
            </div>
          )}
        </div>
        <StatusBadge status={bid.status} />
      </div>

      <div className="flex items-end justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Your Bid</p>
          <p className="text-xl font-heading font-bold text-slate-900 dark:text-slate-100">
            {formatWithSource(bid.amount_kes)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            <span title={fmtDate(bid.created_at)}>{timeAgo(bid.created_at)}</span>
            {" · "}
            <span>{fmtDate(bid.created_at)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {bid.status === "pending" && (
            <button
              onClick={() => setShowWithdraw(true)}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <Link
            to={`/owner/marketplace/${load.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:opacity-80 transition-opacity"
          >
            View Load <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {bid.status === "accepted" && <AcceptedBidActions bid={bid} />}

      {showWithdraw && (
        <WithdrawConfirmModal
          bid={bid}
          onClose={() => setShowWithdraw(false)}
          onConfirm={() => withdrawMutation.mutate()}
          isPending={withdrawMutation.isPending}
        />
      )}
    </div>
  );
}

export default function OwnerMyBidsPage() {
  const [activeTab, setActiveTab] = useState("direct");

  const { data: bids = [], isLoading: bidsLoading } = useQuery({
    queryKey: ["my-bids"],
    queryFn: loadsApi.getMyBids,
    refetchInterval: 30_000,
  });

  const { data: directOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["my-direct-offers"],
    queryFn: loadsApi.getMyDirectOffers,
    refetchInterval: 30_000,
  });

  const isLoading = bidsLoading || offersLoading;

  const counts = {
    direct:    directOffers.length,
    all:       bids.length,
    pending:   bids.filter(b => b.status === "pending").length,
    accepted:  bids.filter(b => b.status === "accepted").length,
    rejected:  bids.filter(b => b.status === "rejected").length,
    withdrawn: bids.filter(b => b.status === "withdrawn").length,
  };

  const filtered = activeTab === "all" ? bids : bids.filter(b => b.status === activeTab);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
          <Gavel className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-slate-100">My Bids</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All bids you've submitted across loads</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Direct",   count: counts.direct,   color: "text-[#2cb5a8]" },
          { label: "Pending",  count: counts.pending,  color: "text-amber-600" },
          { label: "Accepted", count: counts.accepted, color: "text-green-600" },
          { label: "Rejected", count: counts.rejected, color: "text-red-500"   },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className={`text-2xl font-heading font-bold ${color}`}>{count}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-5 overflow-x-auto">
        {["direct", ...TABS].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-max px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab === "direct" ? "Direct Offers" : tab}
            {tab !== "all" && counts[tab] > 0 && (
              <span className="ml-1 opacity-60">({counts[tab]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Direct Offers tab */}
      {activeTab === "direct" && (
        directOffers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">No direct offers</p>
            <p className="text-sm mt-1">When a shipper sends you a job offer it will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {directOffers.map(offer => <DirectOfferCard key={offer.id} offer={offer} />)}
          </div>
        )
      )}

      {/* Regular bids tabs */}
      {activeTab !== "direct" && (
        filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">No bids yet</p>
            <p className="text-sm mt-1">
              Browse the{" "}
              <Link to="/owner/marketplace" className="text-secondary hover:underline">
                marketplace
              </Link>{" "}
              to find loads and place bids.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(bid => <BidCard key={bid.id} bid={bid} />)}
          </div>
        )
      )}
    </div>
  );
}
