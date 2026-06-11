import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Save, Trash2, X, Fuel, TrendingUp } from "lucide-react";
import apiClient from "@/services/apiClient";

const api = {
  listRates:   (cc) => apiClient.get("/admin/corridor-rates", { params: cc ? { country_code: cc } : {} }).then(r => r.data),
  createRate:  (b)  => apiClient.post("/admin/corridor-rates", b).then(r => r.data),
  updateRate:  (id, b) => apiClient.put(`/admin/corridor-rates/${id}`, b).then(r => r.data),
  deleteRate:  (id) => apiClient.delete(`/admin/corridor-rates/${id}`).then(r => r.data),
  fuelIndex:   ()   => apiClient.get("/admin/fuel-index").then(r => r.data),
};

const COUNTRIES = ["KE", "UG", "TZ", "RW", "ET", "NG"];
const COUNTRY_NAMES = { KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", ET: "Ethiopia", NG: "Nigeria" };
const CURRENCY = { KE: "KES", UG: "UGX", TZ: "TZS", RW: "RWF", ET: "ETB", NG: "NGN" };

function EditableRow({ rate, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState({ base_rate: rate.base_rate, corridor_name: rate.corridor_name, notes: rate.notes || "" });

  if (!editing) {
    return (
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
        <td className="px-4 py-3 text-xs font-mono text-slate-500">{rate.corridor_key}</td>
        <td className="px-4 py-3 text-sm text-slate-800 dark:text-white">{rate.corridor_name}</td>
        <td className="px-4 py-3 text-sm font-bold font-mono text-slate-900 dark:text-white">{rate.base_rate.toLocaleString()}</td>
        <td className="px-4 py-3 text-xs text-slate-400">{rate.notes}</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${rate.is_active ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-500"}`}>
            {rate.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(rate.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-secondary/30">
      <td className="px-4 py-2 text-xs font-mono text-slate-500">{rate.corridor_key}</td>
      <td className="px-4 py-2">
        <input value={val.corridor_name} onChange={e => setVal(v => ({ ...v, corridor_name: e.target.value }))}
          className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800" />
      </td>
      <td className="px-4 py-2">
        <input type="number" value={val.base_rate} onChange={e => setVal(v => ({ ...v, base_rate: parseFloat(e.target.value) }))}
          className="w-24 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800" />
      </td>
      <td className="px-4 py-2">
        <input value={val.notes} onChange={e => setVal(v => ({ ...v, notes: e.target.value }))}
          className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800" />
      </td>
      <td></td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button onClick={() => { onSave(rate.id, val); setEditing(false); }}
            className="p-1.5 text-teal-600 hover:text-teal-800 rounded"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminPricingPage() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("KE");
  const [addForm, setAddForm] = useState(null);

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["admin-corridor-rates", country],
    queryFn:  () => api.listRates(country),
  });
  const { data: fuelRows = [] } = useQuery({ queryKey: ["admin-fuel-index"], queryFn: api.fuelIndex });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.updateRate(id, body),
    onSuccess: () => qc.invalidateQueries(["admin-corridor-rates"]),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteRate(id),
    onSuccess: () => qc.invalidateQueries(["admin-corridor-rates"]),
  });
  const createMut = useMutation({
    mutationFn: (body) => api.createRate(body),
    onSuccess: () => { qc.invalidateQueries(["admin-corridor-rates"]); setAddForm(null); },
  });

  const fuelRow = fuelRows.find(f => f.country_code === country);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">Pricing Management</h1>
        <p className="text-sm text-slate-500 mt-1">Corridor rates auto-adjust via weekly fuel price fetch. Edit manually after market announcements (e.g. KTA rate changes).</p>
      </div>

      {/* Fuel Index */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fuel className="w-4 h-4 text-amber-500" />
          <h2 className="font-bold text-sm text-slate-800 dark:text-white">Fuel Index</h2>
          <span className="text-xs text-slate-400">— Auto-fetched weekly from EPRA / EWURA / URA</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {fuelRows.map(f => (
            <div key={f.country_code} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{f.country_code}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{f.current_price?.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{f.currency_code}/L</p>
              <p className={`text-[10px] font-semibold ${f.fuel_adjustment_factor > 1 ? "text-red-500" : f.fuel_adjustment_factor < 1 ? "text-teal-500" : "text-slate-400"}`}>
                {f.fuel_adjustment_factor?.toFixed(3)}× factor
              </p>
              {f.last_fetched_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(f.last_fetched_at).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Country tabs */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
          {COUNTRIES.map(cc => (
            <button key={cc} onClick={() => setCountry(cc)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap ${
                country === cc
                  ? "bg-primary text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}>
              {cc} — {COUNTRY_NAMES[cc]}
            </button>
          ))}
        </div>

        {/* Fuel factor banner */}
        {fuelRow && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <Fuel className="w-3.5 h-3.5" />
            Current fuel factor: <strong>{fuelRow.fuel_adjustment_factor?.toFixed(3)}×</strong>
            (Diesel: {fuelRow.current_price?.toLocaleString()} {fuelRow.currency_code}/L · Baseline: {fuelRow.baseline_price?.toLocaleString()})
            — Corridor rates are multiplied by this factor automatically.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-left">
                {["Corridor Key", `Name`, `Base Rate (${CURRENCY[country]}/km)`, "Notes", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : rates.map(rate => (
                <EditableRow
                  key={rate.id}
                  rate={rate}
                  onSave={(id, body) => updateMut.mutate({ id, body })}
                  onDelete={(id) => deleteMut.mutate(id)}
                />
              ))}
              {/* Add new row */}
              {addForm ? (
                <tr className="bg-teal-50 dark:bg-teal-900/20 border-b border-teal-200 dark:border-teal-800">
                  {["corridor_key", "corridor_name", "base_rate", "notes"].map(f => (
                    <td key={f} className="px-4 py-2">
                      <input placeholder={f} type={f === "base_rate" ? "number" : "text"}
                        value={addForm[f] || ""}
                        onChange={e => setAddForm(v => ({ ...v, [f]: f === "base_rate" ? parseFloat(e.target.value) : e.target.value }))}
                        className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800" />
                    </td>
                  ))}
                  <td></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => createMut.mutate({ ...addForm, country_code: country })}
                        className="p-1.5 text-teal-600 hover:text-teal-800"><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setAddForm(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-3">
                    <button onClick={() => setAddForm({ corridor_key: "", corridor_name: "", base_rate: 0, notes: "" })}
                      className="flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 font-semibold">
                      <Plus className="w-3.5 h-3.5" /> Add corridor rate
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
