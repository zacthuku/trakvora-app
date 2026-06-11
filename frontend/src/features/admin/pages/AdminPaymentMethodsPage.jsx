import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import apiClient from "@/services/apiClient";
import { PageSpinner } from "@/components/ui/Spinner";

const COUNTRIES = [
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Uganda" },
  { code: "TZ", name: "Tanzania" },
  { code: "RW", name: "Rwanda" },
];

const api = {
  list:   (cc) => apiClient.get("/admin/payment-methods", { params: { country_code: cc } }).then(r => r.data),
  create: (body) => apiClient.post("/admin/payment-methods", body).then(r => r.data),
  update: (id, body) => apiClient.put(`/admin/payment-methods/${id}`, body).then(r => r.data),
  toggle: (id) => apiClient.patch(`/admin/payment-methods/${id}/toggle`).then(r => r.data),
  del:    (id) => apiClient.delete(`/admin/payment-methods/${id}`),
};

const EMPTY_FORM = {
  country_code: "KE",
  method_id: "",
  label: "",
  type: "mobile",
  field: "phone",
  bank_code: "",
  mobile_bank: "",
  icon: "",
  is_active: true,
  sort_order: 0,
  notes: "",
  recipient_account: "",
  recipient_name: "",
};

function MethodForm({ initial, countryCode, onSubmit, onClose, isPending, error }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, country_code: countryCode, ...initial });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      sort_order: Number(form.sort_order) || 0,
      bank_code: form.bank_code || null,
      mobile_bank: form.mobile_bank || null,
      icon: form.icon || null,
      notes: form.notes || null,
      recipient_account: form.recipient_account || null,
      recipient_name: form.recipient_name || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-white">{initial?.id ? "Edit Payment Method" : "Add Payment Method"}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 grid grid-cols-2 gap-4">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Country
            <select
              value={form.country_code}
              onChange={e => set("country_code", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Method ID <span className="text-red-500">*</span>
            <input
              required
              type="text"
              value={form.method_id}
              onChange={e => set("method_id", e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="e.g. mpesa, family_bank"
              disabled={!!initial?.id}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>

          <label className="col-span-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Display Label <span className="text-red-500">*</span>
            <input
              required
              type="text"
              value={form.label}
              onChange={e => set("label", e.target.value)}
              placeholder="e.g. M-Pesa, Family Bank"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Type <span className="text-red-500">*</span>
            <select
              value={form.type}
              onChange={e => { set("type", e.target.value); set("field", e.target.value === "mobile" ? "phone" : "account"); }}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="mobile">Mobile Money</option>
              <option value="bank">Bank</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Input Field
            <select
              value={form.field}
              onChange={e => set("field", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="phone">Phone Number</option>
              <option value="account">Account Number</option>
            </select>
          </label>

          {form.type === "mobile" ? (
            <label className="col-span-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Mobile Bank ID (IntaSend)
              <input
                type="text"
                value={form.mobile_bank}
                onChange={e => set("mobile_bank", e.target.value)}
                placeholder="e.g. MPS, AIRTEL, MTN_UG"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
              />
            </label>
          ) : (
            <label className="col-span-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Bank Code (IntaSend)
              <input
                type="text"
                value={form.bank_code}
                onChange={e => set("bank_code", e.target.value)}
                placeholder="e.g. 063, 017, SBU"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Icon (emoji)
            <input
              type="text"
              value={form.icon}
              onChange={e => set("icon", e.target.value)}
              placeholder="📱 or 🏦"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Sort Order
            <input
              type="number"
              value={form.sort_order}
              onChange={e => set("sort_order", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          </label>

          <label className="col-span-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Notes (admin only)
            <input
              type="text"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="e.g. Official partner, added 2024"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          </label>

          <div className="col-span-2 border-t border-slate-200 dark:border-slate-600 pt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">trakvora Receiving Account</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {form.type === "mobile" ? "Paybill / Till / Phone" : "Bank Account Number"}
                <input
                  type="text"
                  value={form.recipient_account}
                  onChange={e => set("recipient_account", e.target.value)}
                  placeholder={form.type === "mobile" ? "e.g. 522533 or 0700000000" : "e.g. 0123456789"}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Account Name
                <input
                  type="text"
                  value={form.recipient_name}
                  onChange={e => set("recipient_name", e.target.value)}
                  placeholder="e.g. trakvora Limited"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <label className="col-span-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set("is_active", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Active (visible to users)
          </label>

          {error && (
            <p className="col-span-2 text-sm text-red-600">{error?.response?.data?.detail || "An error occurred"}</p>
          )}

          <div className="col-span-2 flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : initial?.id ? "Save Changes" : "Add Method"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
      type === "mobile"
        ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    }`}>
      {type}
    </span>
  );
}

export default function AdminPaymentMethodsPage() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("KE");
  const [formTarget, setFormTarget] = useState(null); // null = closed, {} = create, row = edit

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["admin-payment-methods", country],
    queryFn: () => api.list(country),
  });

  const createMut = useMutation({
    mutationFn: api.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); setFormTarget(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); setFormTarget(null); },
  });

  const toggleMut = useMutation({
    mutationFn: api.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }),
  });

  const deleteMut = useMutation({
    mutationFn: api.del,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }),
  });

  const isEditing = formTarget && formTarget.id;
  const activeMut = isEditing ? updateMut : createMut;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">Payment Methods</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage which payment methods are available per country.
          </p>
        </div>
        <button
          onClick={() => setFormTarget({ country_code: country })}
          className="flex items-center gap-2 bg-secondary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add Method
        </button>
      </div>

      {/* Country tabs */}
      <div className="flex gap-2 flex-wrap">
        {COUNTRIES.map(c => (
          <button
            key={c.code}
            onClick={() => setCountry(c.code)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              country === c.code
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Methods table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : methods.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No payment methods for {COUNTRIES.find(c => c.code === country)?.name}. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-left">
                  {["", "Label", "ID", "Type", "IntaSend Code", "Sort", "Notes", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {methods.map(m => (
                  <tr key={m.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${!m.is_active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-lg">{m.icon || (m.type === "mobile" ? "📱" : "🏦")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{m.label}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{m.method_id}</td>
                    <td className="px-4 py-3"><TypeBadge type={m.type} /></td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      {m.type === "mobile" ? m.mobile_bank : m.bank_code}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.sort_order}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[160px] truncate">{m.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setFormTarget(m)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleMut.mutate(m.id)}
                          className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 ${m.is_active ? "text-teal-500 hover:text-teal-700" : "text-slate-400 hover:text-slate-600"}`}
                          title={m.is_active ? "Deactivate" : "Activate"}
                        >
                          {m.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${m.label}"? This cannot be undone.`)) deleteMut.mutate(m.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete (super admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formTarget !== null && (
        <MethodForm
          initial={formTarget.id ? formTarget : { country_code: country }}
          countryCode={country}
          onClose={() => setFormTarget(null)}
          isPending={activeMut.isPending}
          error={activeMut.error}
          onSubmit={(data) => {
            if (formTarget.id) {
              const { method_id, country_code, ...updateData } = data;
              updateMut.mutate({ id: formTarget.id, body: updateData });
            } else {
              createMut.mutate(data);
            }
          }}
        />
      )}
    </div>
  );
}
