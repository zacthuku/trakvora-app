import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGeolocation } from "@/hooks/useGeolocation";
import { driverApi } from "@/features/driver/api/driverApi";

function distanceMetres(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * (Math.PI / 180))
    * Math.cos(b.latitude * (Math.PI / 180))
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Runs inside DriverLayout so GPS + REST pings continue regardless of
 * which page the driver is currently viewing.
 */
export function useBackgroundTracking() {
  const { position } = useGeolocation();
  const lastSentPosRef  = useRef(null);
  const lastSentTimeRef = useRef(0);

  const { data: shipment } = useQuery({
    queryKey: ["active-shipment"],
    queryFn:  driverApi.getActiveShipment,
    refetchInterval: 30_000,
    staleTime:       25_000,
    retry: false,
  });

  const shipmentId = shipment?.id ?? null;

  useEffect(() => {
    if (!position || !shipmentId) return;

    const now      = Date.now();
    const speedKmh = position.speed ?? 0;
    const moved    = distanceMetres(lastSentPosRef.current, position);
    const elapsed  = now - lastSentTimeRef.current;

    const isMoving        = speedKmh > 2;
    const minInterval     = isMoving ? 5_000 : 30_000;
    const significantMove = isMoving && moved > 20;

    if (!significantMove && elapsed < minInterval) return;

    lastSentPosRef.current  = position;
    lastSentTimeRef.current = now;

    driverApi.updateLocation(shipmentId, {
      latitude:  position.latitude,
      longitude: position.longitude,
      accuracy:  position.accuracy,
      speed_kmh: speedKmh,
      heading:   position.heading,
    }).catch(() => {});
  }, [position, shipmentId]);
}
