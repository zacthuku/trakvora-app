import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, X, Package, TrendingUp, Info } from "lucide-react";
import apiClient from "@/services/apiClient";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { useAuthStore } from "@/store/authStore";
import { SparkAreaChart } from "@/features/payments/components/FinanceCharts";
import PaymentMethodModal from "@/components/payments/PaymentMethodModal";

function DriverRatingModal({ shipment, onClose, onSuccess }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      apiClient.post(`/shipments/${shipment.id}/rate`, { rating: stars, comment: comment || null }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Rate the Shipper</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">How was your experience with this load?</p>
        <div className="flex gap-1 justify-center mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className="w-8 h-8"
                fill={(hover || stars) >= n ? "#f59e0b" : "none"}
                stroke={(hover || stars) >= n ? "#f59e0b" : "#cbd5e1"}
              />
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none mb-4 focus:outline-none focus:border-secondary"
        />
        {mut.isError && <p className="text-xs text-red-600 mb-2">{mut.error?.response?.data?.detail || "Rating failed"}</p>}
        <button
          disabled={stars === 0 || mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full bg-secondary text-white py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors"
        >
          {mut.isPending ? "Submitting…" : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}

export default function EarningsWalletPage() {
  const queryClient = useQueryClient();
  const { formatDirect } = useCurrency();
  const { currency: countryCurrency } = useCountryConfig();
  const { user } = useAuthStore();
  const [ratingShipment, setRatingShipment] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [ratedIds, setRatedIds] = useState(new Set());
  const [payInvoice, setPayInvoice] = useState(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["earning-stats"],
    queryFn: () => apiClient.get("/payments/earning-stats").then((r) => r.data),
  });

  const { data: unratedShipments = [], refetch: refetchUnrated } = useQuery({
    queryKey: ["driver-unrated-shipments"],
    queryFn: () => apiClient.get("/shipments/unrated").then((r) => r.data),
  });

  // Commission invoices (only for self-employed drivers)
  const { data: outstanding } = useQuery({
    queryKey: ["commissions-outstanding"],
    queryFn: () => apiClient.get("/commissions/outstanding").then((r) => r.data),
    enabled: stats?.is_employed === false,
  });

  if (statsLoading) return <PageSpinner />;

  const currency = countryCurrency;
  const isEmployed = stats?.is_employed === true;

  // Build chart data from monthly stats
  const chartTxs = (stats?.monthly || []).flatMap(({ month, total_kes }) => {
    if (!total_kes) return [];
    return [{ transaction_type: "payout", amount_kes: total_kes, created_at: `${month}-15T00:00:00Z` }];
  });

  const commission = stats?.commission;
  const outstandingInvoices = outstanding?.invoices || [];
  const totalDue = outstanding?.total_due_kes || 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white mb-6">
        Earnings
      </h1>

      {/* Unrated shipments banner */}
      {!bannerDismissed && unratedShipments.filter((s) => !ratedIds.has(s.id)).length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 shrink-0" fill="#f59e0b" />
            <p className="text-sm text-amber-800 font-medium">
              You have {unratedShipments.filter((s) => !ratedIds.has(s.id)).length} unrated job{unratedShipments.filter((s) => !ratedIds.has(s.id)).length > 1 ? "s" : ""} — rate the shipper to help the community.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={() => setRatingShipment(unratedShipments.find((s) => !ratedIds.has(s.id)))}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
            >
              Rate now
            </button>
            <button onClick={() => setBannerDismissed(true)} className="p-0.5 text-amber-400 hover:text-amber-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Employed driver: simple view */}
      {isEmployed ? (
        <div className="space-y-4">
          <div className="card-accent p-6">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Completed Trips</div>
            <div className="text-4xl font-heading font-bold text-slate-900 dark:text-white">
              {stats?.completed_trips ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">deliveries completed</div>
          </div>
          <div className="card p-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your earnings are managed by your fleet owner. Contact them directly for payout details and payment schedules.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Self-employed: full stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="card-accent p-6">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Earned</div>
              <div className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
                {formatDirect(stats?.total_earned_kes ?? 0, currency)}
              </div>
              <div className="text-xs text-slate-400 mt-1">{currency}</div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Completed Trips</div>
              <div className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
                {stats?.completed_trips ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">deliveries</div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Avg per Trip</div>
              <div className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
                {formatDirect(stats?.avg_per_trip_kes ?? 0, currency)}
              </div>
              <div className="text-xs text-slate-400 mt-1">average</div>
            </div>
          </div>

          {/* Monthly chart */}
          {chartTxs.length > 0 && (
            <div className="card p-5 mb-8">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-secondary" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Earnings</h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Last 6 months</p>
              <SparkAreaChart transactions={chartTxs} currency={currency} />
            </div>
          )}

          {/* Commission section */}
          {commission && (
            <div className="mb-8">
              <h2 className="text-base font-heading font-semibold text-slate-900 dark:text-white mb-3">
                Commissions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="card p-4 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Paid</p>
                  <p className="text-lg font-bold text-teal-600">{formatDirect(commission.paid_kes, currency)}</p>
                </div>
                <div className={`card p-4 text-center ${totalDue > 0 ? "border-amber-200 dark:border-amber-700" : ""}`}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Pending</p>
                  <p className={`text-lg font-bold ${totalDue > 0 ? "text-amber-600" : "text-slate-400"}`}>
                    {formatDirect(commission.pending_kes, currency)}
                  </p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Next Job</p>
                  <p className="text-lg font-bold text-slate-600 dark:text-slate-300">
                    ~{formatDirect(commission.next_job_kes, currency)}
                  </p>
                </div>
              </div>

              {outstandingInvoices.length > 0 && (
                <div className="card divide-y divide-slate-100 dark:divide-slate-700">
                  {outstandingInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatDirect(inv.amount_kes, currency)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Due {inv.due_at ? new Date(inv.due_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => setPayInvoice(inv)}
                        className="bg-secondary text-white text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90"
                      >
                        Pay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {ratingShipment && (
        <DriverRatingModal
          shipment={ratingShipment}
          onClose={() => setRatingShipment(null)}
          onSuccess={() => {
            setRatedIds((prev) => new Set([...prev, ratingShipment.id]));
            refetchUnrated();
          }}
        />
      )}

      {payInvoice && (
        <PaymentMethodModal
          open={true}
          onClose={() => setPayInvoice(null)}
          amount={payInvoice.amount_kes}
          currency={currency}
          invoiceId={payInvoice.id}
          onSuccess={() => {
            setPayInvoice(null);
            queryClient.invalidateQueries({ queryKey: ["commissions-outstanding"] });
            queryClient.invalidateQueries({ queryKey: ["earning-stats"] });
          }}
        />
      )}
    </div>
  );
}
