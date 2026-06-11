import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Phone, ArrowRight, ArrowLeft } from "lucide-react";
import { LogoFull } from "@/components/ui/Logo";
import { authApi } from "@/features/auth/api/authApi";
import OtpModal from "@/features/auth/components/OtpModal";

function maskEmail(email) {
  const [user, domain] = email.split("@");
  const visible = user.slice(0, 2);
  const masked = visible + "*".repeat(Math.max(1, user.length - 2));
  return `${masked}@${domain}`;
}

function maskPhone(phone) {
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("email"); // "email" | "phone"
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOtp, setShowOtp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "email") {
        await authApi.forgotPassword(email);
      } else {
        await authApi.forgotPasswordPhone(phone);
      }
      setShowOtp(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSuccess = ({ reset_token }) => {
    const identifier = tab === "email" ? email : phone;
    navigate("/reset-password", { state: { resetToken: reset_token, email: identifier } });
  };

  const handleResend = async () => {
    if (tab === "email") {
      await authApi.forgotPassword(email);
    } else {
      await authApi.forgotPasswordPhone(phone);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/auth-bg.png" alt="" className="w-full h-full object-cover object-center" />
      </div>

      <header className="relative z-10 w-full px-6 py-4 flex justify-between items-center border-b border-white/10 bg-black">
        <Link to="/">
          <LogoFull iconSize={36} variant="dark" />
        </Link>
        <Link
          to="/login"
          className="border border-white/20 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-white/[0.08] transition-colors"
        >
          Back to Sign In
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px] bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-8 shadow-2xl">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>

          <div className="mb-6">
            <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-white mb-1 tracking-tight">
              Forgot Password
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              We'll send you a 6-digit reset code.
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-6">
            {[
              { key: "email", label: "Email", Icon: Mail },
              { key: "phone", label: "Phone", Icon: Phone },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? "bg-secondary text-white"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === "email" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    placeholder="+254712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Include country code, e.g. +254…</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-white font-semibold text-sm rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Sending code…" : "Send Reset Code"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      {showOtp && tab === "email" && (
        <OtpModal
          email={email}
          channel="email"
          destination={maskEmail(email)}
          verifyFn={({ email: e, code }) => authApi.verifyResetOtp(e, code)}
          onResend={handleResend}
          onSuccess={handleOtpSuccess}
          onClose={() => setShowOtp(false)}
        />
      )}

      {showOtp && tab === "phone" && (
        <OtpModal
          email={phone}
          channel="sms"
          destination={maskPhone(phone)}
          verifyFn={({ email: p, code }) => authApi.verifyResetOtpPhone(p, code)}
          onResend={handleResend}
          onSuccess={handleOtpSuccess}
          onClose={() => setShowOtp(false)}
        />
      )}
    </div>
  );
}
