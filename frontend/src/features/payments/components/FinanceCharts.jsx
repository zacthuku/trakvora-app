/**
 * FinanceCharts.jsx
 * Shared chart components for all finance/wallet pages.
 * Uses react-chartjs-2 (already in package.json) + Tailwind CSS bars.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

// Register once for the whole app
ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, Tooltip, Filler
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  return Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
}

function getWeekLabel(isoKey) {
  // "2024-W22" → "W22"
  return isoKey.replace(/\d{4}-/, "");
}

function groupByWeek(transactions) {
  const weeks = {};
  for (const tx of transactions) {
    if (!tx.created_at) continue;
    const d = new Date(tx.created_at);
    const key = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, "0")}`;
    weeks[key] = (weeks[key] ?? 0) + (tx.amount_kes ?? tx.amount ?? 0);
  }
  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
}

function groupByType(transactions) {
  const types = {};
  for (const tx of transactions) {
    const t = tx.transaction_type ?? "other";
    types[t] = (types[t] ?? 0) + (tx.amount_kes ?? tx.amount ?? 0);
  }
  return Object.entries(types).sort(([, a], [, b]) => b - a).slice(0, 6);
}

function groupByStatus(transactions) {
  const statuses = {};
  for (const tx of transactions) {
    const s = tx.status ?? "unknown";
    statuses[s] = (statuses[s] ?? 0) + 1;
  }
  return statuses;
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const TYPE_BAR_COLORS = {
  escrow_hold:    "bg-amber-400",
  escrow_release: "bg-teal-400",
  escrow_refund:  "bg-blue-400",
  payout:         "bg-violet-400",
  top_up:         "bg-green-400",
  withdrawal:     "bg-indigo-400",
  platform_fee:   "bg-orange-400",
  dispute_hold:   "bg-red-400",
  subscription_fee: "bg-pink-400",
};

const STATUS_CHART_COLORS = {
  completed: "#22c55e",
  pending:   "#f59e0b",
  failed:    "#ef4444",
  reversed:  "#64748b",
};

// ─── SparkAreaChart ───────────────────────────────────────────────────────────
// Light-theme area chart for user wallet pages (Shipper, Owner, Driver)

export function SparkAreaChart({ transactions = [], currency = "KES" }) {
  const weeks = groupByWeek(transactions);

  if (weeks.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-slate-400">
        Not enough transaction data to display chart
      </div>
    );
  }

  const data = {
    labels: weeks.map(([w]) => getWeekLabel(w)),
    datasets: [
      {
        data: weeks.map(([, v]) => v),
        borderColor: "#fe6a34",
        backgroundColor: "rgba(254,106,52,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#fe6a34",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        borderColor: "#334155",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#e2e8f0",
        callbacks: {
          label: (ctx) =>
            `${currency} ${Number(ctx.raw).toLocaleString("en-KE", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#94a3b8", font: { size: 10 } },
      },
      y: {
        display: false,
      },
    },
  };

  return (
    <div className="h-28">
      <Line data={data} options={options} />
    </div>
  );
}

// ─── RevenueTrendChart ────────────────────────────────────────────────────────
// Dark-theme line chart for Admin Finance page

export function RevenueTrendChart({ transactions = [], currency = "KES" }) {
  const weeks = groupByWeek(transactions);

  if (weeks.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-600">
        {transactions.length === 0 ? "No revenue data yet" : "Not enough data points yet"}
      </div>
    );
  }

  const data = {
    labels: weeks.map(([w]) => getWeekLabel(w)),
    datasets: [
      {
        data: weeks.map(([, v]) => v),
        borderColor: "#4fdbcc",
        backgroundColor: "rgba(79,219,204,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#4fdbcc",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#e2e8f0",
        callbacks: {
          label: (ctx) =>
            `${currency} ${Number(ctx.raw).toLocaleString("en-KE")}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#1e293b" },
        ticks: { color: "#475569", font: { size: 10 } },
      },
      y: {
        grid: { color: "#1e293b" },
        ticks: {
          color: "#475569",
          font: { size: 10 },
          callback: (v) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}K`
              : v,
        },
      },
    },
  };

  return (
    <div className="h-32">
      <Line data={data} options={options} />
    </div>
  );
}

// ─── StatusDoughnut ───────────────────────────────────────────────────────────
// Dark-theme doughnut chart showing transaction status split (Admin)

export function StatusDoughnut({ transactions = [] }) {
  const statuses = groupByStatus(transactions);
  const keys = ["completed", "pending", "failed", "reversed"].filter(
    (k) => statuses[k] > 0
  );
  const values = keys.map((k) => statuses[k] ?? 0);
  const total = values.reduce((s, v) => s + v, 0);

  if (total === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-xs text-slate-600">
        No data
      </div>
    );
  }

  const data = {
    labels: keys,
    datasets: [
      {
        data: values,
        backgroundColor: keys.map((k) => STATUS_CHART_COLORS[k] ?? "#64748b"),
        borderColor: "#0f172a",
        borderWidth: 2,
        hoverBorderColor: "#1e293b",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#e2e8f0",
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw}`,
        },
      },
    },
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-36 w-36">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Total</div>
        </div>
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_CHART_COLORS[k] ?? "#64748b" }}
            />
            <span className="text-[10px] text-slate-400 capitalize">{k}</span>
            <span className="text-[10px] text-slate-300 font-semibold ml-auto">{statuses[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TypeBreakdownBars ────────────────────────────────────────────────────────
// Horizontal Tailwind progress bars — works in both light and dark themes

export function TypeBreakdownBars({ transactions = [], dark = false }) {
  const byType = groupByType(transactions);

  if (byType.length === 0) {
    return (
      <p className={`text-xs ${dark ? "text-slate-600" : "text-slate-400"}`}>
        No data
      </p>
    );
  }

  const total = byType.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-3">
      {byType.map(([type, amount]) => {
        const pct = total > 0 ? Math.max(1, Math.round((amount / total) * 100)) : 0;
        return (
          <div key={type}>
            <div
              className={`flex justify-between text-xs mb-1.5 ${
                dark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              <span className="capitalize">{type.replace(/_/g, " ")}</span>
              <span
                className={`font-semibold ${
                  dark ? "text-slate-200" : "text-slate-800"
                }`}
              >
                {pct}%
              </span>
            </div>
            <div
              className={`h-1.5 rounded-full ${
                dark ? "bg-slate-700" : "bg-slate-100"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  TYPE_BAR_COLORS[type] ?? "bg-slate-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
