import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Briefcase, MapPin, User, CheckCircle2, Clock, WifiOff,
  Building2, UserCheck, ChevronRight, Fingerprint, FileText, ShieldCheck, Lock, Loader2,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { driverApi } from "@/features/driver/api/driverApi";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";

const STATUS_CONFIG = {
  available: {
    label: "Available",
    dot: "bg-emerald-400",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    btnActive: "bg-emerald-500 text-white shadow-sm",
    btnInactive: "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700",
  },
  on_job: {
    label: "On Job",
    dot: "bg-sky-400 animate-pulse",
    pill: "bg-sky-50 text-sky-700 border-sky-200",
    btnActive: "bg-sky-500 text-white shadow-sm",
    btnInactive: "bg-white text-slate-500 border border-slate-200 hover:border-sky-300 hover:text-sky-700",
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-500 border-slate-200",
    btnActive: "bg-slate-500 text-white shadow-sm",
    btnInactive: "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-700",
  },
};

const STATUS_OPTIONS = [
  { value: "available", icon: CheckCircle2, label: "Available" },
  { value: "on_job",    icon: Clock,        label: "On Job"   },
  { value: "offline",   icon: WifiOff,      label: "Offline"  },
];

function OnboardingBanner({ user, profile }) {
  const kycDone  = user?.kyc_status === "approved";
  const docsDone = profile?.verification_status === "approved";
  const submitted = profile?.documents_submitted;

  if (kycDone && docsDone) return null;

  const steps = [
    {
      icon: Fingerprint,
      label: "Verify Identity",
      done: kycDone,
      to: "/driver/settings",
      sub: "Submit your national ID or passport",
    },
    {
      icon: FileText,
      label: "Upload Documents",
      done: docsDone,
      locked: !kycDone,
      pending: submitted && !docsDone,
      to: "/driver/profile",
      sub: submitted && !docsDone ? "Under admin review" : "Licence, badge & clearance",
    },
    {
      icon: ShieldCheck,
      label: "Get Approved",
      done: docsDone,
      locked: !submitted,
      pending: submitted && !docsDone,
      sub: docsDone ? "You're good to go!" : submitted ? "Admin is reviewing your documents" : "Submit documents first",
    },
  ];

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
        Complete your profile to start accepting loads
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        {steps.map(({ icon: Icon, label, done, locked, pending, to, sub }, i) => {
          const content = (
            <div
              key={i}
              className={`flex-1 flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                done    ? "bg-teal-50 border-teal-200" :
                locked  ? "bg-slate-50 border-slate-200 opacity-60" :
                pending ? "bg-amber-100 border-amber-300" :
                          "bg-white border-amber-200 hover:border-amber-400"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                done ? "bg-teal-100" : locked ? "bg-slate-100" : "bg-amber-100"
              }`}>
                {done    ? <CheckCircle2 className="w-4 h-4 text-teal-600" /> :
                 locked  ? <Lock className="w-3.5 h-3.5 text-slate-400" /> :
                 pending ? <Loader2 className="w-4 h-4 text-amber-600 animate-spin" /> :
                           <Icon className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${done ? "text-teal-700" : locked ? "text-slate-400" : "text-slate-800"}`}>
                  {label}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
              </div>
              {!done && !locked && !pending && <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-1 ml-auto" />}
            </div>
          );
          return to && !done && !locked ? (
            <Link key={i} to={to} className="flex-1 no-underline">{content}</Link>
          ) : (
            <div key={i} className="flex-1">{content}</div>
          );
        })}
      </div>
    </div>
  );
}

function AvailabilityWidget({ profile, onStatusChange, isPending }) {
  const current = profile?.availability_status || "offline";
  const cfg = STATUS_CONFIG[current] || STATUS_CONFIG.offline;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${cfg.pill}`}>
            {cfg.label}
          </span>
          {profile?.seeking_employment && !profile?.employer_id && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
              Open to Work
            </span>
          )}
        </div>
        <Link to="/driver/profile" className="text-xs text-secondary font-semibold hover:underline flex items-center gap-1">
          <User className="w-3 h-3" /> Full Profile
        </Link>
      </div>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map(({ value, icon: Icon, label }) => {
          const isActive = current === value;
          const activeCls = isActive
            ? STATUS_CONFIG[value].btnActive
            : STATUS_CONFIG[value].btnInactive;
          return (
            <button
              key={value}
              disabled={isPending}
              onClick={() => onStatusChange(value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${activeCls} disabled:opacity-50`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {profile?.availability_location && (
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {profile.availability_location}
        </p>
      )}
    </div>
  );
}

function EmployerBadge({ profile }) {
  const employerId = profile?.employer_id;

  const { data: employer } = useQuery({
    queryKey: ["employer-public", employerId],
    queryFn: () => apiClient.get(`/users/${employerId}/public`).then(r => r.data),
    enabled: !!employerId,
  });

  if (employerId) {
    return (
      <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-violet-500 font-bold uppercase tracking-wider">Employed by</p>
          <p className="text-sm font-semibold text-slate-900 truncate">
            {employer?.company_name || employer?.full_name || "Fleet Owner"}
          </p>
        </div>
        <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold uppercase border border-violet-200">
          Contracted
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <UserCheck className="w-4 h-4 text-slate-500" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Employment</p>
        <p className="text-sm font-semibold text-slate-700">Self-Employed</p>
      </div>
    </div>
  );
}

export default function DriverDashboard() {
  const { format, formatWithSource } = useCurrency();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: activeShipment } = useQuery({
    queryKey: ["active-shipment"],
    queryFn: driverApi.getActiveShipment,
    refetchInterval: 30_000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["driver-wallet"],
    queryFn: driverApi.getWallet,
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["driver-marketplace"],
    queryFn: () => driverApi.getMarketplace({ page: 1, page_size: 5 }),
  });

  const { data: profile } = useQuery({
    queryKey: ["driver-profile-me"],
    queryFn: driverApi.getProfile,
    retry: false,
  });

  const availMutation = useMutation({
    mutationFn: (status) => driverApi.updateAvailability({ availability_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-profile-me"] }),
  });

  if (isLoading) return <PageSpinner />;

  const available = jobs?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-900">
          {user?.full_name?.split(" ")[0]}'s Hub
        </h1>
        <p className="text-slate-500 text-sm mt-1">Driver dashboard</p>
      </div>

      <OnboardingBanner user={user} profile={profile} />

      {activeShipment && (
        <Link
          to="/driver/active"
          className="flex items-center gap-3 bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 mb-4 hover:bg-secondary/15 transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Active Job In Progress</p>
            <p className="text-xs text-slate-500 capitalize">
              {activeShipment.status.replace(/_/g, " ")}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-secondary shrink-0" />
        </Link>
      )}

      <AvailabilityWidget
        profile={profile}
        onStatusChange={(s) => availMutation.mutate(s)}
        isPending={availMutation.isPending}
      />

      <EmployerBadge profile={profile} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card-accent p-5">
          <div className="text-3xl font-heading font-bold text-secondary">
            {format(wallet?.balance_kes ?? wallet?.balance ?? 0, wallet?.currency || "KES")}
          </div>
          <div className="text-sm text-slate-500 mt-1">Wallet Balance</div>
        </div>
        <div className="card p-5">
          <div className="text-3xl font-heading font-bold text-slate-700">
            {user?.total_trips || 0}
          </div>
          <div className="text-sm text-slate-500 mt-1">Completed Trips</div>
        </div>
        <div className="card p-5">
          <div className="text-3xl font-heading font-bold text-tertiary-fixed-dim">
            {available.length}
          </div>
          <div className="text-sm text-slate-500 mt-1">Available Loads</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-semibold">Nearby Loads</h2>
        <Link to="/driver/jobs" className="text-secondary text-sm font-medium">
          View all
        </Link>
      </div>

      {available.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No loads available right now</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {available.map((load) => (
            <Link
              key={load.id}
              to={`/driver/jobs`}
              className="card-accent p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="font-medium text-sm text-slate-900">
                  {load.pickup_location} → {load.dropoff_location}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {load.weight_tonnes}t · {load.cargo_type}
                  {load.corridor && ` · ${load.corridor}`}
                </div>
                {(load.shipper_company || load.shipper_name) && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span>{load.shipper_company || load.shipper_name}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-data-mono font-semibold text-slate-900">
                  {formatWithSource(load.price_kes)}
                </div>
                <StatusBadge status={load.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
