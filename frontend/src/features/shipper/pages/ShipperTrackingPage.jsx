import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Navigation2, Wifi, WifiOff, ArrowRight, Truck,
  Clock, MapPin, Package, CheckCircle2, AlertCircle,
  RefreshCw, Eye, Activity, Zap, ChevronRight,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";
import { truckIcon, pickupIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const STATUS_STEPS = [
  { key: "booked",          label: "Booked",      icon: "📋" },
  { key: "en_route_pickup", label: "En Route",     icon: "🚗" },
  { key: "loaded",          label: "Loaded",       icon: "📦" },
  { key: "in_transit",      label: "In Transit",   icon: "🚛" },
  { key: "delivered",       label: "Delivered",    icon: "✅" },
];

const TRACKABLE_STATUSES = ["booked", "en_route_pickup", "loaded", "in_transit", "delivered"];

const STATUS_META = {
  booked:          { color: "text-violet-600", bg: "bg-violet-50", dot: "bg-violet-500", msg: "Carrier confirmed" },
  en_route_pickup: { color: "text-sky-600",    bg: "bg-sky-50",    dot: "bg-sky-500",    msg: "Driver heading to pickup location"     },
  loaded:          { color: "text-blue-600",   bg: "bg-blue-50",   dot: "bg-blue-500",   msg: "Cargo loaded and secured"              },
  in_transit:      { color: "text-teal-700",   bg: "bg-teal-50",   dot: "bg-[#4fdbcc]",  msg: "Truck moving towards destination"      },
  delivered:       { color: "text-primary",    bg: "bg-primary/10",dot: "bg-primary",    msg: "Delivery complete" },
};

function ProgressBar({ status }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  if (currentIdx < 0) return null;
  const pct = Math.round(((currentIdx + 1) / STATUS_STEPS.length) * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Journey Progress</span>
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full bg-secondary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        {STATUS_STEPS.map((step, i) => (
          <span key={step.key} className={`text-[9px] font-medium ${i <= currentIdx ? "text-secondary" : "text-slate-300"}`}>
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShipmentTrackCard({ load }) {
  const { format } = useCurrency();
  const { distance_unit: distUnit } = useCountryConfig();
  const meta = STATUS_META[load.status] || { color: "text-slate-600", bg: "bg-slate-50", dot: "bg-slate-400", msg: "" };
  const pickup = load.pickup_location?.split(",")[0];
  const dropoff = load.dropoff_location?.split(",")[0];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={`h-[3px] ${load.status === "in_transit" ? "bg-[#4fdbcc]" : load.status === "delivered" ? "bg-primary" : "bg-slate-300"}`} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="font-mono text-xs font-bold text-primary tracking-wide block">
              TRK-{load.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 capitalize mt-0.5 block">
              {load.cargo_type} · {load.weight_tonnes}t
            </span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${load.status === "in_transit" ? "animate-pulse" : ""}`} />
            {STATUS_META[load.status]?.msg || load.status}
          </span>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">From</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{pickup}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">To</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{dropoff}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <ProgressBar status={load.status} />
        </div>

        {/* Status message */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${meta.bg} mb-4`}>
          {load.status === "in_transit" ? (
            <span className="w-2 h-2 rounded-full bg-[#4fdbcc] animate-pulse shrink-0" />
          ) : (
            <Activity className={`w-3.5 h-3.5 ${meta.color} shrink-0`} />
          )}
          <p className={`text-xs font-medium ${meta.color}`}>{meta.msg}</p>
        </div>

        {/* Distance + Price row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Distance</p>
            <p className="font-mono font-bold text-slate-700 dark:text-slate-200 text-sm">
              {load.distance_km ? `${load.distance_km.toLocaleString()} ${distUnit}` : "—"}
            </p>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Value</p>
            <p className="font-mono font-bold text-secondary text-sm">{format(load.price_kes)}</p>
          </div>
        </div>

        {/* Pickup schedule */}
        {load.pickup_date && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Pickup: {load.pickup_date}{load.pickup_window ? ` · ${load.pickup_window}` : ""}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
          <Link to={`/shipper/bids/${load.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Eye className="w-3.5 h-3.5" /> View Bids
          </Link>
          {TRACKABLE_STATUSES.includes(load.status) && (
            <Link to={`/shipper/track/${load.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity">
              <Navigation2 className="w-3.5 h-3.5" />
              {load.status === "in_transit" ? "Live Track" : "Track Status"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const NAIROBI = [-1.2921, 36.8219];

function ShipperOverviewMap({ loads }) {
  const withCoords = loads.filter((l) => l.pickup_latitude && l.pickup_longitude);

  return (
    <FullscreenMapWrapper defaultHeight="260px" className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      <MapContainer
        center={NAIROBI}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Corridor route lines */}
        {withCoords
          .filter((l) => l.dropoff_latitude && l.dropoff_longitude)
          .map((l) => (
            <Polyline
              key={`line-${l.id}`}
              positions={[
                [l.pickup_latitude, l.pickup_longitude],
                [l.dropoff_latitude, l.dropoff_longitude],
              ]}
              color="#4fdbcc"
              weight={2}
              opacity={0.5}
              dashArray="6 4"
            />
          ))}

        {/* Load markers */}
        {withCoords.map((l) => {
          const meta = STATUS_META[l.status];
          const pickup = l.pickup_location?.split(",")[0];
          const dropoff = l.dropoff_location?.split(",")[0];
          return (
            <Marker
              key={`marker-${l.id}`}
              position={[l.pickup_latitude, l.pickup_longitude]}
              icon={l.status === "in_transit" ? truckIcon : pickupIcon}
            >
              <Popup minWidth={210}>
                <div style={{ fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13, marginBottom: 4 }}>
                    TRK-{l.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                    {pickup} → {dropoff}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                    {meta?.msg || l.status}
                  </div>
                  <a
                    href={`/shipper/track/${l.id}`}
                    style={{ fontSize: 12, fontWeight: 600, color: "#fe6a34", textDecoration: "none" }}
                  >
                    Track shipment
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Header overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-[#041627]/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-heading">Live Network Map</p>
        <p className="text-white font-heading font-semibold text-sm">East Africa Corridor</p>
      </div>

      {/* Empty state overlay */}
      {withCoords.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-5 py-3 text-center shadow">
            <Navigation2 className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No active shipment positions yet</p>
          </div>
        </div>
      )}
    </FullscreenMapWrapper>
  );
}

export default function ShipperTrackingPage() {
  const { distance_unit: distUnit } = useCountryConfig();
  const { data: loadsData, isLoading, refetch } = useQuery({
    queryKey: ["shipper-tracking-loads"],
    queryFn: () =>
      apiClient.get("/loads/mine", { params: { page: 1, page_size: 100 } }).then((r) => r.data),
    refetchInterval: 30000,
  });

  const allLoads = loadsData?.items || [];
  const trackable = allLoads.filter((l) => TRACKABLE_STATUSES.includes(l.status));
  const inTransit = trackable.filter((l) => l.status === "in_transit");
  const enRoute   = trackable.filter((l) => l.status === "en_route_pickup");
  const booked    = trackable.filter((l) => l.status === "booked");
  const delivered = trackable.filter((l) => l.status === "delivered");

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Live Tracking</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Real-time status for all your active shipments across the corridor.
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Main layout: map + stats + cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Live map — 2 cols */}
        <div className="lg:col-span-2">
          <ShipperOverviewMap loads={trackable} />
        </div>

        {/* Stats column */}
        <div className="space-y-3">
          {[
            { label: "In Transit",   value: inTransit.length,  color: "text-[#4fdbcc]", bg: "bg-teal-50",     border: "border-teal-200",   icon: "🚛", sub: "moving now"       },
            { label: "En Route",     value: enRoute.length,    color: "text-sky-700",   bg: "bg-sky-50",      border: "border-sky-200",    icon: "🚗", sub: "heading to pickup" },
            { label: "Booked",       value: booked.length,     color: "text-violet-700",bg: "bg-violet-50",   border: "border-violet-200", icon: "📋", sub: "awaiting dispatch" },
            { label: "Delivered",    value: delivered.length,  color: "text-primary",   bg: "bg-primary/5",   border: "border-primary/20", icon: "✅", sub: "pending confirm"   },
          ].map(({ label, value, color, bg, border, icon, sub }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl px-4 py-3 flex items-center gap-4`}>
              <span className="text-2xl">{icon}</span>
              <div className="flex-1">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xs text-slate-400 mt-0.5`}>{sub}</p>
              </div>
              <span className={`text-3xl font-heading font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live update badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
          <Wifi className="w-3.5 h-3.5 text-[#4fdbcc]" /> Auto-refreshes every 30 seconds
        </span>
        {inTransit.length > 0 && (
          <span className="flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" />
            {inTransit.length} truck{inTransit.length > 1 ? "s" : ""} in transit
          </span>
        )}
      </div>

      {/* Shipment cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-60 animate-pulse" />
          ))}
        </div>
      ) : trackable.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4">
            <Navigation2 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">No active shipments to track</p>
          <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
            Once you post a load and a carrier accepts, your shipments will appear here with live tracking.
          </p>
          <Link to="/shipper/post-load"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            Post a Load
          </Link>
        </div>
      ) : (
        <>
          {/* In transit first */}
          {inTransit.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#4fdbcc] animate-pulse" />
                <h2 className="font-heading font-semibold text-slate-900 dark:text-white">In Transit</h2>
                <span className="text-slate-400 text-sm">({inTransit.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {inTransit.map((l) => <ShipmentTrackCard key={l.id} load={l} />)}
              </div>
            </div>
          )}

          {/* Other trackable */}
          {trackable.filter((l) => l.status !== "in_transit").length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-400" />
                <h2 className="font-heading font-semibold text-slate-900 dark:text-white">Other Active</h2>
                <span className="text-slate-400 text-sm">({trackable.filter((l) => l.status !== "in_transit").length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {trackable.filter((l) => l.status !== "in_transit").map((l) => (
                  <ShipmentTrackCard key={l.id} load={l} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
