/**
 * ScheduledReportsPage — manage periodic report subscriptions.
 * Accessible under /shipper/reports and /owner/reports.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import apiClient from "@/services/apiClient";
import { toast } from "@/components/ui/Toast";

const REPORT_TYPES = [
  { value: "fleet",      label: "Fleet Summary",         desc: "Truck status, active trips, avg rating" },
  { value: "shipments",  label: "Shipment Activity",     desc: "Deliveries, revenue, on-time rate" },
  { value: "analytics",  label: "Platform Analytics",    desc: "User growth, load volumes, revenue" },
];

const FREQUENCIES = [
  { value: "daily",  label: "Daily"  },
  { value: "weekly", label: "Weekly" },
];

const API = {
  list:   () => apiClient.get("/scheduled-reports").then(r => r.data),
  create: (d) => apiClient.post("/scheduled-reports", d).then(r => r.data),
  update: (id, d) => apiClient.patch(`/scheduled-reports/${id}`, d).then(r => r.data),
  remove: (id) => apiClient.delete(`/scheduled-reports/${id}`),
};

export default function ScheduledReportsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reportType, setReportType] = useState("fleet");
  const [frequency,  setFrequency]  = useState("weekly");
  const [emailTo,    setEmailTo]    = useState("");

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn:  API.list,
  });

  const createMutation = useMutation({
    mutationFn: API.create,
    onSuccess: () => {
      qc.invalidateQueries(["scheduled-reports"]);
      setShowForm(false);
      toast("Scheduled report created", "success");
    },
    onError: () => toast("Failed to create report schedule", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => API.update(id, data),
    onSuccess: () => qc.invalidateQueries(["scheduled-reports"]),
  });

  const deleteMutation = useMutation({
    mutationFn: API.remove,
    onSuccess: () => {
      qc.invalidateQueries(["scheduled-reports"]);
      toast("Report schedule removed", "success");
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    createMutation.mutate({ report_type: reportType, frequency, email_to: emailTo || undefined });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Scheduled Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Receive automated report summaries by email.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 mb-6">
          <h2 className="font-heading font-semibold mb-4">New Report Schedule</h2>

          <div className="mb-4">
            <label className="label">Report Type</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {REPORT_TYPES.map((rt) => (
                <label
                  key={rt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reportType === rt.value ? "border-secondary bg-orange-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="report_type"
                    value={rt.value}
                    checked={reportType === rt.value}
                    onChange={() => setReportType(rt.value)}
                    className="mt-0.5 accent-secondary"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{rt.label}</div>
                    <div className="text-xs text-slate-500">{rt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Frequency</label>
            <div className="flex gap-2 mt-1">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    frequency === f.value
                      ? "bg-secondary text-white border-secondary"
                      : "border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="label">Send To (optional override)</label>
            <input
              type="email"
              placeholder="Leave blank to use your account email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="input mt-1"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? "Saving…" : "Create Schedule"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-slate-500 animate-pulse">Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <div className="text-slate-500 text-sm">No scheduled reports yet.</div>
          <div className="text-slate-400 text-xs mt-1">Click "New Schedule" to set one up.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.map((s) => {
            const typeInfo = REPORT_TYPES.find((r) => r.value === s.report_type) || {};
            return (
              <div key={s.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{typeInfo.label || s.report_type}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.frequency === "daily"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {s.frequency === "daily" ? "Daily" : "Weekly"}
                    </span>
                    {!s.is_active && (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">Paused</span>
                    )}
                  </div>
                  {s.email_to && (
                    <div className="text-xs text-slate-400 mt-0.5">→ {s.email_to}</div>
                  )}
                  {s.last_sent_at && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      Last sent {new Date(s.last_sent_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, is_active: !s.is_active })}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                    title={s.is_active ? "Pause" : "Resume"}
                  >
                    {s.is_active
                      ? <ToggleRight className="w-5 h-5 text-teal-500" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate(s.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
