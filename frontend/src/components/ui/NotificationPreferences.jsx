import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader, CheckCircle2 } from "lucide-react";
import apiClient from "@/services/apiClient";

const EVENT_LABELS = {
  bid_received:    "Bids & Offers",
  shipment_status: "Shipment Updates",
  payment_due:     "Commission & Payments",
  direct_offer:    "Direct Load Offers",
  dispute:         "Disputes",
  marketing:       "Marketing & Promotions",
};

const CHANNELS = [
  { key: "in_app", label: "In-App" },
  { key: "push",   label: "Push"   },
  { key: "sms",    label: "SMS"    },
  { key: "email",  label: "Email"  },
];

export default function NotificationPreferences() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [localPrefs, setLocalPrefs] = useState(null);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: () => apiClient.get("/users/me/notification-preferences").then((r) => r.data),
    onSuccess: (data) => { if (!localPrefs) setLocalPrefs(data); },
  });

  const saveMut = useMutation({
    mutationFn: (payload) =>
      apiClient.patch("/users/me/notification-preferences", payload).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["notif-prefs"], data);
      setLocalPrefs(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const current = localPrefs ?? prefs ?? {};

  const toggle = (event, channel) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [event]: { ...(prev?.[event] || {}), [channel]: !(prev?.[event]?.[channel] ?? false) },
    }));
  };

  const handleSave = () => {
    if (localPrefs) saveMut.mutate(localPrefs);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
        <Loader className="w-4 h-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-secondary" /> Notification Preferences
        </h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Event</th>
              {CHANNELS.map((ch) => (
                <th key={ch.key} className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {ch.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(EVENT_LABELS).map(([event, label]) => (
              <tr key={event} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</td>
                {CHANNELS.map((ch) => {
                  const isOn = current[event]?.[ch.key] ?? false;
                  return (
                    <td key={ch.key} className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggle(event, ch.key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isOn ? "bg-secondary" : "bg-slate-200 dark:bg-slate-700"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-4" : "translate-x-0.5"}`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {saveMut.isPending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Preferences
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}
