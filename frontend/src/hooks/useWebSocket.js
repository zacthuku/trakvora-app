import { useEffect, useRef, useState } from "react";
import { createTrackingSocket } from "@/services/websocketClient";

export function useTrackingSocket(shipmentId) {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!shipmentId) return;

    // Defer creation so React Strict Mode's mount→cleanup→remount cycle
    // doesn't call close() on a socket still in CONNECTING state.
    const timer = setTimeout(() => {
      const ws = createTrackingSocket(
        shipmentId,
        (data) => { setConnected(true); setLastMessage(data); },
        () => setConnected(false),
      );
      wsRef.current = ws;
    }, 0);

    return () => {
      clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [shipmentId]);

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  return { lastMessage, connected, send };
}
