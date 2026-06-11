import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package2, Truck, UserCircle2,
  User, Building2, Mail, Lock, Eye, EyeOff, ArrowRight,
  CheckCircle, Zap, IdCard, FileText, Upload, AlertCircle, X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/features/auth/api/authApi";
import { LogoFull } from "@/components/ui/Logo";
import { SocialButton, AppleIcon } from "@/components/ui/SocialButtons";
import PhoneCountryInput from "@/components/ui/PhoneCountryInput";
import PasswordStrength, { isPasswordStrong } from "@/features/auth/components/PasswordStrength";
import GoogleAuthButton from "@/features/auth/components/GoogleAuthButton";
import OtpModal from "@/features/auth/components/OtpModal";
import { getCountryConfig } from "@/utils/countryConfig";

const TIMEZONE_TO_COUNTRY = {
  "Africa/Nairobi":       "KE",
  "Africa/Kampala":       "UG",
  "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kigali":        "RW",
};

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const API = import.meta.env.VITE_API_URL;

const ROLES = [
  { value: "shipper", label: "Shipper",      desc: "Post loads and manage freight.", icon: Package2    },
  { value: "driver",  label: "Driver",       desc: "Accept loads and track trips.",  icon: UserCircle2 },
  { value: "owner",   label: "Fleet Owner",  desc: "Register trucks and earn from every haul.", icon: Truck },
];

const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.value, r]));

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const roleFromUrl = ROLE_MAP[searchParams.get("role")] ? searchParams.get("role") : "";

  const detectedCountry = TIMEZONE_TO_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? "KE";

  const [form, setForm] = useState({
    email: "", phone: "", full_name: "", company_name: "",
    password: "", role: roleFromUrl || "shipper", country: detectedCountry,
    national_id: "", kra_pin: "",
  });
  const [accountType, setAccountType] = useState(
    form.role === "owner" ? "company" : "individual"
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [licenseFile, setLicenseFile] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOtp, setPendingOtp] = useState(null); // {email, channel, destination}

  const selectedRole = ROLE_MAP[form.role];

  const handleRoleChange = (value) => {
    setForm((f) => ({ ...f, role: value, national_id: "", kra_pin: "", company_name: "" }));
    setLicenseFile(null);
    // Drivers are always individual; fleet owners default to company
    if (value === "driver") setAccountType("individual");
    else if (value === "owner") setAccountType("company");
    else setAccountType("individual");
  };

  const redirectUser = (user) => {
    const paths = { shipper: "/shipper", driver: "/driver", owner: "/owner", owner_user: "/owner" };
    navigate(paths[user.role] ?? "/", { replace: true });
  };

  const passwordMismatch = confirmPassword && form.password !== confirmPassword;
  const passwordWeak = form.password && !isPasswordStrong(form.password);

  const handleOtpSuccess = async (tokens) => {
    const authHeaders = { Authorization: `Bearer ${tokens.access_token}` };
    if (form.role === "driver" && licenseFile) {
      try {
        const fd = new FormData(); fd.append("file", licenseFile);
        const { url } = await fetch(`${API}/uploads/document`, {
          method: "POST", headers: authHeaders, body: fd,
        }).then((r) => r.json());
        await fetch(`${API}/drivers/me`, {
          method: "PATCH",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ licence_photo_url: url }),
        });
      } catch { /* non-critical; driver can upload later */ }
    }
    const user = await fetch(`${API}/users/me`, { headers: authHeaders }).then((r) => r.json());
    setAuth(user, tokens.access_token, tokens.refresh_token);
    redirectUser(user);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== confirmPassword) { setError("Passwords do not match."); return; }

    // KRA PIN format validation for Kenya
    const kraPin = form.kra_pin?.trim().toUpperCase();
    if ((accountType === "company" || form.role === "owner") && kraPin && form.country === "KE") {
      if (!/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) {
        setError("Invalid KRA PIN format. Expected format like P000111111A (letter + 9 digits + letter).");
        return;
      }
    }

    setError("");
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        phone: form.phone,
        full_name: accountType === "company" ? form.company_name : form.full_name,
        password: form.password,
        role: form.role,
        country: form.country,
        company_name: accountType === "company" ? form.company_name : undefined,
        national_id: form.role === "shipper" && accountType === "individual" && form.national_id ? form.national_id : undefined,
        kra_pin: (accountType === "company" || form.role === "owner") && kraPin ? kraPin : undefined,
        terms_accepted: termsAccepted,
      };
      const otpData = await authApi.register(payload);
      setPendingOtp({ email: otpData.email, channel: otpData.channel, destination: otpData.destination });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === "object") {
        setError(detail.message || "Registration failed");
      } else {
        setError(Array.isArray(detail) ? detail[0]?.msg || "Registration failed" : detail || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* ── Background image — fixed so it covers the viewport even when page scrolls ── */}
      <div className="fixed inset-0 z-0">
        <img src="/auth-bg.png" alt="" className="w-full h-full object-cover object-[center_60%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/60 lg:bg-gradient-to-r lg:from-black/70 lg:via-black/40 lg:to-black/10" />
      </div>

      {/* ── Navbar ── */}
      <header className="relative z-10 w-full px-6 py-4 flex justify-between items-center border-b border-white/10 bg-black">
        <Link to="/"><LogoFull iconSize={36} variant="dark" /></Link>
        <div className="flex items-center gap-3">
          <Link to="/login"
            className="border border-white/20 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-white/8 transition-colors">
            Log in
          </Link>
        </div>
      </header>

      {/* ── Mobile hero (compact, shown only on small screens) ── */}
      <div className="relative z-10 lg:hidden px-6 pt-8 pb-2 text-center">
        <div className="inline-flex items-center gap-2 bg-[#fe6a34]/20 border border-[#fe6a34]/30 text-[#fe6a34] text-xs font-semibold px-3 py-1.5 rounded-full mb-3 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fe6a34] animate-pulse" />
          Live across East Africa
        </div>
        <h2 className="font-heading text-2xl font-bold text-white leading-tight tracking-tight">
          Move Freight.<br />
          <span className="text-[#fe6a34]">Get Paid Faster.</span>
        </h2>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          The freight marketplace built for East Africa.
        </p>
      </div>

      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-10 lg:px-10">
        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* ── Left hero panel ── */}
          <div className="hidden lg:flex flex-col gap-6 justify-center py-4">

            {/* Headline */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#fe6a34]/15 border border-[#fe6a34]/30 text-[#fe6a34] text-xs font-semibold px-3 py-1.5 rounded-full mb-4 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fe6a34] animate-pulse" />
                Live across East Africa
              </div>
              <h1 className="font-heading text-4xl font-bold text-white mb-3 tracking-tight leading-tight">
                Move Freight.<br />
                <span className="text-[#fe6a34]">Get Paid Faster.</span>
              </h1>
              <p className="text-white text-base leading-relaxed">
                The freight marketplace built for East Africa — post loads, bid on jobs, track shipments, and settle payments in one place.
              </p>
            </div>

            {/* Benefit bullets */}
            <ul className="space-y-2.5">
              {[
                { icon: Zap,          text: "Post a load and receive bids in under 5 minutes" },
                { icon: Truck,        text: "Verified drivers and fleet owners only" },
                { icon: CheckCircle,  text: "Secure M-Pesa and bank settlements built in" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                  <Icon className="w-4 h-4 text-[#4fdbcc] shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            {/* ── Mock product window ── */}
            <div className="bg-[#0a1628] border border-white/10 rounded-xl overflow-hidden shadow-2xl">

              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border-b border-white/10">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 flex-1 bg-white/8 rounded text-[10px] text-slate-500 px-2 py-0.5 truncate">
                  app.trakvora.com/shipper/loads
                </span>
              </div>

              {/* Load card */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Active Load · #TRK-8821</span>
                  <span className="flex items-center gap-1.5 bg-[#4fdbcc]/10 text-[#4fdbcc] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" />
                    Bidding
                  </span>
                </div>

                {/* Route */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-center flex-1">
                    <div className="text-white font-black text-xl tracking-tight">NBO</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">Nairobi</div>
                  </div>
                  <div className="flex items-center gap-1 flex-1 justify-center">
                    <div className="h-px flex-1 bg-slate-700" />
                    <Truck className="w-4 h-4 text-[#fe6a34] shrink-0" />
                    <div className="h-px flex-1 bg-slate-700" />
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-white font-black text-xl tracking-tight">MSA</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">Mombasa</div>
                  </div>
                </div>

                {/* Stat chips */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-sm">480 km</div>
                    <div className="text-slate-500 text-[9px] uppercase tracking-wide mt-0.5">Distance</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-[#4fdbcc] font-bold text-sm">5 bids</div>
                    <div className="text-slate-500 text-[9px] uppercase tracking-wide mt-0.5">Received</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-[#fe6a34] font-bold text-sm">KES 98K</div>
                    <div className="text-slate-500 text-[9px] uppercase tracking-wide mt-0.5">Best Bid</div>
                  </div>
                </div>

                {/* Live bid rows */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between bg-[#fe6a34]/10 border border-[#fe6a34]/20 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#fe6a34]/20 flex items-center justify-center text-[10px] font-black text-[#fe6a34]">K</div>
                      <div>
                        <div className="text-white text-xs font-semibold leading-none">Kamau Freight Ltd</div>
                        <div className="text-slate-500 text-[9px] mt-0.5">4 min ago · 5★</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#4fdbcc] text-xs font-black">KES 98,000</div>
                      <div className="text-[#4fdbcc] text-[9px]">Best bid</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 opacity-60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-black text-violet-400">S</div>
                      <div>
                        <div className="text-white text-xs font-semibold leading-none">Savannah Haulage</div>
                        <div className="text-slate-500 text-[9px] mt-0.5">11 min ago · 4.8★</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-xs font-bold">KES 104,500</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom metrics strip */}
              <div className="grid grid-cols-3 border-t border-white/10 divide-x divide-white/10">
                <div className="py-2.5 text-center">
                  <div className="text-white font-bold text-sm">3,204</div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wide">Trucks Live</div>
                </div>
                <div className="py-2.5 text-center">
                  <div className="text-[#fe6a34] font-bold text-sm">142</div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wide">Open Loads</div>
                </div>
                <div className="py-2.5 text-center">
                  <div className="text-[#4fdbcc] font-bold text-sm">98.4%</div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wide">On-Time</div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Registration form card ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-semibold text-primary dark:text-white mb-1 tracking-tight">Create Account</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Join Trakvora as a Shipper, Driver, or Fleet Owner.</p>
            </div>

            {/* Role selector — dropdown when no URL role, read-only badge when pre-selected */}
            {roleFromUrl ? (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Registering As
                </label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-secondary">
                  {selectedRole && <selectedRole.icon className="w-5 h-5 text-secondary shrink-0" />}
                  <div>
                    <div className="text-sm font-semibold text-primary dark:text-white font-heading">{selectedRole?.label}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedRole?.desc}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-secondary ml-auto shrink-0" />
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  I am registering as
                </label>
                <div className="relative">
                  {selectedRole && (
                    <selectedRole.icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  )}
                  <select
                    value={form.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow appearance-none cursor-pointer"
                  >
                    {ROLES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {selectedRole && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{selectedRole.desc}</p>
                )}
              </div>
            )}

            {/* Individual / Company toggle — hidden for drivers */}
            {form.role !== "driver" && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Account Type
                </label>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                  {[
                    { value: "individual", label: "Individual", icon: User },
                    { value: "company",    label: "Company",    icon: Building2 },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAccountType(value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                        accountType === value
                          ? "bg-primary text-white"
                          : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="relative flex items-start gap-3 bg-red-600 text-white text-sm px-4 py-3.5 rounded-lg mb-5 shadow-lg">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-snug">Registration failed</p>
                  <p className="mt-0.5 text-red-100 text-xs leading-relaxed">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="shrink-0 text-red-200 hover:text-white transition-colors mt-0.5"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Company name — shown only for company accounts */}
              {accountType === "company" && (
                <Field label="Company Name" icon={<Building2 />} required
                  type="text" placeholder="Trakvora Logistics Ltd"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              )}

              {/* Full name — hidden for company accounts (company_name is used as full_name) */}
              {accountType !== "company" && (
                <Field
                  label="Full Name"
                  icon={<User />}
                  type="text"
                  placeholder="Jane Doe"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              )}

              <Field label="Email" icon={<Mail />}
                type="email" placeholder="you@example.com" required
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

              <PhoneCountryInput
                value={form.phone}
                countryCode={form.country}
                onChange={(phone, code) => setForm((f) => ({ ...f, phone, country: code }))}
                required
              />

              {/* Company or fleet owner (individual): country-appropriate tax / business ID */}
              {(accountType === "company" || form.role === "owner") && form.role !== "driver" && (() => {
                const cfg = getCountryConfig(form.country);
                const isKE = form.country === "KE";
                const label = isKE ? "KRA PIN" : `${cfg.revenueAuthority} Tax ID`;
                const placeholder = isKE ? "P000111111A" : "e.g. 1234567890";
                const helper = isKE
                  ? "Kenya Revenue Authority PIN — required for company accounts"
                  : `${cfg.revenueAuthority} issued tax identification number`;
                return (
                  <Field label={label} icon={<IdCard />}
                    type="text" placeholder={placeholder} helperText={helper}
                    value={form.kra_pin}
                    onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} />
                );
              })()}

              {/* Individual shipper: ID / Passport */}
              {form.role === "shipper" && accountType === "individual" && (
                <Field label="ID / Passport Number" icon={<IdCard />}
                  type="text" placeholder="e.g. 12345678"
                  helperText="Used for identity verification"
                  value={form.national_id}
                  onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
              )}

              {/* Driver: Driver's License upload */}
              {form.role === "driver" && (
                <FileField
                  label="Driver's License"
                  icon={<FileText />}
                  accept=".pdf,.jpg,.jpeg,.png"
                  helperText="PDF, JPEG, or PNG · max 5 MB"
                  file={licenseFile}
                  onChange={setLicenseFile}
                />
              )}

              <div>
                <Field label="Password" icon={<Lock />}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••" required minLength={8}
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  rightElement={
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <PasswordStrength password={form.password} />
              </div>

              <Field label="Confirm Password" icon={<Lock />}
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                error={passwordMismatch ? "Passwords do not match" : null}
                rightElement={
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirm ? "Hide" : "Show"}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="pt-1 flex flex-col gap-3">
                {/* Terms acceptance */}
                <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-secondary shrink-0"
                  />
                  <span className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                    I have read and agree to the{" "}
                    <Link to="/terms" className="text-secondary underline hover:opacity-80">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-secondary underline hover:opacity-80">
                      Privacy Policy
                    </Link>
                    . I acknowledge that Trakvora is a logistics marketplace and does not hold or process shipper-to-carrier payments.
                  </span>
                </label>

                <button type="submit" disabled={loading || !!passwordMismatch || !!passwordWeak || !termsAccepted}
                  className="w-full flex items-center justify-center gap-2 bg-secondary text-white font-semibold text-sm py-3 px-4 rounded-lg hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wide">
                  {loading ? "Creating account…" : "Initialize Account"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200 dark:border-slate-600" />
                  <span className="text-xs text-slate-400 font-medium">Or sign up with</span>
                  <div className="flex-1 border-t border-slate-200 dark:border-slate-600" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {googleConfigured ? (
                    <GoogleAuthButton
                      onSuccess={(user, at, rt) => { setAuth(user, at, rt); redirectUser(user); }}
                      onError={setError}
                    />
                  ) : (
                    <SocialButton disabled title="Add VITE_GOOGLE_CLIENT_ID to enable" label="Google" icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
                        <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
                        <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
                        <path d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z" fill="#34A853"/>
                      </svg>
                    } />
                  )}
                  <SocialButton icon={<AppleIcon />} label="Apple" disabled />
                </div>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  Already part of the network?{" "}
                  <Link to="/login" className="text-primary font-semibold hover:text-secondary transition-colors">
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>

      {pendingOtp && (
        <OtpModal
          email={pendingOtp.email}
          channel={pendingOtp.channel}
          destination={pendingOtp.destination}
          onSuccess={handleOtpSuccess}
          onClose={null}
        />
      )}
    </div>
  );
}

function Field({ label, icon, optional, rightElement, error, helperText, ...inputProps }) {
  const hasError = Boolean(error);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>
        {optional && <span className="text-xs text-slate-400">optional</span>}
      </div>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </div>
        <input
          {...inputProps}
          className={`w-full pl-10 ${rightElement ? "pr-10" : "pr-4"} py-3 border rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-shadow ${
            hasError ? "border-red-300 focus:border-red-400 focus:ring-red-300" : "border-slate-200 dark:border-slate-600 focus:border-secondary focus:ring-secondary"
          }`}
        />
        {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {hasError && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {helperText && !hasError && <p className="mt-1 text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}

function FileField({ label, icon, accept, helperText, file, onChange }) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <label
        htmlFor={inputId}
        className="flex items-center gap-3 w-full px-4 py-3 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-700 cursor-pointer hover:border-secondary hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors group"
      >
        <div className="text-slate-400 group-hover:text-secondary [&>svg]:w-5 [&>svg]:h-5 transition-colors shrink-0">
          {file ? <CheckCircle className="w-5 h-5 text-secondary" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <span className="text-sm font-medium text-primary dark:text-white truncate block">{file.name}</span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              <span className="text-secondary font-semibold">Choose file</span> or drag and drop
            </span>
          )}
        </div>
        {!file && <Upload className="w-4 h-4 text-slate-400 shrink-0" />}
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {helperText && <p className="mt-1 text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}
