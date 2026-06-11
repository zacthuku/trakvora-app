import L from "leaflet";

// Vite + Leaflet default icon path fix (apply once via this module)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const dot = (bg, emoji, size = 36) =>
  `<div style="background:${bg};border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.5)}px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${emoji}</div>`;

// Orange — active truck position
export const truckIcon = new L.DivIcon({
  className: "",
  html: dot("#fe6a34", "🚛", 36),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Green — pickup location
export const pickupIcon = new L.DivIcon({
  className: "",
  html: dot("#22c55e", "📦", 28),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// Red — dropoff / destination
export const dropoffIcon = new L.DivIcon({
  className: "",
  html: dot("#ef4444", "🏁", 28),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// Blue — field inspector current position
export const inspectorIcon = new L.DivIcon({
  className: "",
  html: dot("#3b82f6", "👷", 36),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Amber — inspection task site
export const taskIcon = new L.DivIcon({
  className: "",
  html: dot("#f59e0b", "📋", 32),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});
