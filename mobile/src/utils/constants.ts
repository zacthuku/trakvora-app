export const CORRIDORS = [
  "Nairobi-Mombasa",
  "Nairobi-Kampala",
  "Nairobi-Dar",
  "Mombasa-Kampala",
];

export const CARGO_TYPES = [
  { value: "general", label: "General" },
  { value: "refrigerated", label: "Refrigerated" },
  { value: "hazardous", label: "Hazardous" },
  { value: "livestock", label: "Livestock" },
  { value: "construction", label: "Construction" },
  { value: "agricultural", label: "Agricultural" },
  { value: "electronics", label: "Electronics" },
];

export const TRUCK_TYPES = [
  { value: "flatbed", label: "Flatbed" },
  { value: "dry_van", label: "Dry Van" },
  { value: "reefer", label: "Reefer" },
  { value: "tanker", label: "Tanker" },
  { value: "lowbed", label: "Low Bed" },
  { value: "tipper", label: "Tipper" },
];

export const LOAD_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  bidding: "Bidding",
  booked: "Booked",
  en_route_pickup: "En Route Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// RN-compatible color values (hex/named) instead of Tailwind class strings
export const LOAD_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available:       { bg: "#f0fdfa", text: "#0f766e" },
  bidding:         { bg: "#eff6ff", text: "#1d4ed8" },
  booked:          { bg: "#fffbeb", text: "#b45309" },
  en_route_pickup: { bg: "#fff7ed", text: "#c2410c" },
  loaded:          { bg: "#faf5ff", text: "#7e22ce" },
  in_transit:      { bg: "#eef2ff", text: "#4338ca" },
  delivered:       { bg: "#f0fdf4", text: "#15803d" },
  cancelled:       { bg: "#fef2f2", text: "#b91c1c" },
};
