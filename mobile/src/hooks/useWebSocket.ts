import { useEffect, useRef, useCallback } from "react";
import { createTrackingSocket } from "../api/websocket";

export function useTrackingSocket(
  shipmentId: string | number | null | undefined,
  onMessage: (data: any) => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!shipmentId) return;
    wsRef.current = createTrackingSocket(shipmentId, onMessage, () => {
      // auto-reconnect after 3s on close
      setTimeout(connect, 3000);
    });
  }, [shipmentId, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
