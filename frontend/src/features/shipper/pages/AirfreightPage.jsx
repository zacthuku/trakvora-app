import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plane, Calendar, Weight, DollarSign, AlertTriangle } from "lucide-react";
import { shipperApi } from "../api/shipperApi";
import LocationSearch from "@/components/ui/LocationSearch";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

const LOC = { name: "", lat: null, lng: null };

const EMPTY = {
  port_of_origin: LOC,
  port_of_destination: LOC,
  airline: "",
  flight_number: "",
  expected_departure: "",
  hawb: "",
  mawb: "",
  cargo_description: "",
  cargo_weight_kg: "",
  volume_cbm: "",
  declared_value_usd: "",
  is_dangerous_goods: false,
  iata_code: "",
  special_instructions: "",
  price_kes: "",
};

export default function AirfreightPage() {
  const { currency } = useCountryConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (data) => shipperApi.createAirfreight(data),
    onSuccess: () => navigate("/shipper/shipments"),
    onError: (err) => setError(err.response?.data?.detail || "Booking failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const { port_of_origin, port_of_destination, ...rest } = form;
    mut.mutate({
      ...rest,
      port_of_origin: port_of_origin.name || "",
      port_of_destination: port_of_destination.name || "",
      cargo_weight_kg: parseFloat(form.cargo_weight_kg),
      volume_cbm: form.volume_cbm ? parseFloat(form.volume_cbm) : null,
      declared_value_usd: form.declared_value_usd ? parseFloat(form.declared_value_usd) : null,
      price_kes: parseFloat(form.price_kes),
      airline: form.airline || null,
      flight_number: form.flight_number || null,
      expected_departure: form.expected_departure || null,
      hawb: form.hawb || null,
      mawb: form.mawb || null,
      cargo_description: form.cargo_description || null,
      iata_code: form.iata_code || null,
      special_instructions: form.special_instructions || null,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Plane className="w-5 h-5 text-secondary" />
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Airfreight Booking</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Urgent or high-value cargo via air.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Route */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Route</p>
          <LocationSearch
            label="Origin Airport / Port"
            value={form.port_of_origin}
            onChange={(loc) => set("port_of_origin", loc)}
            placeholder="Search origin airport or city…"
          />
          <LocationSearch
            label="Destination Airport / Port"
            value={form.port_of_destination}
            onChange={(loc) => set("port_of_destination", loc)}
            placeholder="Search destination airport or city…"
          />
        </section>

        {/* Flight details */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Flight Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Airline</label>
              <input value={form.airline} onChange={(e) => set("airline", e.target.value)} placeholder="Kenya Airways" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Flight Number</label>
              <input value={form.flight_number} onChange={(e) => set("flight_number", e.target.value)} placeholder="KQ 101" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Expected Departure</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="datetime-local" value={form.expected_departure} onChange={(e) => set("expected_departure", e.target.value)} className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
          </div>
        </section>

        {/* AWB numbers */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Waybill Numbers</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">HAWB</label>
              <input value={form.hawb} onChange={(e) => set("hawb", e.target.value)} placeholder="House Air Waybill" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">MAWB</label>
              <input value={form.mawb} onChange={(e) => set("mawb", e.target.value)} placeholder="Master Air Waybill" className={inputCls} />
            </div>
          </div>
        </section>

        {/* Cargo */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cargo Details</p>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Cargo Description</label>
            <input value={form.cargo_description} onChange={(e) => set("cargo_description", e.target.value)} placeholder="e.g. Medical equipment, automotive parts…" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Weight (kg) *</label>
              <div className="relative">
                <Weight className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" step="0.01" min="0.01" required value={form.cargo_weight_kg} onChange={(e) => set("cargo_weight_kg", e.target.value)} placeholder="500" className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Volume (CBM)</label>
              <input type="number" step="0.01" min="0" value={form.volume_cbm} onChange={(e) => set("volume_cbm", e.target.value)} placeholder="2.5" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Declared Value (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" step="0.01" min="0" value={form.declared_value_usd} onChange={(e) => set("declared_value_usd", e.target.value)} placeholder="10000" className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">{`Quote (${currency}) *`}</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" step="1" min="1" required value={form.price_kes} onChange={(e) => set("price_kes", e.target.value)} placeholder="150000" className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
          </div>

          {/* Dangerous goods */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.is_dangerous_goods} onChange={(e) => set("is_dangerous_goods", e.target.checked)} className="w-4 h-4 accent-secondary" />
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Dangerous goods (IATA regulated)
            </label>
            {form.is_dangerous_goods && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">IATA Hazmat Class</label>
                <input value={form.iata_code} onChange={(e) => set("iata_code", e.target.value)} placeholder="e.g. Class 3 — Flammable Liquids" className={inputCls} />
              </div>
            )}
          </div>
        </section>

        {/* Instructions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Special Instructions</label>
          <textarea rows={2} value={form.special_instructions} onChange={(e) => set("special_instructions", e.target.value)} placeholder="Temperature requirements, customs docs, handling notes…" className={inputCls + " resize-none"} />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={mut.isPending || !form.port_of_origin.name || !form.port_of_destination.name} className="flex-1 bg-secondary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors">
            {mut.isPending ? "Booking…" : "Confirm Airfreight Booking"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
