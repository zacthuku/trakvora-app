import { useState, useEffect, useRef } from "react";
import { GoogleMap, DirectionsRenderer, Circle } from "@react-google-maps/api";
import { Loader2, Route } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapId: "trakvora_route_map",
};

export default function RoutePreviewMap({
  origin,
  destination,
  onDistanceResolved,
  height = "280px",
}) {
  const { isLoaded } = useGoogleMaps();
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const prevRouteKey = useRef(null);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    if (!origin?.lat || !destination?.lat) return;

    const key = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
    if (key === prevRouteKey.current) return;
    prevRouteKey.current = key;

    setDirections(null);
    setRouteInfo(null);
    setRouteError(null);

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            const distKm = Math.round(leg.distance.value / 1000);
            setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text, distKm });
            onDistanceResolved?.(distKm);
          }
        } else {
          setRouteError("Could not calculate route. Check your Google Maps API key.");
        }
      }
    );
  }, [isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!origin?.lat || !destination?.lat) return null;

  const center = { lat: origin.lat, lng: origin.lng };

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={center}
        zoom={7}
        options={MAP_OPTIONS}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              polylineOptions: {
                strokeColor: "#fe6a34",
                strokeWeight: 4,
                strokeOpacity: 0.85,
              },
            }}
          />
        )}
        {origin?.lat && (
          <Circle
            center={{ lat: origin.lat, lng: origin.lng }}
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
        {destination?.lat && (
          <Circle
            center={{ lat: destination.lat, lng: destination.lng }}
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

      {routeInfo && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-1.5 shadow-md flex items-center gap-3 text-xs font-semibold text-slate-700 pointer-events-none whitespace-nowrap">
          <Route className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span>{routeInfo.distance}</span>
          <span className="text-slate-300">·</span>
          <span>{routeInfo.duration} drive</span>
        </div>
      )}

      {!routeInfo && !routeError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 rounded-full px-3 py-1.5 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            <span className="text-xs text-slate-400">Calculating route…</span>
          </div>
        </div>
      )}

      {routeError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 rounded-xl pointer-events-none">
          <p className="text-xs text-red-500 text-center px-4">{routeError}</p>
        </div>
      )}
    </div>
  );
}
