import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, CheckCircle2, Gavel, Truck, Star,
  Clock, Package, MapPin, TrendingDown, Award,
  AlertCircle, ChevronRight, Zap, MessageSquare,
  Navigation2, Scale, Building2, User, CreditCard, Wallet,
  ShieldCheck,
} from "lucide-react";
import { shipperApi } from "@/features/shipper/api/shipperApi";
import { paymentsApi } from "@/features/payments/api/paymentsApi";
import PartnerBadge from "@/components/ui/PartnerBadge";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "@/components/ui/Toast";
import { useState } from "react";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const STATUS_CONFIG = {
  available: { bg: "bg-amber-50", text: "text-amber-700", label: "Awaiting Bids" },
  booked:    { bg: "bg-violet-50", text: "text-violet-700", label: "Booked" },
  in_transit:{ bg: "bg-teal-50", text: "text-teal-700", label: "In Transit" },
};

function BidRankBadge({ rank, isLowest, isBestValue }) {
  if (rank === 0 && isLowest) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4fdbcc]/10 text-teal-700 text-[10px] font-bold uppercase tracking-wider border border-teal-200">
      <TrendingDown className="w-3 h-3" /> Lowest Bid
    </span>
  );
  if (isBestValue) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider border border-secondary/20">
      <Zap className="w-3 h-3" /> Best Value
    </span>
  );
  return null;
}

function AcceptModal({ bid, load, walletBalance, onClose, onConfirm, isPending }) {
  const { format } = useCurrency();
  const savings = load?.price_kes ? load.price_kes - bid.amount_kes : null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md my-auto">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Confirm Bid Acceptance</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Review the details before confirming.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Bid amount */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4 text-center">
            <p className="text-[10px] text-teal-600 uppercase tracking-wider mb-1">Accepted Bid</p>
            <p className="text-3xl font-heading font-bold text-teal-700">{format(bid.amount_kes)}</p>
            {savings !== null && savings > 0 && (
              <p className="text-xs text-teal-600 mt-1 flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3" />
                {format(savings)} below your asking price
              </p>
            )}
          </div>

          {(bid.bidder_company || bid.bidder_name) && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-600">
              {bid.bidder_company
                ? <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                : <User className="w-4 h-4 text-slate-400 shrink-0" />}
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Carrier</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {bid.bidder_company || bid.bidder_name}
                    {bid.bidder_company && bid.bidder_name && (
                      <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">· {bid.bidder_name}</span>
                    )}
                  </p>
                  <PartnerBadge tier={bid.bidder_partner_tier ?? "standard"} size="md" />
                </div>
              </div>
            </div>
          )}

          {bid.message && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-600">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Carrier Message</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 italic">"{bid.message}"</p>
            </div>
          )}

          {walletBalance !== null && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-slate-400" /> Wallet balance
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{format(walletBalance)}</span>
            </div>
          )}
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
              A shipment record will be created and the load marked as Booked.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
              The carrier will be dispatched and payment released on delivery confirmation.
            </p>
            <p className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              Other pending bids will be automatically rejected.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />  Accepting…</>
              : <><CheckCircle2 className="w-4 h-4" /> Accept Bid</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopUpRequiredModal({ bid, walletBalance, shortfall, onClose, navigate }) {
  const { format } = useCurrency();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md my-auto">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Top Up Required</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Insufficient wallet balance to accept this bid.</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-center">
            <p className="text-[10px] text-amber-600 uppercase tracking-wider mb-1">Shortfall</p>
            <p className="text-3xl font-heading font-bold text-amber-700">{format(shortfall)}</p>
            <p className="text-xs text-amber-600 mt-1">needed to cover this shipment</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl divide-y divide-slate-200 dark:divide-slate-600">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Current balance</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{format(walletBalance)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Bid amount</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{format(bid.amount_kes)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-amber-700">Shortfall</span>
              <span className="text-sm font-bold text-amber-700">{format(shortfall)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Payment is released to the carrier on delivery confirmation.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => navigate("/shipper/wallet")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors">
            <CreditCard className="w-4 h-4" /> Go to Wallet →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BidComparisonPage() {
  const { distance_unit: distUnit } = useCountryConfig();
  const { loadId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmBid, setConfirmBid] = useState(null);
  const [topUpBid, setTopUpBid] = useState(null);   // holds bid when wallet is short
  const [topUpShortfall, setTopUpShortfall] = useState(0);
  const { format } = useCurrency();

  const { data: load } = useQuery({
    queryKey: ["load", loadId],
    queryFn: () => shipperApi.getLoad(loadId),
  });

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ["bids", loadId],
    queryFn: () => shipperApi.getBids(loadId),
    refetchInterval: 15000,
  });

  const { data: walletData } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: paymentsApi.getWallet,
    staleTime: 30_000,
  });
  const walletBalance = walletData ? parseFloat(walletData.balance_kes ?? 0) : null;

  // Pre-flight balance check before showing the confirm modal
  function handleAcceptClick(bid) {
    if (walletBalance !== null && walletBalance < parseFloat(bid.amount_kes)) {
      setTopUpShortfall(Math.max(0, parseFloat(bid.amount_kes) - walletBalance));
      setTopUpBid(bid);
    } else {
      setConfirmBid(bid);
    }
  }

  const accept = useMutation({
    mutationFn: (bidId) => shipperApi.acceptBid(bidId),
    onSuccess: () => {
      toast("Bid accepted. Shipment created!", "success");
      qc.invalidateQueries({ queryKey: ["bids", loadId] });
      qc.invalidateQueries({ queryKey: ["shipper-loads"] });
      qc.invalidateQueries({ queryKey: ["shipper-active-loads"] });
      setConfirmBid(null);
      navigate("/shipper/shipments");
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      // Backend 409 race-condition fallback
      if (typeof detail === "object" && detail?.code === "insufficient_funds") {
        const serverShortfall = detail.shortfall_kes ?? 0;
        setTopUpShortfall(serverShortfall);
        setTopUpBid(confirmBid);
        setConfirmBid(null);
        return;
      }
      toast((typeof detail === "string" ? detail : null) || "Failed to accept bid", "error");
    },
  });

  const sortedBids = [...bids].sort((a, b) => a.amount_kes - b.amount_kes);
  const lowestBid = sortedBids[0];
  const acceptedBid = bids.find((b) => b.status === "accepted");
  const pendingBids = bids.filter((b) => b.status === "pending");
  const savings = load && lowestBid ? load.price_kes - lowestBid.amount_kes : 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {confirmBid && (
        <AcceptModal
          bid={confirmBid}
          load={load}
          walletBalance={walletBalance}
          onClose={() => setConfirmBid(null)}
          onConfirm={() => accept.mutate(confirmBid.id)}
          isPending={accept.isPending}
        />
      )}
      {topUpBid && (
        <TopUpRequiredModal
          bid={topUpBid}
          walletBalance={walletBalance ?? 0}
          shortfall={topUpShortfall}
          onClose={() => setTopUpBid(null)}
          navigate={navigate}
        />
      )}

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <button onClick={() => navigate("/shipper/shipments")} className="hover:text-slate-600 transition-colors">
            Active Loads
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Bid Comparison</span>
        </div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Bid Comparison</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Review carrier bids and accept the best offer for your load.
        </p>
      </div>

      {/* Load summary card */}
      {load && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
          <div className="h-[3px] bg-secondary" />
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="font-mono text-xs font-bold text-primary tracking-wide">
                  TRK-{load.id?.slice(0, 8).toUpperCase()}
                </span>
                <h2 className="font-heading font-semibold text-slate-900 dark:text-white mt-0.5">Load Summary</h2>
              </div>
              {STATUS_CONFIG[load.status] && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[load.status].bg} ${STATUS_CONFIG[load.status].text}`}>
                  {STATUS_CONFIG[load.status].label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Route */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Route</p>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <span className="truncate max-w-[90px]">{load.pickup_location?.split(",")[0]}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[90px]">{load.dropoff_location?.split(",")[0]}</span>
                  </div>
                </div>
              </div>

              {/* Cargo */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-3">
                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Cargo</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 capitalize">{load.cargo_type} · {load.weight_tonnes}t</p>
                </div>
              </div>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3">
              <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Your Price</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{format(load.price_kes)}</p>
              </div>
              <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Distance</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-base">
                  {load.distance_km ? `${load.distance_km.toLocaleString()} ${distUnit}` : "—"}
                </p>
              </div>
              <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Total Bids</p>
                <p className="font-mono font-bold text-secondary text-base">{bids.length}</p>
              </div>
            </div>

            {/* Savings callout */}
            {savings > 0 && pendingBids.length > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <TrendingDown className="w-4 h-4 text-teal-600 shrink-0" />
                <p className="text-sm text-teal-800">
                  Best bid saves you <span className="font-bold">{format(savings)}</span> vs your asking price.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bids section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-semibold text-slate-900 dark:text-white">
            Carrier Bids
            <span className="text-slate-400 font-normal text-sm ml-2">({bids.length} received)</span>
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sorted by price · refreshes every 15 seconds</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" /> Live
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-28 animate-pulse" />
          ))}
        </div>
      ) : acceptedBid ? (
        /* Accepted bid state */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-teal-200 dark:border-teal-900/50 shadow-sm overflow-hidden">
          <div className="h-[3px] bg-[#4fdbcc]" />
          <div className="px-6 py-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="font-heading font-bold text-slate-900 dark:text-white">Bid Accepted</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {format(acceptedBid.amount_kes)} · Shipment created and carrier notified
              </p>
            </div>
            <button onClick={() => navigate("/shipper/shipments")}
              className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              <Navigation2 className="w-4 h-4" /> Track Shipment
            </button>
          </div>
        </div>
      ) : sortedBids.length === 0 ? (
        /* Empty state */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
            <Gavel className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">No bids yet</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs mx-auto mb-5">
            Your load is live on the marketplace. Carriers in the East Africa corridor will bid shortly.
          </p>
          <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" /> Most loads receive their first bid within 30 minutes
          </div>
        </div>
      ) : (
        /* Bid cards */
        <div className="space-y-3">
          {sortedBids.map((bid, idx) => {
            const isLowest = idx === 0;
            const bidSavings = load ? load.price_kes - bid.amount_kes : 0;
            const isPending = bid.status === "pending";

            return (
              <div key={bid.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
                  isLowest ? "border-teal-200" : "border-slate-200 dark:border-slate-700"
                }`}>
                {isLowest && <div className="h-[3px] bg-[#4fdbcc]" />}

                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    {/* Bid amount + badges */}
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl font-heading font-bold text-slate-900 dark:text-white">
                          {format(bid.amount_kes)}
                        </span>
                        {bidSavings > 0 && (
                          <span className="text-sm text-teal-600 font-semibold">
                            -{format(bidSavings)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <BidRankBadge rank={idx} isLowest={isLowest} isBestValue={idx === 1} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPending ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {isPending ? "Pending" : bid.status}
                        </span>
                      </div>
                    </div>

                    {/* Accept button */}
                    {isPending && (
                      <button
                        onClick={() => handleAcceptClick(bid)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                          isLowest
                            ? "bg-secondary text-white hover:opacity-90 shadow-[0_4px_12px_rgba(254,106,52,0.25)]"
                            : "border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isLowest ? "Accept Best Price" : "Accept Bid"}
                      </button>
                    )}
                  </div>

                  {/* Message */}
                  {bid.message && (
                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5 mb-3">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{bid.message}"</p>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                    {(bid.bidder_company || bid.bidder_name) && (
                      <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                        {bid.bidder_company
                          ? <><Building2 className="w-3 h-3 shrink-0" />{bid.bidder_company}</>
                          : <><User className="w-3 h-3 shrink-0" />{bid.bidder_name}</>
                        }
                        {bid.bidder_company && bid.bidder_name && (
                          <span className="text-slate-400 font-normal">· {bid.bidder_name}</span>
                        )}
                      </span>
                    )}
                    {/* Truck info + verified badge */}
                    {bid.truck_registration && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Truck className="w-3 h-3 shrink-0" />
                        {bid.truck_registration}
                        {bid.truck_type_str && (
                          <span className="text-slate-400">· {bid.truck_type_str.replace("TruckType.", "").replace("_", " ")}</span>
                        )}
                      </span>
                    )}
                    {bid.truck_is_verified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                        <ShieldCheck className="w-2.5 h-2.5" /> Verified
                      </span>
                    )}
                    <PartnerBadge tier={bid.bidder_partner_tier ?? "standard"} />
                    {bid.bidder_rating > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {bid.bidder_rating.toFixed(1)}
                      </span>
                    )}
                    <span className="font-mono">ID: {bid.id.slice(0, 8).toUpperCase()}</span>
                    <span>
                      {new Date(bid.created_at).toLocaleString("en-KE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      Rank #{idx + 1} of {sortedBids.length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guidance footer */}
      {pendingBids.length > 0 && (
        <div className="mt-6 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-5 py-4 flex items-start gap-3">
          <Scale className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">How to choose the best bid</p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>• The <span className="text-teal-600 font-semibold">Lowest Bid</span> saves you the most money</li>
              <li>• Read carrier messages for context on reliability and experience</li>
              <li>• Once accepted, the load is booked and the carrier is dispatched</li>
              <li>• You have until the carrier arrives at pickup to cancel without penalty</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
