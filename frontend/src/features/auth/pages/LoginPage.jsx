import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Smartphone, ShieldAlert, Ban } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/features/auth/api/authApi";
import { LogoFull } from "@/components/ui/Logo";
import { SocialButton, AppleIcon } from "@/components/ui/SocialButtons";
import GoogleAuthButton from "@/features/auth/components/GoogleAuthButton";
import OtpModal from "@/features/auth/components/OtpModal";
import PhoneCountryInput from "@/components/ui/PhoneCountryInput";

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loginTab, setLoginTab] = useState("email"); // "email" | "phone"
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("KE");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [suspensionError, setSuspensionError] = useState("");
  const [banError, setBanError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOtp, setPendingOtp] = useState(null); // {email, channel, destination}
  const sessionExpired = location.state?.expired === true;
  const passwordReset = location.state?.passwordReset === true;

  useEffect(() => {
    if (sessionExpired || passwordReset) window.history.replaceState({}, "");
  }, []);

  const redirectUser = (user) => {
    const paths = {
      shipper:        "/shipper/home",
      driver:         "/driver/home",
      owner:          "/owner/home",
      owner_user:     "/owner/home",
      admin:          "/admin/home",
      mover:          "/mover",
      air_freight:    "/airfreight",
      parcel_carrier: "/parcel-carrier",
    };
    navigate(paths[user.role] ?? "/", { replace: true });
  };

  const fetchUserAndRedirect = async (tokens) => {
    const user = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    setAuth(user, tokens.access_token, tokens.refresh_token, form.remember);
    redirectUser(user);
  };

  const parseLoginError = (err) => {
    const detail = err.response?.data?.detail;
    setSuspensionError("");
    setBanError("");
    setError("");
    if (detail && typeof detail === "object") {
      if (detail.code === "ACCOUNT_SUSPENDED") setSuspensionError(detail.message);
      else if (detail.code === "ACCOUNT_BANNED") setBanError(detail.message);
      else setError(detail.message || "An error occurred");
    } else {
      setError(detail || "Invalid credentials");
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tokens = await authApi.login(form);
      await fetchUserAndRedirect(tokens);
    } catch (err) {
      parseLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phone) { setError("Enter your registered phone number."); return; }
    setError("");
    setLoading(true);
    try {
      const otpData = await authApi.sendPhoneOtp(phone);
      if (!otpData.email) {
        setError("No account found with that phone number.");
        return;
      }
      setPendingOtp({ email: otpData.email, channel: otpData.channel, destination: otpData.destination });
    } catch (err) {
      parseLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* ── Background image ── */}
      <div className="absolute inset-0 z-0">
        <img src="/auth-bg.png" alt="" className="w-full h-full object-cover object-[center_60%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/60 lg:bg-gradient-to-r lg:from-black/70 lg:via-black/40 lg:to-black/10" />
      </div>

      {/* ── Navbar ── */}
      <header className="relative z-10 w-full px-6 py-4 flex justify-between items-center border-b border-white/10 bg-black">
        <Link to="/"><LogoFull iconSize={36} variant="dark" /></Link>
        <div className="flex items-center gap-3">
          <Link to="/register"
            className="border border-white/20 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-white/8 transition-colors">
            Create account
          </Link>
        </div>
      </header>

      {/* ── Mobile hero (shown below navbar on small screens) ── */}
      <div className="relative z-10 lg:hidden px-6 pt-8 pb-4 text-center">
        <h2 className="font-heading text-2xl font-bold text-white leading-tight tracking-tight mb-2">
          Built for Reliability.<br />Designed to Scale.
        </h2>
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className="flex -space-x-2">
            {[{ initials: "MK", bg: "bg-orange-500" }, { initials: "AO", bg: "bg-teal-500" }, { initials: "JN", bg: "bg-blue-500" }].map(({ initials, bg }) => (
              <div key={initials} className={`w-7 h-7 rounded-full border-2 border-white/20 ${bg} flex items-center justify-center text-white text-[10px] font-bold font-heading`}>{initials}</div>
            ))}
            <div className="w-7 h-7 rounded-full border-2 border-white/20 bg-slate-700 flex items-center justify-center text-slate-300 text-[10px] font-semibold font-heading">+2k</div>
          </div>
          <p className="text-xs text-slate-300">Trusted by freight operators across Africa.</p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-1">

        {/* Left: hero text */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-end p-16">
          <h2 className="font-heading text-4xl font-bold text-white mb-6 leading-tight tracking-tight">
            Built for Reliability.<br />Designed to Scale.
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            Connect shippers, carriers, and drivers across Africa, with full visibility, secured payments, and real-time tracking on every shipment.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-3">
              {[
                { initials: "MK", bg: "bg-orange-500" },
                { initials: "AO", bg: "bg-teal-500" },
                { initials: "JN", bg: "bg-blue-500" },
              ].map(({ initials, bg }) => (
                <div key={initials}
                  className={`w-10 h-10 rounded-full border-2 border-white/20 ${bg} flex items-center justify-center text-white text-xs font-bold font-heading`}>
                  {initials}
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-white/20 bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-semibold font-heading">
                +2k
              </div>
            </div>
            <p className="text-sm text-slate-400">Trusted by freight operators across Africa.</p>
          </div>
        </div>

        {/* Right: form card */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-[420px] bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-8 shadow-2xl">

            <div className="mb-8">
              <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-white mb-1 tracking-tight">Sign In</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Enter your credentials to access your dashboard.</p>
            </div>

            {sessionExpired && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg mb-6">
                Your session expired. Please sign in again.
              </div>
            )}

            {passwordReset && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg mb-6">
                Password reset successfully. Please sign in with your new password.
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {suspensionError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Account Suspended</p>
                  <p className="text-xs mt-0.5">{suspensionError}</p>
                  <a href="mailto:support@trakvora.com" className="text-xs font-semibold underline mt-1 block text-amber-700">
                    Contact Support
                  </a>
                </div>
              </div>
            )}

            {banError && (
              <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                <Ban className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold">Account Permanently Suspended</p>
                  <p className="text-xs mt-0.5">{banError}</p>
                  <a href="mailto:support@trakvora.com" className="text-xs font-semibold underline mt-1 block text-red-700">
                    Contact Support
                  </a>
                </div>
              </div>
            )}

            {/* ── Login method tabs ── */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-6">
              {[
                { id: "email", label: "Email", icon: Mail },
                { id: "phone", label: "Phone", icon: Smartphone },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setLoginTab(id); setError(""); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                    loginTab === id
                      ? "bg-secondary text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {loginTab === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input id="email" type="email" required placeholder="name@company.com"
                      value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider" htmlFor="password">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-xs text-secondary font-medium hover:opacity-80 transition-opacity">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input id="password" type={showPassword ? "text" : "password"} required placeholder="••••••••"
                      value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input id="remember" type="checkbox" checked={form.remember}
                    onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary cursor-pointer" />
                  <label htmlFor="remember" className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                    Remember me for 30 days
                  </label>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-white font-semibold text-sm rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? "Signing in…" : "Sign In"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePhoneSubmit} className="space-y-5">
                <div>
                  <PhoneCountryInput
                    value={phone}
                    countryCode={phoneCountry}
                    onChange={(p, c) => { setPhone(p); setPhoneCountry(c); }}
                    required
                  />
                  <p className="mt-1.5 text-xs text-slate-400">We'll send a 6-digit code to this number.</p>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-white font-semibold text-sm rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  <Smartphone className="w-4 h-4" />
                  {loading ? "Sending code…" : "Get Code"}
                </button>
              </form>
            )}

            {pendingOtp && (
              <OtpModal
                email={pendingOtp.email}
                channel={pendingOtp.channel}
                destination={pendingOtp.destination}
                onSuccess={(tokens) => fetchUserAndRedirect(tokens)}
                onClose={() => setPendingOtp(null)}
                onResend={() => authApi.resendOtp(pendingOtp.email)}
              />
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-600" />
              <span className="text-xs text-slate-400 font-medium">Or continue with</span>
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

            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Don't have an account?{" "}
              <Link to="/register" className="text-secondary font-semibold hover:opacity-80 transition-opacity">
                Request Access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
