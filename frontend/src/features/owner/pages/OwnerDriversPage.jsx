import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Search, Star, BadgeCheck, MapPin, Truck,
  Send, UserMinus, UserPlus, Briefcase, X, CheckCircle2,
  AlertCircle, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, Mail, UserCheck,
  TrendingUp,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { invitationsApi } from "@/features/auth/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import PhoneCountryInput from "@/components/ui/PhoneCountryInput";

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500";

const AVAIL_META = {
  available: { label: "Available", dot: "bg-teal-400", text: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
  on_job:    { label: "On Job",    dot: "bg-sky-400",  text: "text-sky-700",  bg: "bg-sky-50 border-sky-200"   },
  offline:   { label: "Offline",   dot: "bg-slate-400",text: "text-slate-500",bg: "bg-slate-100 border-slate-200" },
};

const TRUCK_TYPES = ["flatbed", "dry_van", "reefer", "tanker", "lowbed", "tipper"];

function Avatar({ name, photo, size = 10 }) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || "").trim().slice(0, 2).toUpperCase() || "??";
  return photo
    ? <img src={photo} alt={name} className={`w-${size} h-${size} rounded-full object-cover border border-slate-200 shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-slate-800 flex items-center justify-center border border-slate-200 shrink-0`}>
        <span className="text-xs font-bold text-white font-heading">{initials}</span>
      </div>;
}

function VerBadge({ ntsa, status }) {
  const { transportAuthority } = useCountryConfig();
  if (ntsa) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-teal-50 text-teal-700 border border-teal-200">
      <BadgeCheck className="w-3 h-3" /> {transportAuthority}
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> Verified
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  return null;
}

// ── Post Job Modal ────────────────────────────────────────────────────────────
function PostJobModal({ onClose }) {
  const { currency } = useCountryConfig();
  const [form, setForm] = useState({ title: "", description: "", location: "", required_truck_type: "", salary_range: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const mut = useMutation({
    mutationFn: (data) => apiClient.post("/drivers/job-post", data),
    onSuccess: () => setDone(true),
    onError: (e) => setErr(e?.response?.data?.detail || "Failed to post job"),
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Post a Driver Job</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Broadcasts to all drivers seeking employment</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-teal-600" />
            </div>
            <p className="font-heading font-bold text-slate-900">Job Posted!</p>
            <p className="text-sm text-slate-500">All drivers seeking employment have been notified.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mut.mutate(form); }} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Job Title *</label>
              <input required value={form.title} onChange={set("title")} placeholder="e.g. Long-haul Flatbed Driver" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Description *</label>
              <textarea required rows={3} value={form.description} onChange={set("description")}
                placeholder="Describe the role, routes, schedule, and requirements…"
                className={inputCls + " resize-none"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Location *</label>
                <input required value={form.location} onChange={set("location")} placeholder="e.g. Nairobi CBD" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Salary / Pay Range</label>
                <input value={form.salary_range} onChange={set("salary_range")} placeholder={`e.g. ${currency} 60,000/mo`} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Required Truck Type</label>
              <select value={form.required_truck_type} onChange={set("required_truck_type")} className={inputCls}>
                <option value="">Any type</option>
                {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            {err && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" /> {err}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={mut.isPending}
                className="flex-1 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {mut.isPending ? "Posting…" : "Post Job"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Driver Info Modal ─────────────────────────────────────────────────────────
function DriverInfoModal({ driver, assignedTruckReg, onClose }) {
  const avail = AVAIL_META[driver.availability_status] || AVAIL_META.offline;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Driver Profile</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[75vh]">
          <div className="flex items-center gap-4">
            <Avatar name={driver.full_name} photo={driver.profile_photo_url} size={16} />
            <div className="min-w-0">
              <p className="font-heading font-bold text-slate-900 dark:text-white text-lg leading-tight">{driver.full_name || "Unknown Driver"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{driver.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <VerBadge ntsa={driver.ntsa_verified} status={driver.verification_status} />
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${avail.bg} ${avail.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
                  {avail.label}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {driver.rating != null && (
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-3 text-center border border-slate-100 dark:border-slate-600">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Rating</p>
                <p className="font-bold text-amber-600 flex items-center justify-center gap-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {driver.rating.toFixed(1)}
                </p>
              </div>
            )}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-3 text-center border border-slate-100 dark:border-slate-600">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Trips</p>
              <p className="font-bold text-slate-700 dark:text-slate-200">{driver.total_trips}</p>
            </div>
            {driver.experience_years && (
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-3 text-center border border-slate-100 dark:border-slate-600">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Experience</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">{driver.experience_years}y</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {assignedTruckReg && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assigned Truck</p>
                  <p className="text-slate-700 dark:text-slate-200 font-semibold">{assignedTruckReg}</p>
                </div>
              </div>
            )}
            {driver.licence_class && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Licence Class</p>
                <p className="text-slate-700 dark:text-slate-200 font-semibold">Class {driver.licence_class}</p>
              </div>
            )}
            {driver.licence_expiry && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Licence Expiry</p>
                <p className="text-slate-700 dark:text-slate-200">{driver.licence_expiry}</p>
              </div>
            )}
            {driver.availability_location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</p>
                  <p className="text-slate-700 dark:text-slate-200">{driver.availability_location}</p>
                </div>
              </div>
            )}
          </div>

          {driver.preferred_routes && (
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Preferred Routes</p>
              <p className="text-slate-600 dark:text-slate-300 text-sm">{driver.preferred_routes}</p>
            </div>
          )}
          {driver.bio && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Bio</p>
              <p className="text-slate-600 dark:text-slate-300 text-sm">{driver.bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── My Team card ──────────────────────────────────────────────────────────────
function TeamDriverCard({ driver, assignedTruckReg, onDismiss, dismissing }) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const avail = AVAIL_META[driver.availability_status] || AVAIL_META.offline;

  return (
    <>
      {showInfo && (
        <DriverInfoModal
          driver={driver}
          assignedTruckReg={assignedTruckReg}
          onClose={() => setShowInfo(false)}
        />
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4">
          <button
            className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            onClick={() => setShowInfo(true)}
          >
            <Avatar name={driver.full_name} photo={driver.profile_photo_url} size={12} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-heading font-bold text-slate-900 dark:text-white">{driver.full_name || "Unknown Driver"}</p>
                <VerBadge ntsa={driver.ntsa_verified} status={driver.verification_status} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{driver.email}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${avail.bg} ${avail.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
                  {avail.label}
                </span>
                {driver.experience_years && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{driver.experience_years}y exp</span>
                )}
                {driver.licence_class && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Class {driver.licence_class}</span>
                )}
                {driver.rating != null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {driver.rating.toFixed(1)}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{driver.total_trips} trips</span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {confirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Remove?</span>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirming(false); onDismiss(driver.id); }}
                  disabled={dismissing}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                title="Remove from team"
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {assignedTruckReg && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assigned Truck</p>
                  <p className="text-slate-700 dark:text-slate-200 font-semibold">{assignedTruckReg}</p>
                </div>
              </div>
            )}
            {driver.availability_location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</p>
                  <p className="text-slate-700 dark:text-slate-200">{driver.availability_location}</p>
                </div>
              </div>
            )}
            {driver.preferred_routes && (
              <div className="sm:col-span-2">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Preferred Routes</p>
                <p className="text-slate-600 dark:text-slate-300">{driver.preferred_routes}</p>
              </div>
            )}
            {driver.bio && (
              <div className="sm:col-span-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Bio</p>
                <p className="text-slate-600 dark:text-slate-300">{driver.bio}</p>
              </div>
            )}
            {driver.licence_expiry && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Licence Expiry</p>
                <p className="text-slate-700 dark:text-slate-200">{driver.licence_expiry}</p>
              </div>
            )}
            <div className="sm:col-span-2 pt-1">
              <Link
                to={`/owner/drivers/${driver.id}/performance`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-500 hover:text-violet-600 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" /> View Performance
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Find Drivers card ─────────────────────────────────────────────────────────
function SeekingDriverCard({ driver, onInvite, inviting, invited }) {
  const avail = AVAIL_META[driver.availability_status] || AVAIL_META.offline;
  const alreadyEmployed = Boolean(driver.employer_id);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-start gap-4">
      <Avatar name={driver.full_name} photo={driver.profile_photo_url} size={11} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading font-bold text-slate-900 dark:text-white text-sm">{driver.full_name || "Driver"}</p>
          <VerBadge ntsa={driver.ntsa_verified} status={driver.verification_status} />
          {driver.seeking_employment && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 border border-violet-200">
              Open to Work
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${avail.bg} ${avail.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
            {avail.label}
          </span>
          {driver.experience_years && <span className="text-[10px] text-slate-500 dark:text-slate-400">{driver.experience_years}y exp</span>}
          {driver.licence_class && <span className="text-[10px] text-slate-500 dark:text-slate-400">Licence Class {driver.licence_class}</span>}
          {driver.rating != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {driver.rating.toFixed(1)}
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{driver.total_trips} trips</span>
        </div>
        {driver.availability_location && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500">{driver.availability_location}</span>
          </div>
        )}
        {driver.preferred_routes && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">Routes: {driver.preferred_routes}</p>
        )}
        {driver.bio && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">{driver.bio}</p>
        )}
      </div>
      <div className="shrink-0 pt-1">
        {alreadyEmployed ? (
          <span className="text-[10px] text-slate-400 italic">Employed</span>
        ) : invited ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-violet-50 text-violet-700 border border-violet-200">
            <CheckCircle2 className="w-3 h-3" /> Invited
          </span>
        ) : (
          <button
            onClick={() => onInvite(driver.id)}
            disabled={inviting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
            {inviting ? "Sending…" : "Invite"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Register Driver Modal (owner creates the account on behalf of the driver) ──
function RegisterDriverModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", country: "KE", licence_number: "", national_id: "", kra_pin: "" });
  const [done, setDone] = useState(null); // null | driver object
  const [err, setErr] = useState("");

  const mut = useMutation({
    mutationFn: (data) => apiClient.post("/drivers/register-for-owner", data).then(r => r.data),
    onSuccess: (driver) => { setDone(driver); onSuccess?.(); },
    onError: (e) => setErr(e?.response?.data?.detail || "Registration failed. Please try again."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErr("");
    const payload = {
      full_name:     form.full_name,
      email:         form.email,
      phone:         form.phone,
      country:       form.country,
      licence_number: form.licence_number,
      national_id:   form.national_id || undefined,
      kra_pin:       form.kra_pin || undefined,
    };
    mut.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Register New Driver</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Their account is created and linked to your fleet immediately</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-teal-600" />
            </div>
            <p className="font-heading font-bold text-slate-900 dark:text-white text-lg">{done.full_name} registered!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Their account is live and linked to your fleet. They'll receive an email at <strong>{form.email}</strong> with instructions to set their password.
            </p>
            <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Full Name *</label>
              <input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="John Kamau" className={inputCls} />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="driver@example.com" className={`${inputCls} pl-9`} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Phone Number *</label>
              <PhoneCountryInput
                value={form.phone}
                countryCode={form.country}
                onChange={(phone, code) => setForm(f => ({ ...f, phone, country: code }))}
                required
              />
            </div>

            {/* Driver's License Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Driver's License Number *</label>
              <input required value={form.licence_number} onChange={e => setForm(f => ({ ...f, licence_number: e.target.value }))}
                placeholder="e.g. DL123456" className={inputCls} />
            </div>

            {/* National ID */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                ID / Passport Number <span className="text-slate-400 normal-case font-normal">(optional)</span>
              </label>
              <input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                placeholder="e.g. 12345678" className={inputCls} />
            </div>

            {/* KRA PIN */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                KRA PIN <span className="text-slate-400 normal-case font-normal">(optional)</span>
              </label>
              <input value={form.kra_pin} onChange={e => setForm(f => ({ ...f, kra_pin: e.target.value }))}
                placeholder="e.g. A001234567X" maxLength={20} className={inputCls} />
            </div>

            {err && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" /> {err}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={mut.isPending}
                className="flex-1 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {mut.isPending ? "Registering…" : "Register Driver"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerDriversPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { transportAuthority, currency } = useCountryConfig();
  const [tab, setTab] = useState("team");
  const [search, setSearch] = useState("");
  const [filterSeeking, setFilterSeeking] = useState(false);
  const [filterTruckType, setFilterTruckType] = useState("");
  const [showJobModal, setShowJobModal] = useState(false);
  const [showRegisterDriverModal, setShowRegisterDriverModal] = useState(false);
  const [invitingId, setInvitingId] = useState(null);
  const [invitedIds, setInvitedIds] = useState(new Set());
  const [dismissingId, setDismissingId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const toast = (msg, ok = true) => {
    setToastMsg({ msg, ok });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const { data: team = [], isLoading: teamLoading } = useQuery({
    queryKey: ["owner-my-team"],
    queryFn: () => apiClient.get("/drivers/my-team").then(r => r.data),
    staleTime: 20_000,
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => apiClient.get("/trucks").then(r => r.data),
    staleTime: 30_000,
  });
  const truckRegMap = Object.fromEntries(trucks.map(t => [t.id, t.registration_number]));

  const { data: seekingAll = [], isLoading: seekLoading } = useQuery({
    queryKey: ["owner-seeking-drivers"],
    queryFn: () => apiClient.get("/drivers/seeking").then(r => r.data),
    staleTime: 20_000,
    enabled: tab === "find",
  });

  const dismissMut = useMutation({
    mutationFn: (id) => apiClient.delete(`/drivers/${id}/dismiss`),
    onMutate: (id) => setDismissingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-my-team"] });
      toast("Driver removed from your team.");
    },
    onError: () => toast("Failed to remove driver.", false),
    onSettled: () => setDismissingId(null),
  });

  const inviteMut = useMutation({
    mutationFn: (id) => apiClient.post(`/drivers/${id}/invite`),
    onMutate: (id) => setInvitingId(id),
    onSuccess: (_, id) => {
      setInvitedIds(s => new Set([...s, id]));
      toast("Invitation sent to driver.");
    },
    onError: (e) => toast(e?.response?.data?.detail || "Failed to send invite.", false),
    onSettled: () => setInvitingId(null),
  });

  // Filter seeking list
  const seeking = seekingAll.filter(d => {
    const q = search.toLowerCase();
    const matchName = !q || (d.full_name || "").toLowerCase().includes(q) ||
      (d.availability_location || "").toLowerCase().includes(q);
    const matchSeeking = !filterSeeking || d.seeking_employment;
    const matchTruck = !filterTruckType ||
      (d.preferred_truck_types || "").toLowerCase().includes(filterTruckType);
    return matchName && matchSeeking && matchTruck;
  });

  // Filter team list
  const filteredTeam = team.filter(d => {
    const q = search.toLowerCase();
    return !q || (d.full_name || "").toLowerCase().includes(q) ||
      (d.availability_location || "").toLowerCase().includes(q);
  });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Driver Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your employed drivers and find new talent.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRegisterDriverModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#041627] text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <UserCheck className="w-4 h-4" />
            Register New Driver
          </button>
          <button
            onClick={() => setShowJobModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Briefcase className="w-4 h-4" />
            Post a Job
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "My Team",          value: team.length,                                                  color: "text-slate-900"  },
          { label: "On a Job",         value: team.filter(d => d.availability_status === "on_job").length,  color: "text-sky-600"    },
          { label: "Available",        value: team.filter(d => d.availability_status === "available").length,color: "text-teal-600"  },
          { label: `${transportAuthority} Verified`, value: team.filter(d => d.ntsa_verified).length,       color: "text-green-600"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-heading font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl mb-5 w-fit">
        {[
          { key: "team", icon: Users,     label: "My Team"       },
          { key: "find", icon: UserPlus,  label: "Find Drivers"  },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {key === "team" && team.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold">
                {team.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "team" ? "Search your team…" : "Search by name or location…"}
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
          />
        </div>
        {tab === "find" && (
          <>
            <button
              onClick={() => setFilterSeeking(s => !s)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-widest transition-colors ${
                filterSeeking
                  ? "bg-violet-800 border-violet-600 text-white"
                  : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500"
              }`}
            >
              Open to Work Only
            </button>
            <select
              value={filterTruckType}
              onChange={(e) => setFilterTruckType(e.target.value)}
              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:border-secondary outline-none"
            >
              <option value="">All Truck Types</option>
              {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
            <button
              onClick={() => setShowRegisterDriverModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#041627] text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Register Driver
            </button>
          </>
        )}
      </div>

      {/* ── My Team tab ── */}
      {tab === "team" && (
        <div className="space-y-3">
          {teamLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-24 animate-pulse" />
            ))
          ) : filteredTeam.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="font-heading font-semibold text-slate-400 dark:text-slate-500 mb-1">
                {team.length === 0 ? "No drivers on your team yet" : "No drivers match your search"}
              </p>
              {team.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Assign a driver via{" "}
                  <a href="/owner/fleet" className="text-secondary font-semibold hover:underline">Fleet Management</a>
                  {" "}or invite drivers from the{" "}
                  <button onClick={() => setTab("find")} className="text-secondary font-semibold hover:underline">Find Drivers</button>
                  {" "}tab.
                </p>
              )}
            </div>
          ) : (
            filteredTeam.map(d => (
              <TeamDriverCard
                key={d.id}
                driver={d}
                assignedTruckReg={truckRegMap[d.current_truck_id] ?? null}
                onDismiss={(id) => dismissMut.mutate(id)}
                dismissing={dismissingId === d.id}
              />
            ))
          )}
        </div>
      )}

      {/* ── Find Drivers tab ── */}
      {tab === "find" && (
        <div className="space-y-3">
          {seekLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-24 animate-pulse" />
            ))
          ) : seeking.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
              <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="font-heading font-semibold text-slate-400">
                {seekingAll.length === 0 ? "No drivers currently available" : "No drivers match your filters"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{seeking.length} driver{seeking.length !== 1 ? "s" : ""} found</p>
              {seeking.map(d => (
                <SeekingDriverCard
                  key={d.id}
                  driver={d}
                  onInvite={(id) => inviteMut.mutate(id)}
                  inviting={invitingId === d.id}
                  invited={invitedIds.has(d.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Post Job Modal */}
      {showJobModal && <PostJobModal onClose={() => setShowJobModal(false)} />}
      {showRegisterDriverModal && (
        <RegisterDriverModal
          onClose={() => setShowRegisterDriverModal(false)}
          onSuccess={() => qc.invalidateQueries(["owner-team"])}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
          toastMsg.ok
            ? "bg-teal-50 border-teal-200 text-teal-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {toastMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toastMsg.msg}
        </div>
      )}
    </div>
  );
}
