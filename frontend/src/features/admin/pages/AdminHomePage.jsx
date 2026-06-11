import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, Navigation2, Truck, CreditCard, ShieldCheck, Fingerprint,
  Package, BarChart3, Headphones, ClipboardList, Map,
  Activity, AlertTriangle, CheckCircle2, ArrowRight, ChevronRight,
  Radio, FileText, Wallet, CheckCircle,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";

function greeting(name) {
  const h = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
}

function fmtKes(n) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n ?? 0}`;
}

function timeSince(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ROLE_META = {
  super_admin:        { label: "Super Admin",        subtitle: "Full platform overview",       color: "text-violet-300", bg: "bg-violet-500/20",  border: "border-violet-400/40"  },
  operations_admin:   { label: "Operations Admin",   subtitle: "Operational overview",         color: "text-sky-300",    bg: "bg-sky-500/20",     border: "border-sky-400/40"     },
  finance_admin:      { label: "Finance Admin",      subtitle: "Financial overview",           color: "text-teal-300",   bg: "bg-teal-500/20",    border: "border-teal-400/40"    },
  field_inspector:    { label: "Field Inspector",    subtitle: "Field tasks and inspections",  color: "text-amber-300",  bg: "bg-amber-500/20",   border: "border-amber-400/40"   },
  iot_technician:     { label: "IoT Technician",     subtitle: "Device operations",            color: "text-blue-300",   bg: "bg-blue-500/20",    border: "border-blue-400/40"    },
  compliance_officer: { label: "Compliance Officer", subtitle: "Compliance and KYC",          color: "text-rose-300",   bg: "bg-rose-500/20",    border: "border-rose-400/40"    },
  support_agent:      { label: "Support Agent",      subtitle: "User support overview",       color: "text-emerald-300",bg: "bg-emerald-500/20", border: "border-emerald-400/40" },
};

const ROLE_CTAS = {
  super_admin: [
    { to: "/admin/users",     icon: Users,       label: "Users",       desc: "Manage platform users and accounts"   },
    { to: "/admin/shipments", icon: Navigation2, label: "Shipments",   desc: "Monitor all active shipments"         },
    { to: "/admin/finance",   icon: BarChart3,   label: "Finance",     desc: "Revenue, wallets and commissions"     },
    { to: "/admin/fleet-map", icon: Map,         label: "Fleet Map",   desc: "Live fleet positions across routes"   },
    { to: "/admin/kyc",       icon: Fingerprint, label: "KYC Queue",   desc: "Review pending verifications"         },
    { to: "/admin/trucks",    icon: Truck,       label: "Fleet",       desc: "Truck registry and inspection"        },
  ],
  finance_admin: [
    { to: "/admin/wallets",  icon: Wallet,    label: "Wallets",  desc: "User balances and payouts"         },
    { to: "/admin/finance",  icon: BarChart3, label: "Finance",  desc: "Revenue dashboard and reports"     },
    { to: "/admin/pricing",  icon: CreditCard,label: "Pricing",  desc: "Manage route pricing and rates"    },
  ],
  operations_admin: [
    { to: "/admin/shipments", icon: Navigation2, label: "Shipments", desc: "All active shipments and disputes" },
    { to: "/admin/trucks",    icon: Truck,        label: "Fleet",    desc: "Truck management and inspection"   },
    { to: "/admin/loads",     icon: Package,      label: "Loads",    desc: "All posted loads on the platform"  },
    { to: "/admin/fleet-map", icon: Map,          label: "Fleet Map",desc: "Live tracking across routes"       },
    { to: "/admin/workforce", icon: Users,        label: "Workforce",desc: "Field operations workforce"        },
  ],
  support_agent: [
    { to: "/admin/support",         icon: Headphones, label: "Support", desc: "User support overview"    },
    { to: "/admin/support/tickets", icon: FileText,   label: "Tickets", desc: "Open support tickets"     },
    { to: "/admin/users",           icon: Users,      label: "Users",   desc: "Search and manage users"  },
  ],
  field_inspector: [
    { to: "/admin/field-inspector",  icon: ClipboardList, label: "My Tasks",  desc: "Field inspection assignments"   },
    { to: "/admin/field-ops/tasks",  icon: CheckCircle2,  label: "Field Ops", desc: "All field operations tasks"     },
  ],
  iot_technician: [
    { to: "/admin/iot",         icon: Radio,   label: "IoT Ops",  desc: "Device monitoring and alerts"    },
    { to: "/admin/iot/devices", icon: Package, label: "Devices",  desc: "Device inventory and management" },
  ],
  compliance_officer: [
    { to: "/admin/compliance", icon: ShieldCheck, label: "Compliance", desc: "Review compliance status"       },
    { to: "/admin/kyc",        icon: Fingerprint, label: "KYC",        desc: "Pending identity verifications" },
    { to: "/admin/trucks",     icon: Truck,       label: "Fleet",      desc: "Truck documents and inspection" },
  ],
};

export default function AdminHomePage() {
  const user = useAuthStore((s) => s.user);
  const adminRole = user?.admin_role ?? "super_admin";
  const roleMeta = ROLE_META[adminRole] || ROLE_META.super_admin;
  const ctas = ROLE_CTAS[adminRole] || ROLE_CTAS.super_admin;

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboard(),
    staleTime: 60 * 1000,
  });

  const d = dashboard || {};
  const recentActivity = useMemo(() => (d.recent_activity || []).slice(0, 5), [d]);

  const pendingKyc    = d.drivers?.pending_verifications ?? 0;
  const openDisputes  = d.shipments?.open_disputes        ?? 0;
  const hasAlerts     = pendingKyc > 0 || openDisputes > 0;

  const HERO_STATS = useMemo(() => {
    const base = [
      { icon: Users,       value: fmt(d.users?.total ?? 0),            label: "Users"            },
      { icon: Navigation2, value: fmt(d.shipments?.active ?? 0),       label: "Active Shipments" },
      { icon: Truck,       value: fmt(d.trucks?.total ?? 0),           label: "Trucks"           },
    ];
    if (adminRole === "super_admin" || adminRole === "finance_admin") {
      base.push({ icon: CreditCard, value: fmtKes(d.finance?.platform_revenue ?? 0), label: "Revenue" });
    }
    return base;
  }, [d, adminRole]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

      {/* ── Hero ── */}
      <section className="relative rounded-2xl overflow-hidden mb-8">
        <div className="absolute inset-0">
          <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/97 via-slate-900/90 to-slate-900/65" />
        </div>
        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${roleMeta.bg} ${roleMeta.color} ${roleMeta.border}`}>
                  <ShieldCheck className="w-3 h-3" />
                  {roleMeta.label}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white leading-tight">
                {greeting(user?.full_name)}
              </h1>
              <p className="text-slate-400 text-sm mt-2">{roleMeta.subtitle}</p>
            </div>

            {/* Primary CTAs (first 2) */}
            <div className="flex flex-wrap gap-3 shrink-0">
              {ctas.slice(0, 2).map(({ to, icon: Icon, label }, i) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity ${
                    i === 0
                      ? "bg-[#fe6a34] text-white hover:opacity-90 shadow-lg shadow-[#fe6a34]/30"
                      : "bg-white/10 border border-white/25 text-white hover:bg-white/20 backdrop-blur-sm"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Glass stat pills */}
          {!isLoading && (
            <div className="mt-8 flex flex-wrap gap-3">
              {HERO_STATS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3"
                >
                  <Icon className="w-4 h-4 text-white/60 shrink-0" />
                  <div>
                    <p className="text-lg font-heading font-bold text-white leading-none">{value}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Alert Strip ── */}
      {!isLoading && (
        <div className={`rounded-2xl border px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 ${
          hasAlerts
            ? "bg-amber-50 border-amber-200"
            : "bg-emerald-50 border-emerald-200"
        }`}>
          {hasAlerts ? (
            <>
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">Platform Alerts</span>
              </div>
              <div className="flex flex-wrap gap-2 sm:ml-2">
                {pendingKyc > 0 && (
                  <Link
                    to="/admin/kyc"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-200 transition-colors"
                  >
                    <Fingerprint className="w-3 h-3" />
                    {pendingKyc} Pending KYC
                  </Link>
                )}
                {openDisputes > 0 && (
                  <Link
                    to="/admin/shipments"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {openDisputes} Open Disputes
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm font-semibold">All clear — no critical alerts right now.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Actions + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Role-aware CTAs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-heading font-bold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Your most-used tools</p>
          </div>
          <div className="divide-y divide-slate-50">
            {ctas.map(({ to, icon: Icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <Icon className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{label}</p>
                  <p className="text-xs text-slate-400 truncate">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-heading font-bold text-slate-900">Recent Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest platform events</p>
            </div>
            <Link to="/admin/activity-log" className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentActivity.length === 0 && !isLoading && (
              <p className="text-center text-sm text-slate-400 py-8">No recent activity</p>
            )}
            {isLoading && (
              <p className="text-center text-sm text-slate-400 py-8">Loading...</p>
            )}
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {item.action || item.event || item.description || "System event"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {item.actor_name || item.actor || "System"} · {timeSince(item.created_at || item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {recentActivity.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100">
              <Link
                to="/admin/activity-log"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-violet-500 text-violet-600 text-sm font-semibold hover:bg-violet-500 hover:text-white transition-colors"
              >
                Full Activity Log <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Dashboard link ── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-white font-heading font-bold text-lg">Admin Dashboard</p>
          <p className="text-slate-400 text-sm mt-1">Full platform metrics, charts, and analytics</p>
        </div>
        <Link
          to="/admin"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#fe6a34] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#fe6a34]/30 whitespace-nowrap"
        >
          Open Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
