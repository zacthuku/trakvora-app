import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, Phone, Save, Bell, Shield,
  Eye, EyeOff, Lock, CheckCircle2, AlertCircle,
  LogOut, RefreshCw, Briefcase, CreditCard, MapPin, Zap, Fingerprint, Loader2, Camera,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useNavigate } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { authApi } from "@/features/auth/api/authApi";
import OtpChannelCard from "@/features/auth/components/OtpChannelCard";
import RoleChangeCard from "@/features/auth/components/RoleChangeCard";
import PhoneCountryInput from "@/components/ui/PhoneCountryInput";
import ProfilePhotoPicker from "@/components/ui/ProfilePhotoPicker";
import NotificationPreferences from "@/components/ui/NotificationPreferences";

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400";

function Toggle({ checked, onChange, label, sub, icon: Icon, iconColor }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-slate-50 dark:border-slate-700 last:border-0">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className={`w-4 h-4 ${iconColor || "text-slate-500"}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div onClick={onChange}
        className={`relative w-11 h-6 rounded-full shrink-0 mt-1 transition-colors cursor-pointer ${checked ? "bg-secondary" : "bg-slate-200 dark:bg-slate-600"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </div>
  );
}

const KYC_STATUS_META = {
  unverified: { label: "Unverified",    color: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600" },
  pending:    { label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:   { label: "Verified",       color: "bg-teal-50 text-teal-700 border-teal-200" },
  rejected:   { label: "Rejected",       color: "bg-red-50 text-red-600 border-red-200" },
};

const ID_TYPES = [
  { value: "NATIONAL_ID",     label: "National ID" },
  { value: "PASSPORT",        label: "Passport" },
  { value: "DRIVERS_LICENSE", label: "Driver's Licence" },
  { value: "VOTER_ID",        label: "Voter ID" },
];

function KYCCard({ user, onVerified }) {
  const [idType, setIdType] = useState("NATIONAL_ID");
  const [idNumber, setIdNumber] = useState(user?.national_id || "");
  const [selfieUrl, setSelfieUrl] = useState(user?.kyc_selfie_url || null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  const kycStatus = user?.kyc_status || "unverified";
  const meta = KYC_STATUS_META[kycStatus] || KYC_STATUS_META.unverified;
  const canSubmit = kycStatus === "unverified" || kycStatus === "rejected";

  const handleSelfie = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.post("/uploads/photo", fd);
      setSelfieUrl(data.url);
    } catch {
      setMsg({ type: "err", text: "Selfie upload failed. You can still submit without it." });
    } finally {
      setSelfieUploading(false);
    }
  };

  const kycMut = useMutation({
    mutationFn: (payload) => apiClient.post("/users/me/kyc", payload).then((r) => r.data),
    onSuccess: (updated) => {
      onVerified?.(updated);
      setMsg({ type: "ok", text: updated.kyc_status === "approved" ? "Identity verified successfully!" : "Submitted for review. You will be notified once approved." });
    },
    onError: (err) => setMsg({ type: "err", text: err.response?.data?.detail || "Submission failed. Try again." }),
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Identity Verification</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Required to accept loads and receive payouts.</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      {kycStatus === "approved" && (
        <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Your identity has been verified. No further action needed.
        </div>
      )}

      {kycStatus === "pending" && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          Your ID is under review. This usually takes 24–48 hours.
        </div>
      )}

      {kycStatus === "rejected" && user?.kyc_rejection_reason && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{user.kyc_rejection_reason}</span>
        </div>
      )}

      {canSubmit && (
        <form onSubmit={(e) => { e.preventDefault(); kycMut.mutate({ id_type: idType, id_number: idNumber, ...(selfieUrl ? { selfie_url: selfieUrl } : {}) }); }}
          className="space-y-4 mt-2">
          {/* Selfie */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Selfie <span className="text-slate-400 dark:text-slate-500 font-normal">(optional — helps match face to ID)</span>
            </label>
            <div className="flex items-center gap-3">
              {selfieUrl ? (
                <img src={selfieUrl} alt="selfie" className="w-16 h-16 rounded-xl object-cover border-2 border-teal-300 shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <label className="cursor-pointer px-3 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors">
                {selfieUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Camera className="w-3.5 h-3.5" />{selfieUrl ? "Retake" : "Take Selfie"}</>}
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfie} disabled={selfieUploading} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">ID Type</label>
            <select value={idType} onChange={(e) => setIdType(e.target.value)}
              className={inputCls}>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">ID Number</label>
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 12345678" required className={inputCls} />
          </div>
          {msg && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${msg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={kycMut.isPending || !idNumber.trim()}
            className="px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 flex items-center gap-2">
            {kycMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Fingerprint className="w-4 h-4" /> Verify Identity</>}
          </button>
        </form>
      )}
    </div>
  );
}

export default function DriverSettingsPage() {
  const { user, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { enabled, setEnabled } = useNotificationStore();

  const [profile, setProfile] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    country: user?.country || "KE",
    company_name: user?.company_name || "",
  });
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwMsg, setPwMsg] = useState(null);
  const [notifs, setNotifs] = useState(() => {
    const defaults = {
      job_assigned: true, new_jobs_nearby: true, pickup_reminder: true,
      delivery_reminder: true, earnings_update: true, safety_alerts: true,
      email_digest: true, sms_alerts: false,
    };
    try {
      const stored = localStorage.getItem(`trakvora_notif_${user?.id}_driver`);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const setP = (k) => (e) => setProfile((f) => ({ ...f, [k]: e.target.value }));
  const setPw = (k) => (e) => setPasswords((f) => ({ ...f, [k]: e.target.value }));
  const toggleNotif = (k) => () => setNotifs((f) => ({ ...f, [k]: !f[k] }));

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      setPwMsg({ type: "ok", text: "Password changed successfully." });
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 401) {
        setPwMsg({ type: "err", text: "Current password is incorrect." });
      } else {
        setPwMsg({ type: "err", text: detail || "Failed to change password." });
      }
    }
  };

  const profileMutation = useMutation({
    mutationFn: (data) => apiClient.patch("/users/me", data).then((r) => r.data),
    onSuccess: (updated) => {
      const state = useAuthStore.getState();
      setAuth(updated, state.accessToken, state.refreshToken);
      setProfileMsg({ type: "ok", text: "Profile updated successfully." });
      setTimeout(() => setProfileMsg(null), 4000);
    },
    onError: (err) =>
      setProfileMsg({ type: "err", text: err?.response?.data?.detail || "Failed to save." }),
  });

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "D";

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your driver profile and notification preferences.</p>
      </div>

      {!user?.phone && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
          <Phone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Add your phone number</p>
            <p className="text-xs text-amber-600 mt-0.5">Required for SMS alerts and two-factor authentication. Update it in your profile below.</p>
          </div>
        </div>
      )}

      {/* Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-700/50">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Profile Information</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your driver account details.</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-700">
            <ProfilePhotoPicker user={user} initials={initials} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{user?.full_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-[#4fdbcc]/10 text-teal-700 text-[10px] font-bold uppercase tracking-wider">Driver</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{user?.total_trips || 0} trips completed</span>
              </div>
            </div>
          </div>

          {profileMsg && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border mb-4 ${
              profileMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {profileMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); profileMutation.mutate({ full_name: profile.full_name || undefined, phone: profile.phone || undefined, country: profile.country || undefined }); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Full Name</label>
                <input value={profile.full_name} onChange={setP("full_name")} placeholder="Your name" className={inputCls} />
              </div>
              <PhoneCountryInput
                value={profile.phone}
                countryCode={profile.country}
                onChange={(phone, code) => setProfile((f) => ({ ...f, phone, country: code }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email</label>
              <input value={user?.email} disabled className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={profileMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {profileMutation.isPending ? "Saving…" : <><Save className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-700/50">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center"><Bell className="w-4 h-4 text-white" /></div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Notifications</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which alerts you receive and how.</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <NotificationPreferences />
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
            <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Security</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your password.</p>
          </div>
        </div>
        {pwMsg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border mb-4 ${pwMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {pwMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {["current", "next", "confirm"].map((key) => {
            const labels = { current: "Current Password", next: "New Password", confirm: "Confirm New Password" };
            return (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{labels[key]}</label>
                <div className="relative">
                  <input
                    type={showPw[key] ? "text" : "password"}
                    value={passwords[key]}
                    onChange={setPw(key)}
                    placeholder="••••••••"
                    required
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
          <button type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
            <Lock className="w-4 h-4" /> Change Password
          </button>
        </form>
      </div>

      {/* Two-Factor Auth */}
      <OtpChannelCard user={user} onSaved={(updated) => {
        const s = useAuthStore.getState();
        setAuth(updated, s.accessToken, s.refreshToken);
      }} />

      {/* Identity Verification (KYC) */}
      <KYCCard user={user} onVerified={(updated) => {
        const s = useAuthStore.getState();
        setAuth(updated, s.accessToken, s.refreshToken);
      }} />

      {/* Switch Role */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5 mt-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Switch Role</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Change your account role on the platform.</p>
          </div>
        </div>
        <RoleChangeCard />
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm px-6 py-5 mt-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Danger Zone</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Irreversible account actions.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border border-slate-100 dark:border-slate-700 rounded-lg px-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Sign Out
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sign out on this device.</p>
            </div>
            <button onClick={() => { clearAuth(); navigate("/login"); }}
              className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
