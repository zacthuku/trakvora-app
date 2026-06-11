import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Home, Calendar, DollarSign, Plus, Trash2 } from "lucide-react";
import { shipperApi } from "../api/shipperApi";
import LocationSearch from "@/components/ui/LocationSearch";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

const MOVE_TYPES = [
  { value: "home",    label: "Home" },
  { value: "office",  label: "Office" },
  { value: "storage", label: "Storage" },
];

const EMPTY_ITEM = { item: "", quantity: 1, fragile: false };

const LOC = { name: "", lat: null, lng: null };

const EMPTY = {
  origin: LOC,
  origin_floor: "0", origin_has_lift: false,
  destination: LOC,
  destination_floor: "0", destination_has_lift: false,
  move_date: "", move_type: "home",
  num_rooms: "", estimated_volume_cbm: "",
  requires_packing: false, requires_storage: false,
  special_instructions: "", price_kes: "",
};

export default function MoverBookingPage() {
  const { currency } = useCountryConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const setItem = (i, k, v) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const mut = useMutation({
    mutationFn: (data) => shipperApi.createMoveRequest(data),
    onSuccess: () => navigate("/shipper/shipments"),
    onError: (err) => setError(err.response?.data?.detail || "Booking failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const { origin, destination, ...rest } = form;
    mut.mutate({
      ...rest,
      origin_location: origin.name,
      origin_latitude: origin.lat || 0,
      origin_longitude: origin.lng || 0,
      origin_floor: parseInt(form.origin_floor, 10) || 0,
      destination_location: destination.name,
      destination_latitude: destination.lat || 0,
      destination_longitude: destination.lng || 0,
      destination_floor: parseInt(form.destination_floor, 10) || 0,
      num_rooms: form.num_rooms ? parseInt(form.num_rooms, 10) : null,
      estimated_volume_cbm: form.estimated_volume_cbm ? parseFloat(form.estimated_volume_cbm) : null,
      price_kes: parseFloat(form.price_kes),
      inventory_items: items.filter((it) => it.item.trim()).map((it) => ({
        ...it,
        quantity: parseInt(it.quantity, 10) || 1,
      })),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Home className="w-5 h-5 text-secondary" />
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Book Movers</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Home, office, or storage relocation service.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Move type */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Move Type</p>
          <div className="flex gap-3">
            {MOVE_TYPES.map((mt) => (
              <button
                key={mt.value}
                type="button"
                onClick={() => set("move_type", mt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  form.move_type === mt.value
                    ? "border-secondary bg-secondary/5 text-secondary"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {mt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Origin */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Origin</p>
          <LocationSearch
            label="Pickup Address"
            value={form.origin}
            onChange={(loc) => set("origin", loc)}
            placeholder="Search origin location…"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Floor</label>
              <input type="number" min="0" value={form.origin_floor} onChange={(e) => set("origin_floor", e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer mt-5">
              <input type="checkbox" checked={form.origin_has_lift} onChange={(e) => set("origin_has_lift", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Lift available
            </label>
          </div>
        </section>

        {/* Destination */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Destination</p>
          <LocationSearch
            label="Delivery Address"
            value={form.destination}
            onChange={(loc) => set("destination", loc)}
            placeholder="Search destination location…"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Floor</label>
              <input type="number" min="0" value={form.destination_floor} onChange={(e) => set("destination_floor", e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer mt-5">
              <input type="checkbox" checked={form.destination_has_lift} onChange={(e) => set("destination_has_lift", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Lift available
            </label>
          </div>
        </section>

        {/* Move details */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Move Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Move Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={form.move_date} onChange={(e) => set("move_date", e.target.value)} className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Rooms</label>
              <input type="number" min="1" value={form.num_rooms} onChange={(e) => set("num_rooms", e.target.value)} placeholder="3" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Volume (CBM)</label>
              <input type="number" step="0.1" min="0" value={form.estimated_volume_cbm} onChange={(e) => set("estimated_volume_cbm", e.target.value)} placeholder="20" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">{`Price (${currency}) *`}</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" step="1" min="1" required value={form.price_kes} onChange={(e) => set("price_kes", e.target.value)} placeholder="25000" className={inputCls.replace("px-3", "pl-8 text-xs")} />
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.requires_packing} onChange={(e) => set("requires_packing", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Packing service
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.requires_storage} onChange={(e) => set("requires_storage", e.target.checked)} className="w-4 h-4 accent-secondary" />
              Storage required
            </label>
          </div>
        </section>

        {/* Inventory */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inventory List</p>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-secondary font-semibold hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item.item}
                  onChange={(e) => setItem(i, "item", e.target.value)}
                  placeholder="Item name (e.g. Sofa)"
                  className={inputCls + " flex-1"}
                />
                <input
                  type="number" min="1"
                  value={item.quantity}
                  onChange={(e) => setItem(i, "quantity", e.target.value)}
                  className={inputCls + " w-16 text-center"}
                />
                <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 cursor-pointer shrink-0">
                  <input type="checkbox" checked={item.fragile} onChange={(e) => setItem(i, "fragile", e.target.checked)} className="w-3.5 h-3.5 accent-secondary" />
                  Fragile
                </label>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Instructions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Special Instructions</label>
          <textarea rows={2} value={form.special_instructions} onChange={(e) => set("special_instructions", e.target.value)} placeholder="Fragile electronics, narrow staircase, access codes…" className={inputCls + " resize-none"} />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={mut.isPending || !form.origin.lat || !form.destination.lat} className="flex-1 bg-secondary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-colors">
            {mut.isPending ? "Booking…" : "Confirm Move Booking"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
