import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistanceToNow } from "date-fns";
import apiClient from "@/services/apiClient";
import { truckIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";

const NAIROBI = [-1.2921, 36.8219];

function LastSeenBadge({ lastSeenAt }) {
  if (!lastSeenAt) return <span style={{ fontSize: 11, color: "#94a3b8" }}>Never seen</span>;
  const minutesAgo = (Date.now() - new Date(lastSeenAt).getTime()) / 60000; // eslint-disable-line react-hooks/purity
  const label = formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true });
  const isStale = minutesAgo > 15;
  return (
    <span style={{ fontSize: 11, color: isStale ? "#dc2626" : "#64748b" }}>
      {isStale ? "⚠️ " : ""}Last seen {label}
    </span>
  );
}

function BatteryIndicator({ level }) {
  if (level == null) return null;
  const color = level < 20 ? "#dc2626" : level < 50 ? "#f59e0b" : "#0d9488";
  return <span style={{ fontSize: 11, color }}>🔋 {Math.round(level)}%</span>;
}

export default function OwnerFleetMapPage() {
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => apiClient.get("/trucks").then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const trucks = Array.isArray(raw) ? raw : (raw.items ?? []);
  const activeTrucks = trucks.filter((t) => t.current_latitude != null && t.current_longitude != null);
  const offlineCount = trucks.length - activeTrucks.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">Fleet Map</h1>
          <p className="text-slate-500 text-sm mt-1">Live positions of your trucks across the corridor.</p>
        </div>
        {isLoading && (
          <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Trucks",    value: trucks.length,        color: "text-slate-800",    bg: "bg-slate-50 border-slate-200"     },
          { label: "Broadcasting",    value: activeTrucks.length,  color: "text-teal-700",     bg: "bg-teal-50 border-teal-200"       },
          { label: "Offline / No GPS",value: offlineCount,         color: "text-slate-500",    bg: "bg-slate-50 border-slate-200"     },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-xl px-4 py-3 text-center ${bg}`}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`text-2xl font-heading font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      <FullscreenMapWrapper defaultHeight="500px" className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        {activeTrucks.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 pointer-events-none">
            <div className="text-3xl sm:text-5xl mb-3">🗺️</div>
            <p className="text-base font-medium">No trucks broadcasting GPS</p>
            <p className="text-sm mt-1">Assign GPS trackers to your trucks in Fleet Management</p>
          </div>
        )}

        <MapContainer
          center={NAIROBI}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {activeTrucks.map((truck) => {
            const minutesStale = truck.last_seen_at
              ? (Date.now() - new Date(truck.last_seen_at).getTime()) / 60000 // eslint-disable-line react-hooks/purity
              : null;
            const isStale = minutesStale != null && minutesStale > 15;

            return (
              <Marker
                key={truck.id}
                position={[truck.current_latitude, truck.current_longitude]}
                icon={truckIcon}
              >
                <Popup minWidth={220}>
                  <div style={{ fontFamily: "inherit" }}>
                    {/* Registration */}
                    <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 15, marginBottom: 4 }}>
                      {truck.registration_number}
                    </div>

                    {/* Type + capacity */}
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, textTransform: "capitalize" }}>
                      {truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t
                      {truck.make ? ` · ${truck.make} ${truck.model ?? ""}` : ""}
                    </div>

                    {/* Active status */}
                    <div style={{ marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        padding: "2px 6px", borderRadius: 4,
                        background: truck.is_active ? "#f0fdf4" : "#f8fafc",
                        color: truck.is_active ? "#166534" : "#64748b",
                      }}>
                        {truck.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Health */}
                    <div style={{ display: "flex", gap: 12, paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
                      <BatteryIndicator level={truck.battery_level} />
                      <LastSeenBadge lastSeenAt={truck.last_seen_at} />
                    </div>

                    {/* Stale warning */}
                    {isStale && (
                      <div style={{
                        marginTop: 6, fontSize: 11, color: "#dc2626",
                        background: "#fef2f2", borderRadius: 4, padding: "4px 8px",
                      }}>
                        Tracker signal lost. Check device.
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Map Key</div>
          <div className="flex items-center gap-2"><span className="text-base">🚛</span> Your truck</div>
          <div className="flex items-center gap-2"><span className="text-red-600 font-bold">⚠️</span> Stale signal (&gt;15 min)</div>
        </div>
      </FullscreenMapWrapper>
    </div>
  );
}
