import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Zap, Building2, Crown, Truck, Package, Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { subscriptionsApi } from "../api/subscriptionsApi";
import { useAuthStore } from "@/store/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryFees } from "@/hooks/useCountryFees";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const TIER_META = {
  // Owner / fleet tiers
  free:             { label: "Free",             icon: null,      color: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",         badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
  fleet_basic:      { label: "Fleet Basic",      icon: Zap,       color: "border-teal-300 bg-teal-50/30",     badge: "bg-teal-100 text-teal-700" },
  fleet_pro:        { label: "Fleet Pro",        icon: Building2, color: "border-secondary bg-secondary/5",   badge: "bg-secondary/10 text-secondary" },
  enterprise:       { label: "Enterprise",       icon: Crown,     color: "border-violet-300 bg-violet-50/30", badge: "bg-violet-100 text-violet-700" },
  // Shipper tiers
  shipper_free:     { label: "Starter",          icon: null,      color: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",         badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
  shipper_growth:   { label: "Growth",           icon: Zap,       color: "border-teal-300 bg-teal-50/30",     badge: "bg-teal-100 text-teal-700" },
  shipper_business: { label: "Business",         icon: Crown,     color: "border-violet-300 bg-violet-50/30", badge: "bg-violet-100 text-violet-700" },
  // Driver tiers
  driver_free:      { label: "Free",             icon: Truck,     color: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",         badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
};

const FEATURES_OWNER = [
  { key: "max_trucks",                  label: "Trucks",              fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "max_drivers",                 label: "Drivers",             fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "includes_analytics",          label: "Analytics dashboard", fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_api_access",         label: "API access",          fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_priority_matching",  label: "Priority matching",   fmt: (v) => (v ? "✓" : "—") },
];

const FEATURES_SHIPPER = [
  { key: "max_loads_per_month",         label: "Loads / month",       fmt: (v) => (v == null ? "Unlimited" : v) },
  { key: "includes_priority_matching",  label: "Priority matching",   fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_analytics",          label: "Analytics dashboard", fmt: (v) => (v ? "✓" : "—") },
  { key: "includes_api_access",         label: "API access",          fmt: (v) => (v ? "✓" : "—") },
];

const ROLE_SUBTITLES = {
  shipper: "Choose the plan that fits your shipping volume.",
  owner: "Choose the plan that fits your fleet size.",
  owner_user: "Choose the plan that fits your fleet size.",
  driver: "Your account is on the free plan — no charges apply.",
};

function StatusBadge({ status }) {
  const map = {
    trialing:  "bg-amber-50 text-amber-700 border-amber-200",
    active:    "bg-teal-50 text-teal-700 border-teal-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    expired:   "bg-slate-100 text-slate-500 border-slate-200",
    pending:   "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const { format } = useCurrency();
  const { user } = useAuthStore();
  const { vatRate, formatPercent } = useCountryFees();
  const { revenueAuthority } = useCountryConfig();
  const role = user?.role ?? "shipper";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [subError, setSubError] = useState(null);
  const location = useLocation();

  const walletPath = location.pathname.startsWith("/shipper")
    ? "/shipper/wallet"
    : location.pathname.startsWith("/owner")
      ? "/owner/wallet"
      : null;

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans", role],
    queryFn: () => subscriptionsApi.listPlans(),
  });

  const { data: current } = useQuery({
    queryKey: ["subscription-me"],
    queryFn: subscriptionsApi.getMySubscription,
    retry: false,
  });

  const subscribeMut = useMutation({
    mutationFn: (planId) => subscriptionsApi.subscribe(planId),
    onSuccess: () => {
      setSubError(null);
      qc.invalidateQueries(["subscription-me"]);
    },
    onError: (err) => {
      if (err.response?.status === 402) {
        setSubError(err.response.data?.detail || "Insufficient balance to activate this plan.");
      } else {
        setSubError("Something went wrong. Please try again.");
      }
    },
  });

  const cancelMut = useMutation({
    mutationFn: subscriptionsApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries(["subscription-me"]);
      setConfirmCancel(false);
    },
  });

  const currentPlanId = current?.plan_id;
  const isDriver = role === "driver";
  const features = role === "shipper" ? FEATURES_SHIPPER : FEATURES_OWNER;
  const subtitle = ROLE_SUBTITLES[role] ?? "Choose the plan that fits your needs.";

  if (plansLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
      </div>
    );
  }

  // Drivers: simple free-plan notice, no upgrade cards
  if (isDriver) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Subscription</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Driver Free Plan</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              You have full access to the job feed, active job tracking, and earnings at no cost.
              Trakvora charges no subscription fees to drivers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Subscription</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>
      </div>

      {/* Current subscription banner */}
      {current && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white">{current.plan_name}</span>
              <StatusBadge status={current.status} />
            </div>
            {current.trial_ends_at && current.status === "trialing" && (
              <p className="text-xs text-amber-600 mt-0.5">
                Trial ends {new Date(current.trial_ends_at).toLocaleDateString()}
              </p>
            )}
            {current.current_period_end && current.status === "active" && (
              <p className="text-xs text-slate-400 mt-0.5">
                Renews {new Date(current.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
          {current.status !== "cancelled" && current.status !== "expired" && (
            confirmCancel ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">Cancel subscription?</span>
                <button
                  onClick={() => cancelMut.mutate()}
                  disabled={cancelMut.isPending}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                >
                  {cancelMut.isPending ? "Cancelling…" : "Confirm"}
                </button>
                <button onClick={() => setConfirmCancel(false)} className="text-xs text-slate-400 hover:underline">
                  Keep plan
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="text-xs text-slate-400 hover:text-red-500 hover:underline transition-colors"
              >
                Cancel subscription
              </button>
            )
          )}
        </div>
      )}

      {/* Billing error banner */}
      {subError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <div className="flex-1">
            <span>{subError}</span>
            {walletPath && (subError.toLowerCase().includes("top up") || subError.toLowerCase().includes("insufficient")) && (
              <Link to={walletPath} className="ml-2 font-semibold underline hover:text-red-900">
                Top up wallet →
              </Link>
            )}
          </div>
          <button onClick={() => setSubError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const meta = TIER_META[plan.tier] || TIER_META.free;
          const Icon = meta.icon;
          const isCurrent = plan.id === currentPlanId;

          return (
            <div
              key={plan.id}
              className={`relative border-2 rounded-xl p-5 flex flex-col gap-4 shadow-sm transition-shadow hover:shadow-md ${meta.color} ${isCurrent ? "ring-2 ring-secondary ring-offset-1" : ""}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 bg-secondary text-white text-[10px] font-bold uppercase px-3 py-0.5 rounded-full shadow">
                    <CheckCircle2 className="w-3 h-3" /> Current
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  {Icon && <Icon className="w-4 h-4 text-slate-600" />}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.badge}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {plan.price_kes === 0 ? "Free" : format(plan.price_kes)}
                  {plan.price_kes > 0 && (
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/{plan.billing_cycle === "annual" ? "yr" : "mo"}</span>
                  )}
                </p>
                {plan.price_kes > 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{`+${formatPercent(vatRate)} VAT (${revenueAuthority})`}</p>
                )}
                {plan.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{plan.description}</p>
                )}
              </div>

              <ul className="space-y-1.5 flex-1">
                {features.map(({ key, label, fmt }) => (
                  <li key={key} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(plan[key])}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribeMut.mutate(plan.id)}
                disabled={isCurrent || subscribeMut.isPending}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-default"
                    : "bg-secondary text-white hover:bg-secondary/90 disabled:opacity-60"
                }`}
              >
                {isCurrent ? "Active" : subscribeMut.isPending ? "Processing…" : plan.price_kes === 0 ? "Select Free" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      {/* VAT notice */}
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-teal-400 shrink-0" />
        {`Prices exclude VAT. ${formatPercent(vatRate)} VAT is added at checkout and a tax receipt is issued for every charge.`}
      </p>

      {/* Feature comparison table (desktop) */}
      {plans.length > 0 && (
        <div className="hidden lg:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Feature Comparison</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-slate-500 dark:text-slate-400 font-semibold text-xs w-1/3">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className={`text-center px-3 py-3 text-xs font-semibold ${p.id === currentPlanId ? "text-secondary" : "text-slate-600 dark:text-slate-300"}`}>
                    {p.name}
                    {p.id === currentPlanId && <span className="block text-[9px] text-secondary">Current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {features.map(({ key, label, fmt }) => (
                <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{label}</td>
                  {plans.map((p) => (
                    <td key={p.id} className="text-center px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium">
                      {fmt(p[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
