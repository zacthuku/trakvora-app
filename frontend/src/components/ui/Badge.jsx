import { LOAD_STATUS_COLORS, LOAD_STATUS_LABELS } from "@/utils/constants";

export function StatusBadge({ status }) {
  const colorClass = LOAD_STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`badge ${colorClass}`}>
      {LOAD_STATUS_LABELS[status] || status}
    </span>
  );
}

export function Badge({ children, color = "slate", className = "" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    orange: "bg-orange-100 text-orange-700",
    teal: "bg-teal-100 text-teal-700",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`badge ${colors[color] || colors.slate} ${className}`}>
      {children}
    </span>
  );
}
