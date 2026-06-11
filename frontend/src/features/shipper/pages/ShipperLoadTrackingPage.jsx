import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Navigation2, Wifi, WifiOff, Clock,
  Package, ArrowRight, GripHorizontal, ZoomIn, CheckCircle, Camera, X, MapPin, AlertTriangle, Link2, Phone,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "@/services/apiClient";
import { shipperApi } from "@/features/shipper/api/shipperApi";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import { useCurrency } from "@/hooks/useCurrency";
import { truckIcon, pickupIcon, dropoffIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const STATUS_STEPS = [
  { key: "booked",          label: "Booked",      desc: "Carrier confirmed, awaiting dispatch" },
  { key: "en_route_pickup", label: "En Route",     desc: "Driver heading to your pickup location" },
  { key: "loaded",          label: "Loaded",       desc: "Cargo loaded and secured on truck" },
  { key: "in_transit",      label: "In Transit",   desc: "Truck is moving towards destination" },
  { key: "delivered",       label: "Delivered",    desc: "Delivery complete." },
];

const STATUS_COLORS = {
  booked:          "bg-violet-500",
  en_route_pickup: "bg-sky-500",
  loaded:          "bg-blue-500",
  in_transit:      "bg-[#4fdbcc]",
  delivered:       "bg-primary",
};

function MapFlyTo({ lat, lng }) {
  const map = useMap();
  map.flyTo([lat, lng], map.getZoom(), { duration: 1 });
  return null;
}

function MapFitBounds({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
      fitted.current = true;
    }
  }, [map, points]);
  return null;
}

function ResizableMap({ lat, lng, shipmentId, load, onLiveMessage }) {
  const { lastMessage, connected } = useTrackingSocket(shipmentId);
  const liveLat = lastMessage?.latitude ?? lat;
  const liveLng = lastMessage?.longitude ?? lng;

  // Bubble live messages (ETA + arriving flag) up to the page
  useEffect(() => {
    if (lastMessage) onLiveMessage?.(lastMessage);
  }, [lastMessage]);
  const [autoFollow, setAutoFollow] = useState(true);

  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [mapH, setMapH] = useState(340);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const { data: trailData } = useQuery({
    queryKey: ["tracking-trail", shipmentId],
    queryFn: () => apiClient.get(`/tracking/${shipmentId}/trail`).then((r) => r.data),
    enabled: Boolean(shipmentId),
    refetchInterval: 10_000,
    staleTime: 10_000,
  });
  const trailPoints = trailData?.points
    ?.filter((p) => p?.lat != null && p?.lng != null)
    ?.map((p) => [p.lat, p.lng]) ?? [];

  const pickupLatLng =
    load?.pickup_latitude && load?.pickup_longitude
      ? [load.pickup_latitude, load.pickup_longitude]
      : null;
  const dropoffLatLng =
    load?.dropoff_latitude && load?.dropoff_longitude
      ? [load.dropoff_latitude, load.dropoff_longitude]
      : null;

  const boundsPoints = [pickupLatLng, liveLat && liveLng ? [liveLat, liveLng] : null, dropoffLatLng].filter(Boolean);

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = mapH;
    e.preventDefault();
  }, [mapH]);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const delta = e.clientY - startY.current;
    setMapH(Math.max(200, Math.min(700, startH.current + delta)));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      className="select-none"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-secondary" />
          <span className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm">Live Location</span>
          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${connected ? "bg-teal-50 text-teal-700" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
            {connected ? <><Wifi className="w-3 h-3" /> Live</> : <><WifiOff className="w-3 h-3" /> Polling</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoFollow((f) => !f)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
              autoFollow
                ? "bg-teal-50 text-teal-700 border-teal-200"
                : "bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600"
            }`}
          >
            {autoFollow ? "Following 🟢" : "Follow Truck"}
          </button>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <ZoomIn className="w-3 h-3" /> Scroll · Drag
          </span>
        </div>
      </div>

      <FullscreenMapWrapper defaultHeight={`${mapH}px`} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        <MapContainer
          center={[liveLat, liveLng]}
          zoom={12}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Route trail polyline */}
          {trailPoints.length > 1 && (
            <Polyline positions={trailPoints} color="#4fdbcc" weight={3} opacity={0.75} smoothFactor={1.5} />
          )}

          {/* Live truck position */}
          <Marker position={[liveLat, liveLng]} icon={truckIcon}>
            <Popup>🚛 Truck · {liveLat.toFixed(5)}, {liveLng.toFixed(5)}</Popup>
          </Marker>

          {/* Pickup marker */}
          {pickupLatLng && (
            <Marker position={pickupLatLng} icon={pickupIcon}>
              <Popup>📦 Pickup: {load?.pickup_location}</Popup>
            </Marker>
          )}

          {/* Dropoff marker */}
          {dropoffLatLng && (
            <Marker position={dropoffLatLng} icon={dropoffIcon}>
              <Popup>🏁 Dropoff: {load?.dropoff_location}</Popup>
            </Marker>
          )}

          {/* Auto-follow truck on live updates */}
          {autoFollow && lastMessage?.latitude && lastMessage?.longitude && (
            <MapFlyTo lat={liveLat} lng={liveLng} />
          )}

          {/* Fit map to full route on initial load */}
          {boundsPoints.length >= 2 && <MapFitBounds points={boundsPoints} />}
        </MapContainer>
      </FullscreenMapWrapper>

      {/* Drag handle */}
      <div
        ref={dragRef}
        onMouseDown={onMouseDown}
        className="flex items-center justify-center h-6 cursor-row-resize hover:bg-slate-100 dark:hover:bg-slate-700 rounded-b-xl transition-colors group"
        title="Drag to resize map"
      >
        <GripHorizontal className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>

      <p className="text-[10px] text-slate-400 font-mono mt-1 text-right">
        {liveLat.toFixed(6)}, {liveLng.toFixed(6)}
        {shipmentId && ` · Tracking ${shipmentId.slice(0, 8).toUpperCase()}`}
      </p>
    </div>
  );
}

export default function ShipperLoadTrackingPage() {
  const { format } = useCurrency();
  const { distance_unit: distUnit } = useCountryConfig();
  const { loadId } = useParams();
  const qc = useQueryClient();
  const [liveEta, setLiveEta] = useState(null);
  const arrivingToastedRef = useRef(false);

  // Tier 3: shipper-side POD (when driver had no phone)
  const [shipperPodFiles, setShipperPodFiles] = useState([]);
  const [shipperPodUploading, setShipperPodUploading] = useState(false);
  const [showPodPanel, setShowPodPanel] = useState(false);
  const shipperPodInputRef = useRef(null);

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState("cargo_damage");
  const [disputeNote, setDisputeNote] = useState("");

  function handleLiveMessage(msg) {
    if (msg.eta) setLiveEta(msg.eta);
    if (msg.arriving && !arrivingToastedRef.current) {
      arrivingToastedRef.current = true;
      toast("🚛 Driver is arriving — truck is within 500 m of your dropoff point!", "success");
    }
    // Reset the flag once the truck leaves the zone (backend stops sending arriving=true)
    if (!msg.arriving) arrivingToastedRef.current = false;
  }

  const { data: load, isLoading: loadLoading } = useQuery({
    queryKey: ["shipper-load-track", loadId],
    queryFn: () => shipperApi.getLoad(loadId),
    refetchInterval: 30_000,
  });

  const { data: shipment } = useQuery({
    queryKey: ["shipper-shipment-by-load", loadId],
    queryFn: () => shipperApi.getShipmentByLoad(loadId),
    enabled: Boolean(load && ["booked", "en_route_pickup", "loaded", "in_transit", "delivered"].includes(load.status)),
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: contactData } = useQuery({
    queryKey: ["shipment-contact", shipment?.id],
    queryFn: () => apiClient.get(`/shipments/${shipment.id}/contact`).then((r) => r.data),
    enabled: Boolean(shipment?.id),
    staleTime: 300_000,
  });

  async function handleShipperPodUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setShipperPodUploading(true);
    try {
      for (const file of files) {
        const { url } = await shipperApi.uploadPhoto(file);
        setShipperPodFiles((prev) => [...prev, { url, name: file.name }]);
      }
    } catch {
      toast("Upload failed. Try again.", "error");
    } finally {
      setShipperPodUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  const confirmMutation = useMutation({
    mutationFn: (body) => shipperApi.confirmDelivery(shipment.id, body),
    onSuccess: () => {
      toast("Delivery confirmed — payment released to carrier");
      qc.invalidateQueries({ queryKey: ["shipper-shipment-by-load", loadId] });
      qc.invalidateQueries({ queryKey: ["shipper-load-track", loadId] });
      setShipperPodFiles([]);
      setShowPodPanel(false);
    },
    onError: (err) => toast(err.response?.data?.detail || "Failed to confirm delivery", "error"),
  });

  const disputeMutation = useMutation({
    mutationFn: (body) => apiClient.post(`/payments/shipments/${load?.id}/open-dispute`, body).then((r) => r.data),
    onSuccess: () => {
      toast("Dispute raised — our team has been notified and will review within 24 hours", "success");
      setShowDisputeModal(false);
      setDisputeNote("");
      setDisputeCategory("cargo_damage");
      qc.invalidateQueries({ queryKey: ["shipper-shipment-by-load", loadId] });
      qc.invalidateQueries({ queryKey: ["shipper-load-track", loadId] });
    },
    onError: (err) => toast(err.response?.data?.detail || "Failed to open dispute", "error"),
  });

  function handleConfirmWithPod() {
    const urls = shipperPodFiles.map((f) => f.url).join(",") || null;
    confirmMutation.mutate(urls ? { shipper_pod_urls: urls } : {});
  }


  if (loadLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!load) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-slate-500">
        Load not found.
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === load.status);
  const currentStep = STATUS_STEPS[currentIdx];
  const dotColor = STATUS_COLORS[load.status] || "bg-slate-400";
  const isInTransit = load.status === "in_transit";
  const isTracking = ["en_route_pickup", "loaded", "in_transit"].includes(load.status);

  const lat = shipment?.current_latitude;
  const lng = shipment?.current_longitude;
  const hasLocation = lat != null && lng != null;

  // Auto-confirm time: show the absolute deadline (48h after delivery) so shipper knows when it closes
  const AUTO_CONFIRM_HOURS = 48;
  const autoConfirmAt = (load.status === "delivered" && shipment?.delivered_at && !shipment?.payment_confirmed_at)
    ? new Date(new Date(shipment.delivered_at).getTime() + AUTO_CONFIRM_HOURS * 3600000)
    : null;
  const autoConfirmLabel = autoConfirmAt
    ? autoConfirmAt.toLocaleString("en-KE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  const DISPUTE_CATEGORIES = [
    { value: "cargo_damage",     label: "Cargo damaged in transit" },
    { value: "short_delivery",   label: "Goods delivered short / incomplete" },
    { value: "wrong_location",   label: "Delivered to wrong address" },
    { value: "delayed_delivery", label: "Significantly delayed" },
    { value: "driver_misconduct",label: "Driver misconduct" },
    { value: "no_delivery",      label: "Driver claims delivered but not received" },
    { value: "other",            label: "Other" },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-12 w-full overflow-x-hidden">
      {/* Dispute modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl my-auto">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Raise a Dispute</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Our team will review and respond within 24 hours</p>
              </div>
              <button onClick={() => setShowDisputeModal(false)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Dispute Category</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-secondary transition-colors"
                >
                  {DISPUTE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={disputeNote}
                  onChange={(e) => setDisputeNote(e.target.value)}
                  rows={4}
                  placeholder="Describe what went wrong in detail — include dates, photos, or any evidence you have..."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-secondary resize-none transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-1">{disputeNote.length}/1000 — minimum 10 characters</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>Important:</strong> Raising a dispute blocks the 48-hour auto-confirm and halts any pending payment release. Trakvora will investigate as a neutral platform — we do not hold funds but can mediate resolution.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => disputeMutation.mutate({ reason_category: disputeCategory, reason: disputeNote })}
                  disabled={disputeNote.length < 10 || disputeMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {disputeMutation.isPending ? "Submitting…" : "Submit Dispute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mb-5">
        <Link to="/shipper/tracking"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Tracking
        </Link>
      </div>

      {/* Load ID + route */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <span className="font-mono text-xs font-bold text-primary tracking-wide block">
              TRK-{load.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              {load.cargo_type} · {load.weight_tonnes}t
              {load.distance_km ? ` · ${load.distance_km.toLocaleString()} ${distUnit}` : ""}
            </span>
          </div>
          <span className="font-mono font-bold text-secondary text-sm">{format(load.price_kes)}</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Pickup</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.pickup_location}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mx-1" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Dropoff</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.dropoff_location}</p>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
        <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm mb-5">Journey Progress</h2>

        {/* Step dots */}
        <div className="relative flex items-start justify-between mb-5">
          {/* connector line */}
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
          <div
            className="absolute top-3 left-0 h-0.5 z-0 bg-secondary transition-all duration-500"
            style={{ width: currentIdx < 0 ? "0%" : `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
          />

          {STATUS_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center overflow-hidden" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  done || active
                    ? `${dotColor} border-transparent`
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
                } ${active ? "ring-4 ring-secondary/20 scale-110" : ""}`}>
                  {done && <span className="text-white text-[10px]">✓</span>}
                  {active && <span className={`w-2 h-2 rounded-full bg-white ${isInTransit ? "animate-pulse" : ""}`} />}
                </div>
                <span className={`hidden sm:block text-[9px] font-bold uppercase tracking-wider mt-1.5 text-center leading-tight truncate w-full ${
                  active ? "text-slate-900 dark:text-white" : done ? "text-secondary" : "text-slate-400"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current status message */}
        {currentStep && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
            isInTransit ? "bg-teal-50 border border-teal-200" : "bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
          }`}>
            {isInTransit
              ? <span className="w-2.5 h-2.5 rounded-full bg-[#4fdbcc] animate-pulse shrink-0" />
              : <Navigation2 className={`w-4 h-4 shrink-0 ${dotColor.replace("bg-", "text-")}`} />}
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{currentStep.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentStep.desc}</p>
            </div>
            {(liveEta || shipment?.eta) && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-end gap-1">
                  {liveEta ? <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse inline-block" /> : null}
                  ETA
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(liveEta || shipment.eta).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map — shown whenever truck is on the road */}
      {isTracking && hasLocation ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
          <ResizableMap lat={lat} lng={lng} shipmentId={shipment?.id} load={load} onLiveMessage={handleLiveMessage} />
        </div>
      ) : isTracking && !hasLocation ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 mb-5 text-center">
          <Navigation2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Waiting for driver to share location…</p>
          <p className="text-xs text-slate-400 mt-1">Location updates every 30 seconds</p>
        </div>
      ) : null}

      {/* Delivery confirmation banners */}
      {(load.status === "delivered" || load.status === "in_transit") && shipment && !shipment.payment_confirmed_at && (() => {
        const isUnattended = shipment.delivery_method === "unattended_gps" || shipment.delivery_method === "auto_tracker";
        const isAutoTracker = shipment.delivery_method === "auto_tracker";
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5 space-y-3">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">
                  {load.status === "delivered"
                    ? (isAutoTracker ? "Delivery auto-confirmed by GPS tracker" : isUnattended ? "GPS-verified delivery" : "Delivery confirmed by driver")
                    : "Confirm delivery (driver has no phone)"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {load.status === "delivered"
                    ? (isUnattended
                        ? "GPS location recorded at dropoff. Confirm now or it auto-closes and the commission invoice is issued."
                        : "Confirm to acknowledge receipt. If you don't act, it auto-confirms and closes.")
                    : "If the driver cannot use the app, you can confirm delivery with your own photos."}
                </p>
                {/* Auto-confirm deadline */}
                {autoConfirmLabel && (
                  <p className="text-xs font-semibold text-amber-700 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Auto-confirms {autoConfirmLabel} · Raise a dispute before then to block it
                  </p>
                )}
              </div>
              {load.status === "delivered" && (
                <Button
                  onClick={() => confirmMutation.mutate({})}
                  loading={confirmMutation.isPending}
                  className="shrink-0 text-sm"
                >
                  Confirm Now
                </Button>
              )}
            </div>

            {/* Raise dispute button — only when delivered, unconfirmed, and no open dispute */}
            {load.status === "delivered" && !shipment.dispute_open && (
              <button
                onClick={() => setShowDisputeModal(true)}
                className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors flex items-center gap-1.5 mt-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Raise a dispute
              </button>
            )}
            {shipment.dispute_open && (
              <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-red-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                Dispute open — auto-confirm blocked. Our team is reviewing.
              </div>
            )}

            {/* GPS stamp evidence for unattended deliveries */}
            {isUnattended && shipment.delivered_at && (
              <div className="border-t border-amber-200 pt-3 space-y-2">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> GPS Delivery Proof
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium">Time:</span>
                    <span>{new Date(shipment.delivered_at).toLocaleString("en-KE")}</span>
                  </div>
                  {shipment.delivery_location_name && (
                    <div className="flex items-start gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="font-medium shrink-0">Location:</span>
                      <span className="break-words">{shipment.delivery_location_name}</span>
                    </div>
                  )}
                  {shipment.delivery_latitude && shipment.delivery_longitude && (
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                      <Navigation2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium">Coords:</span>
                      <span className="font-mono">{shipment.delivery_latitude.toFixed(5)}, {shipment.delivery_longitude.toFixed(5)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="font-medium">Method:</span>
                    <span>{isAutoTracker ? "Auto-confirmed by hardware GPS tracker" : "Driver GPS verified at dropoff"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Shipper-side POD upload (Tier 3 — driver had no phone, attended delivery only) */}
            {!isUnattended && (
              <div className="border-t border-amber-200 pt-3">
                <button
                  onClick={() => setShowPodPanel((v) => !v)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {showPodPanel ? "Hide photo panel" : "I have delivery evidence (driver had no phone)"}
                </button>

                {showPodPanel && (
                  <div className="mt-3 space-y-3">
                    <input
                      ref={shipperPodInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleShipperPodUpload}
                    />
                    <button
                      onClick={() => shipperPodInputRef.current?.click()}
                      disabled={shipperPodUploading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-50 transition-colors text-xs font-semibold text-amber-700 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      {shipperPodUploading ? "Uploading…" : shipperPodFiles.length ? `${shipperPodFiles.length} photo(s) — add more` : "Upload delivery photos"}
                    </button>
                    {shipperPodFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {shipperPodFiles.map((f, i) => (
                          <div key={i} className="relative group">
                            <img src={f.url} alt="pod" className="w-full h-16 object-cover rounded-lg border border-amber-200" />
                            <button
                              onClick={() => setShipperPodFiles((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      onClick={handleConfirmWithPod}
                      loading={confirmMutation.isPending}
                      disabled={!shipperPodFiles.length || confirmMutation.isPending}
                      className="w-full justify-center"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirm Delivery with My Photos
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {shipment?.payment_confirmed_at && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
          <p className="text-sm font-semibold text-teal-800">
            Delivery confirmed · {format(load.price_kes)} {shipment.escrow_released ? "released to carrier" : "payment acknowledged"}
          </p>
        </div>
      )}

      {/* Carrier / driver contact */}
      {contactData && (contactData.carrier_phone || contactData.driver_phone) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Carrier Contact</p>
          <div className="space-y-3">
            {contactData.carrier_phone && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{contactData.carrier_name}</p>
                  {contactData.carrier_company && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{contactData.carrier_company}</p>
                  )}
                </div>
                <a
                  href={`tel:${contactData.carrier_phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-semibold text-sm transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {contactData.carrier_phone}
                </a>
              </div>
            )}
            {contactData.driver_phone && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{contactData.driver_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                </div>
                <a
                  href={`tel:${contactData.driver_phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-semibold text-sm transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {contactData.driver_phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery confirmation code — shown to shipper to share with driver (attended deliveries only) */}
      {shipment?.delivery_code && !shipment?.delivery_method?.startsWith("unattended") && load.status !== "delivered" && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            Delivery Confirmation Code
          </p>
          <p className="text-3xl font-mono font-black text-primary tracking-[0.3em]">
            {shipment.delivery_code.slice(0, 3)}-{shipment.delivery_code.slice(3)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Share this code with the carrier. The driver must enter it to confirm delivery.
          </p>
        </div>
      )}

      {/* Share tracking link — copy for customer */}
      {shipment?.share_token && ["booked", "en_route_pickup", "loaded", "in_transit", "delivered"].includes(load.status) && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Customer Tracking Link
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Share this link with your customer so they can track the shipment and confirm delivery.
          </p>
          <button
            onClick={() => {
              const url = `${window.location.origin}/track/${shipment.id}?token=${shipment.share_token}`;
              navigator.clipboard.writeText(url).then(() => {
                toast("Tracking link copied. Share it with your customer.", "success");
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-semibold text-sm transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Copy Tracking Link
          </button>
        </div>
      )}

      {/* Shipment details */}
      {shipment && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm">Shipment Details</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Payment", value: shipment.escrow_released ? "Released" : "Pending", ok: shipment.escrow_released },
            ].map(({ label, value, ok }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-sm font-semibold ${ok ? "text-teal-600" : "text-slate-600 dark:text-slate-300"}`}>{value}</p>
              </div>
            ))}
          </div>
          {load.pickup_date && (
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Scheduled pickup: {load.pickup_date}{load.pickup_window ? ` · ${load.pickup_window}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
