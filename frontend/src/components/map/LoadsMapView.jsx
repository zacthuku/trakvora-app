import { useState, useEffect, useRef } from "react";
import { GoogleMap, Circle } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";

const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapId: "trakvora_loads_map",
};

function LoadMarkers({ mapInstance, loads, selectedLoadId, onLoadClick }) {
  const markersRef = useRef([]);
  const iwRef = useRef(null);

  // Stable key to avoid unnecessary re-runs
  const loadsKey = loads.map((l) => l.id + (l.id === selectedLoadId ? "*" : "")).join(",");

  useEffect(() => {
    if (!mapInstance || !window.google) return;
    let cancelled = false;

    async function build() {
      const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker");
      if (cancelled) return;

      markersRef.current.forEach(({ marker }) => { marker.map = null; });
      markersRef.current = [];

      if (!iwRef.current) {
        iwRef.current = new window.google.maps.InfoWindow();
      }
      const iw = iwRef.current;

      for (const load of loads) {
        if (!load.pickup_latitude || !load.pickup_longitude) continue;
        const isSelected = selectedLoadId === load.id;

        const pin = new PinElement({
          background: isSelected ? "#fe6a34" : "#22c55e",
          borderColor: isSelected ? "#ea580c" : "#16a34a",
          glyphColor: "#fff",
          scale: isSelected ? 1.2 : 1,
        });

        const marker = new AdvancedMarkerElement({
          map: mapInstance,
          position: { lat: load.pickup_latitude, lng: load.pickup_longitude },
          title: load.pickup_location,
          content: pin.element,
        });

        const pickup = load.pickup_location?.split(",")[0] || load.pickup_location;
        const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

        marker.addEventListener("gmp-click", () => {
          iw.setContent(
            `<div style="font-family:sans-serif;font-size:13px;min-width:160px;padding:2px 0">
               <div style="font-weight:700;color:#0f172a;margin-bottom:4px">${pickup} → ${dropoff}</div>
               <div style="color:#64748b;margin-bottom:3px;text-transform:capitalize">${load.cargo_type} · ${load.weight_tonnes}t</div>
               <div style="color:#fe6a34;font-weight:700;font-size:14px">KES ${Number(load.price_kes).toLocaleString()}</div>
               ${load.distance_km ? `<div style="color:#94a3b8;font-size:11px;margin-top:2px">${load.distance_km} km</div>` : ""}
             </div>`
          );
          iw.open(mapInstance, marker);
          onLoadClick?.(load);
        });

        markersRef.current.push({ marker });
      }
    }

    build();
    return () => { cancelled = true; };
  }, [mapInstance, loadsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      markersRef.current.forEach(({ marker }) => { marker.map = null; });
      iwRef.current?.close();
    };
  }, []);

  return null;
}

function DriverMarker({ mapInstance, position }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapInstance || !position || !window.google) return;
    let cancelled = false;

    async function init() {
      const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker");
      if (cancelled) return;

      if (!markerRef.current) {
        const pin = new PinElement({
          background: "#3b82f6",
          borderColor: "#1d4ed8",
          glyphColor: "#fff",
        });
        markerRef.current = new AdvancedMarkerElement({
          map: mapInstance,
          position,
          title: "Your location",
          content: pin.element,
          zIndex: 999,
        });
      } else {
        markerRef.current.position = position;
      }
    }

    init();
    return () => { cancelled = true; };
  }, [mapInstance, position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (markerRef.current) markerRef.current.map = null; };
  }, []);

  return null;
}

export default function LoadsMapView({
  loads = [],
  driverPosition,
  onLoadClick,
  radiusKm,
  selectedLoadId,
}) {
  const { isLoaded } = useGoogleMaps();
  const [mapInstance, setMapInstance] = useState(null);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading map…</span>
      </div>
    );
  }

  const center = driverPosition ?? DEFAULT_CENTER;
  const zoom = driverPosition ? 9 : 6;

  return (
    <GoogleMap
      mapContainerClassName="w-full h-full rounded-xl"
      center={center}
      zoom={zoom}
      onLoad={setMapInstance}
      options={MAP_OPTIONS}
    >
      <LoadMarkers
        mapInstance={mapInstance}
        loads={loads}
        selectedLoadId={selectedLoadId}
        onLoadClick={onLoadClick}
      />
      <DriverMarker mapInstance={mapInstance} position={driverPosition} />
      {driverPosition && radiusKm && (
        <Circle
          center={driverPosition}
          radius={radiusKm * 1000}
          options={{
            strokeColor: "#fe6a34",
            strokeOpacity: 0.4,
            strokeWeight: 1.5,
            fillColor: "#fe6a34",
            fillOpacity: 0.05,
          }}
        />
      )}
    </GoogleMap>
  );
}
