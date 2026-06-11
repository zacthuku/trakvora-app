import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle, Clock, Info, RefreshCw, Receipt, X, TrendingUp,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { SparkAreaChart } from "@/features/payments/components/FinanceCharts";
import PaymentMethodModal from "@/components/payments/PaymentMethodModal";

// ── API helpers ──────────────────────────────────────────────────────────────

const api = {
  outstanding:   () => apiClient.get("/commissions/outstanding").then(r => r.data),
  history:       (page) => apiClient.get("/commissions", { params: { page, page_size: 20 } }).then(r => r.data),
  myRate:        () => apiClient.get("/commissions/my-rate").then(r => r.data),
  earningStats:  () => apiClient.get("/payments/earning-stats").then(r => r.data),
};

// ── Time remaining helper ─────────────────────────────────────────────────────

function timeRemaining(dueAt) {
  if (!dueAt) return null;
  const ms = new Date(dueAt) - Date.now();
  if (ms <= 0) return "Overdue";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.ceil(ms / 60_000)}m left`;
  if (h < 48) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function isDueSoon(dueAt) {
  return dueAt && (new Date(dueAt) - Date.now()) < 86_400_000;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, dueAt }) {
  // eslint-disable-next-line react-hooks/purity
  const nearDue = status === "pending" && dueAt && (new Date(dueAt) - Date.now()) < 86_400_000;
  const cfg = {
    pending:  { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "Pending" },
    overdue:  { cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse", label: "Overdue" },
    paid:     { cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", label: "Paid" },
    waived:   { cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300", label: "Waived" },
    extended: { cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", label: "Extended" },
  }[status] || { cls: "bg-slate-100 text-slate-500", label: status };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      {nearDue ? "Due Soon" : cfg.label}
    </span>
  );
}

// ── Rate breakdown modal ─────────────────────────────────────────────────────

function BreakdownModal({ breakdown, onClose }) {
  if (!breakdown) return null;
  const rows = [
    { label: "Base Rate",        val: `${((breakdown.base_rate?.value || 0) * 100).toFixed(1)}%` },
    { label: "Fleet Tier",       val: `${breakdown.fleet_tier?.label || "—"} → ${breakdown.fleet_tier?.multiplier}×` },
    { label: "Truck Type",       val: `${breakdown.truck_type?.type || "—"} → ${breakdown.truck_type?.multiplier}×` },
    { label: "Capacity",         val: `${breakdown.capacity?.label || "—"} → ${breakdown.capacity?.multiplier}×` },
    { label: "Cargo Spec",       val: `${breakdown.cargo_spec?.cargo_type || "—"} → ${breakdown.cargo_spec?.multiplier}×` },
    { label: "Terrain",          val: `${breakdown.terrain?.terrain || "—"} → ${breakdown.terrain?.multiplier}×` },
    { label: "Registration",     val: `${breakdown.registration?.is_company ? "Company" : "Individual"} → ${breakdown.registration?.multiplier}×` },
    { label: "Distance",         val: `${breakdown.distance?.label || "—"} → ${breakdown.distance?.multiplier}×` },
    ...(breakdown.payment_mode?.mode === "escrow" ? [{ label: "Payment Mode", val: `escrow → ${breakdown.payment_mode?.multiplier}×` }] : []),
    { label: "Effective Rate",   val: `${((breakdown.effective_rate || 0) * 100).toFixed(2)}%`, bold: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Commission Rate Breakdown</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between py-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
              <span className={`font-mono ${r.bold ? "font-bold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── My Rate card ─────────────────────────────────────────────────────────────

function MyRateCard() {
  const { data } = useQuery({ queryKey: ["my-rate"], queryFn: api.myRate, staleTime: 60_000 });
  if (!data) return (
    <div className="bg-slate-900 rounded-xl p-4 animate-pulse flex flex-col gap-2">
      <div className="h-3 w-24 bg-slate-700 rounded" />
      <div className="h-8 w-16 bg-slate-700 rounded" />
      <div className="h-3 w-32 bg-slate-700 rounded" />
      <div className="h-3 w-40 bg-slate-700 rounded" />
    </div>
  );
  return (
    <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Your Base Rate</p>
      <p className="text-3xl font-black">{data.base_rate_pct}%</p>
      <p className="text-xs text-slate-400">{data.fleet_tier?.label} fleet · {data.registration?.is_company ? "Company" : "Individual"}</p>
      <p className="text-xs text-slate-500 mt-1">{data.note}</p>
      <p className="text-xs text-slate-400 mt-1">Payment window: <span className="text-white font-semibold">{data.payment_window_hours}h</span></p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommissionsDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const { currency } = useCountryConfig();
  const [breakdown, setBreakdown] = useState(null);
  const [histPage, setHistPage] = useState(1);
  const [payInvoice, setPayInvoice] = useState(null);

  const outstanding  = useQuery({ queryKey: ["commissions-outstanding"], queryFn: api.outstanding });
  const history      = useQuery({ queryKey: ["commissions-history", histPage], queryFn: () => api.history(histPage) });
  const earningStats = useQuery({ queryKey: ["earning-stats"], queryFn: api.earningStats, staleTime: 60_000 });

  const isSuspended = user?.is_active === false;
  const outstandingInvoices = outstanding.data?.invoices || [];
  const totalDue = outstanding.data?.total_due_kes || 0;
  const hasOverdue = outstandingInvoices.some(i => i.status === "overdue");

  const stats = earningStats.data;
  const chartTxs = (stats?.monthly || []).flatMap(({ month, total_kes }) => {
    if (!total_kes) return [];
    return [{ transaction_type: "payout", amount_kes: total_kes, created_at: `${month}-15T00:00:00Z` }];
  });

  const refreshCommissions = () => {
    qc.invalidateQueries({ queryKey: ["commissions-outstanding"] });
    qc.invalidateQueries({ queryKey: ["commissions-history"] });
    qc.invalidateQueries({ queryKey: ["earning-stats"] });
  };

  if (outstanding.isLoading) return <PageSpinner />;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Earnings section ── */}
      {stats && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white font-heading">Earnings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Gross freight value from completed shipments.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-accent p-5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Total Earned</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{fmt(stats.total_earned_kes ?? 0)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Completed Trips</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.completed_trips ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Avg per Trip</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{fmt(stats.avg_per_trip_kes ?? 0)}</p>
            </div>
          </div>
          {chartTxs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-secondary" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Earnings</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">Last 6 months</p>
              <SparkAreaChart transactions={chartTxs} currency={currency} />
            </div>
          )}
          <hr className="border-slate-200 dark:border-slate-700" />
        </div>
      )}

      {/* Suspension banner */}
      {isSuspended && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Account Suspended</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Your account is suspended due to overdue commission{outstandingInvoices.length > 1 ? "s" : ""}.
              Pay your outstanding balance to restore access immediately.
            </p>
          </div>
          {outstandingInvoices.length > 0 && (
            <button
              onClick={() => setPayInvoice(outstandingInvoices[0])}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              Pay Now
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">Earnings & Commissions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track your freight earnings and manage outstanding Trakvora platform fees.
        </p>
      </div>

      {/* KPI + Rate grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total outstanding */}
        <div className={`rounded-xl p-4 flex flex-col gap-1 ${hasOverdue ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Outstanding</p>
          <p className={`text-2xl font-black ${hasOverdue ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
            {fmt(totalDue)}
          </p>
          <p className="text-xs text-slate-500">{outstandingInvoices.length} pending invoice{outstandingInvoices.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Due soon */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Due &lt; 48h</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {/* eslint-disable-next-line react-hooks/purity */}
            {outstandingInvoices.filter(i => i.due_at && (new Date(i.due_at) - Date.now()) < 172_800_000).length}
          </p>
          <p className="text-xs text-slate-500">invoices expiring soon</p>
        </div>

        <MyRateCard />
      </div>

      {/* Outstanding invoices */}
      {outstandingInvoices.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <h2 className="font-bold text-sm text-slate-800 dark:text-white">Outstanding Invoices</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {outstandingInvoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={inv.status} dueAt={inv.due_at} />
                    {inv.due_at && (
                      <span className={`text-xs font-medium ${timeRemaining(inv.due_at) === "Overdue" ? "text-red-500" : isDueSoon(inv.due_at) ? "text-amber-500" : "text-slate-500"}`}>
                        {timeRemaining(inv.due_at)} · {new Date(inv.due_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {inv.pickup_location && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 truncate font-medium">
                      {inv.pickup_location} → {inv.dropoff_location}
                      {inv.cargo_type && <span className="text-slate-400"> · {inv.cargo_type.replace(/_/g, " ")}</span>}
                    </p>
                  )}
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {fmt(inv.amount_kes)}
                    {inv.load_price_kes && (
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ({inv.rate_pct}% of {fmt(inv.load_price_kes)} freight)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setBreakdown(inv.rate_breakdown)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                    title="View rate breakdown"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPayInvoice(inv)}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg"
                  >
                    Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outstandingInvoices.length === 0 && !isSuspended && (
        <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-teal-500 shrink-0" />
          <p className="text-sm text-teal-700 dark:text-teal-400 font-medium">All commissions are settled. Your account is in good standing.</p>
        </div>
      )}

      {/* History table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-sm text-slate-800 dark:text-white">Invoice History</h2>
          <button onClick={() => qc.invalidateQueries(["commissions-history"])} className="p-1.5 text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-left">
                {["Date", "Route", "Amount", "Rate", "Status", "Due", "Paid", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {history.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…
                  </td>
                </tr>
              ) : (history.data?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No commission history yet.</td>
                </tr>
              ) : (history.data?.items || []).map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                    {inv.pickup_location
                      ? <span className="block truncate text-xs">{inv.pickup_location} → {inv.dropoff_location}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(inv.amount_kes)}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{inv.rate_pct}%</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} dueAt={inv.due_at} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {inv.due_at ? (
                      <span className={`${["pending","overdue"].includes(inv.status) && isDueSoon(inv.due_at) ? "text-amber-500 font-semibold" : "text-slate-500"}`}>
                        {["pending","overdue"].includes(inv.status) ? timeRemaining(inv.due_at) + " · " : ""}
                        {new Date(inv.due_at).toLocaleDateString()}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{inv.paid_at ? new Date(inv.paid_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setBreakdown(inv.rate_breakdown)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title="Rate breakdown"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {(history.data?.total || 0) > 20 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
            <button
              disabled={histPage <= 1}
              onClick={() => setHistPage(p => p - 1)}
              className="text-xs font-semibold text-slate-500 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400">Page {histPage}</span>
            <button
              disabled={(histPage * 20) >= (history.data?.total || 0)}
              onClick={() => setHistPage(p => p + 1)}
              className="text-xs font-semibold text-slate-500 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {breakdown && <BreakdownModal breakdown={breakdown} onClose={() => setBreakdown(null)} />}

      {payInvoice && (
        <PaymentMethodModal
          open={true}
          onClose={() => setPayInvoice(null)}
          amount={payInvoice.amount_kes}
          currency={currency}
          invoiceId={payInvoice.id}
          onSuccess={() => {
            setPayInvoice(null);
            refreshCommissions();
          }}
        />
      )}
    </div>
  );
}
