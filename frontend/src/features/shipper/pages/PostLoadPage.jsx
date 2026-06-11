import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import RoutePreviewMap from "@/components/map/RoutePreviewMap";
import {
  ArrowRight, ArrowLeft, MapPin, Ruler, Clock, CalendarDays,
  CheckCircle2, Users, Truck, Search, Star, Navigation2,
  AlertCircle, Zap, Gavel, Info, TrendingUp, Lock,
} from "lucide-react";
import { shipperApi } from "@/features/shipper/api/shipperApi";
import { paymentsApi } from "@/features/payments/api/paymentsApi";
import apiClient from "@/services/apiClient";
import LocationSearch from "@/components/ui/LocationSearch";
import { CARGO_TYPES, TRUCK_TYPES } from "@/utils/constants";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { useAuthStore } from "@/store/authStore";

// ─── Haversine distance (km, straight-line) ───────────────────────────────────
function straightLineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Road distance ≈ straight-line × 1.3 (typical East Africa factor)
function roadKm(lat1, lng1, lat2, lng2) {
  return Math.round(straightLineKm(lat1, lng1, lat2, lng2) * 1.3);
}

// Estimate delivery given road km and pickup datetime string "YYYY-MM-DD HH:MM"
function estimateDelivery(distKm, pickupDate, pickupWindow) {
  if (!pickupDate || !pickupWindow || !distKm) return null;
  const startHour = parseInt(pickupWindow.split(":")[0], 10);
  const base = new Date(`${pickupDate}T${String(startHour).padStart(2, "0")}:00:00`);
  if (isNaN(base.getTime())) return null;
  // avg loaded truck 60 km/h + 2 h buffer
  const totalHours = distKm / 60 + 2;
  const delivery = new Date(base.getTime() + totalHours * 3600 * 1000);
  return delivery;
}

function formatDelivery(dt) {
  if (!dt) return null;
  return dt.toLocaleString("en-KE", {
    weekday: "long", day: "numeric", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const TIME_WINDOWS = [
  { value: "06:00", label: "06:00 – 09:00  (Early Morning)" },
  { value: "09:00", label: "09:00 – 12:00  (Morning)" },
  { value: "12:00", label: "12:00 – 15:00  (Midday)" },
  { value: "15:00", label: "15:00 – 18:00  (Afternoon)" },
  { value: "18:00", label: "18:00 – 21:00  (Evening)" },
];

const INITIAL_LOC = { name: "", lat: null, lng: null };

const INITIAL = {
  pickup: INITIAL_LOC,
  dropoff: INITIAL_LOC,
  pickup_date: "",
  pickup_window: "09:00",
  cargo_type: "general",
  weight_tonnes: "",
  required_truck_type: "",
  cargo_description: "",
  requires_insurance: false,
  permit_declared: false,
  unattended_delivery: false,
  is_urgent: false,
  booking_mode: "fixed",
  visibility: "public",
  price_kes: "",
  special_instructions: "",
  direct_offer_user_id: null,
  scheduled_at: "",        // ISO datetime string for deferred publishing
  terrain_difficulty: "standard",
};

const STEPS_BID = ["Route & Schedule", "Cargo", "Pricing"];
const STEPS_DIRECT = ["Route & Schedule", "Cargo", "Connect & Price"];

function StepBar({ current, steps }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = current === n;
        const done = current > n;
        return (
          <div key={n} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done || active ? "bg-secondary text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={`text-sm font-medium hidden sm:block transition-colors ${active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
              {label}
            </span>
            {n < steps.length && <div className={`h-0.5 w-8 transition-colors ${done ? "bg-secondary" : "bg-slate-200 dark:bg-slate-700"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function CarrierCard({ carrier, type, selected, onSelect }) {
  const name = carrier.full_name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const avail = carrier.availability_status;
  const isAvailable = avail === "available";
  const isOnJob = avail === "on_job";

  return (
    <button
      type="button"
      onClick={() => onSelect(carrier)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-[#4fdbcc] bg-[#4fdbcc]/10 shadow-md ring-1 ring-[#4fdbcc]/40"
          : "border-slate-200 dark:border-slate-700 hover:border-secondary/50 bg-white dark:bg-slate-800 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white font-heading">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
              isAvailable ? "bg-teal-50 text-teal-700 border-teal-200" :
              isOnJob ? "bg-sky-50 text-sky-700 border-sky-200" :
              "bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-600"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-teal-400" : isOnJob ? "bg-sky-400" : "bg-slate-400"}`} />
              {isAvailable ? "Available" : isOnJob ? "On Job" : "Offline"}
            </span>
          </div>
          {carrier.availability_location && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Navigation2 className="w-3 h-3" /> {carrier.availability_location}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {carrier.rating != null && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                <Star className="w-3 h-3" /> {(carrier.rating).toFixed(1)}
              </span>
            )}
            {carrier.total_trips > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{carrier.total_trips} trips</span>
            )}
            {carrier.licence_class && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Class {carrier.licence_class}</span>
            )}
            {type === "owner" && <span className="text-[10px] text-violet-600 font-semibold">Fleet Owner</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function matchPct(score) {
  // Backend score is 0–100; clamp and display
  return Math.min(100, Math.max(0, Math.round(score)));
}

function NearbyTruckCard({ truck, selectedCarriers, onToggle }) {
  const uid = String(truck.owner_id);
  const isSelected = selectedCarriers.has(uid);
  const pct = matchPct(truck.score ?? 0);
  const scoreColor =
    pct >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600";

  return (
    <button
      type="button"
      onClick={() => onToggle(uid)}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[#4fdbcc] bg-[#4fdbcc]/10 shadow-sm ring-1 ring-[#4fdbcc]/40"
          : "border-slate-200 dark:border-slate-700 hover:border-secondary/50 bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {truck.owner_name || "Unknown carrier"}
            </p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreColor}`}>
              {pct}% match
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
            {truck.truck_type?.replace(/_/g, " ")} · {truck.capacity_tonnes}t
            {truck.make ? ` · ${truck.make}${truck.model ? " " + truck.model : ""}` : ""}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {truck.owner_rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                <Star className="w-3 h-3" /> {truck.owner_rating.toFixed(1)}
              </span>
            )}
            {truck.owner_total_trips > 0 && (
              <span className="text-[10px] text-slate-400">{truck.owner_total_trips} trips</span>
            )}
            <span className="text-[10px] text-secondary font-semibold flex items-center gap-0.5">
              <Navigation2 className="w-3 h-3" /> {truck.distance_km} km
            </span>
          </div>
        </div>
        {isSelected && (
          <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
        )}
      </div>
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export default function PostLoadPage() {
  const { currency, distance_unit: distUnit } = useCountryConfig();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [step, setStep] = useState(1);
  const [postError, setPostError] = useState(null);
  const [postingMode, setPostingMode] = useState("bid"); // "bid" | "direct"
  const [carrierTab, setCarrierTab] = useState("driver"); // "driver" | "owner"
  const [carrierSearch, setCarrierSearch] = useState("");
  const [nearbySort, setNearbySort] = useState("match"); // "match" | "nearest" | "rated"
  const [selectedCarriers, setSelectedCarriers] = useState(new Set()); // user_ids

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const [routeDistance, setRouteDistance] = useState(null);

  // Reset route distance whenever locations change
  useEffect(() => {
    setRouteDistance(null); // eslint-disable-line react-hooks/set-state-in-effect
  }, [form.pickup.lat, form.pickup.lng, form.dropoff.lat, form.dropoff.lng]);

  const isDirect = postingMode === "direct";
  const STEPS = isDirect ? STEPS_DIRECT : STEPS_BID;

  const { data: driversData = [], isLoading: driversLoading } = useQuery({
    queryKey: ["carrier-search-drivers", carrierSearch],
    queryFn: () => shipperApi.searchDrivers(carrierSearch),
    enabled: isDirect && step === 3 && carrierTab === "driver",
    staleTime: 30_000,
  });

  const { data: ownersData = [], isLoading: ownersLoading } = useQuery({
    queryKey: ["carrier-search-owners", carrierSearch],
    queryFn: () => shipperApi.searchOwners(carrierSearch),
    enabled: isDirect && step === 3 && carrierTab === "owner",
    staleTime: 30_000,
  });

  const carriers = carrierTab === "driver" ? driversData : ownersData;
  const carriersLoading = carrierTab === "driver" ? driversLoading : ownersLoading;

  const bothLocated = form.pickup.lat != null && form.dropoff.lat != null;
  const fallbackDistance = bothLocated
    ? roadKm(form.pickup.lat, form.pickup.lng, form.dropoff.lat, form.dropoff.lng)
    : null;
  const distance = routeDistance ?? fallbackDistance;
  const distanceIsReal = routeDistance != null;

  // Price estimate from backend pricing engine (corridor + fuel + seasonal + demand aware)
  const { data: priceEstimate } = useQuery({
    queryKey: ["price-estimate", distance, form.cargo_type, form.weight_tonnes, form.pickup?.name, form.dropoff?.name],
    queryFn: () =>
      apiClient
        .get("/loads/price-estimate", {
          params: {
            distance_km:      distance,
            cargo_type:       form.cargo_type,
            service_type:     "truck",
            weight_tonnes:    form.weight_tonnes || 0,
            pickup_location:  form.pickup?.name  || "",
            dropoff_location: form.dropoff?.name || "",
          },
        })
        .then((r) => r.data),
    enabled: distance != null && distance > 0,
    staleTime: 60_000,
  });

  const { data: nearbyTrucks = [], isLoading: nearbyLoading } = useQuery({
    queryKey: ["nearby-trucks", form.pickup.lat, form.pickup.lng, form.required_truck_type, form.weight_tonnes],
    queryFn: () =>
      apiClient
        .get("/trucks/nearby", {
          params: {
            lat: form.pickup.lat,
            lon: form.pickup.lng,
            radius_km: 150,
            truck_type: form.required_truck_type || undefined,
            weight_tonnes: form.weight_tonnes || undefined,
            limit: 10,
          },
        })
        .then((r) => r.data),
    enabled: step === 3 && form.pickup.lat != null,
    staleTime: 60_000,
  });

  const { data: walletData } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: paymentsApi.getWallet,
    staleTime: 30_000,
    enabled: !!user?.can_use_escrow,
  });
  const walletBalance = user?.can_use_escrow && walletData ? parseFloat(walletData.balance_kes ?? 0) : null;
  const enteredPrice = parseFloat(form.price_kes) || 0;
  const walletShort = walletBalance !== null && enteredPrice > 0 && walletBalance < enteredPrice;

  const deliveryDt = estimateDelivery(distance, form.pickup_date, form.pickup_window);
  const deliveryLabel = formatDelivery(deliveryDt);

  const today = new Date().toISOString().split("T")[0];

  const mutation = useMutation({
    mutationFn: shipperApi.createLoad,
    onSuccess: () => navigate("/shipper"),
    onError: (err) => setPostError({
      msg: err.response?.data?.detail || "Failed to post load",
      upgrade: err.response?.status === 402,
    }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const windowLabel = TIME_WINDOWS.find((w) => w.value === form.pickup_window)?.label || form.pickup_window;
    const bookingMode = isDirect ? "direct" : form.booking_mode;
    mutation.mutate({
      pickup_location: form.pickup.name,
      pickup_latitude: form.pickup.lat,
      pickup_longitude: form.pickup.lng,
      dropoff_location: form.dropoff.name,
      dropoff_latitude: form.dropoff.lat,
      dropoff_longitude: form.dropoff.lng,
      distance_km: distance,
      cargo_type: form.cargo_type,
      weight_tonnes: parseFloat(form.weight_tonnes),
      required_truck_type: form.required_truck_type || null,
      cargo_description: form.cargo_description || null,
      requires_insurance: form.requires_insurance,
      unattended_delivery: form.unattended_delivery,
      is_urgent: form.is_urgent,
      booking_mode: bookingMode,
      price_kes: parseFloat(form.price_kes),
      special_instructions: form.special_instructions || null,
      pickup_date: form.pickup_date || null,
      pickup_window: form.pickup_window || null,
      pickup_deadline: form.pickup_date ? `${form.pickup_date} ${windowLabel}` : null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      terrain_difficulty: form.terrain_difficulty || "standard",
      visibility: form.visibility || "public",
      ...(isDirect && selectedCarriers.size > 0 && {
        direct_offer_user_ids: [...selectedCarriers],
        booking_mode: "direct",
      }),
    });
  };

  const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";
  const selectCls = inputCls;

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Post a Load</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Fill in the route, cargo details and pricing.</p>
      </header>

      {/* Posting mode selector (only on step 1) */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => { setPostingMode("bid"); setSelectedCarriers(new Set()); }}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all ${
              postingMode === "bid"
                ? "border-secondary bg-secondary/5"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <Gavel className={`w-5 h-5 ${postingMode === "bid" ? "text-secondary" : "text-slate-400"}`} />
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Post for Bid</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Carriers compete. You choose the best offer.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setPostingMode("direct"); set("booking_mode", "direct"); setSelectedCarriers(new Set()); }}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all ${
              postingMode === "direct"
                ? "border-secondary bg-secondary/5"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <Zap className={`w-5 h-5 ${postingMode === "direct" ? "text-secondary" : "text-slate-400"}`} />
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Direct Connect</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Find a specific driver or fleet owner and offer directly</p>
            </div>
          </button>
        </div>
      )}

      <StepBar current={step} steps={STEPS} />

      <form onSubmit={handleSubmit}>
        {/* ── Step 1: Route & Schedule ── */}
        {step === 1 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col gap-5 shadow-sm">
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-base">Route Details</h2>

            <LocationSearch
              label="Pickup Location"
              value={form.pickup}
              onChange={(loc) => set("pickup", loc)}
            />

            <LocationSearch
              label="Dropoff Location"
              value={form.dropoff}
              onChange={(loc) => set("dropoff", loc)}
            />

            {/* Route preview map */}
            {bothLocated && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Route Preview</p>
                <RoutePreviewMap
                  origin={form.pickup}
                  destination={form.dropoff}
                  onDistanceResolved={setRouteDistance}
                  height="260px"
                />
              </div>
            )}

            {/* Distance badge */}
            {distance != null && (
              <div className="flex items-center gap-3 bg-secondary/5 border border-secondary/20 rounded-lg px-4 py-3">
                <Ruler className="w-4 h-4 text-secondary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Road distance: <span className="text-secondary">{distance.toLocaleString()} km</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {distanceIsReal ? "Actual road distance via Google Maps" : "Estimated via straight-line × 1.3 road factor"}
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <h3 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-secondary" />
                Pickup Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Pickup Date">
                  <input
                    type="date"
                    min={today}
                    value={form.pickup_date}
                    onChange={(e) => set("pickup_date", e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="Pickup Time Window">
                  <select
                    value={form.pickup_window}
                    onChange={(e) => set("pickup_window", e.target.value)}
                    className={selectCls}
                  >
                    {TIME_WINDOWS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Urgency toggle */}
              <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_urgent}
                    onChange={(e) => set("is_urgent", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-secondary shrink-0"
                  />
                  <span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Mark as Urgent
                    </span>
                    <span className="block text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      Highlighted in the carrier feed — attracts faster responses
                    </span>
                  </span>
                </label>
              </div>

              {/* Schedule for later toggle */}
              <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(form.scheduled_at)}
                    onChange={(e) => set("scheduled_at", e.target.checked ? "" : "")}
                    className="w-4 h-4 accent-secondary rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Schedule for later?</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">(Load goes live to carriers at chosen time)</span>
                </label>
                {form.scheduled_at !== undefined && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={form.scheduled_at}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => set("scheduled_at", e.target.value)}
                      className={inputCls + " mt-1"}
                    />
                    {form.scheduled_at && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                        <span>🕐</span>
                        This load will go live at{" "}
                        <span className="font-semibold">
                          {new Date(form.scheduled_at).toLocaleString("en-KE")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Estimated delivery preview */}
              {deliveryLabel && (
                <div className="mt-3 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">Estimated delivery</p>
                    <p className="text-sm text-green-700 font-medium mt-0.5">{deliveryLabel}</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      ~{Math.round(distance / 60 + 2)}h transit · avg 60 km/h + 2h loading buffer
                      {distanceIsReal ? " · Google Maps distance" : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!bothLocated}
                onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-secondary text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Cargo ── */}
        {step === 2 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col gap-5 shadow-sm">
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-base">Cargo Details</h2>

            <Field label="Cargo Type">
              <select value={form.cargo_type} onChange={(e) => { set("cargo_type", e.target.value); set("permit_declared", false); }} className={selectCls}>
                {CARGO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            {/* Permit declaration — required for regulated cargo types */}
            {(form.cargo_type === "hazardous" || form.cargo_type === "livestock") && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {form.cargo_type === "hazardous" ? "Hazardous Goods Permit Required" : "Livestock Transport Permit Required"}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                      {form.cargo_type === "hazardous"
                        ? "Hazardous materials require a valid KEBS/NEMA transport permit and ADR-compliant packaging. The carrier must hold a hazmat endorsement on their operating licence."
                        : "Livestock transport requires a valid Veterinary Movement Permit issued by the Kenya Veterinary Board or relevant county authority, confirming the animals are disease-free and fit for transport."}
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.permit_declared}
                    onChange={(e) => set("permit_declared", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-secondary shrink-0"
                  />
                  <span className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed font-medium">
                    I confirm that I hold all required permits and licences for this cargo and that the shipment complies with applicable regulations. I accept full liability for non-compliance.
                  </span>
                </label>
              </div>
            )}

            <Field label="Route Terrain" hint="Affects carrier commission rate, not your posted price">
              <select value={form.terrain_difficulty} onChange={(e) => set("terrain_difficulty", e.target.value)} className={selectCls}>
                <option value="standard">Standard — paved road</option>
                <option value="highland">Highland / Mountainous</option>
                <option value="rough">Rough / Off-road</option>
                <option value="remote">Remote / Very isolated</option>
              </select>
            </Field>

            <Field label="Weight (tonnes)">
              <input type="number" step="0.1" min="0.1" required value={form.weight_tonnes}
                onChange={(e) => set("weight_tonnes", e.target.value)}
                className={inputCls} placeholder="e.g. 10.5" />
            </Field>

            <Field label="Required Truck Type (optional)">
              <select value={form.required_truck_type} onChange={(e) => set("required_truck_type", e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {TRUCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            <Field label="Cargo Description (optional)">
              <textarea rows={3} value={form.cargo_description}
                onChange={(e) => set("cargo_description", e.target.value)}
                placeholder="Briefly describe the goods…"
                className={inputCls + " resize-none"} />
            </Field>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.requires_insurance}
                onChange={(e) => set("requires_insurance", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary accent-secondary" />
              <span className="text-slate-700 dark:text-slate-200">Requires cargo insurance</span>
            </label>

            <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.unattended_delivery}
                onChange={(e) => set("unattended_delivery", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary accent-secondary" />
              <span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">Unattended delivery</span>
                <span className="block text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Delivery confirmed by GPS location instead of a code. Use when the warehouse or dock accepts cargo without a recipient present.
                </span>
              </span>
            </label>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(1)}
                className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={!form.weight_tonnes || ((form.cargo_type === "hazardous" || form.cargo_type === "livestock") && !form.permit_declared)}
                onClick={() => setStep(3)}
                className="flex items-center gap-2 bg-secondary text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 Direct: Find Carrier ── */}
        {step === 3 && isDirect && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col gap-5 shadow-sm">
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-base">Find & Connect</h2>

            {/* Smart match suggestions panel */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-secondary" /> Smart Suggestions
                  {!nearbyLoading && nearbyTrucks.length > 0 && (
                    <span className="text-secondary normal-case font-bold">({nearbyTrucks.length})</span>
                  )}
                </p>
                {nearbyTrucks.length > 1 && (
                  <div className="flex gap-1">
                    {[
                      { key: "match", label: "Best Match" },
                      { key: "nearest", label: "Nearest" },
                      { key: "rated", label: "Top Rated" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNearbySort(key)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          nearbySort === key
                            ? "bg-secondary text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {nearbyLoading ? (
                <div className="py-4 text-center text-slate-400 text-xs">Scanning nearby carriers…</div>
              ) : nearbyTrucks.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No trucks near pickup location — try the search below.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {[...nearbyTrucks]
                    .sort((a, b) =>
                      nearbySort === "nearest" ? a.distance_km - b.distance_km :
                      nearbySort === "rated" ? b.owner_rating - a.owner_rating :
                      (b.score ?? 0) - (a.score ?? 0)
                    )
                    .map((t) => (
                      <NearbyTruckCard
                        key={t.truck_id}
                        truck={t}
                        selectedCarriers={selectedCarriers}
                        onToggle={(uid) =>
                          setSelectedCarriers((prev) => {
                            const next = new Set(prev);
                            if (next.has(uid)) next.delete(uid);
                            else if (next.size < 5) next.add(uid);
                            return next;
                          })
                        }
                      />
                    ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" /> Or search for a specific carrier by name below
            </p>

            {/* Carrier type tabs */}
            <div className="flex gap-2">
              {[
                { key: "driver", label: "Drivers", icon: Truck },
                { key: "owner", label: "Fleet Owners", icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCarrierTab(key); setCarrierSearch(""); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    carrierTab === key ? "bg-secondary text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
                placeholder={carrierTab === "driver" ? "Search by name or location…" : "Search fleet owner by name…"}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>

            {/* Selection count badge */}
            {selectedCarriers.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-secondary font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {selectedCarriers.size}/5 selected — first to accept wins
              </div>
            )}

            {/* Results */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {carriersLoading ? (
                <div className="py-8 text-center text-slate-400 text-sm">Searching…</div>
              ) : carriers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No {carrierTab === "driver" ? "available drivers" : "fleet owners"} found</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                carriers.map((c) => {
                  const uid = c.user_id || c.id;
                  const isSelected = selectedCarriers.has(uid);
                  return (
                    <CarrierCard
                      key={uid}
                      carrier={c}
                      type={carrierTab}
                      selected={isSelected ? c : null}
                      onSelect={() => {
                        setSelectedCarriers((prev) => {
                          const next = new Set(prev);
                          if (next.has(uid)) next.delete(uid);
                          else if (next.size < 5) next.add(uid);
                          return next;
                        });
                      }}
                    />
                  );
                })
              )}
            </div>

            {/* Price for direct offer */}
            <Field label={`Offer Price (${currency})`}>
              <input
                type="number" min="1" required value={form.price_kes}
                onChange={(e) => set("price_kes", e.target.value)}
                className={inputCls} placeholder="e.g. 45000"
              />
            </Field>

            <Field label="Special Instructions (optional)">
              <textarea rows={2} value={form.special_instructions}
                onChange={(e) => set("special_instructions", e.target.value)}
                placeholder="Gate code, fragile items, loading dock access…"
                className={inputCls + " resize-none"} />
            </Field>

            {selectedCarriers.size === 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Select up to 5 carriers above — first to accept gets the load
              </div>
            )}

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(2)}
                className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={!form.price_kes || selectedCarriers.size === 0 || mutation.isPending}
                className="flex items-center gap-2 bg-secondary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wide"
              >
                {mutation.isPending
                  ? "Sending…"
                  : `Send to ${selectedCarriers.size || ""} Carrier${selectedCarriers.size !== 1 ? "s" : ""}`}
                {!mutation.isPending && <Zap className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 Bid: Pricing + Summary ── */}
        {step === 3 && !isDirect && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col gap-5 shadow-sm">
            <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-base">Pricing</h2>

            <Field label="Booking Mode">
              <select value={form.booking_mode} onChange={(e) => set("booking_mode", e.target.value)} className={selectCls}>
                <option value="fixed">Fixed Price — carriers accept at your price, no negotiation</option>
                <option value="auction">Open Bidding — carriers compete; you pick the best offer</option>
              </select>
            </Field>

            <Field
              label={form.booking_mode === "auction" ? `Minimum Bid (${currency})` : `Price (${currency})`}
            >
              <div className="relative">
                <input type="number" min="1" required value={form.price_kes}
                  onChange={(e) => set("price_kes", e.target.value)}
                  className={inputCls} placeholder="e.g. 45000" />
              </div>

              {/* ── Market Price Intelligence panel ─────────────────────── */}
              {priceEstimate && (
                <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                  {/* Header with confidence badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Market Intelligence
                      {priceEstimate.corridor_name && (
                        <span className="text-slate-400 font-normal">· {priceEstimate.corridor_name}</span>
                      )}
                    </div>
                    {/* Confidence badge */}
                    {{
                      high:         <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Market Calibrated</span>,
                      medium:       <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Moderate Data</span>,
                      low:          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Limited Data</span>,
                      formula_only: <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Formula Only</span>,
                    }[priceEstimate.confidence]}
                  </div>

                  {/* Three-tier price buttons (when market data available) */}
                  {priceEstimate.market_range ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: "low_kes",         label: "Competitive",  desc: "Attracts most bids" },
                        { key: "recommended_kes", label: "Market Rate",  desc: "Median accepted" },
                        { key: "premium_kes",     label: "Premium",      desc: "Urgent / heavy loads" },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set("price_kes", String(priceEstimate.market_range[key]))}
                          className={`flex flex-col items-center p-2.5 rounded-lg border transition-all text-center
                            ${form.price_kes == priceEstimate.market_range[key]
                              ? "border-secondary bg-secondary/10 dark:bg-secondary/20"
                              : "border-slate-200 dark:border-slate-600 hover:border-secondary hover:bg-secondary/5"}`}
                        >
                          <span className="text-[10px] text-slate-500 font-medium">{label}</span>
                          <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                            {currency} {Number(priceEstimate.market_range[key]).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{desc}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Formula-only fallback: single suggestion button */
                    <button
                      type="button"
                      onClick={() => set("price_kes", String(priceEstimate.formula_estimate_kes || priceEstimate.total_price_kes))}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-secondary transition"
                    >
                      <span className="text-xs text-slate-500">Formula estimate</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {currency} {Number(priceEstimate.formula_estimate_kes || priceEstimate.total_price_kes).toLocaleString()}
                      </span>
                    </button>
                  )}

                  {/* Market insight text */}
                  {priceEstimate.market_insight && (
                    <p className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      {priceEstimate.market_insight}
                    </p>
                  )}

                  {/* Seasonal / fuel context */}
                  {(priceEstimate.seasonal_factor !== 1.0 || priceEstimate.fuel_adjustment_factor !== 1.0) && (
                    <p className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      Estimate includes: seasonal factor {(priceEstimate.seasonal_factor * 100).toFixed(0)}%
                      {priceEstimate.fuel_adjustment_factor !== 1.0 &&
                        ` · fuel index ${(priceEstimate.fuel_adjustment_factor * 100).toFixed(0)}%`}
                    </p>
                  )}
                </div>
              )}
            </Field>

            {/* Wallet balance indicator (separate from price field) */}
            {walletBalance !== null && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Wallet: <span className={`font-semibold ${walletShort ? "text-amber-600" : "text-slate-700 dark:text-slate-200"}`}>
                    {currency} {walletBalance.toLocaleString()}
                  </span>
                </span>
              </div>
            )}
            {walletShort && (
              <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">
                  Your wallet balance may be insufficient when a bid is accepted.{" "}
                  <a href="/shipper/wallet" className="font-semibold underline hover:text-amber-800">
                    Top up →
                  </a>
                </p>
              </div>
            )}

            <Field label="Special Instructions (optional)">
              <textarea rows={2} value={form.special_instructions}
                onChange={(e) => set("special_instructions", e.target.value)}
                placeholder="Gate code, fragile items, loading dock access…"
                className={inputCls + " resize-none"} />
            </Field>

            <Field label="Who can see this load?">
              <select value={form.visibility} onChange={(e) => set("visibility", e.target.value)} className={selectCls}>
                <option value="public">All Carriers — public marketplace</option>
                <option value="preferred_only">My Preferred Partners Only</option>
              </select>
              {form.visibility === "preferred_only" && (
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Only carriers in your company's preferred network can see this load.
                </p>
              )}
            </Field>

            {/* ── Route + Schedule summary card ── */}
            <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-600 border-b border-slate-200 dark:border-slate-500">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Load Summary</p>
              </div>
              <div className="p-4 space-y-3">
                {/* Route */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    <div className="w-0.5 h-6 bg-slate-300" />
                    <MapPin className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{form.pickup.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {form.pickup.lat?.toFixed(5)}, {form.pickup.lng?.toFixed(5)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{form.dropoff.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {form.dropoff.lat?.toFixed(5)}, {form.dropoff.lng?.toFixed(5)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Ruler className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <span><span className="font-semibold">{distance?.toLocaleString() ?? "—"} km</span> road distance</span>
                  </div>
                  {deliveryLabel && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <span className="truncate">{deliveryLabel}</span>
                    </div>
                  )}
                  {form.pickup_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <CalendarDays className="w-3.5 h-3.5 text-secondary shrink-0" />
                      <span>
                        {new Date(form.pickup_date).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}
                        {" · "}
                        {TIME_WINDOWS.find((w) => w.value === form.pickup_window)?.label.split("  ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(2)}
                className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button type="submit" disabled={!form.price_kes || mutation.isPending}
                className="flex items-center gap-2 bg-secondary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wide">
                {mutation.isPending ? "Posting…" : "Post Load"}
                {!mutation.isPending && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
            {postError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span className="flex-1">{postError.msg}</span>
                {postError.upgrade && (
                  <Link to="/shipper/subscription" className="font-semibold underline whitespace-nowrap hover:text-red-900">
                    Upgrade plan →
                  </Link>
                )}
                <button onClick={() => setPostError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-1">&times;</button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
