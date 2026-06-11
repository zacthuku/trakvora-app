import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { providerApi } from "@/features/provider/api/providerApi";
import { Briefcase, ClipboardList, Star, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";

const ROLE_LABELS = {
  mover:          "Mover Company",
  air_freight:    "Air Freight Agent",
  parcel_carrier: "Parcel Carrier",
};

const BASE_PATHS = {
  mover:          "/mover",
  air_freight:    "/airfreight",
  parcel_carrier: "/parcel-carrier",
};

export default function ProviderDashboard() {
  const user = useAuthStore(s => s.user);
  const base = BASE_PATHS[user?.role] ?? "/";

  const { data: stats } = useQuery({
    queryKey: ["provider-stats"],
    queryFn: providerApi.getStats,
    refetchInterval: 30_000,
  });

  const { data: jobs } = useQuery({
    queryKey: ["provider-jobs-recent"],
    queryFn: () => providerApi.getMyJobs({ page: 1, page_size: 5 }),
    refetchInterval: 30_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["provider-profile"],
    queryFn: providerApi.getProfile,
  });

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{ROLE_LABELS[user?.role]} Dashboard</p>
      </div>

      {/* Verification banner */}
      {profile && !profile.is_verified && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-yellow-300 text-sm font-semibold">Account pending verification</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              Complete your profile and await admin verification before accepting bookings.
            </p>
          </div>
          <Link to={`${base}/profile`} className="ml-auto text-xs font-semibold text-yellow-300 hover:text-white transition-colors whitespace-nowrap">
            Complete Profile →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs",    value: stats?.total_jobs ?? 0,           icon: ClipboardList, color: "violet" },
          { label: "Available Now", value: stats?.pending_available ?? 0,    icon: Briefcase,     color: "orange" },
          { label: "Rating",        value: stats?.rating ? `${stats.rating.toFixed(1)}★` : "—", icon: Star, color: "yellow" },
          { label: "Verified",      value: stats?.is_verified ? "Yes" : "No", icon: ShieldCheck,  color: stats?.is_verified ? "green" : "slate" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-slate-900 border border-slate-800 rounded-xl p-4`}>
            <div className={`w-8 h-8 rounded-lg bg-${color}-900/40 flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 text-${color}-400`} />
            </div>
            <p className="text-2xl font-bold text-white font-heading">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={`${base}/bookings`}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-xl p-5 flex items-center gap-4 group transition-colors">
          <div className="w-10 h-10 rounded-xl bg-orange-900/40 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Browse Available Jobs</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {stats?.pending_available ?? 0} open booking{stats?.pending_available !== 1 ? "s" : ""} waiting
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
        </Link>

        <Link to={`${base}/jobs`}
          className="bg-slate-900 border border-slate-800 hover:border-violet-500/50 rounded-xl p-5 flex items-center gap-4 group transition-colors">
          <div className="w-10 h-10 rounded-xl bg-violet-900/40 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">My Jobs</p>
            <p className="text-slate-400 text-xs mt-0.5">{stats?.total_jobs ?? 0} total jobs accepted</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors shrink-0" />
        </Link>
      </div>

      {/* Recent jobs */}
      {jobs?.items?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white font-heading">Recent Jobs</h2>
            <Link to={`${base}/jobs`} className="text-xs text-slate-400 hover:text-white transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-slate-800/50">
            {jobs.items.map((job) => (
              <div key={job.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {job.move_type ? `${job.move_type} move` : null}
                    {job.port_of_origin ? `${job.port_of_origin} → ${job.port_of_destination}` : null}
                    {job.pickup_location ? `${job.pickup_location} → ${job.dropoff_location}` : null}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    KES {(job.price_kes ?? 0).toLocaleString()}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-heading
                  ${job.status === "completed" ? "bg-green-900/50 text-green-300 border-green-700/50" :
                    job.status === "accepted"  ? "bg-blue-900/50 text-blue-300 border-blue-700/50" :
                    job.status === "in_progress" ? "bg-orange-900/50 text-orange-300 border-orange-700/50" :
                    "bg-slate-800 text-slate-400 border-slate-700"}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
