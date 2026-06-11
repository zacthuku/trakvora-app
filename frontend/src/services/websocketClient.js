const WS_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws");

export function createTrackingSocket(shipmentId, onMessage, onClose) {
  const ws = new WebSocket(`${WS_BASE}/ws/tracking/${shipmentId}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onclose = () => onClose?.();

  return ws;
}
