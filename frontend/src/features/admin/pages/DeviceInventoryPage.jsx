import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, Search, Wifi, WifiOff, Wrench, AlertTriangle,
  ChevronRight, X, CheckCircle2, Radio, Cpu,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = ["all", "installed", "warehouse", "damaged", "returned", "retired"];

const STATUS_STYLE = {
  installed: { badge: "bg-green-900/40 text-green-300 border-green-700/40",  dot: "bg-green-400"  },
  warehouse: { badge: "bg-blue-900/40 text-blue-300 border-blue-700/40",     dot: "bg-blue-400"   },
  damaged:   { badge: "bg-red-900/40 text-red-300 border-red-700/40",        dot: "bg-red-400"    },
  returned:  { badge: "bg-amber-900/40 text-amber-300 border-amber-700/40",  dot: "bg-amber-400"  },
  retired:   { badge: "bg-slate-800 text-slate-500 border-slate-700",        dot: "bg-slate-600"  },
};

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Create Device Modal ───────────────────────────────────────────────────────

function CreateDeviceModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ serial_number: "", imei: "", firmware_version: "" });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => adminApi.createIoTDevice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iot-devices"] });
      toast("Device registered", "success");
      onClose();
    },
    onError: (e) => setError(e?.response?.data?.detail || "Registration failed"),
  });

  function submit(e) {
    e.preventDefault();
    if (!form.serial_number.trim()) { setError("Serial number is required"); return; }
    mutation.mutate({
      serial_number:    form.serial_number.trim(),
      imei:             form.imei.trim() || null,
      firmware_version: form.firmware_version.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-heading">Register New Device</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          {[
            { key: "serial_number", label: "Serial Number *", placeholder: "e.g. TRK-001-2026" },
            { key: "imei", label: "IMEI", placeholder: "15-digit IMEI (optional)" },
            { key: "firmware_version", label: "Firmware Version", placeholder: "e.g. v2.3.1 (optional)" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading transition-colors disabled:opacity-50">
              {mutation.isPending ? "Registering…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────────────────

function DeviceCard({ device, navigate }) {
  const style = STATUS_STYLE[device.status] ?? STATUS_STYLE.retired;

  return (
    <div
      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition-colors"
      onClick={() => navigate(`/admin/iot/devices/${device.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
            <p className="text-sm font-bold text-white font-heading truncate">{device.serial_number}</p>
          </div>
          {device.imei && (
            <p className="text-[11px] text-slate-500 mt-0.5 pl-4">IMEI: {device.imei}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${style.badge}`}>
          {device.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-3">
        {device.truck_registration && (
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" /> {device.truck_registration}
          </span>
        )}
        {device.firmware_version && (
          <span>FW {device.firmware_version}</span>
        )}
        {device.battery_level != null && (
          <span className={device.battery_level < 20 ? "text-red-400" : ""}>
            {device.battery_level.toFixed(0)}% batt
          </span>
        )}
        {device.signal_strength != null && (
          <span>{device.signal_strength} dBm</span>
        )}
        {device.last_heartbeat_at && (
          <span>Last ping: {relTime(device.last_heartbeat_at)}</span>
        )}
        {device.tamper_flag && (
          <span className="text-red-400 flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" /> Tamper flag
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-600">Added {relTime(device.created_at)}</p>
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeviceInventoryPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const params = { page, limit: LIMIT };
  if (statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["iot-devices", params],
    queryFn: () => adminApi.getIoTDevices(params),
    staleTime: 30_000,
  });

  const devices = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-400" /> Device Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} device{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-heading uppercase tracking-widest transition-colors"
        >
          <Plus className="w-4 h-4" /> Register
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              statusFilter === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <Radio className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No devices found</p>
          <button onClick={() => setCreateOpen(true)} className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-semibold">
            Register your first device
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} navigate={navigate} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Prev</button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Next</button>
        </div>
      )}

      {createOpen && <CreateDeviceModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
