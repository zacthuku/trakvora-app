import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Briefcase, Navigation2, Wallet, Star, ArrowRight,
  ChevronRight, BarChart2, Truck, MapPin, Package,
  UserCircle, MessageCircle, HelpCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { driverApi } from "@/features/driver/api/driverApi";
import { useCurrency } from "@/hooks/useCurrency";

function greeting(name) {
  const h = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

const PERIOD_DAYS   = { "7d": 7, "30d": 30, "90d": 90 };
const PERIOD_LABELS = { "7d": "7 Days", "30d": "30 Days", "90d": "90 Days" };

const STATUS_CONFIG = {
  available: { label: "Available", dot: "bg-emerald-400",              pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_job:    { label: "On Job",    dot: "bg-sky-400 animate-pulse",    pill: "bg-sky-50 text-sky-700 border-sky-200"             },
  offline:   { label: "Offline",   dot: "bg-slate-400",                pill: "bg-slate-100 text-slate-500 border-slate-200"      },
};

const LOAD_STATUS_LABELS = {
  available: "Pending", booked: "Booked", en_route_pickup: "En Route",
  loaded: "Loaded", in_transit: "In Transit", delivered: "Delivered",
};

export default function DriverHomePage() {
  const { format } = useCurrency();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("30d");

  const { data: profile } = useQuery({
    queryKey: ["driver-profile-me"],
    queryFn: () => driverApi.getProfile(),
    retry: false,
  });

  const { data: wallet } = useQuery({
    queryKey: ["driver-wallet"],
    queryFn: () => driverApi.getWallet(),
  });

  const { data: drivesData } = useQuery({
    queryKey: ["driver-my-drives"],
    queryFn: () => driverApi.getMyDrives({ page: 1, page_size: 100 }),
    retry: false,
  });

  const availabilityMutation = useMutation({
    mutationFn: (status) => driverApi.updateAvailability({ availability_status: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-profile-me"] }),
  });

  const drives = Array.isArray(drivesData) ? drivesData : (drivesData?.items || []);
  const currentStatus = profile?.availability_status || "offline";
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.offline;

  const tripsThisMonth = useMemo(() => {
    const now = new Date();
    return drives.filter((d) => {
      const dt = new Date(d.created_at);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
  }, [drives]);

  const completionRate = useMemo(() => {
    if (drives.length === 0) return 0;
    const done = drives.filter((d) => d.status === "delivered").length;
    return Math.round((done / drives.length) * 100);
  }, [drives]);

  const recentJobs = drives.slice(0, 5);

  const periodDrives = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    return drives.filter((d) => d.status === "delivered" && new Date(d.created_at) >= cutoff);
  }, [drives, period]);

  const periodDistance = useMemo(() => periodDrives.reduce((s, d) => s + (d.distance_km || 0), 0), [periodDrives]);
  const periodEarnings = useMemo(() => periodDrives.reduce((s, d) => s + (d.price_kes   || 0), 0), [periodDrives]);

  const walletDisplay = wallet
    ? format(wallet.balance_kes ?? wallet.balance ?? 0, wallet.currency || "KES")
    : "—";

  const HERO_STATS = [
    { icon: Truck,    value: tripsThisMonth, label: "Trips This Month" },
    { icon: Wallet,   value: walletDisplay,  label: "Wallet Balance"   },
    { icon: Star,     value: `${completionRate}%`, label: "Completion Rate" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

      {/* ── Hero ── */}
      <section className="relative rounded-2xl overflow-hidden mb-8">
        <div className="absolute inset-0">
          <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/96 via-slate-900/88 to-slate-900/60" />
        </div>
        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-[#4fdbcc] text-xs font-bold uppercase tracking-widest mb-2 font-heading">
                Driver Portal
              </p>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white leading-tight">
                {greeting(user?.full_name)}
              </h1>

              {/* Status pill + toggle */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusCfg.pill}`}>
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
                {currentStatus !== "on_job" && (
                  <div className="flex gap-1.5">
                    {currentStatus !== "available" && (
                      <button
                        onClick={() => availabilityMutation.mutate("available")}
                        disabled={availabilityMutation.isPending}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-500 text-white hover:opacity-90 transition border border-emerald-400"
                      >
                        Go Available
                      </button>
                    )}
                    {currentStatus !== "offline" && (
                      <button
                        onClick={() => availabilityMutation.mutate("offline")}
                        disabled={availabilityMutation.isPending}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-600 text-white hover:opacity-90 transition border border-slate-500"
                      >
                        Go Offline
                      </button>
                    )}
                  </div>
                )}
              </div>

              {profile?.rating != null && (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-sm">{Number(profile.rating).toFixed(1)}</span>
                  <span className="text-slate-400 text-xs">/ 5.0 rating</span>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/driver/jobs"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#fe6a34] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#fe6a34]/30"
              >
                <Briefcase className="w-4 h-4" /> Browse Jobs
              </Link>
              <Link
                to="/driver/active"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/25 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Navigation2 className="w-4 h-4" /> Active Job
              </Link>
              <Link
                to="/driver/earnings"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/25 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Wallet className="w-4 h-4" /> My Wallet
              </Link>
            </div>
          </div>

          {/* Glass stat pills */}
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
        </div>
      </section>

      {/* ── Recent Jobs + Earnings Report ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Recent jobs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-heading font-bold text-slate-900">Recent Jobs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Your latest assignments</p>
            </div>
            <Link to="/driver/jobs" className="flex items-center gap-1 text-xs font-semibold text-[#fe6a34] hover:underline">
              All jobs <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentJobs.length === 0 && (
              <div className="text-center py-10">
                <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No jobs yet</p>
                <Link to="/driver/jobs" className="text-xs text-[#fe6a34] font-semibold hover:underline mt-1 inline-block">
                  Browse available jobs
                </Link>
              </div>
            )}
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {job.pickup_location || "—"} → {job.dropoff_location || "—"}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.distance_km ? `${job.distance_km} km` : "Distance TBD"}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
                  job.status === "delivered"
                    ? "bg-teal-50 text-teal-700"
                    : job.status === "in_transit"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {LOAD_STATUS_LABELS[job.status] || job.status}
                </span>
              </div>
            ))}
          </div>
          {recentJobs.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100">
              <Link
                to="/driver/jobs"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#fe6a34] text-[#fe6a34] text-sm font-semibold hover:bg-[#fe6a34] hover:text-white transition-colors"
              >
                Find More Jobs <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Earnings report */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#fe6a34]" />
              <h2 className="text-sm font-heading font-bold text-slate-900">Earnings Report</h2>
            </div>
            <div className="flex gap-1">
              {Object.keys(PERIOD_LABELS).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    period === p ? "bg-[#fe6a34] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Distance</p>
                <p className="text-2xl font-heading font-bold text-slate-900">
                  {periodDistance > 0 ? periodDistance.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">km driven</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Pay</p>
                <p className="text-2xl font-heading font-bold text-slate-900">
                  {periodEarnings > 0 ? format(periodEarnings) : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">gross income</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Completed trips</p>
              {periodDrives.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">No completed trips in this period</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {periodDrives.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">
                          {d.pickup_location || "—"} → {d.dropoff_location || "—"}
                        </p>
                        <p className="text-[11px] text-slate-400">{d.distance_km ? `${d.distance_km} km` : "—"}</p>
                      </div>
                      <span className="text-xs font-bold text-[#fe6a34]">{format(d.price_kes || 0)}</span>
                    </div>
                  ))}
                  {periodDrives.length > 5 && (
                    <Link to="/driver/earnings" className="text-xs text-[#fe6a34] font-semibold hover:underline block text-center pt-1">
                      +{periodDrives.length - 5} more
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">{periodDrives.length} trips in {PERIOD_LABELS[period].toLowerCase()}</span>
              <Link to="/driver/earnings" className="text-xs font-semibold text-[#fe6a34] hover:underline flex items-center gap-1">
                Full report <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { to: "/driver/profile", icon: UserCircle,    label: "My Profile",    desc: "Update your details, documents, and truck info",   color: "bg-[#fe6a34]" },
          { to: "/driver/inbox",   icon: MessageCircle, label: "Inbox",         desc: "Messages and updates from shippers",               color: "bg-[#4fdbcc]" },
          { to: "/driver/support", icon: HelpCircle,    label: "Get Support",   desc: "Reach our team whenever you need help on the road", color: "bg-violet-500" },
        ].map(({ to, icon: Icon, label, desc, color }) => (
          <Link
            key={to}
            to={to}
            className="group relative flex flex-col gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fe6a34] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-heading font-bold text-slate-900 group-hover:text-[#fe6a34] transition-colors mb-1">{label}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#fe6a34] group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}
