import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistanceToNow } from "date-fns";
import { adminApi } from "@/features/admin/api/adminApi";
import { truckIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";

// Kenya center — shows Kenya + Uganda + Tanzania in one view at zoom 6
const NAIROBI = [-1.2921, 36.8219];

function BatteryIndicator({ level }) {
  if (level == null) return null;
  const color = level < 20 ? "text-red-600" : level < 50 ? "text-amber-500" : "text-teal-600";
  return (
    <span className={`text-xs font-medium ${color}`}>
      🔋 {Math.round(level)}%
    </span>
  );
}

function LastSeenBadge({ lastSeenAt }) {
  if (!lastSeenAt) return <span className="text-xs text-slate-400">Never seen</span>;
  const minutesAgo = (Date.now() - new Date(lastSeenAt).getTime()) / 60000; // eslint-disable-line react-hooks/purity
  const label = formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true });
  const isStale = minutesAgo > 15;
  return (
    <span className={`text-xs font-medium ${isStale ? "text-red-600" : "text-slate-500"}`}>
      {isStale ? "⚠️ " : ""}Last seen {label}
    </span>
  );
}

function StatusBadgeMini({ status }) {
  const colors = {
    en_route_pickup: "bg-sky-100 text-sky-700",
    loaded: "bg-blue-100 text-blue-700",
    in_transit: "bg-teal-100 text-teal-700",
  };
  const labels = {
    en_route_pickup: "En Route",
    loaded: "Loaded",
    in_transit: "In Transit",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors[status] ?? "bg-slate-100 text-slate-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function AdminFleetMapPage() {
  const { data: trucks = [], isLoading } = useQuery({
    queryKey: ["admin-fleet-positions"],
    queryFn: adminApi.getActiveFleetPositions,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const activeTrucks = trucks.filter(
    (t) => t.current_latitude != null && t.current_longitude != null
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <div>
          <h1 className="text-xl font-heading font-bold text-slate-900 dark:text-white">Fleet Map</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Live positions of all active trucks</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activeTrucks.length} truck{activeTrucks.length !== 1 ? "s" : ""} active
          </span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Map */}
      <FullscreenMapWrapper className="flex-1">
        {activeTrucks.length === 0 && !isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 pointer-events-none">
            <div className="text-3xl sm:text-5xl mb-3">🗺️</div>
            <p className="text-base font-medium">No active shipments on the road</p>
            <p className="text-sm mt-1">Trucks will appear here when in transit</p>
          </div>
        ) : null}

        <MapContainer
          center={NAIROBI}
          zoom={6}
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
                key={truck.truck_id}
                position={[truck.current_latitude, truck.current_longitude]}
                icon={truckIcon}
              >
                <Popup minWidth={220}>
                  <div className="text-sm py-1">
                    {/* Registration + status */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 font-mono text-base">
                        {truck.registration_number}
                      </span>
                      <StatusBadgeMini status={truck.status} />
                    </div>

                    {/* Route */}
                    {truck.pickup_location && truck.dropoff_location && (
                      <div className="text-xs text-slate-600 mb-2">
                        <span className="text-green-600 font-medium">●</span> {truck.pickup_location}
                        <br />
                        <span className="text-red-500 font-medium">●</span> {truck.dropoff_location}
                      </div>
                    )}

                    {/* Cargo type */}
                    {truck.cargo_type && (
                      <div className="text-xs text-slate-500 mb-2 capitalize">
                        Cargo: {truck.cargo_type}
                      </div>
                    )}

                    {/* ETA */}
                    {truck.eta && (
                      <div className="text-xs text-slate-500 mb-2">
                        ETA: {new Date(truck.eta).toLocaleString()}
                      </div>
                    )}

                    {/* Health indicators */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <BatteryIndicator level={truck.battery_level} />
                      <LastSeenBadge lastSeenAt={truck.last_seen_at} />
                    </div>

                    {/* Stale tracker warning */}
                    {isStale && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        Tracker signal lost. Check device.
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend overlay */}
        <div className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Map Key</div>
          <div className="flex items-center gap-2">
            <span className="text-base">🚛</span> Active truck
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-bold">⚠️</span> Stale tracker (&gt;15 min)
          </div>
        </div>
      </FullscreenMapWrapper>
    </div>
  );
}
