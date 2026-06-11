import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Search, CalendarDays, Filter, Download, FileText,
  Receipt, ChevronLeft, ChevronRight, ArrowRight, Star, X,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { shipperApi } from "../api/shipperApi";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCSV() {
  try {
    const response = await apiClient.get("/reports/shipments.csv", { responseType: "blob" });
    downloadBlob(response.data, "shipments.csv");
  } catch {
    alert("Export failed. Please try again.");
  }
}

async function exportPDF() {
  try {
    const response = await apiClient.get("/reports/shipments.pdf", { responseType: "blob" });
    downloadBlob(response.data, `trakvora-shipments-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch {
    alert("PDF export failed. Please try again.");
  }
}

async function downloadInvoice(loadId) {
  try {
    const shipment = await apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data);
    const response = await apiClient.get(`/reports/shipments/${shipment.id}/invoice.pdf`, { responseType: "blob" });
    downloadBlob(response.data, `invoice-${loadId.slice(0, 8)}.pdf`);
  } catch {
    alert("Invoice download failed.");
  }
}

function RatingModal({ loadId, onClose, onSuccess }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const shipment = await apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data);
      return apiClient.post(`/shipments/${shipment.id}/rate`, { rating: stars, comment: comment || null });
    },
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Rate Your Carrier</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1 justify-center mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className="w-8 h-8"
                fill={(hover || stars) >= n ? "#f59e0b" : "none"}
                stroke={(hover || stars) >= n ? "#f59e0b" : "#cbd5e1"}
              />
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none mb-4 focus:outline-none focus:border-secondary"
        />
        {mut.isError && <p className="text-xs text-red-600 mb-2">{mut.error?.response?.data?.detail || "Rating failed"}</p>}
        <button
          disabled={stars === 0 || mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full bg-secondary text-white py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors"
        >
          {mut.isPending ? "Submitting…" : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

const DATE_RANGES = [
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "365", label: "This Year" },
  { value: "all", label: "All Time" },
];

function withinDays(dateStr, days) {
  if (days === "all") return true;
  const cutoff = Date.now() - parseInt(days, 10) * 86400 * 1000;
  return new Date(dateStr).getTime() >= cutoff;
}

const STATUS_PILL = {
  delivered:  "bg-primary/10 text-primary",
  completed:  "bg-primary/10 text-primary",
  cancelled:  "bg-secondary/10 text-secondary",
  pending:    "bg-amber-100 text-amber-700",
  confirmed:  "bg-sky-100 text-sky-700",
};

const SERVICE_TYPE_COLORS = {
  Truck:   "bg-sky-100 text-sky-700",
  Parcel:  "bg-violet-100 text-violet-700",
  Movers:  "bg-amber-100 text-amber-700",
  Air:     "bg-blue-100 text-blue-700",
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}

function ServiceTypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${SERVICE_TYPE_COLORS[type] ?? "bg-slate-100 text-slate-500"}`}>
      {type}
    </span>
  );
}

export default function ShipmentHistoryPage() {
  const { format } = useCurrency();
  const { currency, distance_unit: distUnit } = useCountryConfig();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("90");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [ratingLoadId, setRatingLoadId] = useState(null);
  const [ratedIds, setRatedIds] = useState(new Set());

  const { data, isLoading: isLoadingLoads } = useQuery({
    queryKey: ["shipper-history"],
    queryFn: () =>
      apiClient.get("/loads/mine", { params: { page: 1, page_size: 100 } }).then((r) => r.data),
  });

  const { data: parcels = [], isLoading: isLoadingParcels } = useQuery({
    queryKey: ["my-parcels"],
    queryFn: () => shipperApi.listParcels(),
  });

  const { data: moveRequests = [], isLoading: isLoadingMoves } = useQuery({
    queryKey: ["my-move-requests"],
    queryFn: () => shipperApi.listMoveRequests(),
  });

  const { data: airfreightData = [], isLoading: isLoadingAir } = useQuery({
    queryKey: ["my-airfreight"],
    queryFn: () => shipperApi.listAirfreight(),
  });

  const isLoading = isLoadingLoads || isLoadingParcels || isLoadingMoves || isLoadingAir;

  const filtered = useMemo(() => {
    const truckLoads = (data?.items ?? [])
      .filter((l) => ["delivered", "cancelled"].includes(l.status))
      .map((l) => ({
        id: l.id, serviceType: "Truck",
        _pickup: l.pickup_location, _dropoff: l.dropoff_location,
        _cargo: l.cargo_type, _distance: l.distance_km, price_kes: l.price_kes,
        status: l.status, created_at: l.created_at,
      }));

    const parcelItems = parcels.map((p) => ({
      id: p.id, serviceType: "Parcel",
      _pickup: p.pickup_location, _dropoff: p.dropoff_location,
      _cargo: p.contents_description, _distance: null, price_kes: p.price_kes,
      status: p.status, created_at: p.created_at,
    }));

    const moveItems = moveRequests.map((m) => ({
      id: m.id, serviceType: "Movers",
      _pickup: m.origin_location, _dropoff: m.destination_location,
      _cargo: m.move_type, _distance: null, price_kes: m.price_kes,
      status: m.status, created_at: m.created_at,
    }));

    const airItems = airfreightData.map((a) => ({
      id: a.id, serviceType: "Air",
      _pickup: a.port_of_origin, _dropoff: a.port_of_destination,
      _cargo: "Air cargo", _distance: null, price_kes: a.price_kes,
      status: a.status, created_at: a.created_at,
    }));

    const all = [...truckLoads, ...parcelItems, ...moveItems, ...airItems]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return all.filter((item) => {
      const matchSearch =
        !search ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item._pickup || "").toLowerCase().includes(search.toLowerCase()) ||
        (item._dropoff || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchDate = withinDays(item.created_at, dateRange);
      return matchSearch && matchStatus && matchDate;
    });
  }, [data, parcels, moveRequests, airfreightData, search, statusFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const inputCls = "pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400";

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Booking History</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review and export all your past logistics bookings.</p>
      </div>

      {/* Filter & action bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 shadow-sm flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search ID or route…"
              className={`w-full ${inputCls}`}
            />
          </div>

          {/* Date range */}
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
              className={`pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 appearance-none`}
            >
              {DATE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 appearance-none`}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Export actions */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
              <tr>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID / Route</th>
                <th className="hidden sm:table-cell py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="hidden md:table-cell py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="hidden md:table-cell py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Distance</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">{`Cost (${currency})`}</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">No bookings found</td></tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-700/60 transition-colors">
                    {/* ID / Route */}
                    <td className="py-3.5 px-4">
                      <span className="block font-mono text-xs font-semibold text-primary tracking-wide">
                        TRK-{item.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="truncate max-w-[100px]">{(item._pickup || "").split(",")[0]}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 text-slate-300" />
                        <span className="truncate max-w-[100px]">{(item._dropoff || "").split(",")[0]}</span>
                      </span>
                    </td>

                    {/* Date */}
                    <td className="hidden sm:table-cell py-3.5 px-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>

                    {/* Type / Cargo */}
                    <td className="hidden md:table-cell py-3.5 px-4">
                      <ServiceTypeBadge type={item.serviceType} />
                      {item._cargo && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{item._cargo}</p>
                      )}
                    </td>

                    {/* Distance */}
                    <td className="hidden md:table-cell py-3.5 px-4 text-sm text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                      {item._distance ? `${item._distance.toLocaleString()} ${distUnit}` : "—"}
                    </td>

                    {/* Cost */}
                    <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-primary whitespace-nowrap">
                      {format(item.price_kes)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusPill status={item.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.serviceType === "Truck" && item.status === "delivered" && !ratedIds.has(item.id) && (
                          <button
                            title="Rate Carrier"
                            onClick={() => setRatingLoadId(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        {item.serviceType === "Truck" && (
                          <button
                            title="Download Invoice"
                            onClick={() => downloadInvoice(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length === 0 ? "No entries" : `Showing ${from}–${to} of ${filtered.length}`}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = i + 1;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${safePage === n ? "bg-secondary text-white" : "text-slate-500 hover:bg-slate-200"}`}>
                  {n}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {ratingLoadId && (
        <RatingModal
          loadId={ratingLoadId}
          onClose={() => setRatingLoadId(null)}
          onSuccess={() => setRatedIds((prev) => new Set([...prev, ratingLoadId]))}
        />
      )}
    </div>
  );
}
