import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Truck, X, CheckCircle2, AlertCircle, Tag,
  XCircle, Clock, ChevronRight, AlertTriangle, Building2,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { loadsApi } from "@/features/loads/api/loadsApi";
import AcceptFixedModal from "@/features/loads/components/AcceptFixedModal";
import { driverApi } from "@/features/driver/api/driverApi";
import { ownerApi } from "@/features/owner/api/ownerApi";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";
import { useCurrency } from "@/hooks/useCurrency";
import { CARGO_TRUCK_REQUIRED } from "@/utils/constants";

// ── Bid Confirm Modal ─────────────────────────────────────────────────────────
function BidConfirmModal({ load, trucks, selectedTruck, bidAmount, bidMessage, onClose, onConfirm, isPending }) {
  const { format } = useCurrency();
  const truck = trucks.find(t => t.id === selectedTruck);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white">Confirm Bid</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{load.pickup_location}</span>
              <span className="text-slate-300 dark:text-slate-600">→</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{load.dropoff_location}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Truck</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                {truck ? `${truck.registration_number} · ${truck.truck_type}` : "—"}
                {truck?.is_verified && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Bid Amount</span>
              <span className="font-bold text-slate-900 dark:text-white">{format(parseFloat(bidAmount))}</span>
            </div>
            {bidMessage && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Message</span>
                <span className="text-slate-700 dark:text-slate-300 text-right text-xs italic">"{bidMessage}"</span>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Once submitted, the shipper can see and accept your bid.
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
            Confirm Bid
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Withdraw Confirm Modal ────────────────────────────────────────────────────
function WithdrawConfirmModal({ bid, load, onClose, onConfirm, isPending }) {
  const { format } = useCurrency();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white">Cancel Bid?</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 rounded-lg px-4 py-3 text-center">
            <p className="text-sm font-semibold text-red-800">
              Cancel your bid of <span className="font-bold">{format(bid.amount_kes)}</span>?
            </p>
            <p className="text-xs text-red-600 mt-1">
              {load.pickup_location?.split(",")[0]} → {load.dropoff_location?.split(",")[0]}
            </p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LoadDetailPage() {
  const { format } = useCurrency();
  const { loadId } = useParams();
  const authUser = useAuthStore((s) => s.user);
  const isAdmin  = authUser?.role === "admin";
  const isDriver = authUser?.role === "driver";
  const isOwner  = authUser?.role === "owner" || authUser?.role === "owner_user";
  const qc = useQueryClient();
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showFixedAccept, setShowFixedAccept] = useState(false);

  const { data: load, isLoading } = useQuery({
    queryKey: ["load", loadId],
    queryFn: () => loadsApi.getLoad(loadId),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["my-trucks"],
    queryFn: loadsApi.getMyTrucks,
  });

  const { data: myBids = [] } = useQuery({
    queryKey: ["my-bids"],
    queryFn: loadsApi.getMyBids,
  });

  const { data: driverActiveShipment } = useQuery({
    queryKey: ["driver-active-shipment"],
    queryFn: driverApi.getActiveShipment,
    enabled: isDriver,
    staleTime: 30_000,
    retry: false,
  });

  const { data: fleetActiveShipments = [] } = useQuery({
    queryKey: ["fleet-active-shipments"],
    queryFn: ownerApi.getFleetActiveShipments,
    enabled: isOwner,
    staleTime: 30_000,
    retry: false,
  });

  const existingBid = myBids.find(b => b.load_id === loadId);

  // Pre-fill amount when there's a pending bid
  useEffect(() => {
    if (existingBid?.status === "pending") {
      setBidAmount(String(existingBid.amount_kes)); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [existingBid]);

  const bidMutation = useMutation({
    mutationFn: (data) => loadsApi.placeBid(data),
    onSuccess: () => {
      toast(existingBid?.status === "pending" ? "Bid updated!" : "Bid placed successfully!");
      setBidMessage("");
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      qc.invalidateQueries({ queryKey: ["load", loadId] });
    },
    onError: (err) => {
      setShowConfirm(false);
      toast(err.response?.data?.detail || "Bid failed", "error");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => loadsApi.withdrawBid(existingBid.id),
    onSuccess: () => {
      toast("Bid cancelled");
      setShowWithdraw(false);
      setBidAmount("");
      setBidMessage("");
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      qc.invalidateQueries({ queryKey: ["load", loadId] });
    },
    onError: () => {
      setShowWithdraw(false);
      toast("Could not cancel bid", "error");
    },
  });

  if (isLoading) return <PageSpinner />;
  if (!load) return <div className="text-slate-500">Load not found</div>;

  const canBid = ["available", "bidding"].includes(load.status);

  function handleSubmitBid() {
    if (!selectedTruck || !bidAmount) return;
    setShowConfirm(true);
  }

  function handleConfirmBid() {
    bidMutation.mutate({
      load_id: loadId,
      truck_id: selectedTruck,
      amount_kes: parseFloat(bidAmount),
      message: bidMessage || undefined,
    });
  }

  // ── Pre-flight warning banners ────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const busyTruckIds = new Set((fleetActiveShipments || []).map(s => s.truck_id));
  const selectedTruckObj = trucks.find(t => t.id === selectedTruck);
  const requiredByCargoType = load ? CARGO_TRUCK_REQUIRED[load.cargo_type] : null;
  const cargoTypeMismatch   = selectedTruckObj && requiredByCargoType && selectedTruckObj.truck_type !== requiredByCargoType;
  const reqTypeMismatch     = selectedTruckObj && load?.required_truck_type && selectedTruckObj.truck_type !== load.required_truck_type;
  const selectedTruckBusy   = isOwner && selectedTruckObj && busyTruckIds.has(selectedTruckObj.id);
  const truckNotVerified    = selectedTruckObj && !selectedTruckObj.is_verified;
  const capacityInsufficient = selectedTruckObj && load && (selectedTruckObj.capacity_tonnes ?? 0) < (load.weight_tonnes ?? 0);
  const insuranceMissing    = selectedTruckObj && load?.requires_insurance && !selectedTruckObj.insurance_url;
  const insuranceExpired    = selectedTruckObj && load?.requires_insurance && selectedTruckObj.insurance_url &&
                              selectedTruckObj.insurance_expiry && new Date(selectedTruckObj.insurance_expiry) < today;
  const ntsaExpired         = selectedTruckObj && selectedTruckObj.ntsa_inspection_expiry &&
                              new Date(selectedTruckObj.ntsa_inspection_expiry) < today;
  const hasBlockingTruckIssue = truckNotVerified || capacityInsufficient || cargoTypeMismatch ||
                                reqTypeMismatch || insuranceMissing || insuranceExpired || ntsaExpired || selectedTruckBusy;

  // ── Bid section: 4 states ──────────────────────────────────────────────────
  function renderBidSection() {
    // Fixed-price: accept or skip — no bidding form
    if (load.booking_mode === "fixed" && !isAdmin) {
      if (load.status !== "available") {
        return (
          <div className="card p-6 text-center text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">This fixed-price load is no longer available.</p>
          </div>
        );
      }
      return (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-emerald-600" />
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Accept at Fixed Price</h2>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-4 text-center mb-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Posted Price</p>
            <p className="text-3xl font-heading font-black text-emerald-700 dark:text-emerald-400">{format(load.price_kes)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">First carrier to accept wins this job</p>
          </div>
          <button
            onClick={() => setShowFixedAccept(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <CheckCircle2 className="w-4 h-4" /> Accept at {format(load.price_kes)}
          </button>
        </div>
      );
    }

    if (isAdmin) {
      return (
        <div className="card p-6 text-center text-slate-500 dark:text-slate-400">
          <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm">Admins cannot participate in marketplace bidding</p>
        </div>
      );
    }

    // Accepted
    if (existingBid?.status === "accepted") {
      return (
        <div className="card p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-heading font-semibold text-green-800">Your bid was accepted!</p>
              <p className="text-sm text-green-700 mt-0.5">
                Bid of {format(existingBid.amount_kes)} — shipment has been created.
              </p>
            </div>
          </div>
          <Link
            to="/owner/bids"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
          >
            View in My Bids <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      );
    }

    // Pending — update form + cancel button
    if (existingBid?.status === "pending" && canBid) {
      return (
        <div className="card p-6">
          <h2 className="font-heading font-semibold text-slate-900 mb-3">Your Bid</h2>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Pending bid of {format(existingBid.amount_kes)}. Modify below to update it.
          </div>
          {renderBidForm("Update Bid")}
          <button
            onClick={() => setShowWithdraw(true)}
            className="mt-3 w-full text-xs font-semibold text-red-500 hover:text-red-700 transition-colors py-1"
          >
            Cancel this bid
          </button>
        </div>
      );
    }

    // Rejected + still open — rebid
    if (existingBid?.status === "rejected" && canBid) {
      return (
        <div className="card p-6">
          <h2 className="font-heading font-semibold text-slate-900 mb-3">Place a Bid</h2>
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-xs text-red-700">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            Your previous bid was not selected. The load is still open — submit a new bid below.
          </div>
          {renderBidForm("Submit New Bid")}
        </div>
      );
    }

    // No bid — normal form
    if (canBid && trucks.length > 0) {
      return (
        <div className="card p-6">
          <h2 className="font-heading font-semibold text-slate-900 mb-4">Place a Bid</h2>
          {renderBidForm("Submit Bid")}
        </div>
      );
    }

    // No trucks
    if (trucks.length === 0 && canBid) {
      return (
        <div className="card p-6 text-center text-slate-500">
          <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          Add a truck to your fleet before bidding
        </div>
      );
    }

    return null;
  }

  function renderBidForm(submitLabel) {
    return (
      <div className="flex flex-col gap-3">
        {/* Driver: active job warning */}
        {isDriver && driverActiveShipment && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            You have an active job in progress. You can only bid if this load&apos;s pickup is after your current delivery date.
          </div>
        )}

        <Select
          label="Select Truck"
          options={trucks.map((t) => ({
            value: t.id,
            label: `${t.registration_number} · ${t.truck_type} · ${t.capacity_tonnes}t${t.is_verified ? " · ✓ Verified" : ""}${busyTruckIds.has(t.id) ? " · (On Job)" : ""}`,
            disabled: busyTruckIds.has(t.id),
          }))}
          value={selectedTruck}
          onChange={(e) => setSelectedTruck(e.target.value)}
        />

        {/* Owner: busy truck warning */}
        {selectedTruckBusy && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            This truck is already on an active job. Select a different truck or wait until it completes.
          </div>
        )}

        {/* Cargo type incompatibility warning */}
        {cargoTypeMismatch && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            This load requires a <strong className="mx-0.5">{requiredByCargoType}</strong> truck. Your selected truck is not suitable.
          </div>
        )}
        {!cargoTypeMismatch && reqTypeMismatch && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            This load requires a <strong className="mx-0.5">{load.required_truck_type}</strong> truck. Your selected truck does not qualify.
          </div>
        )}
        {truckNotVerified && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Truck not verified — submit compliance documents for admin approval.
          </div>
        )}
        {capacityInsufficient && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Truck capacity ({selectedTruckObj.capacity_tonnes}t) is below the required load weight ({load.weight_tonnes}t).
          </div>
        )}
        {insuranceMissing && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            This load requires cargo insurance — upload your document first.
          </div>
        )}
        {insuranceExpired && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Cargo insurance expired on {new Date(selectedTruckObj.insurance_expiry).toLocaleDateString()} — renew before bidding.
          </div>
        )}
        {ntsaExpired && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            NTSA inspection expired on {new Date(selectedTruckObj.ntsa_inspection_expiry).toLocaleDateString()} — renew before bidding.
          </div>
        )}
        <Input
          label={`Bid Amount (KES)${load.min_bid_floor_kes ? ` (min ${format(load.min_bid_floor_kes)})` : ""}`}
          type="number"
          min={load.min_bid_floor_kes || 1}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
        />
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Message (optional)</label>
          <textarea
            className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-secondary/40"
            rows={2}
            value={bidMessage}
            onChange={(e) => setBidMessage(e.target.value)}
          />
        </div>
        <Button onClick={handleSubmitBid} disabled={!selectedTruck || !bidAmount || hasBlockingTruckIssue}>
          {submitLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Load Details</h1>
        <StatusBadge status={load.status} />
      </div>

      <div className="card-accent p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <MapPin className="w-3 h-3" /> Pickup
            </div>
            <div className="font-semibold text-slate-900">{load.pickup_location}</div>
          </div>
          <div className="text-slate-300 font-bold sm:mt-4">↓<span className="hidden sm:inline">→</span></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <MapPin className="w-3 h-3" /> Dropoff
            </div>
            <div className="font-semibold text-slate-900">{load.dropoff_location}</div>
          </div>
        </div>

        {(load.shipper_company || load.shipper_name) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{load.shipper_company || load.shipper_name}</span>
            {load.shipper_company && load.shipper_name && (
              <span className="text-slate-300">· {load.shipper_name}</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Price</div>
            <div className="font-data-mono font-bold text-slate-900 dark:text-white mt-0.5">{format(load.price_kes)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Weight</div>
            <div className="font-semibold dark:text-white mt-0.5">{load.weight_tonnes}t</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Cargo Type</div>
            <div className="font-semibold dark:text-white capitalize mt-0.5">{load.cargo_type}</div>
          </div>
          {load.corridor && (
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Corridor</div>
              <div className="font-semibold dark:text-white mt-0.5">{load.corridor}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Booking Mode</div>
            <div className="font-semibold dark:text-white capitalize mt-0.5">
              {load.booking_mode === "fixed" ? "Fixed Price" : load.booking_mode === "auction" ? "Open Bidding" : load.booking_mode}
            </div>
          </div>
          {load.requires_insurance && (
            <div>
              <div className="text-xs text-slate-500">Insurance</div>
              <div className="font-semibold text-amber-600 mt-0.5">Required</div>
            </div>
          )}
        </div>

        {load.cargo_description && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Description</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{load.cargo_description}</p>
          </div>
        )}
        {load.special_instructions && (
          <div className="mt-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Special Instructions</div>
            <p className="text-sm text-slate-700 dark:text-slate-300 italic">{load.special_instructions}</p>
          </div>
        )}
      </div>

      {renderBidSection()}

      {showConfirm && (
        <BidConfirmModal
          load={load}
          trucks={trucks}
          selectedTruck={selectedTruck}
          bidAmount={bidAmount}
          bidMessage={bidMessage}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirmBid}
          isPending={bidMutation.isPending}
        />
      )}

      {showWithdraw && existingBid && (
        <WithdrawConfirmModal
          bid={existingBid}
          load={load}
          onClose={() => setShowWithdraw(false)}
          onConfirm={() => withdrawMutation.mutate()}
          isPending={withdrawMutation.isPending}
        />
      )}
      {showFixedAccept && load && (
        <AcceptFixedModal
          load={load}
          onClose={() => setShowFixedAccept(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["load", load.id] })}
        />
      )}
    </div>
  );
}
