import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Lock, Package, TrendingUp, BarChart2 } from "lucide-react";
import apiClient from "@/services/apiClient";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { SparkAreaChart } from "@/features/payments/components/FinanceCharts";

const TX_TYPE_ICON = {
  escrow_hold:    <ArrowUpRight className="w-4 h-4 text-amber-500" />,
  escrow_release: <ArrowDownLeft className="w-4 h-4 text-teal-500" />,
  escrow_refund:  <ArrowDownLeft className="w-4 h-4 text-blue-500" />,
  payout:         <ArrowDownLeft className="w-4 h-4 text-teal-500" />,
  top_up:         <ArrowDownLeft className="w-4 h-4 text-green-500" />,
  withdrawal:     <ArrowUpRight className="w-4 h-4 text-indigo-500" />,
  platform_fee:   <ArrowUpRight className="w-4 h-4 text-red-400" />,
  dispute_hold:   <Lock className="w-4 h-4 text-red-500" />,
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`card p-6 ${accent ? "card-accent" : ""}`}>
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-heading font-bold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function WalletPage() {
  const { formatDirect } = useCurrency();
  const { currency: countryCurrency } = useCountryConfig();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["spending-stats"],
    queryFn: () => apiClient.get("/payments/spending-stats").then((r) => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () =>
      apiClient.get("/payments/transactions", { params: { page: 1, page_size: 20 } }).then((r) => r.data),
  });

  const { data: recentLoads, isLoading: loadsLoading } = useQuery({
    queryKey: ["shipper-delivered-loads"],
    queryFn: () =>
      apiClient.get("/loads/mine", { params: { status: "delivered", page: 1, page_size: 10 } }).then((r) => r.data),
  });

  if (statsLoading || txLoading) return <PageSpinner />;

  const transactions = txData?.items || [];
  const loads = recentLoads?.items || [];
  const currency = countryCurrency;

  // Build chart data from monthly stats
  const chartTxs = (stats?.monthly || []).flatMap(({ month, total_kes }) => {
    if (!total_kes) return [];
    return [{ transaction_type: "payout", amount_kes: total_kes, created_at: `${month}-15T00:00:00Z` }];
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white mb-6">
        Spending
      </h1>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Spent"
          value={formatDirect(stats?.total_spent_kes ?? 0, currency)}
          sub={currency}
          accent
        />
        <StatCard
          label="Completed Loads"
          value={stats?.completed_loads ?? 0}
          sub="deliveries"
        />
        <StatCard
          label="Avg per Load"
          value={formatDirect(stats?.avg_per_load_kes ?? 0, currency)}
          sub="average"
        />
      </div>

      {/* Monthly chart */}
      {chartTxs.length > 0 && (
        <div className="card p-5 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-secondary" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Spending</h3>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Last 6 months</p>
          <SparkAreaChart transactions={chartTxs} currency={currency} />
        </div>
      )}

      {/* Recent completed loads */}
      {loads.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-heading font-semibold text-slate-900 dark:text-white">
              Recent Deliveries
            </h2>
            <Link to="/shipper/loads" className="text-xs text-secondary hover:underline">
              View all
            </Link>
          </div>
          <div className="card divide-y divide-slate-100 dark:divide-slate-700">
            {loads.map((load) => (
              <div key={load.id} className="flex items-center gap-3 p-4">
                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {load.pickup_location} → {load.dropoff_location}
                  </div>
                  <div className="text-xs text-slate-400 capitalize">{load.cargo_type?.replace(/_/g, " ")}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatDirect(load.price_kes, currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-semibold">
          Transactions
          <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-2">
            ({txData?.total || 0} total)
          </span>
        </h2>
      </div>

      {transactions.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          No transactions yet
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {TX_TYPE_ICON[tx.transaction_type] || TX_TYPE_ICON.payout}
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                    {tx.transaction_type.replace(/_/g, " ")}
                  </div>
                  {tx.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {tx.description}
                    </div>
                  )}
                  {tx.reference && <div className="data-id">{tx.reference}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-data-mono font-semibold text-slate-900 dark:text-white">
                  {formatDirect(tx.amount ?? tx.amount_kes, currency)}
                </div>
                <div className={`text-xs capitalize mt-0.5 ${
                  tx.status === "completed" ? "text-teal-600" :
                  tx.status === "failed" ? "text-red-600" : "text-slate-400"
                }`}>
                  {tx.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
