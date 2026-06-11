import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, Eye, EyeOff, User, Phone, AlertCircle, Loader2, CheckCircle2, Mail } from "lucide-react";
import { authApi, invitationsApi } from "@/features/auth/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { LogoFull } from "@/components/ui/Logo";
import PhoneCountryInput from "@/components/ui/PhoneCountryInput";
import PasswordStrength, { isPasswordStrong } from "@/features/auth/components/PasswordStrength";

const ROLE_LABELS = {
  shipper:        "Shipper",
  owner:          "Fleet Owner",
  driver:         "Driver",
  mover:          "Mover Company",
  air_freight:    "Air Freight Agent",
  parcel_carrier: "Parcel Carrier",
  admin:          "Admin Staff",
};

const ROLE_PATHS = {
  shipper:        "/shipper",
  owner:          "/owner",
  driver:         "/driver",
  mover:          "/mover",
  air_freight:    "/airfreight",
  parcel_carrier: "/parcel-carrier",
  admin:          "/admin",
};

const inputCls = `w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100
  placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#fe6a34] focus:ring-1 focus:ring-[#fe6a34]
  transition-shadow disabled:opacity-50`;

export default function InviteRegisterPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ full_name: "", phone: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch invite details (public endpoint — no auth needed)
  const { data: invite, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ["invite-validate", token],
    queryFn: () => invitationsApi.validate(token),
    retry: false,
  });

  const passwordMismatch = confirmPassword && form.password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!isPasswordStrong(form.password)) { setError("Please choose a stronger password."); return; }
    setError("");
    setLoading(true);
    try {
      const tokens = await authApi.register({
        email: invite.invitee_email,
        phone: form.phone,
        full_name: form.full_name,
        password: form.password,
        role: invite.role,
        country: "KE",
        invite_token: token,
      });
      // Fetch user profile using the new token directly (apiClient doesn't have it yet)
      const user = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json());
      setAuth(user, tokens.access_token, tokens.refresh_token);
      navigate(ROLE_PATHS[user.role] ?? "/", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail[0]?.msg || "Registration failed" : detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-[#fe6a34] animate-spin" />
      </div>
    );
  }

  // ── Invalid / expired link ─────────────────────────────────────────────────
  if (inviteError || !invite) {
    const msg = inviteError?.response?.data?.detail || "This invite link is invalid or has expired.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-sm w-full text-center">
          <LogoFull className="mx-auto mb-8 h-8" />
          <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 sm:p-8 shadow-sm">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invite link invalid</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{msg}</p>
            <a
              href="/register"
              className="mt-6 inline-block bg-[#fe6a34] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#e85c28] transition-colors"
            >
              Create an account
            </a>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[invite.role] ?? invite.role;
  const contextLine = invite.company_name
    ? `${invite.inviter_name} has invited you to join ${invite.company_name} as ${roleLabel}`
    : `${invite.inviter_name} has invited you to join trakvora as ${roleLabel}`;

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        <LogoFull className="mx-auto mb-8 h-8" />

        {/* Context banner */}
        <div className="bg-[#041627] text-white rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#fe6a34] shrink-0 mt-0.5" />
          <p className="text-sm leading-snug">{contextLine}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5 sm:p-7">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Create your account</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Complete your registration to accept this invite.</p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email — locked */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={invite.invitee_email}
                  readOnly
                  className={`${inputCls} pl-9 bg-slate-100 cursor-not-allowed`}
                />
              </div>
            </div>

            {/* Role — locked */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Role
              </label>
              <input
                type="text"
                value={roleLabel}
                readOnly
                className={`${inputCls} bg-slate-100 cursor-not-allowed`}
              />
            </div>

            {/* Full name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <PhoneCountryInput
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={`${inputCls} pl-9 pr-10`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && <PasswordStrength password={form.password} />}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pl-9 pr-10 ${passwordMismatch ? "border-red-400" : ""}`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || passwordMismatch}
              className="w-full bg-[#fe6a34] hover:bg-[#e85c28] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating account…
                </span>
              ) : (
                "Accept invite & create account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#fe6a34] font-semibold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
