import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Truck, MapPin, ArrowRight, Search, Star, Shield, ChevronRight, X, Loader2, AlertTriangle,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { timeAgo } from "@/utils/time";

const TRUCK_TYPE_LABELS = {
  flatbed: "Flatbed",
  dry_van: "Dry Van",
  reefer: "Refrigerated",
  tanker: "Tanker",
  lowbed: "Lowbed",
  tipper: "Tipper",
};

const TRUCK_TYPES = ["All Types", ...Object.values(TRUCK_TYPE_LABELS)];

function mapTruck(t) {
  return {
    id: t.id,
    ref: `FLT-${String(t.id).slice(-6).toUpperCase()}`,
    owner: t.owner_name,
    truckType: TRUCK_TYPE_LABELS[t.truck_type] || t.truck_type,
    capacity: `${t.capacity_tonnes} t`,
    make: t.make,
    model: t.model,
    available: t.is_active ? "Available Now" : "Unavailable",
    rating: t.owner_rating,
    trips: t.owner_trips,
    verified: t.owner_verified,
    plate: t.registration_number,
    lat: t.current_latitude ?? null,
    lng: t.current_longitude ?? null,
    lastSeen: t.last_seen_at ?? null,
  };
}

/**
 * Lightweight location badge for LIST cards — no API call, just a Google Maps link.
 * Geocoding (via useReverseGeocode) is only done inside TruckDetailModal (user-triggered).
 */
function TruckLocationBadge({ lat, lng, lastSeen }) {
  if (!lat || !lng) return null;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#4fdbcc] transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin className="w-3.5 h-3.5 text-[#4fdbcc] shrink-0" />
      <span className="truncate">
        View location
        {lastSeen && <span className="text-slate-400 ml-1">· {timeAgo(lastSeen)}</span>}
      </span>
    </a>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold font-heading text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function TruckDetailModal({ truck, onClose, onHire }) {
  // Hook must be called unconditionally — pass null when no truck to disable it
  const { locationLabel, isLoading: geoLoading } = useReverseGeocode(
    truck?.lat ?? null,
    truck?.lng ?? null,
  );
  if (!truck) return null;
  const isNow = truck.available === "Available Now";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-base font-bold font-heading text-white leading-tight">{truck.owner}</p>
                <p className="text-[10px] text-slate-400 font-heading font-bold uppercase tracking-wider mt-0.5">
                  {truck.ref} · {truck.plate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {truck.verified && (
                <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 px-2 py-1 rounded-full">
                  <Shield className="w-3 h-3 text-teal-400" />
                  <span className="text-[10px] font-bold text-teal-400 font-heading uppercase tracking-wide">Verified</span>
                </div>
              )}
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors ml-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-700">
          <DetailField label="Truck Type" value={truck.truckType} />
          <DetailField label="Capacity" value={truck.capacity} />
          {truck.make && <DetailField label="Make / Model" value={[truck.make, truck.model].filter(Boolean).join(" ")} />}
          <DetailField label="Rating" value={`${truck.rating} ★  (${truck.trips} trips)`} />
          <DetailField label="Plate" value={truck.plate} />
          <DetailField label="Availability" value={truck.available} />
          {truck.lat && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold font-heading text-slate-400 uppercase tracking-widest mb-1">Location</p>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-[#4fdbcc] shrink-0" />
                <span>
                  {geoLoading ? "Locating…" : (locationLabel ?? `${truck.lat.toFixed(3)}, ${truck.lng.toFixed(3)}`)}
                  {truck.lastSeen && (
                    <span className="text-slate-400 font-normal ml-1 text-xs">· {timeAgo(truck.lastSeen)}</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isNow ? "bg-green-500" : "bg-orange-400"}`} />
            <span className={`text-sm font-semibold ${isNow ? "text-green-600" : "text-orange-500"}`}>
              {truck.available}
            </span>
          </div>
          <button
            onClick={() => { onClose(); onHire(); }}
            className="inline-flex items-center gap-1.5 bg-secondary text-white text-sm font-bold font-heading px-6 py-3 rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide"
          >
            Hire Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvailableTrucksPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [truckFilter, setTruckFilter] = useState("All Types");
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [hireAlert, setHireAlert] = useState(null); // null | { variant: "warn"|"error", message: string }

  function handleHireNow() {
    if (!user)                   { navigate("/login");   return; }
    if (user.role === "shipper") { navigate("/shipper"); return; }
    if (user.role === "admin") {
      setHireAlert({ variant: "error", message: "Platform administrators cannot post loads or hire trucks." });
      return;
    }
    if (user.role === "driver" || user.role === "owner" || user.role === "owner_user") {
      setHireAlert({ variant: "warn", message: "You're registered as a carrier. To hire trucks from other carriers you need a shipper account." });
      return;
    }
    setHireAlert({ variant: "warn", message: "Your account type does not support hiring trucks." });
  }

  useEffect(() => {
    apiClient.get("/trucks/public?page_size=50")
      .then((r) => setTrucks(r.data.map(mapTruck)))
      .catch(() => setError("Failed to load trucks. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = trucks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.owner.toLowerCase().includes(q) ||
      t.truckType.toLowerCase().includes(q) ||
      t.plate.toLowerCase().includes(q);
    const matchType = truckFilter === "All Types" || t.truckType === truckFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-[#f3f8ff] text-gray-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold font-heading text-secondary uppercase tracking-widest mb-2">Live Capacity</p>
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">Available Trucks</h1>
              <p className="text-gray-600 text-sm">Verified fleet capacity ready for hire. Log in to post a load.</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-heading font-bold text-gray-800 tracking-wide">
                {loading ? "…" : `${trucks.length} carriers available`}
              </span>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by owner, truck type, or plate…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-secondary transition"
              />
            </div>
            <select
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 text-sm focus:outline-none focus:border-secondary appearance-none cursor-pointer"
            >
              {TRUCK_TYPES.map((t) => <option key={t} value={t} className="text-slate-900">{t}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="py-10 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">

          {hireAlert && (
            <div className={`flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold font-heading mb-6 border ${
              hireAlert.variant === "error"
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-300"
                : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-300"
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${hireAlert.variant === "error" ? "text-red-500" : "text-amber-500"}`} />
              <span>{hireAlert.message}</span>
              <button onClick={() => setHireAlert(null)} className="ml-auto opacity-50 hover:opacity-100 text-lg leading-none">×</button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading trucks…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20 text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-heading font-semibold text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-heading font-semibold">No trucks match your search</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              {/* Mobile: row list */}
              <div className="md:hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((truck) => {
                  const isNow = truck.available === "Available Now";
                  return (
                    <button
                      key={truck.id}
                      onClick={() => setSelectedTruck(truck)}
                      className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-bold font-heading text-slate-900 dark:text-white truncate">{truck.owner}</span>
                          {truck.verified && <Shield className="w-3 h-3 text-teal-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{truck.truckType} · {truck.capacity}</p>
                        {truck.lat && (
                          <div className="mt-0.5">
                            <TruckLocationBadge lat={truck.lat} lng={truck.lng} lastSeen={truck.lastSeen} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{truck.rating}
                          </span>
                          <span className="text-[11px] text-slate-400">{truck.trips} trips</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center justify-end gap-1 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${isNow ? "bg-green-500" : "bg-orange-400"}`} />
                          <span className={`text-[11px] font-semibold ${isNow ? "text-green-600" : "text-orange-500"}`}>
                            {isNow ? "Now" : "Soon"}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop: card grid */}
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((truck) => (
                  <div key={truck.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold font-heading text-white leading-tight">{truck.owner}</p>
                          <p className="text-[10px] text-slate-400 font-heading font-bold uppercase tracking-wider mt-0.5">{truck.ref} · {truck.plate}</p>
                        </div>
                      </div>
                      {truck.verified && (
                        <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 px-2 py-1 rounded-full">
                          <Shield className="w-3 h-3 text-teal-400" />
                          <span className="text-[10px] font-bold text-teal-400 font-heading uppercase tracking-wide">Verified</span>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400 uppercase tracking-wide font-heading font-bold mb-0.5">Truck Type</p>
                          <p className="text-slate-700 dark:text-slate-200 font-semibold">{truck.truckType}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wide font-heading font-bold mb-0.5">Capacity</p>
                          <p className="text-slate-700 dark:text-slate-200 font-semibold">{truck.capacity}</p>
                        </div>
                        {truck.make && (
                          <div className="col-span-2">
                            <p className="text-slate-400 uppercase tracking-wide font-heading font-bold mb-0.5">Vehicle</p>
                            <p className="text-slate-700 dark:text-slate-200 font-semibold">{[truck.make, truck.model].filter(Boolean).join(" ")}</p>
                          </div>
                        )}
                      </div>
                      {truck.lat && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            {truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}
                            {truck.lastSeen && ` · ${truck.lastSeen}`}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{truck.rating}</span>
                          <span className="text-xs text-slate-400 ml-1">({truck.trips} trips)</span>
                        </div>
                        <span className={`text-xs font-semibold ${truck.available === "Available Now" ? "text-green-600" : "text-orange-500"}`}>
                          {truck.available}
                        </span>
                      </div>
                      <button onClick={handleHireNow} className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-bold font-heading px-4 py-2 rounded-lg hover:opacity-90 transition-opacity uppercase tracking-wide">
                        Hire Now <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-10 bg-slate-900 text-white rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-heading text-xl font-bold mb-1">Need to move freight?</h3>
              <p className="text-slate-400 text-sm">Create a free shipper account to post a load and receive bids from verified carriers.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link to="/register?role=shipper" className="bg-secondary text-white px-6 py-3 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
                Post a Load
              </Link>
              <Link to="/for-shippers" className="border border-white/20 text-white px-6 py-3 font-heading font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-colors rounded-xl">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TruckDetailModal truck={selectedTruck} onClose={() => setSelectedTruck(null)} onHire={handleHireNow} />
    </div>
  );
}
