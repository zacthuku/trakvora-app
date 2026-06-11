import { useState } from "react";
import { Truck, Package, Building2, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/features/auth/api/authApi";
import { useNavigate } from "react-router-dom";

const ROLE_OPTIONS = [
  {
    role: "shipper",
    label: "Shipper",
    description: "Post loads and hire carriers",
    icon: Package,
    home: "/shipper/home",
  },
  {
    role: "owner",
    label: "Fleet Owner",
    description: "Manage trucks, drivers, and accept jobs",
    icon: Building2,
    home: "/owner/home",
  },
  {
    role: "driver",
    label: "Driver",
    description: "Drive and deliver loads directly",
    icon: Truck,
    home: "/driver/home",
    individualOnly: true,
  },
];

export default function RoleChangeCard() {
  const user         = useAuthStore((s) => s.user);
  const setAuth      = useAuthStore((s) => s.setAuth);
  const accessToken  = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();

  const isCompany = Boolean(user?.company_name);
  const currentRole = user?.role;

  const availableOptions = ROLE_OPTIONS.filter(
    (o) => !(o.individualOnly && isCompany)
  );

  const [selected, setSelected] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasChanged = selected !== currentRole;
  const switchingToDriver = selected === "driver";

  const handleSubmit = async () => {
    if (!hasChanged) return;
    setError("");
    setLoading(true);
    try {
      const updatedUser = await authApi.changeRole(selected);
      setAuth(updatedUser, accessToken, refreshToken);
      setSuccess(true);
      const home = ROLE_OPTIONS.find((o) => o.role === selected)?.home ?? "/";
      setTimeout(() => navigate(home, { replace: true }), 1200);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "object"
          ? detail.message || "Could not change role."
          : detail || "Could not change role."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        Role changed successfully. Redirecting…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {availableOptions.map(({ role, label, description, icon: Icon }) => {
          const isCurrent = role === currentRole;
          const isSelected = role === selected;
          return (
            <button
              key={role}
              type="button"
              onClick={() => { setSelected(role); setError(""); }}
              disabled={isCurrent}
              className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? "border-secondary bg-orange-50 dark:bg-orange-900/20"
                  : isCurrent
                  ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 opacity-60 cursor-default"
                  : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700"
              }`}
            >
              {isCurrent && (
                <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-secondary/10" : "bg-slate-100 dark:bg-slate-600"}`}>
                <Icon className={`w-4 h-4 ${isSelected ? "text-secondary" : "text-slate-500 dark:text-slate-300"}`} />
              </div>
              <div>
                <p className={`font-heading font-bold text-sm ${isSelected ? "text-secondary" : "text-slate-800 dark:text-white"}`}>
                  {label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p>Your role change takes effect immediately. All your history — loads, bids, shipments, and wallet balance — is preserved.</p>
          <p className="font-semibold">Make sure you have no active jobs before switching.</p>
          {switchingToDriver && <p>You may need to re-submit your driver&apos;s licence for the new role.</p>}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!hasChanged || loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Switching role…" : "Switch Role"}
      </button>
    </div>
  );
}
