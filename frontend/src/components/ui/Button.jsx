import { Loader2 } from "lucide-react";

export default function Button({
  children,
  variant = "primary",
  loading = false,
  className = "",
  ...props
}) {
  const base = "inline-flex items-center gap-2 font-semibold px-4 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-secondary text-white hover:opacity-90",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
