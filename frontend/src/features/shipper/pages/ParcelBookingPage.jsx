import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Package, Weight, DollarSign, Phone, User } from "lucide-react";
import { shipperApi } from "../api/shipperApi";
import { useCurrency } from "@/hooks/useCurrency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import LocationSearch from "@/components/ui/LocationSearch";

const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

const SERVICE_LEVELS = [
  { value: "standard", label: "Standard",  desc: "2–5 business days" },
  { value: "express",  label: "Express",   desc: "Next day delivery" },
  { value: "same_day", label: "Same Day",  desc: "Within hours" },
];

const LOC = { name: "", lat: null, lng: null };

const EMPTY = {
  pickup: LOC,
  dropoff: LOC,
  weight_kg: "", length_cm: "", width_cm: "", height_cm: "",
  contents_description: "", declared_value_kes: "",
  is_fragile: false, requires_insurance: false,
  service_level: "standard",
  recipient_name: "", recipient_phone: "",
  special_instructions: "", price_kes: "",
};

export default function ParcelBookingPage() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { currency, dialCode } = useCountryConfig();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (data) => shipperApi.createParcel(data),
    onSuccess: () => navigate("/shipper/shipments"),
    onError: (err) => setError(err.response?.data?.detail || "Booking failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const { pickup, dropoff, ...rest } = form;
    mut.mutate({
      ...rest,
      pickup_location: pickup.name,
      pickup_latitude: pickup.lat || 0,
      pickup_longitude: pickup.lng || 0,
      dropoff_location: dropoff.name,
      dropoff_latitude: dropoff.lat || 0,
      dropoff_longitude: dropoff.lng || 0,
      weight_kg: parseFloat(form.weight_kg),
      length_cm: form.length_cm ? parseFloat(form.length_cm) : null,
      width_cm: form.width_cm ? parseFloat(form.width_cm) : null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      declared_value_kes: form.declared_value_kes ? parseFloat(form.declared_value_kes) : null,
      price_kes: parseFloat(form.price_kes),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-secondary" />
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Book a Parcel</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Send a package — standard, express, or same-day.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pickup */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pickup</p>
          <LocationSearch
            label="Pickup Address"
            value={form.pickup}
            onChange={(loc) => set("pickup", loc)}
            placeholder="Search pickup location…"
          />
        </section>

        {/* Dropoff */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dropoff</p>
          <LocationSearch
            label="Delivery Address"
            value={form.dropoff}
            onChange={(loc) => set("dropoff", loc)}
            placeholder="Search delivery location…"
          />
        </section>

        {/* Parcel details */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parcel Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Weight (kg) *</label>
              <div className="relative">
                <Weight className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" step="0.01" min="0.01" required value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} placeholder="0.5" className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">L (cm)</label>
              <input type="number" step="0.1" min="0" value={form.length_cm} onChange={(e) => set("length_cm", e.target.value)} placeholder="30" className={inputCls + " text-xs"} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">W (cm)</label>
              <input type="number" step="0.1" min="0" value={form.width_cm} onChange={(e) => set("width_cm", e.target.value)} placeholder="20" className={inputCls + " text-xs"} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">H (cm)</label>
              <input type="number" step="0.1" min="0" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} placeholder="15" className={inputCls + " text-xs"} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Contents Description</label>
            <input value={form.contents_description} onChange={(e) => set("contents_description", e.target.value)} placeholder="e.g. Electronics, clothing, documents…" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{`Declared Value (${currency})`}</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" step="1" min="0" value={form.declared_value_kes} onChange={(e) => set("declared_value_kes", e.target.value)} placeholder="5000" className={inputCls.replace("px-3", "pl-9")} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{`Quoted Price (${currency}) *`}</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" step="1" min="1" required value={form.price_kes} onChange={(e) => set("price_kes", e.target.value)} placeholder="800" className={inputCls.replace("px-3", "pl-9")} />
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.is_fragile} onChange={(e) => set("is_fragile", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Fragile
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.requires_insurance} onChange={(e) => set("requires_insurance", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Requires insurance
            </label>
          </div>
        </section>

        {/* Service level */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Service Level</p>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_LEVELS.map((sl) => (
              <button
                key={sl.value}
                type="button"
                onClick={() => set("service_level", sl.value)}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  form.service_level === sl.value
                    ? "border-secondary bg-secondary/5"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{sl.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sl.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Recipient */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recipient</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} placeholder="Full name" className={inputCls.replace("px-3", "pl-9")} />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={form.recipient_phone} onChange={(e) => set("recipient_phone", e.target.value)} placeholder={`${dialCode} 7XX XXX XXX`} className={inputCls.replace("px-3", "pl-9")} />
            </div>
          </div>
          <textarea rows={2} value={form.special_instructions} onChange={(e) => set("special_instructions", e.target.value)} placeholder="Special handling instructions…" className={inputCls + " resize-none"} />
        </section>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={mut.isPending || !form.pickup.lat || !form.dropoff.lat} className="flex-1 bg-secondary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors">
            {mut.isPending ? "Booking…" : "Confirm Booking"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
