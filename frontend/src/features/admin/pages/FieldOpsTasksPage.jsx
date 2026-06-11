import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, User, Plus, ChevronRight, ClipboardList, Navigation, ScanLine } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { adminApi } from "@/features/admin/api/adminApi";
import { useGeolocation } from "@/hooks/useGeolocation";
import QrScanButton from "@/features/admin/components/QrScanButton";
import { toast } from "@/components/ui/Toast";

const STATUS_TABS = ["all", "pending", "in_progress", "submitted", "completed", "cancelled"];

function urgencyBorder(task) {
  if (!task.deadline) return "border-l-4 border-slate-700";
  const diff = new Date(task.deadline) - Date.now();
  if (diff < 0) return "border-l-4 border-red-500";
  if (diff < 8 * 3600 * 1000) return "border-l-4 border-amber-500";
  if (diff < 7 * 86400 * 1000) return "border-l-4 border-green-500";
  return "border-l-4 border-slate-700";
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_COLORS = {
  pending:     "bg-yellow-900/40 text-yellow-300 border-yellow-700/40",
  in_progress: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  submitted:   "bg-violet-900/40 text-violet-300 border-violet-700/40",
  completed:   "bg-green-900/40 text-green-300 border-green-700/40",
  cancelled:   "bg-slate-800 text-slate-500 border-slate-700",
};

function TaskCard({ task, isOpsAdmin, onAssign, position }) {
  const navigate = useNavigate();

  const dist =
    position && task.location_lat && task.location_lon
      ? haversineKm(position.latitude, position.longitude, task.location_lat, task.location_lon).toFixed(1)
      : null;

  const mapsUrl =
    task.location_lat && task.location_lon
      ? `https://www.google.com/maps/dir/?api=1&destination=${task.location_lat},${task.location_lon}`
      : null;

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-700 transition-colors ${urgencyBorder(task)}`}
      onClick={() => navigate(`/admin/field-ops/tasks/${task.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white font-heading truncate">Task #{task.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Truck: {task.truck_id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${STATUS_COLORS[task.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
          {task.status.replace(/_/g, " ")}
        </span>
      </div>

      {task.location && (
        <div className="flex items-center gap-1.5 mt-2">
          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
          <p className="text-[11px] text-slate-400 truncate">{task.location}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {task.deadline && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-400">
              Due: {new Date(task.deadline).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        )}
        {dist && (
          <div className="flex items-center gap-1">
            <Navigation className="w-3 h-3 text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-400">{dist} km away</p>
          </div>
        )}
        {task.assigned_to && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-400">Assigned</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        {isOpsAdmin && !task.assigned_to && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAssign(task); }}
            className="text-[10px] font-bold font-heading uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
          >
            Assign Inspector
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
            </a>
          )}
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ truck_id: "", owner_id: "", location: "", deadline: "", notes: "" });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => adminApi.createTask(data),
    onSuccess: (task) => { onCreated(task); onClose(); },
    onError: (e) => setError(e?.response?.data?.detail || "Failed to create task"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.truck_id || !form.owner_id) { setError("Truck ID and Owner ID are required"); return; }
    mutation.mutate({
      truck_id: form.truck_id,
      owner_id: form.owner_id,
      location: form.location || null,
      deadline: form.deadline || null,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-white font-heading">New Inspection Task</h2>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Truck ID</label>
            <input value={form.truck_id} onChange={(e) => setForm(f => ({ ...f, truck_id: e.target.value }))}
              placeholder="UUID of the truck"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Owner ID</label>
            <input value={form.owner_id} onChange={(e) => setForm(f => ({ ...f, owner_id: e.target.value }))}
              placeholder="UUID of the truck owner"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Location</label>
            <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Industrial Area, Nairobi"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Deadline</label>
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Any special instructions"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
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

function AssignModal({ task, onClose }) {
  const qc = useQueryClient();
  const [inspectorId, setInspectorId] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.assignTask(task.id, inspectorId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["field-ops-tasks"] }); onClose(); },
    onError: (e) => setError(e?.response?.data?.detail || "Assignment failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-white font-heading">Assign Inspector</h2>
        <p className="text-xs text-slate-500">Task #{task.id.slice(0, 8).toUpperCase()}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Inspector User ID</label>
          <input value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}
            placeholder="UUID of field inspector or IoT tech"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={!inspectorId || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading transition-colors disabled:opacity-50">
            {mutation.isPending ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FieldOpsTasksPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { position } = useGeolocation();
  const isOpsAdmin = ["operations_admin", null, undefined].includes(user?.admin_role) || user?.admin_role === "super_admin";
  const isFieldInspector = user?.admin_role === "field_inspector";
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTask, setAssignTask] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const navigate = useNavigate();

  async function handleQrResult(value) {
    setShowQr(false);
    try {
      const result = await adminApi.lookupTruck(value);
      if (result.task_id) {
        navigate(`/admin/field-ops/tasks/${result.task_id}`);
      } else {
        toast(`${result.registration_number}: no open task found`, "info");
      }
    } catch {
      toast("Truck not found", "error");
    }
  }

  const params = { page, limit: LIMIT };
  if (statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["field-ops-tasks", params],
    queryFn: () => adminApi.getTasks(params),
    staleTime: 15_000,
  });

  const tasks = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-400" /> Field Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} task{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {isFieldInspector && (
            <button
              onClick={() => setShowQr(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-heading uppercase tracking-widest transition-colors"
            >
              <ScanLine className="w-4 h-4" /> Scan
            </button>
          )}
          {isOpsAdmin && (
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-heading uppercase tracking-widest transition-colors">
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              statusFilter === s
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} isOpsAdmin={isOpsAdmin} onAssign={setAssignTask} position={position} />
          ))}
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

      {createOpen && (
        <CreateTaskModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["field-ops-tasks"] })}
        />
      )}
      {assignTask && <AssignModal task={assignTask} onClose={() => setAssignTask(null)} />}
      {showQr && <QrScanButton onResult={handleQrResult} label="Scan Truck QR" autoStart />}
    </div>
  );
}
