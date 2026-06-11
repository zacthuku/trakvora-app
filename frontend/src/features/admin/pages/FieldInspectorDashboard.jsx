import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, Clock, Navigation, ClipboardList, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { inspectorIcon, taskIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import QrScanButton from "@/features/admin/components/QrScanButton";
import { toast } from "@/components/ui/Toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function urgency(task) {
  if (!task.deadline) return 3;
  const diff = new Date(task.deadline) - Date.now();
  if (diff < 0) return 0;              // overdue
  if (diff < 8 * 3600 * 1000) return 1; // due today
  if (diff < 7 * 86400 * 1000) return 2; // this week
  return 3;
}

const URGENCY_STYLE = [
  { border: "border-l-4 border-red-500",   badge: "bg-red-500/20 text-red-400",   label: "OVERDUE" },
  { border: "border-l-4 border-amber-500", badge: "bg-amber-500/20 text-amber-400", label: "Due Today" },
  { border: "border-l-4 border-green-500", badge: "bg-green-500/20 text-green-400", label: "This Week" },
  { border: "border-l-4 border-slate-600", badge: null, label: null },
];

function relTime(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - Date.now();
  const abs = Math.abs(diff);
  const sign = diff < 0 ? "ago" : "left";
  if (abs < 3600000) return `${Math.floor(abs / 60000)}m ${sign}`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)}h ${sign}`;
  return `${Math.floor(abs / 86400000)}d ${sign}`;
}

function decisionBadge(decision) {
  if (!decision) return <span className="text-[10px] font-bold font-heading text-slate-400 uppercase tracking-widest">Submitted</span>;
  if (decision === "approved") return <span className="text-[10px] font-bold font-heading text-green-400 uppercase tracking-widest">Passed</span>;
  if (decision === "rejected") return <span className="text-[10px] font-bold font-heading text-red-400 uppercase tracking-widest">Failed</span>;
  return <span className="text-[10px] font-bold font-heading text-amber-400 uppercase tracking-widest">Review</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TaskCard({ task, position, navigate }) {
  const u = urgency(task);
  const style = URGENCY_STYLE[u];
  const dist =
    position && task.location_lat && task.location_lon
      ? haversineKm(position.latitude, position.longitude, task.location_lat, task.location_lon).toFixed(1)
      : null;

  const mapsUrl =
    task.location_lat && task.location_lon
      ? `https://www.google.com/maps/dir/?api=1&destination=${task.location_lat},${task.location_lon}`
      : null;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${style.border}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white font-heading truncate">
            Truck #{String(task.truck_id).slice(0, 8)}
          </p>
          {task.location && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{task.location}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {style.badge && (
            <span className={`text-[9px] font-bold font-heading uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
        {task.deadline && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relTime(task.deadline)}
          </span>
        )}
        {dist && (
          <span className="flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            {dist} km away
          </span>
        )}
        <span className={`capitalize font-semibold ${task.status === "in_progress" ? "text-violet-400" : "text-slate-400"}`}>
          {task.status.replace("_", " ")}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/admin/field-ops/tasks/${task.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-xs font-bold font-heading transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Open Task
        </button>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-heading transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FieldInspectorDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { position } = useGeolocation();
  const [showQr, setShowQr] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["fi-tasks"],
    queryFn: () => adminApi.getTasks({ limit: 50 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: inspectionsData } = useQuery({
    queryKey: ["fi-inspections"],
    queryFn: () => adminApi.listInspections({ page: 1, limit: 6 }),
    staleTime: 60_000,
  });

  const allTasks = tasksData?.items ?? [];
  const activeTasks = allTasks
    .filter((t) => t.status === "pending" || t.status === "in_progress")
    .sort((a, b) => urgency(a) - urgency(b));

  const recentInspections = inspectionsData?.items ?? [];

  const mapCenter = position
    ? [position.latitude, position.longitude]
    : [-1.2921, 36.8219]; // Nairobi default

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

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="pt-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white font-heading">
              {greeting}, {user?.full_name?.split(" ")[0]}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${position ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
            <span className={position ? "text-green-400" : "text-slate-500"}>
              {position ? `GPS ±${Math.round(position.accuracy ?? 0)}m` : "No GPS"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowQr(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-heading font-bold transition-colors"
        >
          <ClipboardList className="w-4 h-4" /> Scan Truck
        </button>
        <button
          onClick={() => navigate("/admin/field-ops/tasks")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-heading font-bold transition-colors"
        >
          All Tasks <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today's tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">
            My Tasks ({activeTasks.length})
          </h2>
        </div>
        {tasksLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">Loading…</div>
        ) : activeTasks.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-slate-500 text-sm">No tasks assigned</p>
            <p className="text-slate-600 text-xs">Contact your operations admin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((t) => (
              <TaskCard key={t.id} task={t} position={position} navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* Field map */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading mb-3">Field Map</h2>
        <FullscreenMapWrapper defaultHeight="256px" className="rounded-xl overflow-hidden border border-slate-800" dark>
          <MapContainer
            center={mapCenter}
            zoom={position ? 13 : 7}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {/* Inspector position */}
            {position && (
              <>
                <Marker position={[position.latitude, position.longitude]} icon={inspectorIcon}>
                  <Popup>Your position</Popup>
                </Marker>
                {position.accuracy && (
                  <Circle
                    center={[position.latitude, position.longitude]}
                    radius={position.accuracy}
                    pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 1 }}
                  />
                )}
              </>
            )}

            {/* Task locations */}
            {activeTasks
              .filter((t) => t.location_lat && t.location_lon)
              .map((t) => (
                <Marker key={t.id} position={[t.location_lat, t.location_lon]} icon={taskIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold">{t.location ?? "Inspection site"}</p>
                      {t.deadline && <p>Deadline: {relTime(t.deadline)}</p>}
                      <a
                        href={`/admin/field-ops/tasks/${t.id}`}
                        className="text-violet-600 font-semibold"
                      >
                        Open Task
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </FullscreenMapWrapper>
      </section>

      {/* Recent inspections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-heading">Recent Inspections</h2>
          <button
            onClick={() => navigate("/admin/field-ops/tasks?status=submitted")}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
          >
            View all
          </button>
        </div>
        {recentInspections.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
            No inspections submitted yet
          </div>
        ) : (
          <div className="space-y-2">
            {recentInspections.map((insp) => (
              <div key={insp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white font-heading">
                    Truck #{String(insp.truck_id).slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {insp.submitted_at
                      ? new Date(insp.submitted_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {insp.roadworthy === true
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : insp.roadworthy === false
                      ? <XCircle className="w-4 h-4 text-red-400" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400" />
                  }
                  {decisionBadge(null)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QR scan modal */}
      {showQr && (
        <QrScanButton
          onResult={handleQrResult}
          label="Scan Truck QR"
          autoStart
        />
      )}
    </div>
  );
}
