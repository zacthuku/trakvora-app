import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, List, Map, Building2, SlidersHorizontal, Zap, CheckCircle2, Tag,
  ChevronDown, X, ArrowUpDown, Truck as TruckIcon, Calendar, Weight,
} from "lucide-react";
import { loadsApi } from "@/features/loads/api/loadsApi";
import apiClient from "@/services/apiClient";
import AcceptFixedModal from "@/features/loads/components/AcceptFixedModal";
import Select from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCurrency } from "@/hooks/useCurrency";
import { CARGO_TYPES, CORRIDORS } from "@/utils/constants";
import LoadsMapView from "@/components/map/LoadsMapView";
import PartnerBadge from "@/components/ui/PartnerBadge";

const TRUCK_TYPES = [
  { value: "motorcycle_courier", label: "Motorcycle" },
  { value: "cargo_bike",         label: "Cargo Bike"  },
  { value: "van",                label: "Van"          },
  { value: "pickup",             label: "Pickup"       },
  { value: "dry_van",            label: "Dry Van"      },
  { value: "tipper",             label: "Tipper"       },
  { value: "flatbed",            label: "Flatbed"      },
  { value: "reefer",             label: "Reefer"       },
  { value: "tanker",             label: "Tanker"       },
  { value: "lowbed",             label: "Lowbed"       },
];

const SORT_OPTIONS = [
  { value: "",           label: "Newest First"   },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "urgent",     label: "Urgent First"   },
];

export default function LoadMarketplacePage() {
  const { format } = useCurrency();
  const navigate = useNavigate();

  const [fixedLoad,  setFixedLoad]  = useState(null);
  const [view,       setView]       = useState("loads"); // "loads" | "trucks"
  const [cargoType,  setCargoType]  = useState("");
  const [corridor,   setCorridor]   = useState("");
  const [truckType,  setTruckType]  = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sort,       setSort]       = useState("");
  const [page,       setPage]       = useState(1);
  const [mapMode,    setMapMode]    = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [cargoType, corridor, truckType, urgentOnly ? "1" : ""].filter(Boolean).length;

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", cargoType, corridor, truckType, urgentOnly, sort, page],
    queryFn: () =>
      loadsApi.getMarketplace({
        cargo_type:   cargoType  || undefined,
        corridor:     corridor   || undefined,
        truck_type:   truckType  || undefined,
        urgent:       urgentOnly || undefined,
        sort:         sort       || undefined,
        page,
        page_size: 20,
      }),
  });

  const { data: returnWindows = [], isLoading: rwLoading } = useQuery({
    queryKey: ["return-windows-browse"],
    queryFn: () => apiClient.get("/return-windows/browse").then((r) => r.data),
    enabled: view === "trucks",
    staleTime: 30_000,
  });

  if (isLoading && view === "loads") return <PageSpinner />;

  const loads = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const resetFilters = () => {
    setCargoType(""); setCorridor(""); setTruckType(""); setUrgentOnly(false);
    setSort(""); setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
          Marketplace
        </h1>
        <div className="flex items-center gap-2">
          {view === "loads" && (
            <>
              <span className="text-sm text-slate-500 dark:text-slate-400">{total} loads</span>
              <div className="ml-1 flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setMapMode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !mapMode ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setMapMode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    mapMode ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" /> Map
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl mb-5 w-fit">
        <button
          onClick={() => setView("loads")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === "loads" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <List className="w-3.5 h-3.5" /> Available Loads
        </button>
        <button
          onClick={() => setView("trucks")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === "trucks" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <TruckIcon className="w-3.5 h-3.5" /> Available Trucks
        </button>
      </div>

      {/* Available Trucks (return windows) */}
      {view === "trucks" && (
        <div>
          {rwLoading ? (
            <PageSpinner />
          ) : returnWindows.length === 0 ? (
            <div className="card p-12 text-center text-slate-500">
              No available trucks posted yet. Fleet owners can post empty-leg availability from their dashboard.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {returnWindows.map((rw) => (
                <div key={rw.id} className="card-accent p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TruckIcon className="w-4 h-4 text-violet-500 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {rw.origin_location} → {rw.destination_location}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 text-[10px] font-bold uppercase">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rw.available_from ? new Date(rw.available_from).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "Flexible"}
                          {rw.available_until ? ` – ${new Date(rw.available_until).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Weight className="w-3 h-3" />
                          {rw.capacity_tonnes}t capacity
                        </span>
                      </div>
                      {rw.notes && <p className="text-xs text-slate-400 mt-1.5 italic">{rw.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter bar — only for loads tab */}
      {view === "loads" && (<>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select
          options={[{ value: "", label: "All cargo types" }, ...CARGO_TYPES]}
          value={cargoType}
          onChange={(e) => { setCargoType(e.target.value); setPage(1); }}
        />
        <Select
          options={[{ value: "", label: "All corridors" }, ...CORRIDORS.map((c) => ({ value: c, label: c }))]}
          value={corridor}
          onChange={(e) => { setCorridor(e.target.value); setPage(1); }}
        />

        {/* More filters toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
            showFilters || activeFilterCount > 0
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-500"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/30 text-[9px] font-bold">{activeFilterCount}</span>
          )}
        </button>

        {/* Sort */}
        <Select
          options={SORT_OPTIONS}
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
        />

        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Truck Type</label>
            <Select
              options={[{ value: "", label: "Any truck" }, ...TRUCK_TYPES]}
              value={truckType}
              onChange={(e) => { setTruckType(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={urgentOnly}
                onChange={(e) => { setUrgentOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Urgent only
              </span>
            </label>
          </div>
        </div>
      )}

      {mapMode && (
        <div className="h-[540px] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm mb-4">
          <LoadsMapView
            loads={loads}
            onLoadClick={(load) => navigate(`/owner/loads/${load.id}`)}
          />
        </div>
      )}

      {!mapMode && loads.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          No loads match your filters
        </div>
      ) : !mapMode ? (
        <>
          <div className="flex flex-col gap-3">
            {loads.map((load) => (
              <Link
                key={load.id}
                to={`/owner/loads/${load.id}`}
                className="card-accent p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Route + urgent badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {load.pickup_location} → {load.dropoff_location}
                      </span>
                      {load.is_urgent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-700">
                          <Zap className="w-2.5 h-2.5" /> URGENT
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-x-2 gap-y-1 mt-1.5 flex-wrap text-sm text-slate-500 dark:text-slate-400">
                      <span>{load.weight_tonnes}t</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="capitalize">{load.cargo_type?.replace(/_/g, " ")}</span>
                      {load.required_truck_type && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-medium capitalize">
                            {load.required_truck_type?.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                      {load.corridor && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span>{load.corridor}</span>
                        </>
                      )}
                    </div>

                    {/* Shipper + partner tier */}
                    {(load.shipper_name || load.shipper_company) && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{load.shipper_company || load.shipper_name}</span>
                        </div>
                        {load.shipper_partner_tier && load.shipper_partner_tier !== "standard" && (
                          <PartnerBadge tier={load.shipper_partner_tier} size="sm" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price + status */}
                  <div className="text-right shrink-0">
                    <div className="font-data-mono font-bold text-lg text-slate-900 dark:text-white">
                      {format(load.price_kes)}
                    </div>
                    <StatusBadge status={load.status} />
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 capitalize">
                      {load.booking_mode?.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>

                {load.special_instructions && (
                  <p className="text-xs text-slate-400 mt-2 italic truncate">{load.special_instructions}</p>
                )}
                {load.booking_mode === "fixed" && load.status === "available" && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFixedLoad(load); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accept at {format(load.price_kes)}
                  </button>
                )}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-outline text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : null}
      </>)}
      {fixedLoad && <AcceptFixedModal load={fixedLoad} onClose={() => setFixedLoad(null)} />}
    </div>
  );
}
