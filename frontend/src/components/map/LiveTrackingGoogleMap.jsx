import { useState, useEffect, useRef } from "react";
import { GoogleMap, DirectionsRenderer, Polyline, Circle } from "@react-google-maps/api";
import { Loader2, Navigation2 } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapId: "trakvora_tracking_map",
};

const TRAIL_OPTIONS = {
  strokeColor: "#4fdbcc",
  strokeWeight: 3,
  strokeOpacity: 0.8,
};

export default function LiveTrackingGoogleMap({
  pickupLocation,
  dropoffLocation,
  trailPoints = [],
  currentPosition,
  height = "300px",
}) {
  const { isLoaded } = useGoogleMaps();
  const [mapInstance, setMapInstance] = useState(null);
  const [directions, setDirections] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const truckMarkerRef = useRef(null);
  const prevRouteKey = useRef(null);

  // Fetch planned route once pickup+dropoff are known
  useEffect(() => {
    if (!isLoaded || !pickupLocation?.lat || !dropoffLocation?.lat || !window.google) return;

    const key = `${pickupLocation.lat},${pickupLocation.lng}|${dropoffLocation.lat},${dropoffLocation.lng}`;
    if (key === prevRouteKey.current) return;
    prevRouteKey.current = key;

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: pickupLocation.lat, lng: pickupLocation.lng },
        destination: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK") setDirections(result);
      }
    );
  }, [isLoaded, pickupLocation?.lat, pickupLocation?.lng, dropoffLocation?.lat, dropoffLocation?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Truck marker — update imperatively to avoid full re-render
  useEffect(() => {
    if (!isLoaded || !mapInstance || !currentPosition || !window.google) return;
    let cancelled = false;

    async function update() {
      const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker");
      if (cancelled) return;

      if (!truckMarkerRef.current) {
        const pin = new PinElement({
          background: "#fe6a34",
          borderColor: "#ea580c",
          glyphColor: "#fff",
        });
        truckMarkerRef.current = new AdvancedMarkerElement({
          map: mapInstance,
          position: currentPosition,
          title: "Truck",
          content: pin.element,
          zIndex: 999,
        });
      } else {
        truckMarkerRef.current.position = currentPosition;
      }

      if (autoFollow) {
        mapInstance.panTo(currentPosition);
      }
    }

    update();
    return () => { cancelled = true; };
  }, [isLoaded, mapInstance, currentPosition?.lat, currentPosition?.lng, autoFollow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (truckMarkerRef.current) truckMarkerRef.current.map = null; };
  }, []);

  if (!isLoaded) {
    return (
      <div
        className="w-full bg-slate-100 rounded-xl flex items-center justify-center gap-2"
        style={{ height }}
      >
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading map…</span>
      </div>
    );
  }

  const center = currentPosition ?? pickupLocation ?? { lat: -1.2921, lng: 36.8219 };
  const trailPath = trailPoints.map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={center}
        zoom={currentPosition ? 12 : 8}
        onLoad={setMapInstance}
        options={MAP_OPTIONS}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              polylineOptions: {
                strokeColor: "#94a3b8",
                strokeWeight: 2,
                strokeOpacity: 0.5,
              },
              suppressMarkers: false,
            }}
          />
        )}
        {trailPath.length > 1 && (
          <Polyline path={trailPath} options={TRAIL_OPTIONS} />
        )}
        {/* Pickup zone — blue 500m circle */}
        {pickupLocation?.lat && (
          <Circle
            center={{ lat: pickupLocation.lat, lng: pickupLocation.lng }}
            radius={500}
            options={{
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
              strokeColor: "#3b82f6",
              strokeOpacity: 0.5,
              strokeWeight: 1.5,
            }}
          />
        )}
        {/* Dropoff / delivery zone — green 500m circle */}
        {dropoffLocation?.lat && (
          <Circle
            center={{ lat: dropoffLocation.lat, lng: dropoffLocation.lng }}
            radius={500}
            options={{
              fillColor: "#22c55e",
              fillOpacity: 0.15,
              strokeColor: "#22c55e",
              strokeOpacity: 0.6,
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>

      <button
        onClick={() => setAutoFollow((v) => !v)}
        className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow transition-colors ${
          autoFollow
            ? "bg-secondary text-white"
            : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
        }`}
      >
        <Navigation2 className="w-3 h-3" />
        {autoFollow ? "Following" : "Follow"}
      </button>
    </div>
  );
}
