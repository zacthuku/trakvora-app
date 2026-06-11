import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wifi, WifiOff, BatteryLow, Signal, AlertTriangle, CheckCircle2,
  XCircle, Clock, Wrench, RefreshCw, Package, ChevronRight,
  Activity, Layers, MapPin, Radio,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { adminApi } from "@/features/admin/api/adminApi";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import { useAuthStore } from "@/store/authStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "@/components/ui/Toast";

// ── Map icons ─────────────────────────────────────────────────────────────────

const HEALTH_COLOR = {
  online:      "#22c55e",
  offline:     "#ef4444",
  low_battery: "#f59e0b",
  no_signal:   "#6b7280",
};

function makeHealthIcon(health) {
  const color = HEALTH_COLOR[health] ?? "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};border-radius:50%;width:14px;height:14px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso);
  const abs = Math.abs(diff);
  if (abs < 60000) return "just now";
  if (abs < 3600000) return `${Math.floor(abs / 60000)}m ago`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)}h ago`;
  return `${Math.floor(abs / 86400000)}d ago`;
}

const SEVERITY_STYLE = {
  critical: { bg: "bg-red-500/20 border-red-700/50", text: "text-red-400", dot: "bg-red-500" },
  high:     { bg: "bg-orange-500/20 border-orange-700/50", text: "text-orange-400", dot: "bg-orange-500" },
  medium:   { bg: "bg-amber-500/20 border-amber-700/50",  text: "text-amber-400",  dot: "bg-amber-500"  },
  low:      { bg: "bg-slate-800 border-slate-700",        text: "text-slate-400",  dot: "bg-slate-500"  },
};

const ALERT_TYPE_LABEL = {
  no_ping:          "No Ping",
  duplicate_id:     "Duplicate ID",
  tamper:           "Tamper Detected",
  low_battery:      "Low Battery",
  signal_lost:      "Signal Lost",
  unrealistic_jump: "GPS Jump",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthStat({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-white font-heading">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-heading font-semibold">{label}</p>
      </div>
    </div>
  );
}

function AlertCard({ alert, onResolve, resolving }) {
  const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.low;
  return (
    <div className={`border rounded-xl p-3 ${style.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${style.dot}`} />
          <div className="min-w-0">
            <p className={`text-xs font-bold font-heading ${style.text}`}>
              {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{alert.message}</p>
            {(alert.truck_registration || alert.device_serial) && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {alert.truck_registration && `Truck ${alert.truck_registration}`}
                {alert.truck_registration && alert.device_serial && " · "}
                {alert.device_serial && `SN ${alert.device_serial}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[9px] text-slate-500">{relTime(alert.created_at)}</span>
          <button
            onClick={() => onResolve(alert.id)}
            disabled={resolving}
            className="text-[9px] font-bold font-heading uppercase tracking-widest text-slate-400 hover:text-green-400 transition-colors"
          >
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IoTDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { position } = useGeolocation();
  const [resolvingId, setResolvingId] = useState(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["iot-dashboard"],
    queryFn: adminApi.getIoTDashboard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => adminApi.resolveAlert(id),
    onMutate: (id) => setResolvingId(id),
    onSettled: () => setResolvingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iot-dashboard"] });
      toast("Alert resolved", "success");
    },
    onError: () => toast("Failed to resolve alert", "error"),
  });

  const health    = data?.device_health ?? {};
  const tasks     = data?.tasks ?? {};
  const alertsSummary = data?.alerts_summary ?? {};
  const recentAlerts  = data?.recent_alerts ?? [];
  const fleetPositions = health.fleet_positions ?? [];

  const mapCenter = position
    ? [position.latitude, position.longitude]
    : fleetPositions.length > 0
      ? [fleetPositions[0].lat, fleetPositions[0].lon]
      : [-1.2921, 36.8219];

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white font-heading">
            {greeting}, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Telemetry Operations Center</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => navigate("/admin/iot/devices")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-heading font-bold transition-colors"
        >
          <Package className="w-4 h-4" /> Device Inventory
        </button>
        <button
          onClick={() => navigate("/admin/iot/tasks")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-heading font-bold transition-colors"
        >
          <Wrench className="w-4 h-4" /> Install Tasks
        </button>
        <button
          onClick={() => navigate("/admin/iot/alerts")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-heading font-bold transition-colors"
        >
          <AlertTriangle className="w-4 h-4" /> All Alerts
          {alertsSummary.total_active > 0 && (
            <span className="bg-red-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {alertsSummary.total_active > 9 ? "9+" : alertsSummary.total_active}
            </span>
          )}
        </button>
      </div>

      {/* Device Health */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading mb-3">
          Device Health ({health.total_with_tracker ?? 0} tracked)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthStat icon={Wifi}       label="Online"      value={health.online      ?? 0} color="bg-green-900/50 text-green-400" />
          <HealthStat icon={WifiOff}    label="Offline"     value={health.offline     ?? 0} color="bg-red-900/50 text-red-400" />
          <HealthStat icon={BatteryLow} label="Low Battery" value={health.low_battery ?? 0} color="bg-amber-900/50 text-amber-400" />
          <HealthStat icon={Signal}     label="No Signal"   value={health.no_signal   ?? 0} color="bg-slate-800 text-slate-400" />
        </div>
      </section>

      {/* Installation Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Installation Tasks</h2>
          <button
            onClick={() => navigate("/admin/iot/tasks")}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
          >
            View all
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pending Installs",   value: tasks.pending_installs   ?? 0, color: "text-blue-400",   bg: "bg-blue-900/30 border-blue-800" },
            { label: "Replacements",       value: tasks.pending_replacements ?? 0, color: "text-amber-400", bg: "bg-amber-900/30 border-amber-800" },
            { label: "Re-verifications",   value: tasks.pending_verifications ?? 0, color: "text-violet-400",bg: "bg-violet-900/30 border-violet-800" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`border rounded-xl p-3 text-center ${bg}`}>
              <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-heading font-semibold mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Alert Summary */}
      {alertsSummary.total_active > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">
              Active Alerts ({alertsSummary.total_active})
            </h2>
          </div>
          <div className="flex gap-3 flex-wrap mb-3">
            {[
              { label: "Critical", key: "critical", color: "bg-red-500/20 text-red-400 border-red-700/40" },
              { label: "High",     key: "high",     color: "bg-orange-500/20 text-orange-400 border-orange-700/40" },
              { label: "Medium",   key: "medium",   color: "bg-amber-500/20 text-amber-400 border-amber-700/40" },
            ].map(({ label, key, color }) => alertsSummary[key] > 0 && (
              <div key={key} className={`border rounded-full px-3 py-1 text-xs font-bold font-heading ${color}`}>
                {alertsSummary[key]} {label}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={(id) => resolveMutation.mutate(id)}
                resolving={resolvingId === alert.id}
              />
            ))}
          </div>
        </section>
      )}

      {alertsSummary.total_active === 0 && !isLoading && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <p className="text-sm text-green-300 font-heading font-semibold">All clear. No active alerts.</p>
        </div>
      )}

      {/* Device Map */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Fleet Map</h2>
          <div className="flex items-center gap-3 text-[10px]">
            {Object.entries(HEALTH_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-slate-500 capitalize">{k.replace("_", " ")}</span>
              </span>
            ))}
          </div>
        </div>
        <FullscreenMapWrapper defaultHeight="288px" className="rounded-xl overflow-hidden border border-slate-800" dark>
          <MapContainer center={mapCenter} zoom={fleetPositions.length > 0 ? 8 : 7} className="h-full w-full" zoomControl={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {fleetPositions.map((pos) => (
              <Marker key={pos.truck_id} position={[pos.lat, pos.lon]} icon={makeHealthIcon(pos.health)}>
                <Popup>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold">{pos.registration_number}</p>
                    <p className="capitalize">{pos.health.replace("_", " ")}</p>
                    {pos.battery != null && <p>Battery: {pos.battery.toFixed(0)}%</p>}
                    {pos.signal != null && <p>Signal: {pos.signal} dBm</p>}
                    {pos.last_seen && <p>Last seen: {relTime(pos.last_seen)}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            {position && (
              <Circle
                center={[position.latitude, position.longitude]}
                radius={500}
                pathOptions={{ color: "#8b5cf6", fillColor: "#8b5cf6", fillOpacity: 0.15, weight: 1 }}
              />
            )}
          </MapContainer>
        </FullscreenMapWrapper>
        {fleetPositions.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-2">No trucks with GPS coordinates found</p>
        )}
      </section>

      {/* Activation Panel */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading mb-3">Activation Panel</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/admin/iot/devices/new")}
            className="bg-slate-900 border border-slate-800 hover:border-violet-600 rounded-xl p-4 text-left transition-colors group"
          >
            <Radio className="w-5 h-5 text-violet-400 mb-2" />
            <p className="text-sm font-bold text-white font-heading">Register Device</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Add tracker to inventory</p>
          </button>
          <button
            onClick={() => navigate("/admin/iot/devices?status=warehouse")}
            className="bg-slate-900 border border-slate-800 hover:border-amber-600 rounded-xl p-4 text-left transition-colors group"
          >
            <Layers className="w-5 h-5 text-amber-400 mb-2" />
            <p className="text-sm font-bold text-white font-heading">Provision Device</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Generate QR & secrets</p>
          </button>
          <button
            onClick={() => navigate("/admin/iot/devices?status=installed")}
            className="bg-slate-900 border border-slate-800 hover:border-green-600 rounded-xl p-4 text-left transition-colors group"
          >
            <Activity className="w-5 h-5 text-green-400 mb-2" />
            <p className="text-sm font-bold text-white font-heading">Test Ping</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Verify installed devices</p>
          </button>
        </div>
      </section>

    </div>
  );
}
