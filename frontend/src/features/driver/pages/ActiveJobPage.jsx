import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera, CheckCircle, Navigation,
  MapPin, ExternalLink, ArrowRight, Package, Route, Briefcase, Building2,
  FileText, X, Clock, Lock, Phone,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import LiveTrackingGoogleMap from "@/components/map/LiveTrackingGoogleMap";
import { driverApi } from "@/features/driver/api/driverApi";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import apiClient from "@/services/apiClient";
import { truckIcon, pickupIcon, dropoffIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import CameraCapture from "@/components/ui/CameraCapture";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";
import SignaturePad from "@/components/ui/SignaturePad";

const NAIROBI = [-1.2921, 36.8219];

function openMapsNavigation(lat, lng) {
  const isAndroid = /android/i.test(navigator.userAgent);
  const url = isAndroid
    ? `intent://maps.google.com/maps?daddr=${lat},${lng}&directionsmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;end`
    : `https://maps.google.com/maps?daddr=${lat},${lng}&directionsmode=driving`;
  window.location.href = url;
}

function MapFitBounds({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && points.length >= 2) {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 13 });
      fitted.current = true;
    }
  }, [map, points]);
  return null;
}

const STATUS_STEPS = [
  { key: "booked",          label: "Booked"    },
  { key: "en_route_pickup", label: "En Route"  },
  { key: "loaded",          label: "Loaded"    },
  { key: "in_transit",      label: "In Transit"},
  { key: "delivered",       label: "Delivered" },
];

const NEXT_STATUS = {
  booked:          "en_route_pickup",
  en_route_pickup: "loaded",
  loaded:          "in_transit",
  in_transit:      "delivered",
};

// ── Geolocation distance helper (Haversine, metres) ──────────────────────────
function distanceMetres(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.latitude  - a.latitude)  * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * (Math.PI / 180))
    * Math.cos(b.latitude * (Math.PI / 180))
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function ActiveJobPage() {
  const qc = useQueryClient();
  const { position } = useGeolocation();
  const [deliveryFiles, setDeliveryFiles] = useState([]); // [{url, type, name}]
  const [deliveryCode, setDeliveryCode] = useState("");
  const [capturedAt, setCapturedAt] = useState(null);     // {lat, lng, time}
  const [uploading, setUploading] = useState(false);
  const [podSignatureUrl, setPodSignatureUrl] = useState(null);  // base64 PNG data URL
  const [showCamera, setShowCamera] = useState(false);
  const [noCamera, setNoCamera] = useState(false);        // Tier 2: basic phone / no camera
  const [mapTab, setMapTab] = useState("leaflet");
  // Persist across navigation — sessionStorage survives route changes but not tab close.
  const [phoneTrackingEnabled, setPhoneTrackingEnabled] = useState(
    () => sessionStorage.getItem("trakvora_phone_gps") === "true"
  );
  const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(
    () => sessionStorage.getItem("trakvora_phone_banner_dismissed") === "true"
  );
  const docInputRef = useRef(null);

  // Adaptive ping rate refs (rideshare-style)
  const lastSentPosRef   = useRef(null);   // last position we actually sent
  const lastSentTimeRef  = useRef(0);      // timestamp of last send

  // Auto-fetch the driver's active shipment — no manual ID needed
  const { data: shipment, isLoading } = useQuery({
    queryKey: ["active-shipment"],
    queryFn: driverApi.getActiveShipment,
    refetchInterval: 15_000,
  });

  const shipmentId = shipment?.id ?? null;

  const { send } = useTrackingSocket(shipmentId);

  const { data: trailData } = useQuery({
    queryKey: ["driver-trail", shipmentId],
    queryFn: () => apiClient.get(`/tracking/${shipmentId}/trail`).then((r) => r.data),
    enabled: Boolean(shipmentId),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: loadData } = useQuery({
    queryKey: ["driver-load", shipment?.load_id],
    queryFn: () => apiClient.get(`/loads/${shipment.load_id}`).then((r) => r.data),
    enabled: Boolean(shipment?.load_id),
    staleTime: 60_000,
  });

  const { data: contactData } = useQuery({
    queryKey: ["shipment-contact", shipmentId],
    queryFn: () => apiClient.get(`/shipments/${shipmentId}/contact`).then((r) => r.data),
    enabled: Boolean(shipmentId),
    staleTime: 300_000,
  });

  // Auto-enable phone GPS the moment a position arrives — background tracking
  // (useBackgroundTracking in DriverLayout) already runs GPS continuously, so
  // the user never actually needs to tap "Enable". Persisted to sessionStorage
  // so re-mounting the page doesn't reset the banner to the "enable" state.
  useEffect(() => {
    if (position && !phoneTrackingEnabled) {
      setPhoneTrackingEnabled(true); // eslint-disable-line react-hooks/set-state-in-effect
      sessionStorage.setItem("trakvora_phone_gps", "true");
    }
  }, [position]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hardware tracker online? (last ping < 5 min) ──────────────────────────
  const hardwareTrackerOnline = (() => {
    if (!shipment?.truck?.last_seen_at) return false;
    const minAgo = (Date.now() - new Date(shipment.truck.last_seen_at).getTime()) / 60000; // eslint-disable-line react-hooks/purity
    return minAgo < 5;
  })();

  // ── Adaptive ping: rideshare-style rate control ───────────────────────────
  useEffect(() => {
    if (!position || !shipmentId) return;

    const now      = Date.now();
    const speedKmh = position.speed ?? 0;
    const moved    = distanceMetres(lastSentPosRef.current, position);
    const elapsed  = now - lastSentTimeRef.current;

    // Adaptive interval — same logic as Uber/Bolt:
    //   Moving (>2 km/h): send every 5 s OR when moved >20 m
    //   Stationary:       send every 30 s only
    const isMoving        = speedKmh > 2;
    const minInterval     = isMoving ? 5_000 : 30_000;
    const significantMove = isMoving && moved > 20;

    if (!significantMove && elapsed < minInterval) return;  // too soon / not moved enough

    lastSentPosRef.current  = position;
    lastSentTimeRef.current = now;

    // REST location persistence is handled by useBackgroundTracking in DriverLayout.
    // Here we only broadcast via WebSocket so the shipper's live map updates instantly.
    send({
      latitude:  position.latitude,
      longitude: position.longitude,
      accuracy:  position.accuracy,
      speed_kmh: speedKmh,
      heading:   position.heading,
      source: "driver_phone",
    });
  }, [position, shipmentId]);

  const advance = useMutation({
    mutationFn: (payload) => driverApi.updateStatus(shipmentId, payload),
    onSuccess: () => {
      toast("Status updated");
      qc.invalidateQueries({ queryKey: ["active-shipment"] });
    },
    onError: (err) => toast(err.response?.data?.detail || "Failed", "error"),
  });

  async function handleFileAdd(e, fileType) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    if (!capturedAt && position) {
      setCapturedAt({ lat: position.latitude, lng: position.longitude, time: new Date().toISOString() });
    }
    try {
      for (const file of files) {
        let url;
        if (fileType === "photo")    url = (await driverApi.uploadPhoto(file)).url;
        else if (fileType === "video") url = (await driverApi.uploadVideo(file)).url;
        else                           url = (await driverApi.uploadDocument(file)).url;
        setDeliveryFiles(prev => [...prev, { url, type: fileType, name: file.name }]);
      }
    } catch {
      toast("Upload failed. Try again.", "error");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  function removeFile(idx) {
    setDeliveryFiles(prev => prev.filter((_, i) => i !== idx));
  }

  const isUnattended = Boolean(loadData?.unattended_delivery);

  // Haversine distance in metres between two GPS points
  function haversineMetres(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlam = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const driverLat = position?.latitude ?? null;
  const driverLng = position?.longitude ?? null;
  const dropoffLat = loadData?.dropoff_latitude ?? null;
  const dropoffLng = loadData?.dropoff_longitude ?? null;
  const distanceToDropoff = (driverLat && driverLng && dropoffLat && dropoffLng)
    ? haversineMetres(driverLat, driverLng, dropoffLat, dropoffLng)
    : null;
  const withinDeliveryZone = distanceToDropoff !== null && distanceToDropoff <= 150;

  function handleDeliverySubmit() {
    if (isUnattended) {
      if (!withinDeliveryZone) return toast("You must be within 150 m of the delivery point to confirm.", "error");
      const payload = {
        status: "delivered",
        no_photo_reason: "unattended",
        delivery_latitude: driverLat,
        delivery_longitude: driverLng,
        pod_signature_url: podSignatureUrl || undefined,
      };
      advance.mutate(payload);
      return;
    }
    if (!noCamera && !deliveryFiles.length) return toast("Upload at least one proof file, or toggle 'No camera'.", "error");
    if (deliveryCode.trim().length !== 6) return toast("Enter the 6-character delivery code.", "error");
    const photoUrls = deliveryFiles.length ? deliveryFiles.map(f => f.url).join(",") : undefined;
    const payload = {
      status: "delivered",
      delivery_photo_urls: photoUrls,
      delivery_code: deliveryCode.trim().toUpperCase(),
      pod_signature_url: podSignatureUrl || undefined,
      no_photo_reason: noCamera && !photoUrls ? "no_smartphone" : undefined,
    };
    if (position?.latitude && position?.longitude) {
      payload.delivery_latitude  = position.latitude;
      payload.delivery_longitude = position.longitude;
    }
    advance.mutate(payload);
  }

  if (isLoading) return <PageSpinner />;

  // No active job state
  if (!shipment) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white mb-6">Active Job</h1>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-heading font-semibold text-slate-700 dark:text-slate-200 text-lg mb-1">No Active Job</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Jobs you're dispatched on will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === shipment.status);
  const nextStatus = NEXT_STATUS[shipment.status];

  const _rawLat = position?.latitude  ?? shipment?.current_latitude;
  const _rawLng = position?.longitude ?? shipment?.current_longitude;
  const lat = typeof _rawLat === "number" && isFinite(_rawLat) ? _rawLat : null;
  const lng = typeof _rawLng === "number" && isFinite(_rawLng) ? _rawLng : null;
  const trailPoints  = trailData?.points
    ?.filter((p) => p?.lat != null && p?.lng != null)
    ?.map((p) => [p.lat, p.lng]) ?? [];
  const pickupLatLng = (typeof loadData?.pickup_latitude === "number" && typeof loadData?.pickup_longitude === "number")
    ? [loadData.pickup_latitude, loadData.pickup_longitude] : null;
  const dropoffLatLng = (typeof loadData?.dropoff_latitude === "number" && typeof loadData?.dropoff_longitude === "number")
    ? [loadData.dropoff_latitude, loadData.dropoff_longitude] : null;
  const boundsPoints  = [pickupLatLng, lat && lng ? [lat, lng] : null, dropoffLatLng].filter(Boolean);
  const center        = lat && lng ? [lat, lng] : NAIROBI;

  return (
    <div className="max-w-2xl w-full overflow-x-hidden">
      <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white mb-2">Active Job</h1>
      <div className="data-id mb-6">{shipment.id}</div>

      {/* Status timeline */}
      <div className="card-accent p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold">Status</h2>
          <StatusBadge status={shipment.status} />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_STEPS.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center">
                <div className={`status-timeline-dot ${
                  idx <= currentIdx ? "border-secondary bg-secondary" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                }`} />
                <span className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">{step.label}</span>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={`h-0.5 w-6 mb-4 shrink-0 ${idx < currentIdx ? "bg-secondary" : "bg-slate-200 dark:bg-slate-600"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Hardware tracker offline banner (rideshare-style fallback prompt) ── */}
      {!hardwareTrackerOnline && !phoneBannerDismissed && shipment && (
        <div className="card p-4 mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-4 h-4 text-amber-600" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Hardware tracker offline</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {phoneTrackingEnabled
                  ? "📍 Using your phone as backup tracker — location is being shared."
                  : "Enable your phone's location as a backup so the shipper can track this delivery."}
              </p>
            </div>
            {!phoneTrackingEnabled ? (
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setPhoneTrackingEnabled(true);
                    sessionStorage.setItem("trakvora_phone_gps", "true");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  Enable Phone GPS
                </button>
                <button
                  onClick={() => {
                    setPhoneBannerDismissed(true);
                    sessionStorage.setItem("trakvora_phone_banner_dismissed", "true");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setPhoneTrackingEnabled(false);
                  sessionStorage.setItem("trakvora_phone_gps", "false");
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* GPS status */}
      {position ? (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              position.accuracy == null ? "bg-slate-300" :
              position.accuracy < 20 ? "bg-teal-500" :
              position.accuracy < 50 ? "bg-amber-400" : "bg-red-500"
            }`} />
            <Navigation className="w-4 h-4 text-secondary" />
            <span className="font-heading font-semibold text-sm text-slate-800 dark:text-slate-100">
              {phoneTrackingEnabled ? "📍 Phone Tracking Active" : "Location Active"}
            </span>
          </div>
          <div className="font-mono text-sm text-slate-700 dark:text-slate-200 mb-1">
            {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            {position.accuracy != null && <span>Accuracy: ±{Math.round(position.accuracy)} m</span>}
            {position.speed   != null && <span>Speed: {Math.round(position.speed)} km/h</span>}
            {position.heading != null && <span>Heading: {Math.round(position.heading)}°</span>}
            <span className="text-slate-400">· {(position.speed ?? 0) > 2 ? "Sending every 5 s" : "Stationary — every 30 s"}</span>
          </div>
        </div>
      ) : (
        <div className="card p-4 mb-4 flex items-center gap-2 text-sm text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0 animate-pulse" />
          <Navigation className="w-4 h-4" />
          Waiting for GPS fix…
        </div>
      )}

      {/* Navigation panel */}
      {loadData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <Route className="w-4 h-4 text-secondary" />
            <span className="font-heading font-semibold text-sm text-slate-800 dark:text-slate-100">Navigation</span>
            {loadData.corridor && (
              <span className="ml-auto text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{loadData.corridor}</span>
            )}
          </div>
          <div className="p-4 space-y-3">
            {/* Pickup */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{loadData.pickup_location}</p>
                {loadData.pickup_date && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {loadData.pickup_date}{loadData.pickup_window ? ` · ${loadData.pickup_window}` : ""}
                  </p>
                )}
              </div>
              {loadData.pickup_latitude && loadData.pickup_longitude && (
                <button
                  onClick={() => openMapsNavigation(loadData.pickup_latitude, loadData.pickup_longitude)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="w-3 h-3" /> Navigate
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pl-3.5">
              <div className="w-0.5 h-5 bg-slate-200" />
              <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              {loadData.distance_km && (
                <span className="text-xs text-slate-400">{loadData.distance_km.toLocaleString()} km</span>
              )}
            </div>

            {/* Dropoff */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drop-off</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{loadData.dropoff_location}</p>
                {loadData.delivery_date && (
                  <p className="text-xs text-slate-400 mt-0.5">Est. delivery: {loadData.delivery_date}</p>
                )}
              </div>
              {loadData.dropoff_latitude && loadData.dropoff_longitude && (
                <button
                  onClick={() => openMapsNavigation(loadData.dropoff_latitude, loadData.dropoff_longitude)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="w-3 h-3" /> Navigate
                </button>
              )}
            </div>

            {/* Cargo summary */}
            <div className="flex items-center gap-2 mt-1 pt-3 border-t border-slate-100 dark:border-slate-700">
              <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 capitalize">{loadData.cargo_type}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{loadData.weight_tonnes}t</span>
            </div>
            {(loadData.shipper_company || loadData.shipper_name) && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <Building2 className="w-3 h-3 shrink-0" />
                <span>{loadData.shipper_company || loadData.shipper_name}</span>
                {loadData.shipper_company && loadData.shipper_name && (
                  <span className="text-slate-300">· {loadData.shipper_name}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipper contact */}
      {contactData?.shipper_phone && (
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Shipper Contact</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{contactData.shipper_name}</p>
              {contactData.shipper_company && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{contactData.shipper_company}</p>
              )}
            </div>
            <a
              href={`tel:${contactData.shipper_phone}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-semibold text-sm transition-colors"
            >
              <Phone className="w-4 h-4" />
              {contactData.shipper_phone}
            </a>
          </div>
        </div>
      )}

      {/* Route map */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-4 h-4 text-secondary" />
          <span className="font-heading font-semibold text-sm text-slate-800 dark:text-slate-100">Route Map</span>
          {loadData && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {loadData.pickup_location?.split(",")[0]} → {loadData.dropoff_location?.split(",")[0]}
            </span>
          )}
          <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setMapTab("leaflet")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mapTab === "leaflet" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Trail
            </button>
            <button
              onClick={() => setMapTab("google")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mapTab === "google" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Google
            </button>
          </div>
        </div>

        {mapTab === "leaflet" && (
          <FullscreenMapWrapper defaultHeight="260px" className="rounded-xl overflow-hidden border border-slate-200">
            <MapContainer center={center} zoom={10} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {trailPoints.length > 1 && (
                <Polyline positions={trailPoints} color="#4fdbcc" weight={3} opacity={0.75} smoothFactor={1.5} />
              )}
              {pickupLatLng && dropoffLatLng && (
                <Polyline positions={[pickupLatLng, dropoffLatLng]} color="#94a3b8" weight={2} opacity={0.5} dashArray="6 6" />
              )}
              {lat && lng && (
                <Marker position={[lat, lng]} icon={truckIcon}>
                  <Popup>🚛 Your position · {lat.toFixed(5)}, {lng.toFixed(5)}</Popup>
                </Marker>
              )}
              {pickupLatLng && (
                <Marker position={pickupLatLng} icon={pickupIcon}>
                  <Popup>📦 Pickup: {loadData?.pickup_location}</Popup>
                </Marker>
              )}
              {dropoffLatLng && (
                <Marker position={dropoffLatLng} icon={dropoffIcon}>
                  <Popup>🏁 Dropoff: {loadData?.dropoff_location}</Popup>
                </Marker>
              )}
              {boundsPoints.length >= 2 && <MapFitBounds points={boundsPoints} />}
            </MapContainer>
          </FullscreenMapWrapper>
        )}

        {mapTab === "google" && (
          <LiveTrackingGoogleMap
            pickupLocation={pickupLatLng ? { lat: pickupLatLng[0], lng: pickupLatLng[1] } : null}
            dropoffLocation={dropoffLatLng ? { lat: dropoffLatLng[0], lng: dropoffLatLng[1] } : null}
            trailPoints={trailData?.points ?? []}
            currentPosition={lat && lng ? { lat, lng } : null}
            height="260px"
          />
        )}
      </div>

      {/* Advance status */}
      {nextStatus && nextStatus !== "delivered" && (
        <Button
          onClick={() => advance.mutate({ status: nextStatus })}
          loading={advance.isPending}
          className="w-full justify-center"
        >
          <CheckCircle className="w-4 h-4" />
          Mark as {STATUS_STEPS.find((s) => s.key === nextStatus)?.label}
        </Button>
      )}

      {/* Delivery confirmation panel */}
      {nextStatus === "delivered" && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-secondary" />
            <h3 className="font-heading font-semibold text-slate-900 text-sm">Delivery Confirmation</h3>
          </div>

          {/* Camera/document inputs — not shown for unattended deliveries */}
          {!isUnattended && (
            <>
              {/* Hidden document input (PDFs only — not camera captured) */}
              <input ref={docInputRef} type="file" accept=".pdf,image/*"
                className="hidden" multiple onChange={(e) => handleFileAdd(e, "doc")} />

              {/* Capture buttons: camera + document */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={uploading || deliveryFiles.filter(f => f.type !== "doc").length >= 3}
                  className="flex flex-col items-center gap-1.5 py-3 border-2 border-dashed border-[#4fdbcc] rounded-xl hover:bg-[#4fdbcc]/5 transition-colors disabled:opacity-40"
                >
                  <Camera className="w-5 h-5 text-[#4fdbcc]" />
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    {deliveryFiles.filter(f => f.type !== "doc").length === 0
                      ? "Camera"
                      : `Camera (${deliveryFiles.filter(f => f.type !== "doc").length}/3)`}
                  </span>
                </button>
                <button
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploading}
                  className="flex flex-col items-center gap-1.5 py-3 border border-dashed border-slate-300 rounded-xl hover:border-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50"
                >
                  <FileText className="w-5 h-5 text-secondary" />
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Document</span>
                </button>
              </div>

              {uploading && (
                <p className="text-xs text-slate-400 text-center animate-pulse">Uploading…</p>
              )}
            </>
          )}

          {/* File previews */}
          {deliveryFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {deliveryFiles.map((f, idx) => (
                <div key={idx} className="relative group">
                  {f.type === "photo" ? (
                    <img src={f.url} alt="proof" className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-20 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 flex flex-col items-center justify-center gap-1">
                      {f.type === "video"
                        ? <Camera className="w-5 h-5 text-slate-400" />
                        : <FileText className="w-5 h-5 text-slate-400" />}
                      <span className="text-[9px] text-slate-400 truncate px-1 max-w-full capitalize">{f.type}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Unattended delivery: GPS proximity stamp */}
          {isUnattended ? (
            <div className="space-y-3">
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                withinDeliveryZone
                  ? "border-green-300 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {withinDeliveryZone ? "Within delivery zone" : "Outside delivery zone"}
                </div>
                {distanceToDropoff !== null ? (
                  <p className="text-xs">
                    {withinDeliveryZone
                      ? `${Math.round(distanceToDropoff)} m from dropoff — GPS stamp will be recorded.`
                      : `${Math.round(distanceToDropoff)} m from dropoff. Move to within 150 m to confirm.`}
                  </p>
                ) : (
                  <p className="text-xs">Waiting for GPS signal…</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{new Date().toLocaleString("en-KE")}</span>
                {driverLat && driverLng && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono">{driverLat.toFixed(5)}, {driverLng.toFixed(5)}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No code required. Your GPS location, timestamp, and place name are recorded as proof of delivery.
              </p>
            </div>
          ) : (
            <>
              {/* Captured location + time (attended) */}
              {capturedAt && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(capturedAt.time).toLocaleString("en-KE")}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{capturedAt.lat.toFixed(5)}, {capturedAt.lng.toFixed(5)}</span>
                </div>
              )}

              {/* Recipient signature */}
              <SignaturePad
                onCapture={(dataUrl) => setPodSignatureUrl(dataUrl)}
                className="mb-1"
              />

              {/* No-camera toggle (basic phone / old device) */}
              <label className="flex items-center gap-3 cursor-pointer select-none py-2">
                <div
                  onClick={() => setNoCamera((v) => !v)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${noCamera ? "bg-secondary" : "bg-slate-200 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${noCamera ? "left-5" : "left-1"}`} />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  No camera / basic phone — submit code only
                </span>
              </label>

              {/* Delivery code input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Delivery Confirmation Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 8A2X7K"
                  value={deliveryCode}
                  onChange={(e) => setDeliveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="w-full text-center text-2xl font-mono font-black tracking-[0.4em] border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Get this code from the shipper before marking delivered.</p>
              </div>
            </>
          )}

          <Button
            onClick={handleDeliverySubmit}
            loading={advance.isPending}
            disabled={advance.isPending || (isUnattended ? !withinDeliveryZone : ((!noCamera && !deliveryFiles.length) || deliveryCode.length !== 6))}
            className="w-full justify-center"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm Delivery
          </Button>

          {/* Camera capture modal */}
          {showCamera && (
            <CameraCapture
              onCapture={async (blobs, mode) => {
                setShowCamera(false);
                setUploading(true);
                if (!capturedAt && position) {
                  setCapturedAt({ lat: position.latitude, lng: position.longitude, time: new Date().toISOString() });
                }
                try {
                  for (const blob of blobs) {
                    const ext  = mode === "video" ? "webm" : "jpg";
                    const file = new File([blob], `delivery_${Date.now()}.${ext}`, { type: blob.type });
                    let url;
                    if (mode === "video") url = (await driverApi.uploadVideo(file)).url;
                    else                  url = (await driverApi.uploadPhoto(file)).url;
                    setDeliveryFiles(prev => [...prev, { url, type: mode === "video" ? "video" : "photo", name: file.name }]);
                  }
                } catch {
                  toast("Upload failed. Try again.", "error");
                } finally {
                  setUploading(false);
                }
              }}
              onClose={() => setShowCamera(false)}
            />
          )}
        </div>
      )}

      {/* Delivered confirmation */}
      {shipment.status === "delivered" && (
        <div className="card p-5 mt-4 space-y-3">
          <div className="text-center">
            <CheckCircle className="w-10 h-10 text-teal-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-900 dark:text-white">Delivery Complete!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {shipment.escrow_released
                ? "Payment has been released to your fleet owner."
                : "Awaiting shipper confirmation to release payment."}
            </p>
          </div>

          {/* GPS delivery receipt for unattended jobs */}
          {(shipment.delivery_method === "unattended_gps" || shipment.delivery_method === "auto_tracker") && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GPS Delivery Receipt</p>
              {shipment.delivered_at && (
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{new Date(shipment.delivered_at).toLocaleString("en-KE")}</span>
                </div>
              )}
              {shipment.delivery_location_name && (
                <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{shipment.delivery_location_name}</span>
                </div>
              )}
              {shipment.delivery_latitude && shipment.delivery_longitude && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{shipment.delivery_latitude.toFixed(5)}, {shipment.delivery_longitude.toFixed(5)}</span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                {shipment.delivery_method === "auto_tracker"
                  ? "Confirmed automatically by your truck's GPS tracker."
                  : "Confirmed by your GPS location at the dropoff point."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
