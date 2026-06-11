import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useGoogleMaps } from "@/components/map/GoogleMapsProvider";

const COUNTRY_CODES = ["ke", "ug", "tz", "rw", "et"];

/**
 * Thin wrapper around the legacy google.maps.places.Autocomplete attached to a
 * plain <input>.  This fires the well-tested `place_changed` event synchronously
 * on dropdown selection and gives us a fully-populated Place object (including
 * geometry) without any extra fetchFields() call.
 *
 * Note: the legacy Autocomplete class is deprecated in favour of
 * PlaceAutocompleteElement, but it remains fully functional and is far more
 * reliable across all API-key configurations (Places API only, no "New" needed).
 */
function PlaceAutocompleteInput({ onConfirm, onFirstKeystroke, onError, placeholder }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: COUNTRY_CODES },
      fields: ["geometry", "formatted_address", "name"],
    });

    // Fired when user picks a suggestion OR presses Enter
    const placeListener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();

      if (place?.geometry?.location) {
        // Happy path — dropdown item selected
        onConfirm({
          name: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
        return;
      }

      // Fallback: user pressed Enter without selecting a suggestion.
      // Try to geocode whatever text is in the input.
      const text = inputRef.current?.value?.trim();
      if (text && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: text }, (results, status) => {
          if (status === "OK" && results[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            onConfirm({
              name: results[0].formatted_address || text,
              lat: loc.lat(),
              lng: loc.lng(),
            });
          } else {
            onError("Could not find that location — please select a suggestion from the dropdown.");
          }
        });
      }
    });

    // Clear resolve error and show the dropdown hint on every keystroke
    const handleKeydown = () => onFirstKeystroke();
    const inputEl = inputRef.current;
    inputEl.addEventListener("keydown", handleKeydown);

    return () => {
      window.google.maps.event.removeListener(placeListener);
      inputEl.removeEventListener("keydown", handleKeydown);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      autoComplete="off"
      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white outline-none
                 focus:border-[#fe6a34] focus:shadow-[0_0_0_3px_rgb(254_106_52/0.15)]
                 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150"
    />
  );
}

export default function LocationSearch({ label, value, onChange, placeholder }) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [hasTyped, setHasTyped] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  function handleConfirm(loc) {
    setResolveError(null);
    setHasTyped(false); // reset so hint doesn't re-appear until they type again
    onChange(loc);
  }

  if (loadError) {
    return (
      <div>
        {label && (
          <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {label}
          </span>
        )}
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Maps failed to load. Check your API key.
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </span>
      )}

      {!isLoaded ? (
        <div className="w-full h-11 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse flex items-center px-3 gap-2">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          <span className="text-xs text-slate-400 dark:text-slate-500">Loading maps…</span>
        </div>
      ) : (
        <PlaceAutocompleteInput
          onConfirm={handleConfirm}
          onFirstKeystroke={() => { setHasTyped(true); setResolveError(null); }}
          onError={setResolveError}
          placeholder={placeholder || "Search for a location…"}
        />
      )}

      {/* Confirmed location */}
      {value?.lat != null && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{value.name}</span>
          <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-auto">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </div>
      )}

      {/* Resolve error */}
      {resolveError && (
        <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {resolveError}
        </p>
      )}

      {/* Hint: only after first keystroke, only while unconfirmed, no error */}
      {hasTyped && value?.lat == null && !resolveError && (
        <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Select a result from the dropdown to confirm
        </p>
      )}
    </div>
  );
}
