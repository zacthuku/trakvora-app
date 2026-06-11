import { useState } from "react";
import { Mail, Smartphone, ArrowRight, X, ShieldCheck, Loader2 } from "lucide-react";
import { authApi } from "@/features/auth/api/authApi";

export default function OtpChannelPicker({ email, phoneAvailable, onSent, onClose }) {
  const [selected, setSelected] = useState(phoneAvailable ? null : "email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const res = await authApi.sendOtp(email, selected);
      onSent(res);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const options = [
    {
      id: "email",
      icon: Mail,
      label: "Email",
      sub: email,
      available: true,
      accentBg: "bg-orange-50",
      accentBorder: "border-secondary",
      accentText: "text-secondary",
      iconBg: "bg-orange-50",
      iconColor: "text-secondary",
    },
    {
      id: "sms",
      icon: Smartphone,
      label: "SMS",
      sub: phoneAvailable ? "Text message to your registered number" : "No phone number on file",
      available: phoneAvailable,
      accentBg: "bg-sky-50",
      accentBorder: "border-sky-500",
      accentText: "text-sky-700",
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-8 relative">
        {onClose && (
          <button onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-slate-700 dark:text-slate-300" />
          </div>
          <h2 className="font-heading text-2xl font-semibold text-primary dark:text-white mb-1">
            Choose verification method
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Where should trakvora send your login code? You can change this anytime in Settings.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {options.map(({ id, icon: Icon, label, sub, available, accentBg, accentBorder, accentText, iconBg, iconColor }) => (
            <button
              key={id}
              type="button"
              disabled={!available}
              onClick={() => available && setSelected(id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                ${!available ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700" :
                  selected === id
                    ? `${accentBg} ${accentBorder}`
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${selected === id ? iconBg : "bg-slate-100 dark:bg-slate-700"}`}>
                <Icon className={`w-5 h-5 ${selected === id ? iconColor : "text-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${selected === id ? accentText : "text-slate-800 dark:text-slate-200"}`}>
                  {label}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{sub}</p>
              </div>
              {selected === id && (
                <div className={`w-5 h-5 rounded-full border-2 ${accentBorder} flex items-center justify-center shrink-0`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${id === "sms" ? "bg-sky-500" : "bg-secondary"}`} />
                </div>
              )}
              {selected !== id && available && (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-500 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center mb-4">{error}</p>
        )}

        {!phoneAvailable && (
          <p className="text-xs text-slate-400 text-center mb-4">
            Add a phone number in Settings to enable SMS verification.
          </p>
        )}

        <button
          onClick={handleSend}
          disabled={!selected || loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-white font-semibold text-sm rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            : <>Send Code <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
