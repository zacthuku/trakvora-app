import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Truck, TrendingUp, Users, Download, ArrowRight,
  Navigation2, Building2,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistanceToNow } from "date-fns";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";
import { truckIcon } from "@/utils/leafletIcons";
import { useCountryConfig } from "@/hooks/useCountryConfig";

function MetricCard({ topColor, icon: Icon, label, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${topColor}`} />
      <div className="flex justify-between items-start mb-4">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className="w-5 h-5 text-slate-300" />
      </div>
      {children}
    </div>
  );
}

const NAIROBI = [-1.2921, 36.8219];

function TelemetryMap({ trucks }) {
  const withCoords = trucks.filter((t) => t.current_latitude != null && t.current_longitude != null);
  const broadcastingCount = trucks.filter((t) => t.is_active).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 flex justify-between items-center bg-white">
        <h2 className="font-heading font-semibold text-slate-900 flex items-center gap-2 text-base">
          <Navigation2 className="w-5 h-5 text-secondary" />
          Live Telemetry Map
        </h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {broadcastingCount} units broadcasting
          </span>
          <Link to="/owner/fleet-map"
            className="text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Full map <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Real Leaflet map */}
      <div className="relative" style={{ height: 380 }}>
        {withCoords.length === 0 && trucks.length > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 pointer-events-none">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-sm font-medium">No trucks broadcasting GPS</p>
          </div>
        )}

        <MapContainer
          center={NAIROBI}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {withCoords.map((truck) => {
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
                <Popup minWidth={200}>
                  <div style={{ fontFamily: "inherit" }}>
                    <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14, marginBottom: 3 }}>
                      {truck.registration_number}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, textTransform: "capitalize" }}>
                      {truck.truck_type?.replace("_", " ")} · {truck.capacity_tonnes}t
                    </div>
                    <div style={{ fontSize: 11, color: isStale ? "#dc2626" : "#64748b" }}>
                      {truck.last_seen_at
                        ? `${isStale ? "⚠️ " : ""}Last seen ${formatDistanceToNow(new Date(truck.last_seen_at), { addSuffix: true })}`
                        : "Never seen"}
                    </div>
                    {isStale && (
                      <div style={{ marginTop: 5, fontSize: 11, color: "#dc2626", background: "#fef2f2", borderRadius: 4, padding: "3px 7px" }}>
                        Signal lost — check tracker
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map key */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white rounded-lg shadow border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5"><span className="text-sm">🚛</span> Your truck</div>
          <div className="flex items-center gap-1.5"><span className="text-red-600 font-bold text-sm">⚠️</span> Stale &gt;15 min</div>
        </div>
      </div>
    </div>
  );
}

async function handleExport() {
  try {
    const res = await apiClient.get("/reports/shipments.csv", { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trakvora-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Export failed. Please try again.");
  }
}

export default function OwnerDashboard() {
  const { format } = useCurrency();
  const { distance_unit: distUnit } = useCountryConfig();
  const { data: trucks = [] } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => apiClient.get("/trucks").then((r) => r.data),
  });

  const { data: loadsData } = useQuery({
    queryKey: ["owner-marketplace"],
    queryFn: () => apiClient.get("/loads/marketplace", { params: { page: 1, page_size: 10 } }).then((r) => r.data),
  });

  const { data: wallet } = useQuery({
    queryKey: ["owner-wallet"],
    queryFn: () => apiClient.get("/payments/wallet").then((r) => r.data),
  });

  const activeCount   = trucks.filter((t) => t.is_active).length;
  const totalCount    = trucks.length;
  const matches       = (loadsData?.items || []).filter((l) => l.status === "available").slice(0, 5);

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">Fleet Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time telemetry and operational status for your network.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <Link to="/owner/fleet"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <Truck className="w-4 h-4" />
            Dispatch Unit
          </Link>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Active Units */}
        <MetricCard topColor="bg-[#4fdbcc]" icon={Truck} label="Active Units">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold font-heading text-slate-900">{activeCount}</span>
            <span className="text-sm text-slate-400">/ {totalCount || "—"}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc]" /> On Time
            </span>
            {totalCount - activeCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-orange-50 text-secondary text-[11px] font-semibold flex items-center gap-1.5 border border-secondary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> {totalCount - activeCount} Idle
              </span>
            )}
          </div>
        </MetricCard>

        {/* Revenue */}
        <MetricCard topColor="bg-secondary" icon={TrendingUp} label="Current Cycle Revenue">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold font-heading text-slate-900">
              {wallet ? format(wallet.balance) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#4fdbcc] text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            <span>Wallet balance</span>
          </div>
        </MetricCard>

        {/* Driver Roster */}
        <MetricCard topColor="bg-primary" icon={Users} label="Fleet Roster">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-700">Active trucks</span>
              <span className="font-mono font-semibold text-slate-900">{activeCount}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-[#4fdbcc] h-2 rounded-full transition-all"
                style={{ width: totalCount > 0 ? `${(activeCount / totalCount) * 100}%` : "0%" }} />
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-slate-400">Idle / Offline</span>
              <span className="font-mono text-slate-400">{totalCount - activeCount}</span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* ── Live Telemetry Map ── */}
      <div className="mb-6">
        <TelemetryMap trucks={trucks} />
      </div>

      {/* ── Return Load Matches ── */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-lg font-heading font-semibold text-slate-900">Return Load Matches</h2>
            <p className="text-slate-500 text-sm mt-0.5">Available loads for your fleet. Claim to maximise yield.</p>
          </div>
          <Link to="/owner/marketplace"
            className="flex items-center gap-1 text-secondary text-sm font-semibold hover:opacity-80 transition-opacity">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Load ID</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Distance</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Payout</th>
                <th className="py-3 px-4 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                    No available loads in the marketplace right now.
                  </td>
                </tr>
              ) : matches.map((load) => (
                <tr key={load.id} className="group hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs font-semibold text-primary tracking-wide block">
                      TRK-{load.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{load.cargo_type} · {load.weight_tonnes}t</span>
                    {(load.shipper_company || load.shipper_name) && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {load.shipper_company || load.shipper_name}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-slate-800 truncate max-w-[110px]">
                        {load.pickup_location.split(",")[0]}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="font-medium text-slate-800 truncate max-w-[110px]">
                        {load.dropoff_location.split(",")[0]}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-500 capitalize">{load.cargo_type}</td>
                  <td className="py-3.5 px-4 text-sm text-slate-500 font-mono whitespace-nowrap">
                    {load.distance_km ? `${load.distance_km.toLocaleString()} ${distUnit}` : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-secondary whitespace-nowrap">
                    {format(load.price_kes)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/owner/loads/${load.id}`}
                        className="px-3 py-1.5 border border-slate-300 text-slate-700 text-[11px] font-semibold rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                        Claim Load
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
