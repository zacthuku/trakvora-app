import { useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { LogoFull } from "@/components/ui/Logo";
import { authApi } from "@/features/auth/api/authApi";
import PasswordStrength, { isPasswordStrong } from "@/features/auth/components/PasswordStrength";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const resetToken = location.state?.resetToken;
  const email = location.state?.email;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isPasswordStrong(password)) {
      setError("Please meet all password requirements below.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, password);
      navigate("/login", { state: { passwordReset: true }, replace: true });
    } catch (err) {
      if (err.response?.status === 401) {
        setError("This reset link has expired. Please request a new one.");
      } else {
        setError(err.response?.data?.detail || "Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
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
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          <div className="mb-8">
            <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-white mb-1 tracking-tight">
              Set New Password
            </h1>
            {email && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Choose a new password for <span className="font-medium text-slate-700 dark:text-slate-200">{email}</span>.
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
              {error.includes("expired") && (
                <Link to="/forgot-password" className="underline ml-1 font-medium">
                  Request a new code
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-white font-semibold text-sm rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting…" : "Reset Password"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
