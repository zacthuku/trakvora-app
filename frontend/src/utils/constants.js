export const CARGO_TRUCK_REQUIRED = {
  refrigerated: "reefer",
  hazardous: "tanker",
};

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

export const LOAD_STATUS_LABELS = {
  available: "Available",
  bidding: "Bidding",
  booked: "Booked",
  en_route_pickup: "En Route Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const LOAD_STATUS_COLORS = {
  available: "bg-teal-50 text-teal-700",
  bidding: "bg-blue-50 text-blue-700",
  booked: "bg-amber-50 text-amber-700",
  en_route_pickup: "bg-orange-50 text-orange-700",
  loaded: "bg-purple-50 text-purple-700",
  in_transit: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};
