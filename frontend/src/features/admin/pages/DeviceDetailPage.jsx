import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Radio, Battery, Signal, Clock, Cpu, AlertTriangle,
  CheckCircle2, RefreshCw, Wifi, WifiOff, Copy, QrCode, Activity,
  Wrench, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast("Copied!", "success"));
}

const STATUS_STYLE = {
  installed: "bg-green-900/40 text-green-300 border-green-700/40",
  warehouse: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  damaged:   "bg-red-900/40 text-red-300 border-red-700/40",
  returned:  "bg-amber-900/40 text-amber-300 border-amber-700/40",
  retired:   "bg-slate-800 text-slate-500 border-slate-700",
};

const INVENTORY_STATUSES = ["installed", "warehouse", "damaged", "returned", "retired"];

// ── Telemetry Bar ─────────────────────────────────────────────────────────────

function TelemetryBar({ label, value, max, color, unit }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{value}{unit}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Provisioning Panel ────────────────────────────────────────────────────────

function ProvisioningPanel({ device, onProvision, provisioning }) {
  const [provision, setProvision] = useState(null);

  async function handleProvision() {
    const result = await onProvision();
    if (result) setProvision(result);
  }

  const qrContent = device.serial_number;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=ffffff&bgcolor=1e293b&data=${encodeURIComponent(qrContent)}`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Provisioning</h3>

      <div className="flex gap-4 items-start">
        {/* QR code (shows device serial — not the secret) */}
        <div className="shrink-0">
          <img
            src={qrUrl}
            alt="Device QR"
            className="w-24 h-24 rounded-xl border border-slate-700"
          />
          <p className="text-[9px] text-slate-600 text-center mt-1">Device ID QR</p>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading mb-1">Serial Number</label>
            <div className="flex items-center gap-2">
              <code className="text-xs text-violet-300 bg-slate-800 px-2 py-1 rounded font-mono">{device.serial_number}</code>
              <button onClick={() => copyToClipboard(device.serial_number)} className="text-slate-400 hover:text-white transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {device.provisioned_at && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading mb-1">Last Provisioned</label>
              <p className="text-xs text-slate-400">{relTime(device.provisioned_at)}</p>
            </div>
          )}

          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold font-heading transition-colors disabled:opacity-50"
          >
            <QrCode className="w-3.5 h-3.5" />
            {provisioning ? "Generating…" : "Generate New Secret"}
          </button>
        </div>
      </div>

      {/* Show secret after generation */}
      {provision && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-bold text-amber-300 font-heading">New Provisioning Secret Generated</p>
          </div>
          <p className="text-[11px] text-amber-400/80">
            Share this with the tracker's programming interface. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg font-mono break-all">
              {provision.secret}
            </code>
            <button onClick={() => copyToClipboard(provision.secret)} className="text-slate-400 hover:text-white transition-colors shrink-0">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-slate-500">
            <p>Provisioning payload:</p>
            <code className="break-all text-slate-400">{provision.provisioning_payload}</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Test Ping Panel ───────────────────────────────────────────────────────────

function TestPingPanel({ deviceId, onTest, testing }) {
  const [result, setResult] = useState(null);

  async function handleTest() {
    const r = await onTest();
    if (r) setResult(r);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Test Ping</h3>
      <button
        onClick={handleTest}
        disabled={testing}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-bold font-heading transition-colors disabled:opacity-50 w-full justify-center"
      >
        <Activity className="w-4 h-4" />
        {testing ? "Testing…" : "Run Ping Verification"}
      </button>
      {result && (
        <div className={`rounded-xl p-3 border ${result.responding ? "bg-green-900/20 border-green-700/40" : "bg-red-900/20 border-red-700/40"}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.responding
              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
              : <WifiOff className="w-4 h-4 text-red-400" />}
            <p className={`text-xs font-bold font-heading ${result.responding ? "text-green-300" : "text-red-300"}`}>
              {result.responding ? "Device Responding" : "No Response"}
            </p>
          </div>
          {result.truck && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-slate-500">Truck:</span> <span className="text-slate-300">{result.truck.registration_number}</span></div>
              <div><span className="text-slate-500">Battery:</span> <span className="text-slate-300">{result.truck.battery_level != null ? `${result.truck.battery_level}%` : "—"}</span></div>
              <div><span className="text-slate-500">Signal:</span> <span className="text-slate-300">{result.truck.signal_strength != null ? `${result.truck.signal_strength} dBm` : "—"}</span></div>
              <div><span className="text-slate-500">Last ping:</span> <span className="text-slate-300">{relTime(result.truck.last_ping_at)}</span></div>
            </div>
          )}
          <p className="text-[10px] text-slate-600 mt-2">Checked at {new Date(result.checked_at).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeviceDetailPage() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusEdit, setStatusEdit] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: device, isLoading } = useQuery({
    queryKey: ["iot-device", deviceId],
    queryFn: () => adminApi.getIoTDevice(deviceId),
    staleTime: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => adminApi.updateIoTDevice(deviceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iot-device", deviceId] });
      qc.invalidateQueries({ queryKey: ["iot-devices"] });
      toast("Device updated", "success");
      setStatusEdit(false);
    },
    onError: (e) => toast(e?.response?.data?.detail || "Update failed", "error"),
  });

  async function handleProvision() {
    setProvisioning(true);
    try {
      const result = await adminApi.provisionDevice(deviceId);
      qc.invalidateQueries({ queryKey: ["iot-device", deviceId] });
      return result;
    } catch (e) {
      toast(e?.response?.data?.detail || "Provisioning failed", "error");
      return null;
    } finally {
      setProvisioning(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      return await adminApi.testDevicePing(deviceId);
    } catch (e) {
      toast(e?.response?.data?.detail || "Ping test failed", "error");
      return null;
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!device) {
    return <p className="text-slate-500 py-8 text-center">Device not found</p>;
  }

  const statusStyle = STATUS_STYLE[device.status] ?? STATUS_STYLE.retired;

  return (
    <div className="py-6 space-y-5">
      {/* Back + Header */}
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <Radio className="w-5 h-5 text-violet-400" />
              {device.serial_number}
            </h1>
            {device.imei && <p className="text-xs text-slate-500 mt-0.5">IMEI: {device.imei}</p>}
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${statusStyle}`}>
            {device.status}
          </span>
        </div>
      </div>

      {/* Tamper Warning */}
      {device.tamper_flag && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300 font-heading">Tamper Flag Active</p>
            {device.tamper_reason && <p className="text-xs text-red-400/80 mt-0.5">{device.tamper_reason}</p>}
          </div>
          <button
            onClick={() => updateMutation.mutate({ tamper_flag: false, tamper_reason: null })}
            disabled={updateMutation.isPending}
            className="ml-auto shrink-0 text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            Clear Flag
          </button>
        </div>
      )}

      {/* Diagnostics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Diagnostics</h3>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Firmware</span>
            <span className="text-white font-semibold">{device.firmware_version ?? "—"}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Installed On</span>
            <span className="text-white font-semibold">{device.truck_registration ?? "—"}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Installed</span>
            <span className="text-white font-semibold">{relTime(device.installed_at)}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Last Heartbeat</span>
            <span className="text-white font-semibold">{relTime(device.last_heartbeat_at)}</span>
          </div>
        </div>

        {device.battery_level != null && (
          <TelemetryBar
            label="Battery"
            value={device.battery_level.toFixed(0)}
            max={100}
            unit="%"
            color={device.battery_level < 20 ? "bg-red-500" : device.battery_level < 50 ? "bg-amber-500" : "bg-green-500"}
          />
        )}
        {device.signal_strength != null && (
          <TelemetryBar
            label="Signal Strength"
            value={Math.max(0, device.signal_strength + 120)}
            max={120}
            unit={` dBm (${device.signal_strength})`}
            color="bg-blue-500"
          />
        )}
      </div>

      {/* Status change */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Inventory Status</h3>
          <button
            onClick={() => setStatusEdit((v) => !v)}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
          >
            {statusEdit ? "Cancel" : "Change"}
          </button>
        </div>
        {statusEdit ? (
          <div className="flex flex-wrap gap-2">
            {INVENTORY_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => updateMutation.mutate({ status: s })}
                disabled={updateMutation.isPending || s === device.status}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading border transition-colors capitalize disabled:opacity-50 ${
                  s === device.status ? "bg-violet-700 text-white border-violet-600" : "bg-slate-800 text-slate-300 border-slate-700 hover:border-violet-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm font-bold text-white capitalize">{device.status}</p>
        )}
      </div>

      {/* Tamper management */}
      {!device.tamper_flag && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Tamper Detection</h3>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <p className="text-sm text-slate-300">No tamper flags</p>
            <button
              onClick={() => {
                const reason = window.prompt("Describe the tamper event:");
                if (reason) updateMutation.mutate({ tamper_flag: true, tamper_reason: reason });
              }}
              className="ml-auto text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              Flag Tamper
            </button>
          </div>
        </div>
      )}

      {/* Provisioning */}
      <ProvisioningPanel device={device} onProvision={handleProvision} provisioning={provisioning} />

      {/* Test ping */}
      <TestPingPanel deviceId={deviceId} onTest={handleTest} testing={testing} />
    </div>
  );
}
