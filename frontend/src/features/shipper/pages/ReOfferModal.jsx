import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Search, CheckCircle2, Navigation2, Star, Zap, Users, Truck,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { shipperApi } from "@/features/shipper/api/shipperApi";
import { toast } from "@/components/ui/Toast";
import { useCountryConfig } from "@/hooks/useCountryConfig";

function matchPct(score) {
  return Math.min(100, Math.max(0, Math.round(score ?? 0)));
}

function NearbyTruckCard({ truck, selectedCarriers, onToggle }) {
  const uid = String(truck.owner_id);
  const isSelected = selectedCarriers.has(uid);
  const pct = matchPct(truck.score);
  const scoreColor =
    pct >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-slate-100 text-slate-500 border-slate-200";

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
        {isSelected && <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />}
      </div>
    </button>
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
              "bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-200"
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
                <Star className="w-3 h-3" /> {Number(carrier.rating).toFixed(1)}
              </span>
            )}
            {carrier.total_trips > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{carrier.total_trips} trips</span>
            )}
            {type === "owner" && (
              <span className="text-[10px] text-violet-600 font-semibold">Fleet Owner</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ReOfferModal({ load, onClose }) {
  const qc = useQueryClient();
  const { currency } = useCountryConfig();

  const [carrierTab, setCarrierTab] = useState("nearby");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [selectedCarriers, setSelectedCarriers] = useState(new Set());
  const [nearbySort, setNearbySort] = useState("match");
  const [newPrice, setNewPrice] = useState("");

  const { data: nearbyTrucks = [], isLoading: nearbyLoading } = useQuery({
    queryKey: ["nearby-trucks-reoffer", load.pickup_latitude, load.pickup_longitude],
    queryFn: () =>
      apiClient.get("/trucks/nearby", {
        params: { lat: load.pickup_latitude, lon: load.pickup_longitude, radius_km: 150, limit: 10 },
      }).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: driversData = [], isLoading: driversLoading } = useQuery({
    queryKey: ["reoffer-search-drivers", carrierSearch],
    queryFn: () => shipperApi.searchDrivers(carrierSearch),
    enabled: carrierTab === "driver",
    staleTime: 30_000,
  });

  const { data: ownersData = [], isLoading: ownersLoading } = useQuery({
    queryKey: ["reoffer-search-owners", carrierSearch],
    queryFn: () => shipperApi.searchOwners(carrierSearch),
    enabled: carrierTab === "owner",
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      shipperApi.reOfferLoad(load.id, {
        user_ids: [...selectedCarriers],
        ...(newPrice ? { price_kes: parseFloat(newPrice) } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipper-active-loads"] });
      qc.invalidateQueries({ queryKey: ["shipper-loads"] });
      toast(`Offer sent to ${selectedCarriers.size} carrier${selectedCarriers.size !== 1 ? "s" : ""}`, "success");
      onClose();
    },
    onError: (err) => toast(err?.response?.data?.detail || "Failed to re-offer", "error"),
  });

  const toggleCarrier = (uid) => {
    setSelectedCarriers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) { next.delete(uid); }
      else if (next.size < 5) { next.add(uid); }
      return next;
    });
  };

  const sortedNearby = [...nearbyTrucks].sort((a, b) =>
    nearbySort === "nearest" ? a.distance_km - b.distance_km :
    nearbySort === "rated" ? b.owner_rating - a.owner_rating :
    b.score - a.score
  );

  const pickup = load.pickup_location?.split(",")[0] || load.pickup_location;
  const dropoff = load.dropoff_location?.split(",")[0] || load.dropoff_location;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Offer Again</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {pickup} → {dropoff}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Selection badge */}
          {selectedCarriers.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/30 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
              <p className="text-xs font-semibold text-secondary">
                {selectedCarriers.size}/5 selected — first to accept wins
              </p>
            </div>
          )}

          {/* Optional price update */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Update offer price <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                {currency}
              </span>
              <input
                type="number"
                min="1"
                step="100"
                placeholder={String(Math.round(load.price_kes))}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          </div>

          {/* Tab switcher */}
          <div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-3">
              {[
                { key: "nearby", icon: Navigation2, label: "Nearby" },
                { key: "driver", icon: Truck, label: "Drivers" },
                { key: "owner", icon: Users, label: "Owners" },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCarrierTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    carrierTab === key
                      ? "bg-white dark:bg-slate-700 text-secondary shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Nearby sort controls */}
            {carrierTab === "nearby" && sortedNearby.length > 1 && (
              <div className="flex gap-1 mb-3">
                {[["match", "Best Match"], ["nearest", "Nearest"], ["rated", "Top Rated"]].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNearbySort(key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                      nearbySort === key
                        ? "bg-secondary text-white border-secondary"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Search (driver/owner tabs) */}
            {(carrierTab === "driver" || carrierTab === "owner") && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${carrierTab === "driver" ? "drivers" : "fleet owners"}…`}
                  value={carrierSearch}
                  onChange={(e) => setCarrierSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-secondary/40"
                />
              </div>
            )}

            {/* Carrier list */}
            <div className="space-y-2">
              {carrierTab === "nearby" && (
                nearbyLoading ? (
                  <p className="text-center text-xs text-slate-400 py-4">Scanning nearby carriers…</p>
                ) : sortedNearby.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No carriers found within 150 km</p>
                ) : (
                  sortedNearby.map((truck) => (
                    <NearbyTruckCard
                      key={truck.id}
                      truck={truck}
                      selectedCarriers={selectedCarriers}
                      onToggle={toggleCarrier}
                    />
                  ))
                )
              )}

              {carrierTab === "driver" && (
                driversLoading ? (
                  <p className="text-center text-xs text-slate-400 py-4">Searching…</p>
                ) : driversData.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No drivers found</p>
                ) : (
                  driversData.map((carrier) => (
                    <CarrierCard
                      key={carrier.id}
                      carrier={carrier}
                      type="driver"
                      selected={selectedCarriers.has(String(carrier.id))}
                      onSelect={(c) => toggleCarrier(String(c.id))}
                    />
                  ))
                )
              )}

              {carrierTab === "owner" && (
                ownersLoading ? (
                  <p className="text-center text-xs text-slate-400 py-4">Searching…</p>
                ) : ownersData.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No fleet owners found</p>
                ) : (
                  ownersData.map((carrier) => (
                    <CarrierCard
                      key={carrier.id}
                      carrier={carrier}
                      type="owner"
                      selected={selectedCarriers.has(String(carrier.id))}
                      onSelect={(c) => toggleCarrier(String(c.id))}
                    />
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          {selectedCarriers.size === 0 && (
            <p className="text-xs text-amber-600 text-center mb-3">Select at least one carrier to continue</p>
          )}
          <button
            onClick={() => mutation.mutate()}
            disabled={selectedCarriers.size === 0 || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            {mutation.isPending
              ? "Sending…"
              : `Send to ${selectedCarriers.size || ""} Carrier${selectedCarriers.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
