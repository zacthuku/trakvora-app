import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, Navigation, Navigation2, Wifi, WifiOff } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "@/services/apiClient";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { truckIcon, pickupIcon, dropoffIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import PlaybackTimeline from "@/components/tracking/PlaybackTimeline";
import { toast } from "@/components/ui/Toast";

function MapFlyTo({ lat, lng }) {
  const map = useMap();
  map.flyTo([lat, lng], map.getZoom(), { duration: 1 });
  return null;
}

function MapFitBounds({ points }) {
  const map = useMap();
  if (points.length >= 2) {
    map.fitBounds(points, { padding: [40, 40] });
  }
  return null;
}

export default function TrackingPage() {
  const { shipmentId } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("token");

  const { lastMessage, connected } = useTrackingSocket(shareToken ? null : shipmentId);
  const [playbackPoint, setPlaybackPoint] = useState(null);
  const [deliveryCode, setDeliveryCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["shipment-track", shipmentId, shareToken],
    queryFn: () => {
      if (shareToken) {
        return apiClient
          .get(`/shipments/public/${shipmentId}?share_token=${encodeURIComponent(shareToken)}`)
          .then((r) => r.data);
      }
      return apiClient.get(`/shipments/${shipmentId}`).then((r) => r.data);
    },
    refetchInterval: 30000,
    retry: false,
  });

  const { data: trailData } = useQuery({
    queryKey: ["tracking-trail", shipmentId, shareToken],
    queryFn: () => {
      if (shareToken) {
        return apiClient
          .get(`/tracking/public/${shipmentId}/trail?share_token=${encodeURIComponent(shareToken)}`)
          .then((r) => r.data);
      }
      return apiClient.get(`/tracking/${shipmentId}/trail`).then((r) => r.data);
    },
    enabled: Boolean(shipmentId),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: load } = useQuery({
    queryKey: ["load-for-track", shipment?.load_id],
    queryFn: () => apiClient.get(`/loads/${shipment.load_id}`).then((r) => r.data),
    enabled: Boolean(shipment?.load_id) && !shareToken,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/shipments/public/${shipmentId}/confirm-delivery`, {
          share_token: shareToken,
          delivery_code: deliveryCode.trim().toUpperCase(),
        })
        .then((r) => r.data),
    onSuccess: () => {
      setConfirmed(true);
      toast("Delivery confirmed. Thank you!", "success");
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      if (detail === "Invalid delivery code") {
        toast("Incorrect delivery code. Please check with the shipper.", "error");
      } else if (detail === "Delivery already confirmed") {
        toast("This delivery has already been confirmed.", "warning");
      } else {
        toast(detail || "Confirmation failed. Try again.", "error");
      }
    },
  });

  if (isLoading) return <PageSpinner />;
  if (!shipment) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <div className="text-center text-slate-500">
          <Navigation className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium">Tracking link not found or has expired.</p>
        </div>
      </div>
    );
  }

  const lat = playbackPoint?.lat ?? lastMessage?.latitude ?? shipment.current_latitude;
  const lng = playbackPoint?.lng ?? lastMessage?.longitude ?? shipment.current_longitude;

  const trailPoints = trailData?.points?.map((p) => [p.lat, p.lng]) ?? [];

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
    lat && lng ? [lat, lng] : null,
    dropoffLatLng,
  ].filter(Boolean);

  const STATUS_STEPS = [
    { key: "booked", label: "Booked" },
    { key: "en_route_pickup", label: "En Route" },
    { key: "loaded", label: "Loaded" },
    { key: "in_transit", label: "In Transit" },
    { key: "delivered", label: "Delivered" },
  ];
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === shipment.status);

  const showConfirmSection =
    shareToken &&
    shipment.status === "delivered" &&
    shipment.delivery_code &&
    !shipment.payment_confirmed_at &&
    !confirmed;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-slate-900">
              {shareToken ? "Shipment Tracking" : "Live Tracking"}
            </h1>
            <div className="data-id mt-1">{shipmentId}</div>
          </div>
          <div className="flex items-center gap-2">
            {!shareToken && (
              <>
                {connected ? (
                  <Wifi className="w-4 h-4 text-teal-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm text-slate-500">
                  {connected ? "Live" : "Polling"}
                </span>
              </>
            )}
            <StatusBadge status={shipment.status} />
          </div>
        </div>

        <div className="card-accent p-6 mb-6">
          <h2 className="font-heading font-semibold mb-4">Journey Progress</h2>
          <div className="flex items-center gap-2 overflow-x-auto">
            {STATUS_STEPS.map((step, idx) => (
              <div key={step.key} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`status-timeline-dot ${
                      idx <= currentIdx
                        ? "border-secondary bg-secondary"
                        : "border-slate-300 bg-white"
                    }`}
                  />
                  <span className="text-xs text-slate-500 mt-1">{step.label}</span>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-12 mb-4 ${
                      idx < currentIdx ? "bg-secondary" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {lat && lng ? (
          <div className="card p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Navigation2 className="w-4 h-4 text-secondary" />
              <h2 className="font-heading font-semibold">Current Location</h2>
            </div>
            <div className="font-data-mono text-sm text-slate-700 mb-1">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
            {shipment.eta && (
              <div className="text-sm text-slate-500 mb-3">
                ETA: {new Date(shipment.eta).toLocaleString()}
              </div>
            )}
            <FullscreenMapWrapper defaultHeight="340px" className="rounded-lg overflow-hidden">
              <MapContainer
                center={[lat, lng]}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {trailPoints.length > 1 && (
                  <Polyline positions={trailPoints} color="#4fdbcc" weight={3} opacity={0.75} smoothFactor={1.5} />
                )}

                <Marker position={[lat, lng]} icon={truckIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold mb-1">🚛 Truck Position</div>
                      <div className="font-mono text-xs text-slate-600">
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>

                {pickupLatLng && (
                  <Marker position={pickupLatLng} icon={pickupIcon}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold mb-1">📦 Pickup</div>
                        <div className="text-slate-600">{load?.pickup_location}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {dropoffLatLng && (
                  <Marker position={dropoffLatLng} icon={dropoffIcon}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold mb-1">🏁 Dropoff</div>
                        <div className="text-slate-600">{load?.dropoff_location}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {lastMessage?.latitude && lastMessage?.longitude && (
                  <MapFlyTo lat={lastMessage.latitude} lng={lastMessage.longitude} />
                )}

                {boundsPoints.length >= 2 && <MapFitBounds points={boundsPoints} />}
              </MapContainer>
            </FullscreenMapWrapper>
          </div>
        ) : (
          <div className="card p-8 text-center text-slate-500">
            <Navigation className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Waiting for driver location update…
          </div>
        )}

        {!shareToken && (
          <PlaybackTimeline
            shipmentId={shipmentId}
            onPoint={(pt) => setPlaybackPoint(pt)}
          />
        )}

        {/* Customer delivery confirmation — shown to anyone with a share link */}
        {confirmed || shipment.payment_confirmed_at ? (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800">Delivery confirmed</p>
              <p className="text-xs text-teal-600 mt-0.5">Thank you for confirming receipt of your goods.</p>
            </div>
          </div>
        ) : showConfirmSection ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Confirm Delivery</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the delivery code provided by the shipper to confirm you have received your goods.
            </p>
            <input
              type="text"
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={10}
              placeholder="Enter delivery code"
              className="w-full px-4 py-3 rounded-xl border border-amber-300 bg-white text-slate-900 font-mono text-lg tracking-widest text-center placeholder:text-slate-300 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-secondary mb-3"
            />
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={deliveryCode.length < 6 || confirmMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              {confirmMutation.isPending ? "Confirming…" : "Confirm Receipt"}
            </button>
          </div>
        ) : null}

        {!shareToken && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Driver</div>
              <div className="data-id">{shipment.driver_id?.slice(0, 8)}…</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Dispute</div>
              <div className={`text-sm font-medium ${shipment.dispute_open ? "text-red-600" : "text-teal-600"}`}>
                {shipment.dispute_open ? "Open" : "None"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
