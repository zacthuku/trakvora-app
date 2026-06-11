import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "@/utils/mediaUrl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Filter, MapPin, RotateCcw, Navigation2, SlidersHorizontal,
  Briefcase, Building2, Star, X, Clock, Zap, ArrowRight,
  CheckCircle2, XCircle, Package, Truck, AlertCircle, Loader2,
  Gavel, List, Map, Tag,
} from "lucide-react";
import AcceptFixedModal from "@/features/loads/components/AcceptFixedModal";
import LoadsMapView from "@/components/map/LoadsMapView";
import apiClient from "@/services/apiClient";
import { driverApi } from "@/features/driver/api/driverApi";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useNotificationStore } from "@/store/notificationStore";
import Select from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { haversineKm } from "@/utils/distance";
import { CARGO_TYPES, CARGO_TRUCK_REQUIRED, CORRIDORS } from "@/utils/constants";

const MY_JOB_STATUS = {
  booked:          { label: "Booked",     bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-400" },
  en_route_pickup: { label: "En Route",   bg: "bg-sky-50",     text: "text-sky-700",    dot: "bg-sky-500"    },
  loaded:          { label: "Loaded",     bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400"   },
  in_transit:      { label: "In Transit", bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-[#4fdbcc]"  },
};

function MyJobStatusPill({ status }) {
  const cfg = MY_JOB_STATUS[status] || { label: status, bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "in_transit" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function MyJobCard({ load, onDispatch, dispatching }) {
  const { format, formatWithSource } = useCurrency();
  const navigate = useNavigate();
  const isBooked = load.status === "booked";
  const isActive = ["en_route_pickup", "loaded", "in_transit"].includes(load.status);
  const pickup   = load.pickup_location?.split(",")[0] || load.pickup_location;
  const dropoff  = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  return (
    <div className="card-accent p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-mono text-xs font-bold text-primary tracking-wide">
            TRK-{load.id.slice(0, 8).toUpperCase()}
          </span>
          <p className="text-[10px] text-slate-400 capitalize mt-0.5">
            {load.cargo_type} · {load.weight_tonnes}t
          </p>
        </div>
        <MyJobStatusPill status={load.status} />
      </div>

      <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">From</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{pickup}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">To</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{dropoff}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-data-mono font-bold text-secondary text-base">{format(load.price_kes)}</span>
        {load.distance_km && (
          <span className="text-xs text-slate-400">{load.distance_km.toLocaleString()} km</span>
        )}
      </div>

      {(load.shipper_company || load.shipper_name) && (
        <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-400">
          <Building2 className="w-3 h-3 shrink-0" />
          <span>{load.shipper_company || load.shipper_name}</span>
          {load.shipper_company && load.shipper_name && (
            <span className="text-slate-300">· {load.shipper_name}</span>
          )}
        </div>
      )}

      {isBooked && (
        <button
          onClick={() => onDispatch(load)}
          disabled={dispatching === load.id}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#4fdbcc] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {dispatching === load.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Truck className="w-4 h-4" />}
          Dispatch: Start Job
        </button>
      )}

      {isActive && (
        <button
          onClick={() => navigate("/driver/active")}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowRight className="w-4 h-4" /> Open Active Job
        </button>
      )}
    </div>
  );
}

const RADIUS_OPTIONS = [
  { value: "50",  label: "50 km" },
  { value: "100", label: "100 km" },
  { value: "200", label: "200 km" },
  { value: "500", label: "500 km" },
];

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Bid Modal ─────────────────────────────────────────────────────────────────

function BidModal({ load, truck, onClose, onSuccess }) {
  const { format } = useCurrency();
  const { currency } = useCountryConfig();
  const [amount, setAmount] = useState(load.min_bid_floor_kes ? String(Math.ceil(load.min_bid_floor_kes)) : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Compute all blocking eligibility issues upfront
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const blockingIssues = [];
  if (!truck.is_verified) {
    blockingIssues.push("Truck not verified — submit compliance documents for admin approval.");
  }
  if ((truck.capacity_tonnes ?? 0) < (load.weight_tonnes ?? 0)) {
    blockingIssues.push(`Truck capacity (${truck.capacity_tonnes}t) is below the required load weight (${load.weight_tonnes}t).`);
  }
  const reqByType = CARGO_TRUCK_REQUIRED[load.cargo_type];
  if (reqByType && truck.truck_type !== reqByType) {
    blockingIssues.push(`This load requires a ${reqByType} truck. Your ${truck.truck_type} truck is not suitable.`);
  }
  if (load.required_truck_type && truck.truck_type !== load.required_truck_type) {
    blockingIssues.push(`This load requires a ${load.required_truck_type} truck. Your ${truck.truck_type} truck does not qualify.`);
  }
  if (load.requires_insurance) {
    if (!truck.insurance_url) {
      blockingIssues.push("This load requires cargo insurance — upload your document first.");
    } else if (truck.insurance_expiry && new Date(truck.insurance_expiry) < today) {
      blockingIssues.push(`Cargo insurance expired on ${new Date(truck.insurance_expiry).toLocaleDateString()} — renew before bidding.`);
    }
  }
  if (truck.ntsa_inspection_expiry && new Date(truck.ntsa_inspection_expiry) < today) {
    blockingIssues.push(`NTSA inspection expired on ${new Date(truck.ntsa_inspection_expiry).toLocaleDateString()} — renew before bidding.`);
  }

  const mutation = useMutation({
    mutationFn: (data) => apiClient.post("/bids", data).then((r) => r.data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e) => {
      setError(e?.response?.data?.detail || "Failed to place bid. Try again.");
    },
  });

  function handleSubmit() {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid bid amount."); return; }
    if (load.min_bid_floor_kes && amt < load.min_bid_floor_kes) {
      setError(`Minimum bid is ${format(load.min_bid_floor_kes)}.`);
      return;
    }
    mutation.mutate({ load_id: load.id, truck_id: truck.id, amount_kes: amt, message });
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8"
      onClick={onClose}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Gavel className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-900 dark:text-white text-sm leading-tight">Place a Bid</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{load.pickup_location} → {load.dropoff_location}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Load summary */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>{load.weight_tonnes}t · <span className="capitalize">{load.cargo_type}</span></p>
              {load.pickup_date && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> {load.pickup_date}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Listed</p>
              <p className="font-data-mono font-bold text-slate-800 text-sm">{format(load.price_kes)}</p>
            </div>
          </div>

          {/* Truck used */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Bidding with: <span className="font-semibold text-slate-700">{truck.registration_number}</span> · {truck.truck_type} · {truck.capacity_tonnes}t</span>
          </div>

          {/* Eligibility issues — shown before user tries to submit */}
          {blockingIssues.map((msg, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{msg}</span>
            </div>
          ))}

          {/* Bid amount */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              {`Your Bid (${currency})`}
            </label>
            <input
              type="number"
              min={load.min_bid_floor_kes || 1}
              step="500"
              placeholder={load.min_bid_floor_kes ? `Min ${Math.ceil(load.min_bid_floor_kes).toLocaleString()}` : "Enter amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-data-mono font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            {load.min_bid_floor_kes && (
              <p className="text-[10px] text-slate-400 mt-1">Minimum bid: {format(load.min_bid_floor_kes)}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Message (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add a note for the shipper…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || blockingIssues.length > 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
            Submit Bid
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Direct Offer Modal ────────────────────────────────────────────────────────

function DirectOfferModal({ load: loadProp, notification, onClose, onRespond }) {
  const { format, formatWithSource } = useCurrency();
  const [load, setLoad]         = useState(loadProp || null);
  const [shipper, setShipper]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(null); // "accepted" | "declined"
  const [declining, setDeclining] = useState(false);
  const [reason, setReason]     = useState("");

  const loadId = loadProp?.id || notification?.reference_id;
  const notifId = notification?.id || null;

  useEffect(() => {
    if (loadProp || !notification?.reference_id) return;
    apiClient.get(`/loads/${notification.reference_id}`)
      .then(r => {
        setLoad(r.data);
        return apiClient.get(`/users/${r.data.shipper_id}/public`);
      })
      .then(r => setShipper(r.data))
      .catch(() => {});
  }, [notification?.reference_id]);

  useEffect(() => {
    if (!loadProp?.shipper_id) return;
    apiClient.get(`/users/${loadProp.shipper_id}/public`)
      .then(r => setShipper(r.data))
      .catch(() => {});
  }, [loadProp?.shipper_id]);

  const initials = shipper?.full_name
    ? shipper.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  async function handleRespond(accept) {
    setLoading(true);
    try {
      await driverApi.respondToOffer(loadId, accept, notifId, accept ? null : reason.trim() || null);
      setDone(accept ? "accepted" : "declined");
      if (onRespond) onRespond(notifId);
    } catch {
      /* keep modal open on error */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8"
      onClick={done ? onClose : undefined}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-900 dark:text-white text-sm leading-tight">Direct Load Offer</h2>
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Sent directly to you</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shipper */}
        {shipper && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0">
              {shipper.profile_photo_url
                ? <img src={mediaUrl(shipper.profile_photo_url)} alt="shipper" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-slate-600 dark:text-slate-200 font-heading">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{shipper.full_name}</p>
              <p className="text-[10px] text-slate-400">Shipper</p>
              {shipper.rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="text-[10px] text-slate-500">{shipper.rating.toFixed(1)} · {shipper.total_trips} trips</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Load details */}
        {load && (
          <div className="px-6 py-5 space-y-4">
            {/* Route */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pickup</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.pickup_location}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Dropoff</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.dropoff_location}</p>
              </div>
            </div>

            {/* Details row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  <span className="capitalize">{load.cargo_type}</span>
                </span>
                <span>·</span>
                <span>{load.weight_tonnes}t</span>
                {load.distance_km && (
                  <>
                    <span>·</span>
                    <span>{load.distance_km.toLocaleString()} km</span>
                  </>
                )}
              </div>
              <span className="font-data-mono font-bold text-secondary text-base">{formatWithSource(load.price_kes)}</span>
            </div>

            {/* Instructions */}
            {load.special_instructions && (
              <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                {load.special_instructions}
              </p>
            )}

            {/* Pickup date */}
            {load.pickup_date && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Pickup: {load.pickup_date}{load.pickup_window ? ` · ${load.pickup_window}` : ""}
              </p>
            )}
          </div>
        )}

        {!load && !done && (
          <div className="px-6 py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Result banner */}
        {done && (
          <div className={`mx-6 mb-4 flex items-center gap-2 rounded-xl px-4 py-3 ${
            done === "accepted" ? "bg-teal-50 border border-teal-200" : "bg-slate-100 border border-slate-200"
          }`}>
            {done === "accepted"
              ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
            <p className="text-sm font-semibold text-slate-700">
              {done === "accepted" ? "Offer accepted. The shipper has been notified." : "Offer declined."}
            </p>
          </div>
        )}

        {/* Decline reason input */}
        {declining && !done && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-xs text-slate-500">Reason for declining (optional):</p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Unavailable on those dates…"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-secondary resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
          {done ? (
            <button onClick={onClose} className="flex-1 px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Close
            </button>
          ) : declining ? (
            <>
              <button
                onClick={() => setDeclining(false)}
                className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => handleRespond(false)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Decline
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setDeclining(true)}
                disabled={!load}
                className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
              <button
                onClick={() => handleRespond(true)}
                disabled={loading || !load}
                className="flex-1 px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.3)] disabled:opacity-50"
              >
                {loading ? "..." : "Accept Offer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Direct Offer Card (notification-based, legacy) ────────────────────────────
function DirectOfferCard({ notification, onOpen }) {
  if (!notification) return null;
  return (
    <div
      onClick={() => onOpen(notification)}
      className="relative bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer"
    >
      <span className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
        <Zap className="w-2.5 h-2.5" /> Direct
      </span>
      <div className="flex items-start gap-3 pr-14">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-slate-900 text-sm leading-snug">Direct Load Offer</p>
          <p className="text-xs text-slate-600 mt-1 leading-snug line-clamp-2">{notification.body}</p>
          <span className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
            <Clock className="w-3 h-3" />
            {timeAgo(notification.time)}
          </span>
        </div>
      </div>
      {!notification.read && (
        <span className="absolute top-3 left-3 w-2 h-2 bg-secondary rounded-full" />
      )}
    </div>
  );
}

// ── Direct Offer Load Card (API-based, with inline accept/decline) ─────────────
function DirectOfferLoadCard({ load, onDone }) {
  const { formatWithSource } = useCurrency();
  const [showModal, setShowModal] = useState(false);
  const [done, setDone] = useState(false);

  const pickup  = load.pickup_location?.split(",")[0] || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  if (done) return null;

  return (
    <>
      <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
        <span className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
          <Zap className="w-2.5 h-2.5" /> Direct
        </span>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2 pr-20">
          <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span className="truncate">{pickup}</span>
          <span className="text-slate-300 shrink-0">→</span>
          <span className="truncate">{dropoff}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wider">
            <Package className="w-2.5 h-2.5" /> {load.cargo_type}
          </span>
          {load.weight_tonnes && <span className="text-[10px] text-slate-400">{load.weight_tonnes}t</span>}
          {load.distance_km && <span className="text-[10px] text-slate-400">{load.distance_km.toLocaleString()} km</span>}
        </div>

        {(load.shipper_company || load.shipper_name) && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{load.shipper_company || load.shipper_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-amber-100">
          <p className="text-xl font-heading font-bold text-slate-900">{formatWithSource(load.price_kes)}</p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            View & Respond
          </button>
        </div>
      </div>

      {showModal && (
        <DirectOfferModal
          load={load}
          notification={null}
          onClose={() => setShowModal(false)}
          onRespond={() => { setShowModal(false); setDone(true); if (onDone) onDone(); }}
        />
      )}
    </>
  );
}

// ── Driving Job Modal ─────────────────────────────────────────────────────────

function DrivingJobModal({ notification, onClose }) {
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    if (!notification.reference_id) return;
    apiClient.get(`/users/${notification.reference_id}/public`)
      .then(r => setOwner(r.data))
      .catch(() => {});
  }, [notification.reference_id]);

  const initials = owner?.full_name
    ? owner.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8"
      onClick={onClose}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4 text-secondary" />
            </div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-sm leading-tight max-w-[200px]">
              {notification.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Posted by */}
        {owner && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0">
              {owner.profile_photo_url
                ? <img src={mediaUrl(owner.profile_photo_url)} alt="owner" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-slate-600 dark:text-slate-200 font-heading">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{owner.full_name}</p>
              {owner.company_name && (
                <p className="text-[10px] text-slate-400 truncate">{owner.company_name}</p>
              )}
              {owner.rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="text-[10px] text-slate-500">{owner.rating.toFixed(1)} · {owner.total_trips} trips</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{notification.body}</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{timeAgo(notification.time)}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.3)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Driving Job Card ──────────────────────────────────────────────────────────

function DrivingJobCard({ notification, onOpen }) {
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    if (!notification.reference_id) return;
    apiClient.get(`/users/${notification.reference_id}/public`)
      .then(r => setOwner(r.data))
      .catch(() => {});
  }, [notification.reference_id]);

  const initials = owner?.full_name
    ? owner.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div
      onClick={() => onOpen(notification)}
      className="card-accent p-5 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
          <Briefcase className="w-5 h-5 text-secondary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="font-heading font-bold text-slate-900 text-sm leading-snug">{notification.title}</p>

          {/* Body preview */}
          <p className="text-xs text-slate-500 mt-1 leading-snug line-clamp-2">{notification.body}</p>

          {/* Owner row */}
          {owner && (
            <div className="flex items-center gap-2 mt-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0">
                {owner.profile_photo_url
                  ? <img src={mediaUrl(owner.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[9px] font-bold text-slate-600 dark:text-slate-200">{initials}</span>}
              </div>
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{owner.full_name}</span>
                {owner.company_name && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-slate-400 truncate">
                      <Building2 className="w-3 h-3 shrink-0" />
                      {owner.company_name}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Time */}
        <div className="text-right shrink-0">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            {timeAgo(notification.time)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JobFeedPage() {
  const { format, formatWithSource } = useCurrency();
  const { currency } = useCountryConfig();
  const { position } = useGeolocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab]           = useState("cargo");
  const [cargoMapMode, setCargoMapMode]     = useState(false);
  const [cargoFilter, setCargoFilter]       = useState("");
  const [corridorFilter, setCorridorFilter] = useState("");
  const [selectedJob, setSelectedJob]       = useState(null);
  const [dispatchingId, setDispatchingId]   = useState(null);
  const [dispatchError, setDispatchError]   = useState("");

  // Return-trip mode
  const [returnMode, setReturnMode]       = useState(false);
  const [returnLat, setReturnLat]         = useState("");
  const [returnLon, setReturnLon]         = useState("");
  const [radiusKm, setRadiusKm]           = useState("100");
  const [useCurrentPos, setUseCurrentPos] = useState(false);

  const { data: myDrivesData } = useQuery({
    queryKey: ["driver-my-drives"],
    queryFn: () => apiClient.get("/loads/my-drives", { params: { page: 1, page_size: 50 } }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const myLoads = myDrivesData?.items || [];
  const bookedCount = myLoads.filter(l => l.status === "booked").length;

  // Fetch driver's available truck for bidding
  const { data: assignedTruck } = useQuery({
    queryKey: ["driver-assigned-truck"],
    queryFn: () => apiClient.get("/trucks/assigned-to-me").then((r) => r.data),
    staleTime: 60_000,
  });
  const { data: ownedTrucks } = useQuery({
    queryKey: ["driver-owned-trucks"],
    queryFn: () => apiClient.get("/trucks").then((r) => r.data),
    staleTime: 60_000,
  });
  const driverTruck = assignedTruck || (ownedTrucks?.length > 0 ? ownedTrucks[0] : null);

  const [bidLoad, setBidLoad] = useState(null);
  const [fixedLoad, setFixedLoad] = useState(null);

  // Active job: the first non-delivered job in the list
  const activeJob = myLoads.find(l =>
    ["booked", "en_route_pickup", "loaded", "in_transit"].includes(l.status)
  );

  function checkTimelineConflict(newLoad) {
    if (!activeJob || activeJob.status === "delivered") return null;
    if (!newLoad.pickup_date || !activeJob.pickup_date) return null;
    const newStart = new Date(newLoad.pickup_date);
    const activeStart = new Date(activeJob.pickup_date);
    const activeEnd = activeJob.delivery_date
      ? new Date(activeJob.delivery_date)
      : activeJob.pickup_deadline
      ? new Date(activeJob.pickup_deadline)
      : null;
    if (!activeEnd) return null;
    if (newStart >= activeStart && newStart <= activeEnd) {
      return `You have an active job until ${activeEnd.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}. You can only start new jobs from that date onwards.`;
    }
    return null;
  }

  async function handleDriverDispatch(load) {
    setDispatchingId(load.id);
    setDispatchError("");
    const conflict = checkTimelineConflict(load);
    if (conflict) {
      setDispatchError(conflict);
      setDispatchingId(null);
      return;
    }
    try {
      const { data: shipment } = await apiClient.get(`/shipments/by-load/${load.id}`);
      await apiClient.patch(`/shipments/${shipment.id}/status`, { status: "en_route_pickup" });
      qc.invalidateQueries({ queryKey: ["driver-my-drives"] });
      navigate("/driver/active");
    } catch (e) {
      setDispatchError(e?.response?.data?.detail || "Dispatch failed. Please try again.");
    } finally {
      setDispatchingId(null);
    }
  }

  const { notifications, markRead } = useNotificationStore();
  const drivingJobs    = notifications.filter(n => n.reference_type === "job_post");
  const unreadJobCount = drivingJobs.filter(n => !n.read).length;
  const [selectedOffer, setSelectedOffer] = useState(null);

  const { data: directOfferLoads = [], refetch: refetchDirectOffers } = useQuery({
    queryKey: ["driver-direct-offers"],
    queryFn: driverApi.getMyDirectOffers,
    refetchInterval: 30_000,
  });

  const effectiveReturnLat = returnMode
    ? useCurrentPos && position ? position.latitude  : parseFloat(returnLat) || undefined
    : undefined;
  const effectiveReturnLon = returnMode
    ? useCurrentPos && position ? position.longitude : parseFloat(returnLon) || undefined
    : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["jobs-feed", cargoFilter, corridorFilter, effectiveReturnLat, effectiveReturnLon, radiusKm],
    queryFn: () =>
      driverApi.getMarketplace({
        cargo_type: cargoFilter  || undefined,
        corridor:   corridorFilter || undefined,
        near_lat:   effectiveReturnLat,
        near_lon:   effectiveReturnLon,
        radius_km:  returnMode ? parseFloat(radiusKm) : undefined,
        page:       1,
        page_size:  50,
      }),
    enabled: activeTab === "cargo",
  });

  if (isLoading && activeTab === "cargo") return <PageSpinner />;

  let loads = data?.items || [];
  if (!returnMode && position) {
    loads = [...loads].sort((a, b) => {
      if (a.is_urgent && !b.is_urgent) return -1;
      if (!a.is_urgent && b.is_urgent) return 1;
      const da     = haversineKm(position.latitude, position.longitude, a.pickup_latitude,  a.pickup_longitude);
      const db     = haversineKm(position.latitude, position.longitude, b.pickup_latitude,  b.pickup_longitude);
      const profitA = a.price_kes / (da + 1);
      const profitB = b.price_kes / (db + 1);
      return profitB - profitA;
    });
  }

  const distanceRef = effectiveReturnLat != null && effectiveReturnLon != null
    ? { lat: effectiveReturnLat, lon: effectiveReturnLon }
    : position
    ? { lat: position.latitude, lon: position.longitude }
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Job Feed</h1>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("cargo")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "cargo"
                ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Cargo Loads
          </button>
          <button
            onClick={() => setActiveTab("driving")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "driving"
                ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Driving Jobs
            {(unreadJobCount + directOfferLoads.length) > 0 && (
              <span className="min-w-[16px] h-4 bg-secondary rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                {(unreadJobCount + directOfferLoads.length) > 9 ? "9+" : unreadJobCount + directOfferLoads.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("myjobs")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "myjobs"
                ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            My Jobs
            {bookedCount > 0 && (
              <span className="min-w-[16px] h-4 bg-[#4fdbcc] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                {bookedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Cargo Loads Tab ────────────────────────────────────────────────── */}
      {activeTab === "cargo" && (
        <>
          {/* Return-trip controls */}
          <div className="flex items-center justify-between mb-4">
            {returnMode && (
              <p className="text-xs text-sky-600 font-medium flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Return Trip Mode: loads near your drop-off
              </p>
            )}
            <button
              onClick={() => setReturnMode((v) => !v)}
              className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                returnMode
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-sky-400 hover:text-sky-700"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Return Trip
            </button>
          </div>

          {/* Return-trip panel */}
          {returnMode && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-sky-800">Find loads near your drop-off</p>
                <button
                  onClick={() => setUseCurrentPos((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    useCurrentPos
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-white text-sky-700 border-sky-300 hover:bg-sky-100"
                  }`}
                >
                  <Navigation2 className="w-3 h-3" />
                  {useCurrentPos ? "Using GPS" : "Use My Location"}
                </button>
              </div>

              {!useCurrentPos && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-sky-700 uppercase tracking-wider mb-1">Latitude</label>
                    <input
                      type="number" step="0.0001" placeholder="-1.2921"
                      value={returnLat} onChange={(e) => setReturnLat(e.target.value)}
                      className="w-full px-3 py-2 border border-sky-300 dark:border-sky-700 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-sky-700 uppercase tracking-wider mb-1">Longitude</label>
                    <input
                      type="number" step="0.0001" placeholder="36.8219"
                      value={returnLon} onChange={(e) => setReturnLon(e.target.value)}
                      className="w-full px-3 py-2 border border-sky-300 dark:border-sky-700 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <label className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider shrink-0">Radius</label>
                <div className="flex gap-1.5">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRadiusKm(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                        radiusKm === opt.value
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white text-sky-700 border-sky-300 hover:bg-sky-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <Select
              options={[{ value: "", label: "All cargo" }, ...CARGO_TYPES]}
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="text-sm"
            />
            <Select
              options={[{ value: "", label: "All corridors" }, ...CORRIDORS.map((c) => ({ value: c, label: c }))]}
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="text-sm"
            />
            <span className="text-xs text-slate-400 font-medium">
              {loads.length} load{loads.length !== 1 ? "s" : ""}
            </span>
            {/* Map / List toggle */}
            <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setCargoMapMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !cargoMapMode ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setCargoMapMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  cargoMapMode ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
          </div>

          {/* Map view */}
          {cargoMapMode && (
            <div className="h-[520px] mb-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <LoadsMapView
                loads={loads}
                driverPosition={
                  position
                    ? { lat: position.latitude, lng: position.longitude }
                    : undefined
                }
                radiusKm={returnMode ? parseFloat(radiusKm) : undefined}
                selectedLoadId={bidLoad?.id}
                onLoadClick={(load) => {
                  navigate(`/driver/loads/${load.id}`);
                }}
              />
            </div>
          )}

          {/* Cargo results (list mode) */}
          {!cargoMapMode && (loads.length === 0 ? (
            <div className="card p-12 text-center">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No loads match your filters</p>
              {returnMode && (
                <p className="text-xs text-slate-400 mt-1">
                  Try increasing the radius or check your drop-off coordinates
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {loads.map((load) => {
                const distKm = distanceRef
                  ? Math.round(haversineKm(distanceRef.lat, distanceRef.lon, load.pickup_latitude, load.pickup_longitude))
                  : null;
                const conflict = checkTimelineConflict(load);
                const capacityOk = !driverTruck || driverTruck.capacity_tonnes >= load.weight_tonnes;
                const canBid = load.booking_mode === "auction" && driverTruck && !conflict && capacityOk;
                const canAcceptFixed = load.booking_mode === "fixed" && driverTruck && !conflict && capacityOk;
                return (
                  <div
                    key={load.id}
                    onClick={() => navigate(`/driver/loads/${load.id}`)}
                    className={`card-accent p-5 hover:shadow-md transition-shadow cursor-pointer ${conflict ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 text-sm">{load.pickup_location}</div>
                        <div className="w-0.5 h-3 bg-slate-300 mx-1 my-0.5" />
                        <div className="font-semibold text-slate-900 text-sm">{load.dropoff_location}</div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                          <span>{load.weight_tonnes}t</span>
                          <span>·</span>
                          <span className="capitalize">{load.cargo_type}</span>
                          {load.corridor && <><span>·</span><span>{load.corridor}</span></>}
                          {distKm !== null && (
                            <>
                              <span>·</span>
                              <span className={`flex items-center gap-0.5 ${returnMode ? "text-sky-600 font-semibold" : ""}`}>
                                <MapPin className="w-3 h-3" />
                                {distKm} km {returnMode ? "from drop-off" : "away"}
                              </span>
                            </>
                          )}
                        </div>
                        {(load.shipper_company || load.shipper_name) && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span>{load.shipper_company || load.shipper_name}</span>
                            {load.shipper_company && load.shipper_name && (
                              <span className="text-slate-300">· {load.shipper_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="font-data-mono font-bold text-lg text-slate-900">{formatWithSource(load.price_kes)}</div>
                        <div className="flex flex-col items-end gap-1 mt-0.5">
                          {load.is_urgent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 text-[9px] font-bold uppercase tracking-wide">
                              <Zap className="w-2.5 h-2.5" /> Urgent
                            </span>
                          )}
                          {conflict
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase border border-red-200">Scheduled conflict</span>
                            : <StatusBadge status={load.status} />
                          }
                        </div>
                      </div>
                    </div>
                    {conflict && (
                      <p className="mt-2 text-[11px] text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {conflict}
                      </p>
                    )}
                    {canBid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setBidLoad(load); }}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
                      >
                        <Gavel className="w-4 h-4" /> Place Bid
                      </button>
                    )}
                    {canAcceptFixed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setFixedLoad(load); }}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Accept at {formatWithSource(load.price_kes)}
                      </button>
                    )}
                    {load.booking_mode === "auction" && !driverTruck && !conflict && (
                      <p className="mt-2 text-[11px] text-red-500 font-semibold flex items-center gap-1">
                        <Truck className="w-3 h-3 shrink-0" /> You need a truck to bid. Register or get assigned one.
                      </p>
                    )}
                    {load.booking_mode === "fixed" && !driverTruck && !conflict && (
                      <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 shrink-0" /> Fixed price — accept instantly once you have a truck.
                      </p>
                    )}
                    {(load.booking_mode === "auction" || load.booking_mode === "fixed") && driverTruck && !capacityOk && !conflict && (
                      <p className="mt-2 text-[11px] text-red-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> Your truck ({driverTruck.capacity_tonnes}t) cannot carry this load ({load.weight_tonnes}t).
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* ── Driving Jobs Tab ───────────────────────────────────────────────── */}
      {activeTab === "driving" && (
        <>
          {/* Direct offers from API — shown first when present */}
          {directOfferLoads.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">Direct Offers</h3>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {directOfferLoads.length}
                </span>
                <p className="ml-auto text-xs text-slate-400">Sent specifically to you</p>
              </div>
              <div className="flex flex-col gap-3">
                {directOfferLoads.map((load) => (
                  <DirectOfferLoadCard
                    key={load.id}
                    load={load}
                    onDone={() => refetchDirectOffers()}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Broadcast job posts */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">Job Board</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {drivingJobs.length} post{drivingJobs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {drivingJobs.length === 0 && directOfferLoads.length === 0 ? (
            <div className="card p-12 text-center">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No driving jobs yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Fleet owners will post job opportunities here when they need drivers
              </p>
            </div>
          ) : drivingJobs.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-slate-400">No broadcast job posts yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {drivingJobs.map((n) => (
                <DrivingJobCard
                  key={n.id}
                  notification={n}
                  onOpen={(notif) => { markRead(notif.id); setSelectedJob(notif); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Jobs Tab ───────────────────────────────────────────────── */}
      {activeTab === "myjobs" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#4fdbcc]" />
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">My Active Jobs</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">{myLoads.length} job{myLoads.length !== 1 ? "s" : ""}</span>
          </div>

          {dispatchError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {dispatchError}
              <button onClick={() => setDispatchError("")} className="ml-auto text-red-400 hover:text-red-600">×</button>
            </div>
          )}

          {myLoads.length === 0 ? (
            <div className="card p-12 text-center">
              <Truck className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No active jobs</p>
              <p className="text-xs text-slate-400 mt-1">
                Jobs appear here once a shipper accepts your bid or direct offer.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myLoads.map((load) => (
                <MyJobCard
                  key={load.id}
                  load={load}
                  onDispatch={handleDriverDispatch}
                  dispatching={dispatchingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bid modal */}
      {bidLoad && driverTruck && createPortal(
        <BidModal
          load={bidLoad}
          truck={driverTruck}
          onClose={() => setBidLoad(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["jobs-feed"] }); }}
        />,
        document.body,
      )}

      {/* Fixed-price accept modal */}
      {fixedLoad && createPortal(
        <AcceptFixedModal
          load={fixedLoad}
          onClose={() => setFixedLoad(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["jobs-feed"] })}
        />,
        document.body,
      )}

      {/* Driving job detail modal — portalled to body to escape layout stacking context */}
      {selectedJob && createPortal(
        <DrivingJobModal notification={selectedJob} onClose={() => setSelectedJob(null)} />,
        document.body,
      )}

      {/* Direct offer modal */}
      {selectedOffer && createPortal(
        <DirectOfferModal
          notification={selectedOffer}
          onClose={() => setSelectedOffer(null)}
          onRespond={(id) => markRead(id)}
        />,
        document.body,
      )}
    </div>
  );
}
