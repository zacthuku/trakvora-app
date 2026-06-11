import { useState } from "react";
import { Mail, Smartphone, ShieldCheck, CheckCircle2, AlertCircle, Save } from "lucide-react";
import apiClient from "@/services/apiClient";

/**
 * Shared card for changing 2FA OTP channel in settings pages.
 * Props:
 *   user      — current user from authStore
 *   onSaved   — callback(updatedUser) called after successful save
 */
export default function OtpChannelCard({ user, onSaved }) {
  const current = user?.otp_channel || null;
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const hasPhone = Boolean(user?.phone);
  const dirty = selected !== current;

  const handleSave = async () => {
    if (!selected || !dirty) return;
    if (selected === "sms" && !hasPhone) {
      setMsg({ type: "err", text: "Add a phone number to your profile before enabling SMS verification." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const updated = await apiClient.patch("/users/me", { otp_channel: selected }).then((r) => r.data);
      setMsg({ type: "ok", text: `Verification method updated to ${selected === "sms" ? "SMS" : "Email"}.` });
      setTimeout(() => setMsg(null), 4000);
      onSaved?.(updated);
    } catch (err) {
      setMsg({ type: "err", text: err?.response?.data?.detail || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const options = [
    {
      id: "email",
      icon: Mail,
      label: "Email",
      sub: user?.email || "Your registered email address",
      available: true,
      activeRing: "border-secondary",
      activeBg: "bg-orange-50",
      activeText: "text-secondary",
      dot: "bg-secondary",
    },
    {
      id: "sms",
      icon: Smartphone,
      label: "SMS",
      sub: hasPhone ? user.phone : "No phone number. Add one in Profile above.",
      available: hasPhone,
      activeRing: "border-sky-500",
      activeBg: "bg-sky-50",
      activeText: "text-sky-700",
      dot: "bg-sky-500",
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-700/50">
        <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Two-Factor Authentication</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose where trakvora sends your login verification code.</p>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Current status badge */}
        {current && (
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
            Currently using:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {current === "sms" ? "SMS" : "Email"}
            </span>
          </div>
        )}
        {!current && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">Not configured yet. Choose a method below.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {options.map(({ id, icon: Icon, label, sub, available, activeRing, activeBg, activeText, dot }) => (
            <button
              key={id}
              type="button"
              disabled={!available}
              onClick={() => available && setSelected(id)}
              className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all
                ${!available
                  ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700"
                  : selected === id
                    ? `${activeBg} ${activeRing}`
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer"}`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selected === id ? activeBg : "bg-slate-100 dark:bg-slate-600"}`}>
                  <Icon className={`w-4.5 h-4.5 ${selected === id ? activeText : "text-slate-500"} w-[18px] h-[18px]`} />
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected === id ? activeRing : "border-slate-300 dark:border-slate-500"}`}>
                  {selected === id && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                </div>
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected === id ? activeText : "text-slate-800 dark:text-slate-100"}`}>{label}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {msg && (
          <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border mb-4 ${
            msg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!selected || !dirty || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Method</>}
          </button>
        </div>
      </div>
    </div>
  );
}
