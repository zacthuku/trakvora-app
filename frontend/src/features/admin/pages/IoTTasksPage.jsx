import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Plus, CheckCircle2, Clock, AlertCircle, RefreshCw, X,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  pending:     { badge: "bg-blue-900/40 text-blue-300 border-blue-700/40",    dot: "bg-blue-400",    icon: Clock      },
  in_progress: { badge: "bg-amber-900/40 text-amber-300 border-amber-700/40", dot: "bg-amber-400",   icon: AlertCircle },
  completed:   { badge: "bg-green-900/40 text-green-300 border-green-700/40", dot: "bg-green-400",   icon: CheckCircle2 },
  submitted:   { badge: "bg-violet-900/40 text-violet-300 border-violet-700/40", dot: "bg-violet-400", icon: CheckCircle2 },
  cancelled:   { badge: "bg-slate-800 text-slate-500 border-slate-700",       dot: "bg-slate-600",   icon: X          },
};

const TYPE_LABEL = {
  install:         "Installation",
  replacement:     "Replacement",
  re_verification: "Re-verification",
};

const TASK_TYPE_FILTERS = ["all", "install", "replacement", "re_verification"];
const STATUS_FILTERS    = ["all", "pending", "in_progress", "completed"];

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function fmtDeadline(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const past = d < now;
  const str = d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  return { str, past };
}

// ── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    truck_id: "", owner_id: "", task_type: "install",
    location: "", deadline: "", notes: "",
  });
  const [error, setError] = useState(null);

  // Load trucks for selector
  const { data: trucksData } = useQuery({
    queryKey: ["admin-trucks-select"],
    queryFn: () => adminApi.getTrucks({ limit: 200 }),
    staleTime: 60_000,
  });
  const trucks = trucksData?.items ?? [];

  const mutation = useMutation({
    mutationFn: (data) => adminApi.createIoTTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iot-tasks"] });
      qc.invalidateQueries({ queryKey: ["iot-dashboard"] });
      toast("Task created", "success");
      onClose();
    },
    onError: (e) => setError(e?.response?.data?.detail || "Failed to create task"),
  });

  function submit(e) {
    e.preventDefault();
    if (!form.truck_id) { setError("Select a truck"); return; }
    const selectedTruck = trucks.find((t) => t.id === form.truck_id);
    const payload = {
      truck_id:  form.truck_id,
      owner_id:  form.owner_id || (selectedTruck?.owner_id ?? form.truck_id),
      task_type: form.task_type,
      location:  form.location.trim() || null,
      deadline:  form.deadline ? new Date(form.deadline).toISOString() : null,
      notes:     form.notes.trim() || null,
    };
    mutation.mutate(payload);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-heading">Create Installation Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          {/* Truck */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Truck *</label>
            <select
              value={form.truck_id}
              onChange={(e) => {
                const truck = trucks.find((t) => t.id === e.target.value);
                setForm((f) => ({ ...f, truck_id: e.target.value, owner_id: truck?.owner_id ?? "" }));
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="">Select a truck…</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>{t.registration_number}{t.make ? ` — ${t.make}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Task type */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Task Type</label>
            <select
              value={form.task_type}
              onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="install">Installation</option>
              <option value="replacement">Replacement</option>
              <option value="re_verification">Re-verification</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Mombasa Road Garage"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional instructions…"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading transition-colors disabled:opacity-50">
              {mutation.isPending ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task }) {
  const style = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending;
  const deadline = fmtDeadline(task.deadline);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white font-heading">
              {TYPE_LABEL[task.task_type] ?? task.task_type}
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${style.dot}`} />
              {task.status.replace("_", " ")}
            </span>
          </div>
          {task.location && (
            <p className="text-xs text-slate-400 mt-0.5">{task.location}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
        <span>Created {relTime(task.created_at)}</span>
        {deadline && (
          <span className={deadline.past && task.status !== "completed" ? "text-red-400" : ""}>
            Due {deadline.str}
          </span>
        )}
        {task.assigned_to && <span>Technician assigned</span>}
      </div>

      {task.notes && (
        <p className="text-[11px] text-slate-500 italic line-clamp-2">{task.notes}</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IoTTasksPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const LIMIT = 20;

  const params = { page, limit: LIMIT };
  if (typeFilter !== "all")   params.task_type = typeFilter;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["iot-tasks", params],
    queryFn: () => adminApi.getIoTTasks(params),
    staleTime: 30_000,
  });

  const tasks = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
            <Wrench className="w-5 h-5 text-violet-400" /> Installation Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} task{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-heading uppercase tracking-widest transition-colors"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* Task type filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TASK_TYPE_FILTERS.map((t) => (
          <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              typeFilter === t ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}>
            {t === "re_verification" ? "Re-verify" : t}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              statusFilter === s
                ? "bg-violet-600 text-white"
                : s === "pending"     ? "bg-blue-900/30 text-blue-400 hover:text-blue-300"
                : s === "in_progress" ? "bg-amber-900/30 text-amber-400 hover:text-amber-300"
                : s === "completed"   ? "bg-green-900/30 text-green-400 hover:text-green-300"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
          <p className="text-sm text-slate-500">No tasks found</p>
          <button onClick={() => setCreateOpen(true)} className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-semibold">
            Create your first task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Prev</button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Next</button>
        </div>
      )}

      {createOpen && <CreateTaskModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
