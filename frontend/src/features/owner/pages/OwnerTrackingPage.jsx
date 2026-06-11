import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Navigation2, Wifi, WifiOff,
  ArrowRight, GripHorizontal, ZoomIn, Truck, User,
  Package, Clock, Camera, CheckCircle, Lock, X, FileText,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "@/services/apiClient";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import { useCurrency } from "@/hooks/useCurrency";
import { truckIcon, pickupIcon, dropoffIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { ownerApi } from "@/features/owner/api/ownerApi";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

const STATUS_STEPS = [
  { key: "booked",          label: "Booked",     desc: "Carrier confirmed, awaiting dispatch" },
  { key: "en_route_pickup", label: "En Route",   desc: "Driver heading to pickup location" },
  { key: "loaded",          label: "Loaded",     desc: "Cargo loaded and secured" },
  { key: "in_transit",      label: "In Transit", desc: "Truck is moving to destination" },
  { key: "delivered",       label: "Delivered",  desc: "Delivery complete" },
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

function ResizableMap({ lat, lng, shipmentId, load }) {
  const { lastMessage, connected } = useTrackingSocket(shipmentId);
  const liveLat = lastMessage?.latitude ?? lat;
  const liveLng = lastMessage?.longitude ?? lng;
  const [autoFollow, setAutoFollow] = useState(true);

  const containerRef = useRef(null);
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

  const boundsPoints = [
    pickupLatLng,
    liveLat && liveLng ? [liveLat, liveLng] : null,
    dropoffLatLng,
  ].filter(Boolean);

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
          {trailPoints.length > 1 && (
            <Polyline positions={trailPoints} color="#4fdbcc" weight={3} opacity={0.75} smoothFactor={1.5} />
          )}
          <Marker position={[liveLat, liveLng]} icon={truckIcon}>
            <Popup>🚛 Truck · {liveLat.toFixed(5)}, {liveLng.toFixed(5)}</Popup>
          </Marker>
          {pickupLatLng && (
            <Marker position={pickupLatLng} icon={pickupIcon}>
              <Popup>📦 Pickup: {load?.pickup_location}</Popup>
            </Marker>
          )}
          {dropoffLatLng && (
            <Marker position={dropoffLatLng} icon={dropoffIcon}>
              <Popup>🏁 Dropoff: {load?.dropoff_location}</Popup>
            </Marker>
          )}
          {autoFollow && lastMessage?.latitude && lastMessage?.longitude && (
            <MapFlyTo lat={liveLat} lng={liveLng} />
          )}
          {boundsPoints.length >= 2 && <MapFitBounds points={boundsPoints} />}
        </MapContainer>
      </FullscreenMapWrapper>

      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-center h-6 cursor-row-resize hover:bg-slate-100 dark:hover:bg-slate-700 rounded-b-xl transition-colors group"
        title="Drag to resize map"
      >
        <GripHorizontal className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>

      <p className="text-[10px] text-slate-400 font-mono mt-1 text-right flex items-center justify-end gap-1">
        <ZoomIn className="w-3 h-3" />
        {liveLat.toFixed(6)}, {liveLng.toFixed(6)}
        {shipmentId && ` · ${shipmentId.slice(0, 8).toUpperCase()}`}
      </p>
    </div>
  );
}

export default function OwnerTrackingPage() {
  const { format } = useCurrency();
  const { distance_unit: distUnit } = useCountryConfig();
  const { loadId } = useParams();
  const qc = useQueryClient();

  // Proxy delivery state (for drivers without smartphones)
  const [proxyFiles, setProxyFiles] = useState([]);   // [{url, name}]
  const [proxyCode, setProxyCode]   = useState("");
  const [proxyUploading, setProxyUploading] = useState(false);
  const proxyFileInputRef = useRef(null);

  const proxyDeliveryMutation = useMutation({
    mutationFn: ({ shipmentId, photoUrls, code }) =>
      ownerApi.submitDelivery(shipmentId, {
        status: "delivered",
        delivery_photo_urls: photoUrls || undefined,
        delivery_code: code,
        no_photo_reason: !photoUrls ? "no_smartphone" : undefined,
      }),
    onSuccess: () => {
      toast("Delivery marked — awaiting shipper confirmation");
      qc.invalidateQueries({ queryKey: ["owner-load-track", loadId] });
      qc.invalidateQueries({ queryKey: ["owner-shipment-by-load", loadId] });
      setProxyFiles([]);
      setProxyCode("");
    },
    onError: (err) => toast(err.response?.data?.detail || "Failed to submit delivery", "error"),
  });

  async function handleProxyFileAdd(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setProxyUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const { url } = await apiClient.post("/uploads/photo", form, {
          headers: { "Content-Type": "multipart/form-data" },
        }).then((r) => r.data);
        setProxyFiles((prev) => [...prev, { url, name: file.name }]);
      }
    } catch {
      toast("Upload failed. Try again.", "error");
    } finally {
      setProxyUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  function handleProxySubmit() {
    if (proxyCode.trim().length !== 6) return toast("Enter the 6-character delivery code.", "error");
    const photoUrls = proxyFiles.map((f) => f.url).join(",") || null;
    proxyDeliveryMutation.mutate({ shipmentId: shipment?.id, photoUrls, code: proxyCode.trim().toUpperCase() });
  }

  const { data: load, isLoading } = useQuery({
    queryKey: ["owner-load-track", loadId],
    queryFn: () => apiClient.get(`/loads/${loadId}`).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: shipment } = useQuery({
    queryKey: ["owner-shipment-by-load", loadId],
    queryFn: () => apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data),
    enabled: Boolean(load),
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: driverUser } = useQuery({
    queryKey: ["driver-user-public", shipment?.driver_id],
    queryFn: () => apiClient.get(`/users/${shipment.driver_id}/public`).then((r) => r.data),
    enabled: Boolean(shipment?.driver_id),
  });

  const { data: truck } = useQuery({
    queryKey: ["truck-detail", shipment?.truck_id],
    queryFn: () => apiClient.get(`/trucks/${shipment.truck_id}`).then((r) => r.data),
    enabled: Boolean(shipment?.truck_id),
  });

  if (isLoading) {
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

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-5">
        <Link
          to="/owner/loads"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Active Loads
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
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Pickup</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.pickup_location}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Dropoff</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{load.dropoff_location}</p>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
        <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm mb-5">Journey Progress</h2>

        <div className="relative flex items-start justify-between mb-5">
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
          <div
            className="absolute top-3 left-0 h-0.5 z-0 bg-secondary transition-all duration-500"
            style={{ width: currentIdx < 0 ? "0%" : `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
          />
          {STATUS_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  done || active
                    ? `${dotColor} border-transparent`
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
                } ${active ? "ring-4 ring-secondary/20 scale-110" : ""}`}>
                  {done && <span className="text-white text-[10px]">✓</span>}
                  {active && <span className={`w-2 h-2 rounded-full bg-white ${isInTransit ? "animate-pulse" : ""}`} />}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 text-center leading-tight ${
                  active ? "text-slate-900 dark:text-white" : done ? "text-secondary" : "text-slate-400"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

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
            {shipment?.eta && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">ETA</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(shipment.eta).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live map */}
      {isTracking && hasLocation ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
          <ResizableMap lat={lat} lng={lng} shipmentId={shipment?.id} load={load} />
        </div>
      ) : isTracking && !hasLocation ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 mb-5 text-center">
          <Navigation2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Waiting for driver to share location…</p>
          <p className="text-xs text-slate-400 mt-1">Location updates every 30 seconds</p>
        </div>
      ) : null}

      {/* Driver + Truck info */}
      {(driverUser || truck) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
          <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4">Carrier Details</h2>
          <div className="flex flex-col gap-3">
            {driverUser && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Driver</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{driverUser.full_name}</p>
                </div>
              </div>
            )}
            {truck && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#4fdbcc]/10 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-[#4fdbcc]" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Truck</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {truck.registration_number}
                    <span className="font-normal text-slate-500 dark:text-slate-400 ml-1.5">· {truck.truck_type?.replace(/_/g, " ")} · {truck.capacity_tonnes}t</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner proxy delivery panel — for drivers without smartphones */}
      {load.status === "in_transit" && shipment && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-4 h-4 text-secondary" />
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Submit Delivery on Behalf of Driver
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Use this if your driver does not have a smartphone. Get the delivery code from the shipper, optionally add photos, then submit.
          </p>

          {/* Hidden file input */}
          <input
            ref={proxyFileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={handleProxyFileAdd}
          />

          {/* Photo upload button */}
          <button
            onClick={() => proxyFileInputRef.current?.click()}
            disabled={proxyUploading}
            className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50 mb-3 justify-center"
          >
            <Camera className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {proxyUploading ? "Uploading…" : proxyFiles.length > 0 ? `${proxyFiles.length} photo(s) added — add more` : "Add Delivery Photos (optional)"}
            </span>
          </button>

          {/* Photo previews */}
          {proxyFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {proxyFiles.map((f, i) => (
                <div key={i} className="relative group">
                  <img src={f.url} alt="proof" className="w-full h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                  <button
                    onClick={() => setProxyFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Delivery code */}
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Delivery Code (from shipper)
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. 8A2X7K"
              value={proxyCode}
              onChange={(e) => setProxyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              className="w-full text-center text-2xl font-mono font-black tracking-[0.4em] border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition"
            />
          </div>

          <Button
            onClick={handleProxySubmit}
            loading={proxyDeliveryMutation.isPending}
            disabled={proxyCode.length !== 6 || proxyDeliveryMutation.isPending}
            className="w-full justify-center"
          >
            <CheckCircle className="w-4 h-4" />
            Submit Delivery for Driver
          </Button>
        </div>
      )}

      {/* Delivered banner for owner */}
      {load.status === "delivered" && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-800">Delivery complete</p>
            <p className="text-xs text-teal-600 mt-0.5">Awaiting shipper payment confirmation.</p>
          </div>
        </div>
      )}

      {/* Shipment details */}
      {shipment && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4">Shipment Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Payment",  value: shipment.escrow_released ? "Released" : "Pending", ok: shipment.escrow_released },
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
          {shipment.payment_confirmed_at && (
            <div className="flex items-center gap-2 mt-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
              <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
              <p className="text-sm font-semibold text-teal-700">Payment confirmed by shipper</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
