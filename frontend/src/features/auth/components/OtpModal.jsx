import { useEffect, useRef, useState } from "react";
import { X, MailCheck, Smartphone, RefreshCw } from "lucide-react";
import { authApi } from "@/features/auth/api/authApi";

const OTP_LENGTH = 6;
const TIMER_SECONDS = 60;

export default function OtpModal({ email, channel = "email", destination, onSuccess, onClose, verifyFn, onResend }) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const inputs = useRef([]);

  const isSms = channel === "sms";
  const displayDest = destination || (isSms ? "your phone" : email);

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleDigit = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const tokens = await (verifyFn ? verifyFn({ email, code }) : authApi.verifyOtp({ email, code }));
      onSuccess(tokens);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired code.");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await (onResend ? onResend() : authApi.resendOtp(email));
      setDigits(Array(OTP_LENGTH).fill(""));
      setTimer(TIMER_SECONDS);
      inputs.current[0]?.focus();
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every((d) => d !== "")) handleSubmit(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = digits.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-8 relative">
        {onClose && (
          <button onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${isSms ? "bg-sky-50" : "bg-orange-50"}`}>
            {isSms
              ? <Smartphone className="w-7 h-7 text-sky-600" />
              : <MailCheck className="w-7 h-7 text-secondary" />}
          </div>

          <h2 className="font-heading text-2xl font-semibold text-primary dark:text-white mb-1">
            {isSms ? "Check your phone" : "Check your email"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{displayDest}</span>
          </p>
          {isSms && (
            <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider">
              <Smartphone className="w-3 h-3" /> SMS
            </span>
          )}
        </div>

        {/* OTP inputs */}
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className={`w-12 h-14 text-center text-xl font-bold font-heading rounded-xl border-2 transition-all outline-none
                  ${d
                    ? isSms ? "border-sky-500 bg-sky-50 text-primary" : "border-secondary bg-orange-50 text-primary"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"}
                  focus:${isSms ? "border-sky-500 bg-sky-50" : "border-secondary bg-orange-50"}
                  ${error ? "border-red-300" : ""}`}
              />
            ))}
          </div>

          {error && <p className="text-center text-sm text-red-500 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading || filled < OTP_LENGTH}
            className={`w-full py-3 text-white font-semibold text-sm rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4 ${isSms ? "bg-sky-600" : "bg-secondary"}`}
          >
            {loading ? "Verifying…" : `Verify ${isSms ? "Phone" : "Email"}`}
          </button>
        </form>

        {/* Timer + resend */}
        <div className="text-center">
          {timer > 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Resend code in{" "}
              <span className="font-semibold text-primary dark:text-slate-200 tabular-nums">
                0:{String(timer).padStart(2, "0")}
              </span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
