import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Truck, Search, Filter, ArrowRight, Package,
  Clock, Loader2, ChevronLeft, ChevronRight,
  ChevronDown, Eye, X, AlertCircle, CheckCircle2,
  SendHorizonal, Building2, Navigation2,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import AcceptFixedModal from "@/features/loads/components/AcceptFixedModal";

const PAGE_SIZE = 12;

const ACTIVE_STATUSES = ["available", "bidding", "booked", "en_route_pickup", "loaded", "in_transit"];

const STATUS_CONFIG = {
  available:       { label: "Available",   bg: "bg-sky-50",     text: "text-sky-700",    dot: "bg-sky-400"     },
  bidding:         { label: "Bidding",     bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"   },
  booked:          { label: "Booked",      bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-400"  },
  en_route_pickup: { label: "En Route",    bg: "bg-sky-50",     text: "text-sky-700",    dot: "bg-sky-500"     },
  in_transit:      { label: "In Transit",  bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-[#4fdbcc]"   },
  loaded:          { label: "Loaded",      bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400"    },
  delivered:       { label: "Delivered",   bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary"     },
  cancelled:       { label: "Cancelled",   bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400"   },
};

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400";

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "in_transit" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Bid Modal ─────────────────────────────────────────────────────────────────
function BidModal({ load, onClose }) {
  const { format } = useCurrency();
  const { currency } = useCountryConfig();
  const qc = useQueryClient();
  const [trucks, setTrucks] = useState([]);
  const [truckId, setTruckId] = useState("");
  const [amount, setAmount] = useState(String(load.price_kes || ""));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [step, setStep] = useState("form"); // "form" | "confirm"

  useEffect(() => {
    apiClient.get("/trucks", { params: { page: 1, page_size: 50 } })
      .then(r => {
        const list = r.data.items || r.data;
        setTrucks(list);
        if (list.length) setTruckId(list[0].id);
      })
      .catch(() => setError("Could not load your trucks"));
  }, []);

  async function submit() {
    if (!truckId) { setError("Select a truck"); return; }
    if (!amount || Number(amount) <= 0) { setError("Enter a valid bid amount"); return; }
    setLoading(true);
    setError("");
    try {
      await apiClient.post("/bids", {
        load_id: load.id,
        truck_id: truckId,
        amount_kes: Number(amount),
        message: message || undefined,
      });
      qc.invalidateQueries({ queryKey: ["owner-active-loads"] });
      setDone(true);
    } catch (e) {
      setError(e?.response?.data?.detail || "Bid failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const pickup  = load.pickup_location?.split(",")[0]  || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={done ? onClose : undefined}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white">Place Bid</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-teal-500 mx-auto mb-3" />
            <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">Bid Submitted</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">The shipper will review your bid.</p>
            <button onClick={onClose} className="mt-5 px-6 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : step === "form" ? (
          <div className="px-6 py-5 space-y-4">
            {/* Route */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">From</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{pickup}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">To</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{dropoff}</p>
              </div>
            </div>

            {/* Truck */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Select Truck</label>
              <select
                value={truckId}
                onChange={e => setTruckId(e.target.value)}
                className={inputCls}
              >
                {trucks.length === 0 && <option value="">Loading trucks…</option>}
                {trucks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.registration_number} · {t.truck_type} · {t.capacity_tonnes}t
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{`Bid Amount (${currency})`}</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={inputCls}
                placeholder="e.g. 85000"
              />
              {load.min_bid_floor_kes && (
                <p className="text-[11px] text-slate-400 mt-1">Floor: {format(load.min_bid_floor_kes)}</p>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Message (optional)</label>
              <textarea
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className={`${inputCls} resize-none`}
                placeholder="Any notes for the shipper…"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!truckId) { setError("Select a truck"); return; }
                  if (!amount || Number(amount) <= 0) { setError("Enter a valid bid amount"); return; }
                  if (load.min_bid_floor_kes && Number(amount) < Number(load.min_bid_floor_kes)) {
                    setError(`Bid must be at least ${format(load.min_bid_floor_kes)}`); return;
                  }
                  setError("");
                  setStep("confirm");
                }}
                disabled={trucks.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <SendHorizonal className="w-4 h-4" />
                Review Bid
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Review your bid before submitting.</p>

            {/* Route recap */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5 flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">From</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pickup}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">To</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{dropoff}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Truck</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {trucks.find(t => t.id === truckId)?.registration_number || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Bid Amount</span>
                <span className="font-bold text-slate-900 dark:text-white">{format(Number(amount))}</span>
              </div>
              {message && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">Message</span>
                  <span className="text-slate-700 dark:text-slate-200 text-right text-xs italic">"{message}"</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Once submitted, the shipper can see and accept your bid.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep("form")}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dispatch Modal ────────────────────────────────────────────────────────────
function DispatchModal({ load, onClose }) {
  const qc = useQueryClient();
  const [shipment,    setShipment]    = useState(null);
  const [truck,       setTruck]       = useState(null);
  const [driverUser,  setDriverUser]  = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [fetchError,  setFetchError]  = useState("");
  const [dispError,   setDispError]   = useState("");
  const [done,        setDone]        = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoadingData(true);
      setFetchError("");
      try {
        const { data: s } = await apiClient.get(`/shipments/by-load/${load.id}`);
        if (cancelled) return;
        setShipment(s);

        if (s.truck_id) {
          const { data: t } = await apiClient.get(`/trucks/${s.truck_id}`);
          if (cancelled) return;
          setTruck(t);

          // Resolve driver name via truck.assigned_driver_id → driver profile → user
          // (not shipment.driver_id, which falls back to the fleet owner's ID when
          // no driver was assigned at bid acceptance time)
          if (t.assigned_driver_id) {
            try {
              const { data: driverProfile } = await apiClient.get(`/drivers/${t.assigned_driver_id}`);
              if (cancelled) return;
              const { data: u } = await apiClient.get(`/users/${driverProfile.user_id}/public`);
              if (!cancelled) setDriverUser(u);
            } catch { /* driver name optional */ }
          }
        }
      } catch {
        if (!cancelled) setFetchError("Could not load dispatch details.");
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [load.id]);

  const noDriverAssigned = truck && !truck.assigned_driver_id && !truck.is_driver_owned;

  async function handleDispatch() {
    if (!shipment || noDriverAssigned) return;
    setDispatching(true);
    setDispError("");
    try {
      await apiClient.patch(`/shipments/${shipment.id}/status`, { status: "en_route_pickup" });
      qc.invalidateQueries({ queryKey: ["owner-active-loads"] });
      setDone(true);
    } catch (e) {
      setDispError(e?.response?.data?.detail || "Dispatch failed. Please try again.");
    } finally {
      setDispatching(false);
    }
  }

  const pickup  = load.pickup_location?.split(",")[0]  || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={done ? onClose : undefined}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#4fdbcc]/10 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-[#4fdbcc]" />
            </div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white">Dispatch Truck</h2>
          </div>
          {!done && (
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-teal-500 mx-auto mb-3" />
            <p className="font-heading font-bold text-slate-900 dark:text-white mb-1">Truck Dispatched</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Driver is now en route to pickup. The shipper can track progress.</p>
            <button onClick={onClose} className="mt-5 px-6 py-2.5 bg-[#4fdbcc] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : loadingData ? (
          <div className="px-6 py-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : fetchError ? (
          <div className="px-6 py-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">{fetchError}</p>
            <button onClick={onClose} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Close</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Route */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pickup</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pickup}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Dropoff</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{dropoff}</p>
              </div>
            </div>

            {/* Truck details */}
            {truck && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
                  <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-slate-900 dark:text-white text-sm">{truck.registration_number}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${truck.is_active ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                    {truck.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Driver row */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Assigned Driver</p>
                  {noDriverAssigned ? (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-700 font-medium">No driver assigned to this truck</span>
                    </div>
                  ) : driverUser ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#4fdbcc]/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#4fdbcc]">{driverUser.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{driverUser.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Loading driver info…</span>
                  )}
                </div>
              </div>
            )}

            {/* Block: no driver assigned */}
            {noDriverAssigned && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Assign a driver first</p>
                  <p className="text-xs text-amber-600 mt-0.5">This truck has no driver assigned. Go to Fleet Management to assign one before dispatching.</p>
                  <a href="/owner/fleet" className="inline-block mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2">
                    Go to Fleet Management →
                  </a>
                </div>
              </div>
            )}

            {dispError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {dispError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDispatch}
                disabled={dispatching || !shipment || noDriverAssigned}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4fdbcc] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Confirm Dispatch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Load Card ─────────────────────────────────────────────────────────────────
function LoadCard({ load, onBid, onAcceptFixed, onDispatch }) {
  const { format } = useCurrency();
  const { distance_unit: distUnit } = useCountryConfig();
  const pickup  = load.pickup_location?.split(",")[0]  || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  const topColor =
    load.status === "in_transit"      ? "bg-[#4fdbcc]" :
    load.status === "booked"          ? "bg-violet-400" :
    load.status === "en_route_pickup" ? "bg-sky-400"    :
    load.status === "bidding"         ? "bg-amber-400"  :
    "bg-slate-200";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      <div className={`h-[3px] ${topColor}`} />
      <div className="p-5">
        {/* ID + status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            {!["available", "bidding"].includes(load.status) ? (
              <span className="font-mono text-xs font-bold text-primary tracking-wide">
                TRK-{load.id.slice(0, 8).toUpperCase()}
              </span>
            ) : (
              <span className="font-mono text-xs tracking-widest text-slate-300">
                TRK-••••••••
              </span>
            )}
            <p className="text-[10px] text-slate-400 capitalize mt-0.5">
              {load.cargo_type} · {load.weight_tonnes}t
            </p>
          </div>
          <StatusPill status={load.status} />
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">From</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{pickup}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">To</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{dropoff}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Distance</p>
            <p className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
              {load.distance_km ? `${load.distance_km.toLocaleString()} ${distUnit}` : "—"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Payout</p>
            <p className="font-mono text-sm font-semibold text-secondary">{format(load.price_kes)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Mode</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 capitalize font-medium">{load.booking_mode || "spot"}</p>
          </div>
        </div>

        {/* Shipper info */}
        {(load.shipper_company || load.shipper_name) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{load.shipper_company || load.shipper_name}</span>
            {load.shipper_company && load.shipper_name && (
              <span className="text-slate-300">· {load.shipper_name}</span>
            )}
          </div>
        )}

        {/* Pickup schedule */}
        {load.pickup_date && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Pickup: {load.pickup_date}{load.pickup_window ? ` · ${load.pickup_window}` : ""}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
          <Link
            to={`/owner/marketplace/${load.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View Details
          </Link>

          {load.status === "available" && load.booking_mode === "fixed" && (
            <button
              onClick={() => onAcceptFixed(load)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept Now
            </button>
          )}
          {(load.status === "available" || load.status === "bidding") && load.booking_mode !== "fixed" && (
            <button
              onClick={() => onBid(load)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              <SendHorizonal className="w-3.5 h-3.5" /> Place Bid
            </button>
          )}

          {load.status === "booked" && (
            <button
              onClick={() => onDispatch(load)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#4fdbcc] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Truck className="w-3.5 h-3.5" /> Dispatch
            </button>
          )}

          {["en_route_pickup", "loaded", "in_transit"].includes(load.status) && (
            <Link
              to={`/owner/track/${load.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#4fdbcc] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Navigation2 className="w-3.5 h-3.5" /> Live Track
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OwnerActiveLoadsPage() {
  const { distance_unit: distUnit } = useCountryConfig();
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]               = useState(1);
  const [bidLoad, setBidLoad]         = useState(null);
  const [fixedLoad, setFixedLoad]     = useState(null);
  const [dispatchLoad, setDispatchLoad] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-active-loads"],
    queryFn: () =>
      apiClient.get("/loads/fleet", { params: { page: 1, page_size: 200 } }).then((r) => r.data),
  });

  const allLoads    = data?.items || [];
  const activeLoads = allLoads.filter((l) => ACTIVE_STATUSES.includes(l.status));

  const filtered = useMemo(() => {
    return activeLoads.filter((l) => {
      const matchSearch =
        !search ||
        l.id.toLowerCase().includes(search.toLowerCase()) ||
        l.pickup_location.toLowerCase().includes(search.toLowerCase()) ||
        l.dropoff_location.toLowerCase().includes(search.toLowerCase()) ||
        l.cargo_type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [activeLoads, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const inTransit = activeLoads.filter((l) => l.status === "in_transit").length;
  const booked    = activeLoads.filter((l) => l.status === "booked").length;
  const available = activeLoads.filter((l) => l.status === "available").length;
  const bidding   = activeLoads.filter((l) => l.status === "bidding").length;

  const selectCls =
    "pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 appearance-none";

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Active Loads</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Loads assigned to your fleet or available to bid on.</p>
        </div>
        <Link
          to="/owner/marketplace"
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Package className="w-4 h-4" />
          Browse Marketplace
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          { label: "In Transit",    value: inTransit, color: "text-[#4fdbcc]",   sub: "currently moving"  },
          { label: "Booked",        value: booked,    color: "text-violet-600",  sub: "awaiting dispatch" },
          { label: "Available",     value: available, color: "text-sky-600",     sub: "ready to bid"      },
          { label: "Total Active",  value: activeLoads.length, color: "text-slate-900", sub: "all statuses" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-5 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ID, route or cargo…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary text-slate-700 dark:text-slate-200 appearance-none"
          >
            <option value="">All Statuses</option>
            {ACTIVE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <span className="ml-auto text-xs text-slate-400 font-medium">
          {filtered.length} load{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Load cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-56 animate-pulse" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
          <Package className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {activeLoads.length === 0 ? "No active loads right now." : "No loads match your filters."}
          </p>
          <Link to="/owner/marketplace"
            className="inline-flex items-center gap-1.5 mt-4 text-secondary text-sm font-semibold hover:opacity-80 transition-opacity">
            Go to Marketplace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pageItems.map((load) => (
            <LoadCard
              key={load.id}
              load={load}
              onBid={setBidLoad}
              onAcceptFixed={setFixedLoad}
              onDispatch={setDispatchLoad}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${safePage === n ? "bg-secondary text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {bidLoad      && <BidModal         load={bidLoad}      onClose={() => setBidLoad(null)}      />}
      {fixedLoad    && <AcceptFixedModal load={fixedLoad}    onClose={() => setFixedLoad(null)}    />}
      {dispatchLoad && <DispatchModal    load={dispatchLoad} onClose={() => setDispatchLoad(null)} />}
    </div>
  );
}
