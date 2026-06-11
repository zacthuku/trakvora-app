import { useQuery } from "@tanstack/react-query";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Reverse-geocodes a lat/lng pair to a human-readable label.
 *
 * Uses Google Maps Geocoding API when a key is available (VITE_GOOGLE_MAPS_API_KEY),
 * otherwise falls back to Nominatim — but Nominatim is rate-limited to 1 req/s,
 * so callers should be careful not to mount many instances simultaneously.
 *
 * ⚠️  Do NOT call this for every card in a long list on mount.
 *     Use it only for modals/detail views (one at a time).
 *
 * Results are cached indefinitely in the React Query cache (staleTime: Infinity)
 * so the same coordinate pair is only ever fetched once per session.
 */
export function useReverseGeocode(lat, lng) {
  const enabled = Boolean(lat && lng);

  const { data, isLoading } = useQuery({
    queryKey: ["reverse-geocode", lat?.toFixed(4), lng?.toFixed(4)],
    enabled,
    staleTime: Infinity,          // never re-fetch the same coordinates
    gcTime:    60 * 60 * 1000,   // keep in cache 1 hour
    retry: 0,                     // don't retry on failure — avoids piling up requests
    queryFn: async () => {
      if (GOOGLE_API_KEY) {
        // Google Maps Geocoding API — more reliable, higher rate limits
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&result_type=locality|sublocality|neighborhood`
        );
        const json = await res.json();
        if (json.status === "OK" && json.results?.length > 0) {
          // Extract city + sub-locality (e.g. "Westlands, Nairobi")
          const components = json.results[0].address_components;
          const sub  = components.find((c) => c.types.includes("sublocality") || c.types.includes("neighborhood"))?.short_name;
          const city = components.find((c) => c.types.includes("locality"))?.short_name;
          return [sub, city].filter(Boolean).join(", ") || json.results[0].formatted_address.split(",").slice(0, 2).join(",");
        }
        return null;
      }

      // Fallback: Nominatim (only use for one-at-a-time calls)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "en" } },
      );
      if (!res.ok) return null;
      const json = await res.json();
      const addr = json?.address;
      if (!addr) return null;
      const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.village || "";
      const city = addr.city || addr.town || addr.county || "";
      return [area, city].filter(Boolean).join(", ") || null;
    },
  });

  return {
    locationLabel: data ?? null,
    isLoading: enabled && isLoading,
  };
}
