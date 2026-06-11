import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Calendar, Weight, Plus, Trash2, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ownerApi } from "../api/ownerApi";
import LocationSearch from "@/components/ui/LocationSearch";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

const LOC = { name: "", lat: null, lng: null };

const EMPTY_FORM = {
  truck_id: "",
  origin: LOC,
  destination: LOC,
  available_from: "",
  available_until: "",
  capacity_tonnes: "",
  notes: "",
};

export default function ReturnWindowPage() {
  const { format } = useCurrency();
  const { currency } = useCountryConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [expandedMatches, setExpandedMatches] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: windows = [], isLoading } = useQuery({
    queryKey: ["return-windows"],
    queryFn: ownerApi.getReturnWindows,
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: ownerApi.getMyTrucks,
  });

  const { data: matchData = [] } = useQuery({
    queryKey: ["return-window-matches"],
    queryFn: ownerApi.getReturnWindowMatches,
    enabled: windows.length > 0,
  });

  const matchesByWindowId = Object.fromEntries(matchData.map((m) => [m.window_id, m.matches]));

  const toggleMatches = (windowId) =>
    setExpandedMatches((prev) => ({ ...prev, [windowId]: !prev[windowId] }));

  const createMut = useMutation({
    mutationFn: (data) => ownerApi.createReturnWindow(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-windows"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setError(null);
    },
    onError: (err) => setError(err.response?.data?.detail || "Failed to post return window"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => ownerApi.deleteReturnWindow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["return-windows"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => ownerApi.toggleReturnWindow(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["return-windows"] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMut.mutate({
      truck_id: form.truck_id,
      origin_location: form.origin.name,
      origin_latitude: form.origin.lat || 0,
      origin_longitude: form.origin.lng || 0,
      destination_location: form.destination.name,
      destination_latitude: form.destination.lat || 0,
      destination_longitude: form.destination.lng || 0,
      available_from: form.available_from,
      available_until: form.available_until || null,
      capacity_tonnes: parseFloat(form.capacity_tonnes),
      notes: form.notes || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Return Windows</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Post empty-leg availability to attract backhaul loads.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Post Window
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">New Return Window</h3>

          {/* Truck selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Truck</label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select required value={form.truck_id} onChange={(e) => set("truck_id", e.target.value)} className={inputCls.replace("px-3", "pl-9")}>
                <option value="">Select a truck…</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.registration_number} — {t.make} {t.model} ({t.capacity_tonnes}t)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Origin */}
          <LocationSearch
            label="Origin Location"
            value={form.origin}
            onChange={(loc) => set("origin", loc)}
            placeholder="Search origin location…"
          />

          {/* Destination */}
          <LocationSearch
            label="Destination Location"
            value={form.destination}
            onChange={(loc) => set("destination", loc)}
            placeholder="Search destination location…"
          />

          {/* Dates + capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Available From *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" required value={form.available_from} onChange={(e) => set("available_from", e.target.value)} className={inputCls.replace("px-3", "pl-9")} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Available Until</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={form.available_until} onChange={(e) => set("available_until", e.target.value)} className={inputCls.replace("px-3", "pl-9")} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Capacity (tonnes) *</label>
              <div className="relative">
                <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" step="0.1" min="0.1" required value={form.capacity_tonnes} onChange={(e) => set("capacity_tonnes", e.target.value)} placeholder="e.g. 10" className={inputCls.replace("px-3", "pl-9")} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any special conditions or load preferences…" className={inputCls + " resize-none"} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={createMut.isPending || !form.origin.lat || !form.destination.lat} className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors">
              {createMut.isPending ? "Posting…" : "Post Return Window"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Posted Windows ({windows.length})</p>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : windows.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No return windows posted yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {windows.map((w) => (
              <li key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start gap-4 px-4 py-4">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${w.is_active ? "bg-teal-400" : "bg-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {w.origin_location} → {w.destination_location}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${w.is_active ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600"}`}>
                        {w.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400">
                      <span>{w.capacity_tonnes}t capacity</span>
                      <span>From {w.available_from}{w.available_until ? ` – ${w.available_until}` : ""}</span>
                    </div>
                    {w.notes && <p className="text-xs text-slate-400 mt-1 italic">{w.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleMatches(w.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/5 transition-colors"
                      title="Show matching loads"
                    >
                      {expandedMatches[w.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Matches {matchesByWindowId[w.id]?.length > 0 ? `(${matchesByWindowId[w.id].length})` : ""}
                    </button>
                    <button
                      onClick={() => toggleMut.mutate({ id: w.id, is_active: !w.is_active })}
                      disabled={toggleMut.isPending}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${w.is_active ? "bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-600 hover:bg-red-50 hover:text-red-600" : "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100"}`}
                      title={w.is_active ? "Deactivate" : "Activate"}
                    >
                      {w.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(w.id)}
                      disabled={deleteMut.isPending}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expandedMatches[w.id] && (
                  <div className="mx-4 mb-3 border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                    {!matchesByWindowId[w.id] || matchesByWindowId[w.id].length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 px-4">No matching loads within 100 km.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                        {matchesByWindowId[w.id].map((m) => (
                          <li key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200 font-medium">
                                <span className="truncate max-w-[100px]">{(m.pickup_location || "").split(",")[0]}</span>
                                <ArrowRight className="w-3 h-3 shrink-0 text-slate-300" />
                                <span className="truncate max-w-[100px]">{(m.dropoff_location || "").split(",")[0]}</span>
                              </div>
                              <div className="flex gap-3 mt-0.5 text-[11px] text-slate-400">
                                <span className="capitalize">{m.cargo_type}</span>
                                <span>{m.weight_tonnes}t</span>
                                <span>{format(Number(m.price_kes), "KES")}</span>
                                {m.pickup_date && <span>{m.pickup_date}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => navigate(`/owner/marketplace/${m.id}`)}
                              className="ml-3 text-xs text-secondary font-semibold hover:underline shrink-0"
                            >
                              View
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
