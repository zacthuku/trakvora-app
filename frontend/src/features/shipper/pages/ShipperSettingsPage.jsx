import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  User, Phone, Mail, Save,
  Bell, Shield, Eye, EyeOff, Lock,
  CheckCircle2, AlertCircle, LogOut, RefreshCw,
  Gavel, Truck, CreditCard, Navigation2, Zap,
  Smartphone, ShieldCheck, Fingerprint, Loader2, Camera,
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
    <label className="flex items-start gap-4 cursor-pointer py-3.5 group border-b border-slate-50 dark:border-slate-700 last:border-0">
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-slate-50 dark:bg-slate-700`}>
          <Icon className={`w-4 h-4 ${iconColor || "text-slate-500"}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full shrink-0 mt-1 transition-colors cursor-pointer ${checked ? "bg-secondary" : "bg-slate-200 dark:bg-slate-600"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </label>
  );
}

function SectionCard({ icon: Icon, title, sub, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-700/50">
        <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-slate-900 dark:text-white">{title}</h2>
          {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
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
      setMsg({ type: "ok", text: updated.kyc_status === "approved" ? "Identity verified!" : "Submitted for review. You will be notified once approved." });
    },
    onError: (err) => setMsg({ type: "err", text: err.response?.data?.detail || "Submission failed." }),
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Identity Verification</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verified shippers get priority support and faster payouts.</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      {kycStatus === "approved" && (
        <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Your identity has been verified.
        </div>
      )}
      {kycStatus === "pending" && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> Your ID is under review. Usually 24–48 hours.
        </div>
      )}
      {kycStatus === "rejected" && user?.kyc_rejection_reason && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{user.kyc_rejection_reason}
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
              <label className="cursor-pointer px-3 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors">
                {selfieUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Camera className="w-3.5 h-3.5" />{selfieUrl ? "Retake" : "Take Selfie"}</>}
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfie} disabled={selfieUploading} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">ID Type</label>
            <select value={idType} onChange={(e) => setIdType(e.target.value)} className={inputCls}>
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

export default function ShipperSettingsPage() {
  const { user, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { enabled, setEnabled } = useNotificationStore();

  const [profile, setProfile] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    country: user?.country || "KE",
    company_name: user?.company_name || "",
    kra_pin: user?.kra_pin || "",
  });
  const [profileMsg, setProfileMsg] = useState(null);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwMsg, setPwMsg] = useState(null);

  const [notifs, setNotifs] = useState(() => {
    const defaults = {
      new_bids: true, bid_accepted: true, shipment_status: true,
      delivery_confirmed: true, payment_released: true, dispatch_alerts: true,
      email_digest: true, sms_alerts: false, platform_updates: false,
    };
    try {
      const stored = localStorage.getItem(`trakvora_notif_${user?.id}_shipper`);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const setP = (k) => (e) => setProfile((f) => ({ ...f, [k]: e.target.value }));
  const setPw = (k) => (e) => setPasswords((f) => ({ ...f, [k]: e.target.value }));
  const toggleNotif = (k) => () => setNotifs((f) => ({ ...f, [k]: !f[k] }));

  const profileMutation = useMutation({
    mutationFn: (data) => apiClient.patch("/users/me", data).then((r) => r.data),
    onSuccess: (updated) => {
      const state = useAuthStore.getState();
      setAuth(updated, state.accessToken, state.refreshToken);
      setProfileMsg({ type: "ok", text: "Profile updated successfully." });
      setTimeout(() => setProfileMsg(null), 4000);
    },
    onError: (err) =>
      setProfileMsg({ type: "err", text: err?.response?.data?.detail || "Failed to save profile." }),
  });

  const handleProfileSave = (e) => {
    e.preventDefault();
    setProfileMsg(null);
    profileMutation.mutate({
      full_name: profile.full_name || undefined,
      phone: profile.phone || undefined,
      country: profile.country || undefined,
      company_name: profile.company_name || undefined,
      kra_pin: profile.kra_pin?.trim().toUpperCase() || undefined,
    });
  };

  const handlePhotoUpdated = () => {
    setProfileMsg({ type: "ok", text: "Profile photo updated." });
    setTimeout(() => setProfileMsg(null), 4000);
  };

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

  const handleNotifSave = () => {
    localStorage.setItem(`trakvora_notif_${user?.id}_shipper`, JSON.stringify(notifs));
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "S";

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your profile, security, and notification preferences.</p>
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

      {/* ── Profile ── */}
      <SectionCard icon={User} title="Profile Information" sub="Update your personal and company details.">
        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-700">
          <ProfilePhotoPicker user={user} initials={initials} onUpdated={handlePhotoUpdated} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider">
              Shipper
            </span>
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

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Full Name</label>
              <input value={profile.full_name} onChange={setP("full_name")} placeholder="Your full name" className={inputCls} />
            </div>
            <PhoneCountryInput
              value={profile.phone}
              countryCode={profile.country}
              onChange={(phone, code) => setProfile((f) => ({ ...f, phone, country: code }))}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Company Name</label>
            <input value={profile.company_name} onChange={setP("company_name")} placeholder="Your company (optional)" className={inputCls} />
          </div>
          {profile.company_name && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                {profile.country === "KE" || !profile.country ? "KRA PIN" : "Tax / Business ID"}
              </label>
              <input
                value={profile.kra_pin}
                onChange={setP("kra_pin")}
                placeholder={profile.country === "KE" || !profile.country ? "P000111111A" : "Tax ID"}
                className={inputCls}
                maxLength={20}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {profile.country === "KE" || !profile.country
                  ? "Kenya Revenue Authority PIN — letter + 9 digits + letter"
                  : "Revenue authority tax identification number"}
              </p>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</label>
            <input value={user?.email} disabled className={inputCls} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Email cannot be changed. Contact support to update it.</p>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={profileMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {profileMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Profile</>}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard icon={Bell} title="Notifications" sub="Choose which alerts you receive and how.">
        <NotificationPreferences />
      </SectionCard>

      {/* ── Two-Factor Auth ── */}
      <OtpChannelCard user={user} onSaved={(updated) => {
        const s = useAuthStore.getState();
        setAuth(updated, s.accessToken, s.refreshToken);
      }} />

      {/* ── Identity Verification (KYC) ── */}
      <KYCCard user={user} onVerified={(updated) => {
        const s = useAuthStore.getState();
        setAuth(updated, s.accessToken, s.refreshToken);
      }} />

      {/* ── Security ── */}
      <SectionCard icon={Shield} title="Security" sub="Manage your password and account access.">
        {pwMsg && (
          <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border mb-4 ${
            pwMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {pwMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {["current", "next", "confirm"].map((key) => {
            const labels = { current: "Current Password", next: "New Password", confirm: "Confirm New Password" };
            return (
              <div key={key}>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">{labels[key]}</label>
                <div className="relative">
                  <input type={showPw[key] ? "text" : "password"} value={passwords[key]}
                    onChange={setPw(key)} placeholder="••••••••" className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-end pt-1">
            <button type="submit"
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Lock className="w-4 h-4" /> Change Password
            </button>
          </div>
        </form>

        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Status</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Active
            </span>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Member Since</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString(user?.country ? `en-${user.country}` : "en", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Verification</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              user?.is_verified ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
            }`}>
              {user?.is_verified ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {user?.is_verified ? "Verified" : "Pending"}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Trips</p>
            <p className="text-sm font-bold font-heading text-slate-900 dark:text-white">{user?.total_trips || 0}</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Switch Role ── */}
      <SectionCard title="Switch Role" icon={RefreshCw} description="Change your account role on the platform.">
        <RoleChangeCard />
      </SectionCard>

      {/* ── Danger zone ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm px-6 py-5">
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sign out of trakvora on this device.</p>
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
