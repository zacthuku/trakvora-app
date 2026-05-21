import Constants from "expo-constants";

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8000";

const WS_BASE = BASE_URL.replace(/^http/, "ws");

export function createTrackingSocket(
  shipmentId: string | number,
  onMessage: (data: any) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/tracking/${shipmentId}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };

  ws.onclose = () => onClose?.();
  ws.onerror = () => ws.close();

  return ws;
}
