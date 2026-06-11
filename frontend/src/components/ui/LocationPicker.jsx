import { useState, useRef, useCallback, useEffect } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { MapPin, Crosshair, Loader2, AlertCircle } from "lucide-react";
import { useGoogleMaps } from "@/components/map/GoogleMapsProvider";

const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 }; // Nairobi
const COUNTRY_CODES = ["ke", "ug", "tz", "rw", "et"];
const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControlOptions: { position: 9 },
  mapId: "trakvora_map",
};

function reverseGeocode(lat, lng, onResult) {
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    const name =
      status === "OK" && results[0]
        ? results[0].formatted_address
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    onResult({ name, lat, lng });
  });
}

// Attaches legacy google.maps.places.Autocomplete to a plain <input>.
// Reliable across all API-key configurations; Places API (legacy) is sufficient.
function PlaceSearch({ onSelect }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: COUNTRY_CODES },
      fields: ["geometry", "formatted_address", "name"],
    });

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place?.geometry?.location) {
        onSelect({
          name: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search for a location…"
      autoComplete="off"
      className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none
                 focus:border-[#fe6a34] focus:shadow-[0_0_0_2px_rgb(254_106_52/0.2)]
                 placeholder:text-slate-400 transition-[border-color,box-shadow] duration-150"
    />
  );
}

// Renders an AdvancedMarkerElement imperatively onto the map.
function MapMarker({ map, position }) {
  useEffect(() => {
    if (!map || !position) return;
    let marker = null;

    async function init() {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
      marker = new AdvancedMarkerElement({ map, position });
    }

    init();

    return () => {
      if (marker) marker.map = null;
    };
  }, [map, position]);

  return null;
}

export default function LocationPicker({ label, value, onChange }) {
  const [mapInstance, setMapInstance] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const { isLoaded, loadError } = useGoogleMaps();

  const marker = value?.lat ? { lat: value.lat, lng: value.lng } : null;

  const handleMapClick = useCallback(
    (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      reverseGeocode(lat, lng, onChange);
    },
    [onChange]
  );

  const handlePlaceSelected = useCallback(
    (loc) => {
      mapInstance?.panTo({ lat: loc.lat, lng: loc.lng });
      mapInstance?.setZoom(14);
      onChange(loc);
    },
    [mapInstance, onChange]
  );

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by this browser.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapInstance?.panTo({ lat, lng });
        mapInstance?.setZoom(15);
        reverseGeocode(lat, lng, (loc) => {
          onChange(loc);
          setLocating(false);
        });
      },
      (err) => {
        setGeoError(err.message || "Could not get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [mapInstance, onChange]);

  if (loadError) {
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Google Maps failed to load. Check your API key.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <div className="w-full h-52 bg-slate-100 rounded-lg animate-pulse flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}

      {/* Search + current location row */}
      <div className="flex gap-2">
        <PlaceSearch onSelect={handlePlaceSelected} />

        <button
          type="button"
          onClick={handleCurrentLocation}
          disabled={locating}
          title="Use my current location"
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {locating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Crosshair className="w-4 h-4" />
          }
          My Location
        </button>
      </div>

      {geoError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {geoError}
        </p>
      )}

      {/* Interactive map */}
      <GoogleMap
        mapContainerClassName="w-full h-52 rounded-lg border border-slate-200 overflow-hidden"
        center={marker ?? DEFAULT_CENTER}
        zoom={marker ? 14 : 6}
        onClick={handleMapClick}
        onLoad={setMapInstance}
        options={MAP_OPTIONS}
      >
        {marker && <MapMarker map={mapInstance} position={marker} />}
      </GoogleMap>

      {/* Coordinates readout */}
      {value?.lat != null && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <MapPin className="w-3 h-3 text-secondary shrink-0" />
          <span>{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</span>
          {value.name && (
            <span className="truncate text-slate-500 not-italic">{value.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
