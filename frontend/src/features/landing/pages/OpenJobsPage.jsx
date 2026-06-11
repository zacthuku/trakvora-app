import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package, MapPin, ArrowRight, Search, ChevronRight, X, Loader2, AlertTriangle, Building2,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";

const CARGO_LABELS = {
  general: "General Goods",
  refrigerated: "Refrigerated",
  hazardous: "Hazardous",
  livestock: "Livestock",
  construction: "Building Materials",
  agricultural: "Agricultural Produce",
  electronics: "Electronics",
};

const TRUCK_TYPES = ["All Types", "Trailer Truck", "Truck (FH)", "Small Truck", "Van", "Flatbed", "Tanker", "Tipper"];

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function mapLoad(load) {
  return {
    id: load.id,
    ref: `JOB-${String(load.id).slice(-6).toUpperCase()}`,
    origin: load.pickup_location,
    dest: load.dropoff_location,
    distance: load.distance_km ? `${load.distance_km} km` : null,
    cargo: CARGO_LABELS[load.cargo_type] || load.cargo_type,
    weight: `${load.weight_tonnes} t`,
    truckType: load.required_truck_type || "Any",
    postedAgo: timeAgo(load.created_at),
    pickupDate: load.pickup_date || "TBD",
    budget: `KES ${Number(load.price_kes).toLocaleString()}`,
    bids: load.bid_count,
    shipper: load.shipper_company || load.shipper_name || null,
  };
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold font-heading text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function JobDetailModal({ job, onClose, onBid }) {
  if (!job) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[10px] font-black font-heading text-secondary uppercase tracking-widest">{job.ref}</span>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-secondary shrink-0" />
            <span className="text-base font-bold font-heading text-white">{job.origin}</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 ml-0.5" />
            <span className="text-base font-bold font-heading text-white">{job.dest}</span>
            {job.distance && <span className="text-xs text-slate-400 ml-auto">{job.distance}</span>}
          </div>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-700">
          <DetailField label="Cargo" value={job.cargo} />
          <DetailField label="Weight" value={job.weight} />
          <DetailField label="Truck Type" value={job.truckType} />
          <DetailField label="Pickup Date" value={job.pickupDate} />
          <DetailField label="Posted" value={job.postedAgo} />
          <DetailField label="Bids Placed" value={`${job.bids} bids`} />
          {job.shipper && <DetailField label="Shipper" value={job.shipper} />}
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-heading font-bold">Budget</p>
            <p className="text-2xl font-extrabold font-heading text-primary">{job.budget}</p>
          </div>
          <button
            onClick={() => { onClose(); onBid(); }}
            className="inline-flex items-center gap-1.5 bg-secondary text-white text-sm font-bold font-heading px-6 py-3 rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide"
          >
            Bid Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OpenJobsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [truckFilter, setTruckFilter] = useState("All Types");
  const [selectedJob, setSelectedJob] = useState(null);
  const [bidAlert, setBidAlert] = useState(null); // null | { variant: "warn"|"error", message: string }

  function handleBidNow() {
    if (!user)                        { navigate("/login");                          return; }
    if (user.role === "driver")       { navigate("/driver/jobs");                    return; }
    if (user.role === "owner")        { navigate("/owner/marketplace");              return; }
    if (user.role === "owner_user")   { navigate("/owner/marketplace");              return; }
    if (user.role === "shipper" && user.can_carry) { navigate("/shipper/carrier-marketplace"); return; }
    if (user.role === "admin")        {
      setBidAlert({ variant: "error", message: "Platform administrators cannot participate in marketplace bidding." });
      return;
    }
    if (user.role === "shipper") {
      setBidAlert({ variant: "warn", message: "Your shipper account doesn't have carrier access. Contact support to apply for bidding privileges." });
      return;
    }
    setBidAlert({ variant: "warn", message: "Your account type does not support bidding on loads." });
  }

  useEffect(() => {
    apiClient.get("/loads/public?page_size=50")
      .then((r) => setJobs(r.data.map(mapLoad)))
      .catch(() => setError("Failed to load jobs. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.origin.toLowerCase().includes(q) || j.dest.toLowerCase().includes(q) || j.cargo.toLowerCase().includes(q);
    const matchTruck = truckFilter === "All Types" || j.truckType === truckFilter;
    return matchSearch && matchTruck;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-[#f3f8ff] text-gray-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold font-heading text-secondary uppercase tracking-widest mb-2">Live Board</p>
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">Open Jobs</h1>
              <p className="text-gray-600 text-sm">Available loads posted by verified shippers. Log in to bid.</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-heading font-bold text-gray-800 tracking-wide">
                {loading ? "…" : `${jobs.length} loads live`}
              </span>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by origin, destination, or cargo type…"
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

          {bidAlert && (
            <div className={`flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold font-heading mb-6 border ${
              bidAlert.variant === "error"
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-300"
                : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-300"
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${bidAlert.variant === "error" ? "text-red-500" : "text-amber-500"}`} />
              <span>{bidAlert.message}</span>
              <button onClick={() => setBidAlert(null)} className="ml-auto text-inherit opacity-50 hover:opacity-100 text-lg leading-none">×</button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading jobs…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-heading font-semibold text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-heading font-semibold">No loads match your search</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              {/* Mobile: row list */}
              <div className="md:hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-heading text-slate-900 dark:text-white truncate">
                        {job.origin.split(",")[0]} → {job.dest.split(",")[0]}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{job.cargo} · {job.weight}{job.distance ? ` · ${job.distance}` : ""}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{job.ref} · {job.bids} bids · {job.postedAgo}</p>
                      {job.shipper && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" />{job.shipper}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold font-heading text-primary leading-tight">{job.budget}</p>
                      <ChevronRight className="w-4 h-4 text-slate-300 mt-1 ml-auto" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: card grid */}
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((job) => (
                  <div key={job.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-[10px] font-black font-heading text-slate-400 uppercase tracking-widest">{job.ref}</span>
                        <span className="text-[10px] text-slate-400">{job.postedAgo}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <span className="text-sm font-bold font-heading text-slate-800 dark:text-slate-100">{job.origin}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-0.5" />
                        <span className="text-sm font-bold font-heading text-slate-800 dark:text-slate-100">{job.dest}</span>
                        {job.distance && <span className="text-xs text-slate-400 ml-auto">{job.distance}</span>}
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 gap-3 text-xs">
                      {[["Cargo", job.cargo], ["Weight", job.weight], ["Truck Type", job.truckType], ["Pickup", job.pickupDate]].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-slate-400 uppercase tracking-wide font-heading font-bold mb-0.5">{label}</p>
                          <p className="text-slate-700 dark:text-slate-200 font-semibold">{val}</p>
                        </div>
                      ))}
                    </div>
                    {job.shipper && (
                      <div className="px-5 py-2 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span>{job.shipper}</span>
                      </div>
                    )}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-heading font-bold">Budget</p>
                        <p className="text-base font-extrabold font-heading text-primary">{job.budget}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 mb-1">{job.bids} bids placed</p>
                        <button onClick={handleBidNow} className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-bold font-heading px-4 py-2 rounded-lg hover:opacity-90 transition-opacity uppercase tracking-wide">
                          Bid Now <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-10 bg-primary text-white rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-heading text-xl font-bold mb-1">Want to bid on these loads?</h3>
              <p className="text-slate-400 text-sm">Create a free driver or fleet owner account to place bids and start earning.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link to="/register?role=driver" className="bg-secondary text-white px-6 py-3 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
                Join as Driver
              </Link>
              <Link to="/register?role=owner" className="border border-white/20 text-white px-6 py-3 font-heading font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-colors rounded-xl">
                Fleet Owner
              </Link>
            </div>
          </div>
        </div>
      </section>

      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} onBid={handleBidNow} />
    </div>
  );
}
