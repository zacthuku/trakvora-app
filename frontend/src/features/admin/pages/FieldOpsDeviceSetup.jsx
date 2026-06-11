import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Cpu, CheckCircle2 } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

export default function FieldOpsDeviceSetup() {
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [trackerId, setTrackerId] = useState("");
  const [trackerStatus, setTrackerStatus] = useState("installed");

  const { data, isLoading } = useQuery({
    queryKey: ["field-ops-tasks", { status: "in_progress", limit: 50 }],
    queryFn: () => adminApi.getTasks({ status: "in_progress", limit: 50 }),
    staleTime: 15_000,
  });

  const tasks = data?.items ?? [];

  const mutation = useMutation({
    mutationFn: ({ taskId }) => adminApi.submitInspection(taskId, {
      photo_urls: { front: "", back: "", left: "", right: "", interior: "", plate: "" },
      condition: "good",
      score: 3,
      roadworthy: true,
      tracker_status: trackerStatus,
      tracker_id: trackerId || null,
      notes: "Device setup submission",
    }),
    onSuccess: () => {
      toast("Device setup recorded", "success");
      navigate("/admin/field-ops/tasks");
    },
    onError: (e) => toast(e?.response?.data?.detail || "Failed to record device setup", "error"),
  });

  return (
    <div className="max-w-lg mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Cpu className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white font-heading">Device Setup</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Select Task</p>
          {isLoading ? (
            <div className="h-10 bg-slate-800 rounded-lg animate-pulse" />
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No in-progress tasks assigned to you</p>
          ) : (
            <select value={selectedTaskId || ""} onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
              <option value="">Select a task…</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id.slice(0, 8).toUpperCase()}: {t.location || "No location"}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Device Status</p>
          <div className="flex gap-3">
            {[{ value: "installed", label: "Installed" }, { value: "verified", label: "Verified" }].map(({ value, label }) => (
              <button type="button" key={value} onClick={() => setTrackerStatus(value)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold font-heading transition-colors ${
                  trackerStatus === value
                    ? "bg-violet-900/50 border-violet-500 text-violet-200"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Device ID / Serial</label>
          <input value={trackerId} onChange={(e) => setTrackerId(e.target.value)}
            placeholder="e.g. GPS-12345"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        </div>

        <button
          onClick={() => selectedTaskId && mutation.mutate({ taskId: selectedTaskId })}
          disabled={!selectedTaskId || mutation.isPending}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          {mutation.isPending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording…</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Record Device Setup</>
          )}
        </button>
      </div>
    </div>
  );
}
