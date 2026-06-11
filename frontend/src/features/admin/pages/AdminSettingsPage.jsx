import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2, X, SlidersHorizontal, Globe, DollarSign, Package, Building2, Save } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/Toast";

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-xs font-heading font-semibold uppercase tracking-widest rounded-lg transition-colors ${
        active
          ? "bg-violet-700 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, step }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 w-full"
    />
  );
}

function Modal({ title, onClose, children, onSave, saving, disabled }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="font-heading font-bold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            onClick={onSave}
            disabled={disabled || saving}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-heading font-semibold rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Country Config Tab ────────────────────────────────────────────────────────

function CountryConfigTab() {
  const qc = useQueryClient();
  const [editRow, setEditRow] = useState(null);
  const [creating, setCreating] = useState(false);
  const blankCreate = { country_code: "", country_name: "", currency_code: "KES", currency_symbol: "KSh", vat_rate: 0.16, distance_unit: "km", date_format: "DD/MM/YYYY", phone_prefix: "+254", is_active: true };
  const [createForm, setCreateForm] = useState(blankCreate);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: adminApi.getCountryConfigs,
  });

  const setEdit = (k) => (e) => setEditRow((r) => ({ ...r, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setCreate = (k) => (e) => setCreateForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const update = useMutation({
    mutationFn: () => adminApi.updateCountryConfig(editRow.country_code, editRow),
    onSuccess: () => { toast("Country config updated", "success"); qc.invalidateQueries({ queryKey: ["admin-countries"] }); qc.invalidateQueries({ queryKey: ["country-fees"] }); setEditRow(null); },
    onError: (e) => toast(e?.response?.data?.detail || "Update failed", "error"),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createCountryConfig({ ...createForm, vat_rate: parseFloat(createForm.vat_rate) }),
    onSuccess: () => { toast("Country added", "success"); qc.invalidateQueries({ queryKey: ["admin-countries"] }); setCreating(false); setCreateForm(blankCreate); },
    onError: (e) => toast(e?.response?.data?.detail || "Create failed", "error"),
  });

  const remove = useMutation({
    mutationFn: (code) => adminApi.deleteCountryConfig(code),
    onSuccess: () => { toast("Country removed", "success"); qc.invalidateQueries({ queryKey: ["admin-countries"] }); },
    onError: (e) => toast(e?.response?.data?.detail || "Delete failed", "error"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">Manage supported countries, currencies, VAT and localization settings.</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-heading font-semibold px-3 py-2 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Country
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                {["Code", "Country", "Currency", "Symbol", "VAT", "Phone Prefix", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-heading font-bold uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country_code} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-heading font-bold text-violet-300">{r.country_code}</td>
                  <td className="px-4 py-3 text-slate-200">{r.country_name}</td>
                  <td className="px-4 py-3 text-slate-300">{r.currency_code}</td>
                  <td className="px-4 py-3 text-slate-300">{r.currency_symbol}</td>
                  <td className="px-4 py-3 text-slate-300">{(r.vat_rate * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-slate-300">{r.phone_prefix}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-heading ${r.is_active ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditRow({ ...r })} className="text-slate-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm(`Remove ${r.country_code}?`)) remove.mutate(r.country_code); }} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <Modal title={`Edit ${editRow.country_code}`} onClose={() => setEditRow(null)} onSave={() => update.mutate()} saving={update.isPending} disabled={!editRow.country_name}>
          <FieldRow label="Country Name"><Input value={editRow.country_name} onChange={setEdit("country_name")} /></FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Currency Code"><Input value={editRow.currency_code} onChange={setEdit("currency_code")} /></FieldRow>
            <FieldRow label="Symbol"><Input value={editRow.currency_symbol} onChange={setEdit("currency_symbol")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="VAT Rate (e.g. 0.16)"><Input type="number" step="0.01" value={editRow.vat_rate} onChange={setEdit("vat_rate")} /></FieldRow>
            <FieldRow label="Phone Prefix"><Input value={editRow.phone_prefix} onChange={setEdit("phone_prefix")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Distance Unit"><Input value={editRow.distance_unit} onChange={setEdit("distance_unit")} /></FieldRow>
            <FieldRow label="Date Format"><Input value={editRow.date_format} onChange={setEdit("date_format")} /></FieldRow>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={editRow.is_active} onChange={setEdit("is_active")} className="rounded" />
            Active
          </label>
        </Modal>
      )}

      {creating && (
        <Modal title="Add Country" onClose={() => setCreating(false)} onSave={() => create.mutate()} saving={create.isPending} disabled={!createForm.country_code || !createForm.country_name}>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="ISO-2 Code *"><Input value={createForm.country_code} onChange={setCreate("country_code")} placeholder="KE" /></FieldRow>
            <FieldRow label="Country Name *"><Input value={createForm.country_name} onChange={setCreate("country_name")} placeholder="Kenya" /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Currency Code"><Input value={createForm.currency_code} onChange={setCreate("currency_code")} /></FieldRow>
            <FieldRow label="Symbol"><Input value={createForm.currency_symbol} onChange={setCreate("currency_symbol")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="VAT Rate"><Input type="number" step="0.01" value={createForm.vat_rate} onChange={setCreate("vat_rate")} /></FieldRow>
            <FieldRow label="Phone Prefix"><Input value={createForm.phone_prefix} onChange={setCreate("phone_prefix")} /></FieldRow>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Platform Fees Tab ─────────────────────────────────────────────────────────

function PlatformFeesTab() {
  const qc = useQueryClient();
  const [filterCountry, setFilterCountry] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [creating, setCreating] = useState(false);
  const blankCreate = { country_code: "", service_type: "truck", commission_rate: 0.05, shipper_commission_rate: 0.03, carrier_commission_rate: 0.07, cancellation_fee_rate: 0.05, vat_rate: 0.16, min_commission_kes: 500, max_commission_kes: 15000, is_active: true };
  const [createForm, setCreateForm] = useState(blankCreate);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-fees", filterCountry],
    queryFn: () => adminApi.getPlatformFees(filterCountry || undefined),
  });

  const { data: countries = [] } = useQuery({ queryKey: ["admin-countries"], queryFn: adminApi.getCountryConfigs });

  const setEdit = (k) => (e) => setEditRow((r) => ({ ...r, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setCreate = (k) => (e) => setCreateForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const numFields = ["commission_rate", "shipper_commission_rate", "carrier_commission_rate", "cancellation_fee_rate", "vat_rate", "min_commission_kes", "max_commission_kes"];
  const parseNums = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, numFields.includes(k) && v !== "" ? parseFloat(v) : v]));

  const update = useMutation({
    mutationFn: () => adminApi.updatePlatformFee(editRow.id, parseNums(editRow)),
    onSuccess: () => { toast("Fees updated", "success"); qc.invalidateQueries({ queryKey: ["admin-fees"] }); qc.invalidateQueries({ queryKey: ["country-fees"] }); setEditRow(null); },
    onError: (e) => toast(e?.response?.data?.detail || "Update failed", "error"),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createPlatformFee(parseNums(createForm)),
    onSuccess: () => { toast("Fee config added", "success"); qc.invalidateQueries({ queryKey: ["admin-fees"] }); setCreating(false); setCreateForm(blankCreate); },
    onError: (e) => toast(e?.response?.data?.detail || "Create failed", "error"),
  });

  const pct = (v) => v != null ? `${Math.round(v * 100)}%` : "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-heading font-semibold uppercase tracking-widest">Country:</label>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="">All</option>
            {countries.map((c) => <option key={c.country_code} value={c.country_code}>{c.country_code} — {c.country_name}</option>)}
          </select>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-heading font-semibold px-3 py-2 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Config
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                {["Country", "Service", "Shipper %", "Carrier %", "Cancel %", "Max Cap", "VAT", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-heading font-bold uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-heading font-bold text-violet-300">{r.country_code}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{r.service_type}</td>
                  <td className="px-4 py-3 text-slate-200">{pct(r.shipper_commission_rate)}</td>
                  <td className="px-4 py-3 text-slate-200">{pct(r.carrier_commission_rate)}</td>
                  <td className="px-4 py-3 text-slate-200">{pct(r.cancellation_fee_rate)}</td>
                  <td className="px-4 py-3 text-slate-300">{r.max_commission_kes ? Number(r.max_commission_kes).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{pct(r.vat_rate)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-heading ${r.is_active ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                      {r.is_active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditRow({ ...r })} className="text-slate-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <Modal title={`Edit ${editRow.country_code} / ${editRow.service_type}`} onClose={() => setEditRow(null)} onSave={() => update.mutate()} saving={update.isPending}>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Shipper Rate (e.g. 0.03)"><Input type="number" step="0.001" value={editRow.shipper_commission_rate ?? ""} onChange={setEdit("shipper_commission_rate")} /></FieldRow>
            <FieldRow label="Carrier Rate (e.g. 0.07)"><Input type="number" step="0.001" value={editRow.carrier_commission_rate ?? ""} onChange={setEdit("carrier_commission_rate")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Cancellation Rate (e.g. 0.05)"><Input type="number" step="0.001" value={editRow.cancellation_fee_rate ?? ""} onChange={setEdit("cancellation_fee_rate")} /></FieldRow>
            <FieldRow label="VAT Rate (e.g. 0.16)"><Input type="number" step="0.01" value={editRow.vat_rate} onChange={setEdit("vat_rate")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Min Commission (KES)"><Input type="number" step="1" value={editRow.min_commission_kes} onChange={setEdit("min_commission_kes")} /></FieldRow>
            <FieldRow label="Max Cap (KES)"><Input type="number" step="100" value={editRow.max_commission_kes ?? ""} onChange={setEdit("max_commission_kes")} /></FieldRow>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={editRow.is_active} onChange={setEdit("is_active")} className="rounded" />
            Active
          </label>
        </Modal>
      )}

      {creating && (
        <Modal title="Add Fee Config" onClose={() => setCreating(false)} onSave={() => create.mutate()} saving={create.isPending} disabled={!createForm.country_code || !createForm.service_type}>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Country Code *">
              <select value={createForm.country_code} onChange={setCreate("country_code")} className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select…</option>
                {countries.map((c) => <option key={c.country_code} value={c.country_code}>{c.country_code}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Service Type *">
              <select value={createForm.service_type} onChange={setCreate("service_type")} className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["truck","van","pickup","parcel","mover","airfreight"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Shipper Rate"><Input type="number" step="0.001" value={createForm.shipper_commission_rate} onChange={setCreate("shipper_commission_rate")} /></FieldRow>
            <FieldRow label="Carrier Rate"><Input type="number" step="0.001" value={createForm.carrier_commission_rate} onChange={setCreate("carrier_commission_rate")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Cancellation Rate"><Input type="number" step="0.001" value={createForm.cancellation_fee_rate} onChange={setCreate("cancellation_fee_rate")} /></FieldRow>
            <FieldRow label="VAT Rate"><Input type="number" step="0.01" value={createForm.vat_rate} onChange={setCreate("vat_rate")} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Min Commission KES"><Input type="number" step="1" value={createForm.min_commission_kes} onChange={setCreate("min_commission_kes")} /></FieldRow>
            <FieldRow label="Max Cap KES"><Input type="number" step="100" value={createForm.max_commission_kes} onChange={setCreate("max_commission_kes")} /></FieldRow>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Subscription Plans Tab ────────────────────────────────────────────────────

function SubscriptionPlansTab() {
  const qc = useQueryClient();
  const [editRow, setEditRow] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: adminApi.getSubscriptionPlans,
  });

  const setEdit = (k) => (e) => setEditRow((r) => ({
    ...r,
    [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  const update = useMutation({
    mutationFn: () => adminApi.updateSubscriptionPlan(editRow.id, {
      name: editRow.name,
      price_kes: parseFloat(editRow.price_kes),
      max_trucks: editRow.max_trucks ? parseInt(editRow.max_trucks) : null,
      max_drivers: editRow.max_drivers ? parseInt(editRow.max_drivers) : null,
      includes_api_access: editRow.includes_api_access,
      includes_analytics: editRow.includes_analytics,
      includes_priority_matching: editRow.includes_priority_matching,
      description: editRow.description || null,
      is_active: editRow.is_active,
    }),
    onSuccess: () => { toast("Plan updated", "success"); qc.invalidateQueries({ queryKey: ["admin-plans"] }); setEditRow(null); },
    onError: (e) => toast(e?.response?.data?.detail || "Update failed", "error"),
  });

  const tierColor = (t) => ({
    free: "bg-slate-700/50 text-slate-300",
    fleet_basic: "bg-blue-900/50 text-blue-300",
    fleet_pro: "bg-violet-900/50 text-violet-300",
    enterprise: "bg-amber-900/50 text-amber-300",
  }[t] ?? "bg-slate-700/50 text-slate-300");

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">Edit subscription plan prices and feature limits.</p>
      {isLoading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                {["Name", "Tier", "Billing", "Price (KES)", "Trucks", "Drivers", "Features", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-heading font-bold uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-200 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-heading ${tierColor(r.tier)}`}>{r.tier}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{r.billing_cycle}</td>
                  <td className="px-4 py-3 font-heading font-bold text-slate-100">{Number(r.price_kes).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{r.max_trucks ?? "∞"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.max_drivers ?? "∞"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {[r.includes_api_access && "API", r.includes_analytics && "Analytics", r.includes_priority_matching && "Priority"].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-heading ${r.is_active ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                      {r.is_active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditRow({ ...r })} className="text-slate-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <Modal title={`Edit Plan — ${editRow.name}`} onClose={() => setEditRow(null)} onSave={() => update.mutate()} saving={update.isPending}>
          <FieldRow label="Plan Name"><Input value={editRow.name} onChange={setEdit("name")} /></FieldRow>
          <FieldRow label="Price (KES)"><Input type="number" step="1" value={editRow.price_kes} onChange={setEdit("price_kes")} /></FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Max Trucks (blank = ∞)"><Input type="number" step="1" value={editRow.max_trucks ?? ""} onChange={setEdit("max_trucks")} placeholder="unlimited" /></FieldRow>
            <FieldRow label="Max Drivers (blank = ∞)"><Input type="number" step="1" value={editRow.max_drivers ?? ""} onChange={setEdit("max_drivers")} placeholder="unlimited" /></FieldRow>
          </div>
          <div className="space-y-2">
            {[
              ["includes_api_access", "API Access"],
              ["includes_analytics", "Analytics"],
              ["includes_priority_matching", "Priority Matching"],
              ["is_active", "Active"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={!!editRow[key]} onChange={setEdit(key)} className="rounded" />
                {label}
              </label>
            ))}
          </div>
          <FieldRow label="Description (optional)">
            <textarea
              value={editRow.description ?? ""}
              onChange={setEdit("description")}
              rows={2}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 w-full resize-none"
            />
          </FieldRow>
        </Modal>
      )}
    </div>
  );
}

// ── Company Profile Tab ───────────────────────────────────────────────────────

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 w-full resize-y"
    />
  );
}

function CompanyProfileTab() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["company-profile-admin"],
    queryFn: () =>
      import("@/services/apiClient").then(({ default: api }) =>
        api.get("/settings/company-profile").then((r) => r.data)
      ),
  });

  const [form, setForm] = useState(null);

  // Sync form when data loads
  if (data?.profile && !form) setForm({ ...data.profile });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: () =>
      import("@/services/apiClient").then(({ default: api }) =>
        api.put("/admin/settings/company-profile", form)
      ),
    onSuccess: () => {
      toast("Company profile saved", "success");
      qc.invalidateQueries({ queryKey: ["company-profile-admin"] });
    },
    onError: () => toast("Failed to save", "error"),
  });

  if (isLoading || !form) {
    return <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>;
  }

  const cs = data?.computed_stats;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-white text-sm">Company / About Page</h3>
          <p className="text-slate-500 text-xs mt-0.5">Controls the public <code className="text-violet-400">/company</code> page content.</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-heading font-semibold rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saveMutation.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <FieldRow label="Tagline (hero headline)">
            <Input value={form.tagline} onChange={set("tagline")} placeholder="Built to move Africa's freight." />
          </FieldRow>
        </div>
        <div className="sm:col-span-2">
          <FieldRow label="Subtitle (hero body)">
            <Textarea value={form.subtitle} onChange={set("subtitle")} rows={3} placeholder="Short paragraph shown in the hero section." />
          </FieldRow>
        </div>
        <FieldRow label="HQ City">
          <Input value={form.hq_city} onChange={set("hq_city")} placeholder="Nairobi, Kenya" />
        </FieldRow>
        <FieldRow label="Founded Year">
          <Input value={form.founded_year} onChange={(e) => setForm((f) => ({ ...f, founded_year: Number(e.target.value) }))} type="number" placeholder="2023" />
        </FieldRow>
      </div>

      {/* Live computed stats — read-only, auto-calculated from DB */}
      <div>
        <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Live Platform Stats <span className="normal-case text-slate-600 font-normal">(auto-computed from DB, read-only)</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Carriers", cs?.carriers],
            ["Countries", cs?.countries],
            ["Shipments", cs?.shipments],
          ].map(([label, val]) => (
            <div key={label} className="bg-white/5 border border-white/8 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-white font-heading">{val ?? "—"}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section visibility toggles */}
      <div className="space-y-3">
        <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-400">
          Section Visibility
        </p>

        {/* Stats section toggle */}
        <div className="bg-white/5 border border-white/8 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!form.show_stats_section}
              onChange={(e) => setForm((f) => ({ ...f, show_stats_section: e.target.checked }))}
              className="sr-only"
            />
            <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${form.show_stats_section ? "bg-violet-600" : "bg-slate-700"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.show_stats_section ? "translate-x-5" : ""}`} />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Show Stats Section</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Only goes public when this is enabled <span className="font-semibold text-slate-400">and</span> carriers ≥ 100.
                Current carriers: <span className={`font-semibold ${(cs?.carriers ?? 0) >= 100 ? "text-green-400" : "text-amber-400"}`}>{cs?.carriers ?? 0}</span>
              </p>
            </div>
          </label>
        </div>

        {/* Testimonials section toggle */}
        <div className="bg-white/5 border border-white/8 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!form.show_testimonials_section}
              onChange={(e) => setForm((f) => ({ ...f, show_testimonials_section: e.target.checked }))}
              className="sr-only"
            />
            <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${form.show_testimonials_section ? "bg-violet-600" : "bg-slate-700"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.show_testimonials_section ? "translate-x-5" : ""}`} />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Show Testimonials Section</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Only goes public when this is enabled <span className="font-semibold text-slate-400">and</span> at least one featured testimonial exists. Feature testimonials via the Feedback page.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-400">Mission Section</p>
        <FieldRow label="Mission Headline">
          <Input value={form.mission_headline} onChange={set("mission_headline")} placeholder="Digitise freight so every cargo move is fast, fair, and traceable." />
        </FieldRow>
        <FieldRow label="Mission Body (separate paragraphs with blank line)">
          <Textarea value={form.mission_body} onChange={set("mission_body")} rows={6} placeholder="Paragraph 1&#10;&#10;Paragraph 2" />
        </FieldRow>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.admin_role === "super_admin";
  const [activeTab, setActiveTab] = useState("countries");

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <SlidersHorizontal className="w-12 h-12 text-slate-600 mb-4" />
        <h2 className="font-heading text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          Platform settings are only accessible to Super Admins. Contact your Super Admin if you need configuration changes.
        </p>
      </div>
    );
  }

  const tabs = [
    { key: "countries", label: "Countries",       icon: Globe      },
    { key: "fees",      label: "Platform Fees",   icon: DollarSign },
    { key: "plans",     label: "Subscription Plans", icon: Package },
    { key: "company",   label: "Company Profile", icon: Building2  },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <SlidersHorizontal className="w-5 h-5 text-violet-400" />
          <h1 className="font-heading text-2xl font-bold text-white">Platform Settings</h1>
        </div>
        <p className="text-slate-500 text-sm">Manage countries, commission rates, and subscription plans.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <TabBtn key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} />
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        {activeTab === "countries" && <CountryConfigTab />}
        {activeTab === "fees"      && <PlatformFeesTab />}
        {activeTab === "plans"     && <SubscriptionPlansTab />}
        {activeTab === "company"   && <CompanyProfileTab />}
      </div>
    </div>
  );
}
