import { ShieldCheck, Crown, Shield } from "lucide-react";

const TIER_CONFIG = {
  standard: {
    label: "Partner",
    icon: Shield,
    className: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
  verified: {
    label: "Verified Partner",
    icon: ShieldCheck,
    className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  premium: {
    label: "Premium Partner",
    icon: Crown,
    className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
  },
};

/**
 * PartnerBadge — displays a trust tier badge for logistics partners.
 * tier: "standard" | "verified" | "premium"
 * size: "sm" | "md" (default "sm")
 */
export default function PartnerBadge({ tier = "standard", size = "sm" }) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.standard;
  const Icon = config.icon;

  const sizeClass = size === "md"
    ? "px-2.5 py-1 text-xs gap-1.5"
    : "px-2 py-0.5 text-[10px] gap-1";

  return (
    <span
      className={`inline-flex items-center font-semibold border rounded-full ${sizeClass} ${config.className}`}
      title={config.label}
    >
      <Icon className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} />
      {config.label}
    </span>
  );
}
