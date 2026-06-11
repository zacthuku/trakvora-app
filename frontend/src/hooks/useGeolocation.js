import { useEffect, useRef, useState } from "react";

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const lastFireRef = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported"); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    function onSuccess(pos) {
      lastFireRef.current = Date.now();
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        // m/s → km/h; null when the device doesn't provide speed
        speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
        heading: pos.coords.heading,
      });
    }

    function onError(err) {
      setError(err.message);
    }

    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 };
    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, opts);

    // Fallback interval: if watchPosition hasn't fired in 10s, poll manually.
    // This covers Android Chrome backgrounding and low-movement scenarios.
    const intervalId = setInterval(() => {
      if (Date.now() - lastFireRef.current > 10000) {
        navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
      }
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, []);

  return { position, error };
}
