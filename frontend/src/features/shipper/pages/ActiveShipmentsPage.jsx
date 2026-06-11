import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Truck, Search, Filter, ArrowRight, Package,
  Clock, MapPin, Eye, Navigation2, X,
  ChevronDown, AlertCircle, CheckCircle2,
  Gavel, XCircle, RefreshCw, Zap,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "@/components/ui/Toast";
import { shipperApi } from "@/features/shipper/api/shipperApi";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import ReOfferModal from "./ReOfferModal";

const ACTIVE_STATUSES = ["available", "booked", "en_route_pickup", "loaded", "in_transit"];

const STATUS_STEPS = [
  { key: "available",       label: "Posted",     short: "Posted"  },
  { key: "booked",          label: "Booked",     short: "Booked"  },
  { key: "en_route_pickup", label: "En Route",   short: "En Route"},
  { key: "loaded",          label: "Loaded",     short: "Loaded"  },
  { key: "in_transit",      label: "In Transit", short: "Transit" },
];

const STATUS_CONFIG = {
  available:       { label: "Awaiting Bids",  bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-400",  bar: "bg-amber-400"  },
  booked:          { label: "Booked",         bg: "bg-violet-50",   text: "text-violet-700",  dot: "bg-violet-500", bar: "bg-violet-500" },
  en_route_pickup: { label: "En Route",       bg: "bg-sky-50",      text: "text-sky-700",     dot: "bg-sky-500",    bar: "bg-sky-500"    },
  loaded:          { label: "Loaded",         bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500",   bar: "bg-blue-500"   },
  in_transit:      { label: "In Transit",     bg: "bg-teal-50",     text: "text-teal-700",    dot: "bg-[#4fdbcc]",  bar: "bg-[#4fdbcc]"  },
  delivered:       { label: "Delivered",      bg: "bg-primary/10",  text: "text-primary",     dot: "bg-primary",    bar: "bg-primary"    },
  cancelled:       { label: "Cancelled",      bg: "bg-secondary/10",text: "text-secondary",   dot: "bg-secondary",  bar: "bg-secondary"  },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "in_transit" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function ProgressTimeline({ status }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                done ? "bg-secondary border-secondary" : "bg-white border-slate-300"
              } ${active ? "ring-2 ring-secondary/30" : ""}`} />
              <span className={`text-[9px] mt-1 font-medium whitespace-nowrap ${done ? "text-secondary" : "text-slate-400"}`}>
                {step.short}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mb-3 ${i < currentIdx ? "bg-secondary" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CancelModal({ load, onClose }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => shipperApi.cancelLoad(load.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipper-active-loads"] });
      qc.invalidateQueries({ queryKey: ["shipper-loads"] });
      toast("Load cancelled successfully", "success");
      onClose();
    },
    onError: (err) => toast(err?.response?.data?.detail || "Failed to cancel", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 my-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 dark:text-white">Cancel Load</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Are you sure you want to cancel load <span className="font-mono font-bold text-primary">TRK-{load.id.slice(0, 8).toUpperCase()}</span>?
          Any pending bids will be automatically rejected.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Type <span className="font-mono font-bold text-slate-700 dark:text-slate-200">CANCEL</span> to confirm:</p>
        <input
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white mb-4 focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-200"
          placeholder="CANCEL"
        />
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Keep Load
          </button>
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={confirm !== "CANCEL" || cancelMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
          >
            {cancelMutation.isPending ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConvertToBidButton({ load }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const convertMutation = useMutation({
    mutationFn: () => shipperApi.convertToBid(load.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipper-active-loads"] });
      qc.invalidateQueries({ queryKey: ["shipper-loads"] });
      toast("Load opened to all carriers for bidding", "success");
      setConfirming(false);
    },
    onError: (err) => toast(err?.response?.data?.detail || "Failed to convert", "error"),
  });

  if (confirming) {
    return (
      <div className="flex gap-1.5 flex-1">
        <button
          onClick={() => convertMutation.mutate()}
          disabled={convertMutation.isPending}
          className="flex-1 px-2 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 disabled:opacity-40 transition-colors"
        >
          {convertMutation.isPending ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-700 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800 rounded-lg text-[11px] font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
    >
      <Gavel className="w-3 h-3" /> Open to Bidding
    </button>
  );
}

function LoadCard({ load, onCancelRequest, onReOfferRequest }) {
  const { format } = useCurrency();
  const distUnit = "km";
  const cfg = STATUS_CONFIG[load.status] || {};
  const pickup = load.pickup_location?.split(",")[0] || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;
  const canCancel = load.status === "available";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`h-[3px] ${cfg.bar || "bg-slate-200"}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="font-mono text-xs font-bold text-primary tracking-wide block">
              TRK-{load.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 capitalize mt-0.5 block">
              {load.cargo_type} · {load.weight_tonnes}t{load.distance_km ? ` · ${load.distance_km.toLocaleString()} ${distUnit}` : ""}
            </span>
          </div>
          <StatusPill status={load.status} />
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pickup</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{pickup}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Drop-off</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{dropoff}</p>
          </div>
        </div>

        {/* Progress timeline */}
        {ACTIVE_STATUSES.includes(load.status) && (
          <div className="mb-4 overflow-x-auto">
            <ProgressTimeline status={load.status} />
          </div>
        )}

        {/* Recovery banner — shown when all direct offers have been declined */}
        {load.booking_mode === "direct" && load.all_offers_declined && load.status === "available" && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">All carriers declined</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onReOfferRequest(load)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Zap className="w-3 h-3" /> Offer Again
              </button>
              <ConvertToBidButton load={load} />
            </div>
          </div>
        )}

        {/* Schedule info */}
        {load.pickup_date && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Pickup: {load.pickup_date}{load.pickup_window ? ` · ${load.pickup_window}` : ""}</span>
          </div>
        )}

        {/* Price + meta */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
          <div>
            <p className="font-mono font-bold text-secondary text-base">{format(load.price_kes)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{load.booking_mode || "spot"} · {load.corridor || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {canCancel && (
              <button onClick={() => onCancelRequest(load)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Cancel load">
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {load.status === "in_transit" && (
              <Link to={`/shipper/tracking`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4fdbcc]/10 text-teal-700 border border-teal-200 rounded-lg text-[11px] font-semibold hover:bg-teal-50 transition-colors">
                <Navigation2 className="w-3.5 h-3.5" /> Track
              </Link>
            )}
            <Link to={`/shipper/bids/${load.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Gavel className="w-3.5 h-3.5" />
              {load.status === "available" ? "View Bids" : "Details"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActiveShipmentsPage() {
  const { distance_unit: distUnit } = useCountryConfig();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reOfferTarget, setReOfferTarget] = useState(null);

  const { data: loadsData, isLoading, refetch } = useQuery({
    queryKey: ["shipper-active-loads"],
    queryFn: () =>
      apiClient.get("/loads/mine", { params: { page: 1, page_size: 100 } }).then((r) => r.data),
    refetchInterval: 30000,
  });

  const allLoads = loadsData?.items || [];
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

  const inTransit  = activeLoads.filter((l) => l.status === "in_transit").length;
  const awaitBids  = activeLoads.filter((l) => l.status === "available").length;
  const enRoute    = activeLoads.filter((l) => ["en_route_pickup", "booked", "loaded"].includes(l.status)).length;

  return (
    <div className="w-full">
      {cancelTarget && <CancelModal load={cancelTarget} onClose={() => setCancelTarget(null)} />}
      {reOfferTarget && <ReOfferModal load={reOfferTarget} onClose={() => setReOfferTarget(null)} />}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Active Loads</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Monitor all in-progress shipments and respond to bids.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link to="/shipper/post-load"
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            Post Load
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          { label: "Total Active", value: activeLoads.length, color: "text-slate-900", sub: "all statuses" },
          { label: "In Transit",   value: inTransit,           color: "text-[#4fdbcc]", sub: "moving now"   },
          { label: "Awaiting Bids", value: awaitBids,          color: "text-amber-600", sub: "on marketplace"},
          { label: "With Carrier", value: enRoute,             color: "text-violet-600", sub: "en route / loaded"},
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
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, route or cargo…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary text-slate-700 dark:text-slate-200 appearance-none"
          >
            <option value="">All Statuses</option>
            {ACTIVE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {(search || statusFilter) && (
          <button onClick={() => { setSearch(""); setStatusFilter(""); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 font-medium">
          {filtered.length} load{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Auto-refresh badge */}
      <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" />
        Live · refreshes every 30 seconds
      </div>

      {/* Load cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-56 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
          <Package className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {activeLoads.length === 0 ? "No active loads yet." : "No loads match your filters."}
          </p>
          {activeLoads.length === 0 && (
            <Link to="/shipper/post-load"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Post your first load
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((load) => (
            <LoadCard key={load.id} load={load} onCancelRequest={setCancelTarget} onReOfferRequest={setReOfferTarget} />
          ))}
        </div>
      )}
    </div>
  );
}
