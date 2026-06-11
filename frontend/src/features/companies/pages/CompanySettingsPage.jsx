import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CheckCircle2, Users, Search, Trash2, ShieldCheck } from "lucide-react";
import { companiesApi } from "../api/companiesApi";
import { useCompanyStore } from "@/store/companyStore";
import PartnerBadge from "@/components/ui/PartnerBadge";

const inputCls =
  "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

function PreferredCarriersPanel({ companyId }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addError, setAddError] = useState(null);

  const { data: preferred = [], isLoading } = useQuery({
    queryKey: ["preferred-carriers", companyId],
    queryFn: () => companiesApi.listPreferredCarriers(companyId),
    enabled: !!companyId,
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["carrier-search", search],
    queryFn: () => companiesApi.searchCarriers(search),
    enabled: search.length >= 2,
    staleTime: 30_000,
  });

  const addMut = useMutation({
    mutationFn: (carrier_user_id) => companiesApi.addPreferredCarrier(companyId, carrier_user_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preferred-carriers", companyId] });
      setSearch("");
      setAddError(null);
    },
    onError: (err) => setAddError(err.response?.data?.detail || "Failed to add carrier"),
  });

  const removeMut = useMutation({
    mutationFn: (carrier_user_id) => companiesApi.removePreferredCarrier(companyId, carrier_user_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferred-carriers", companyId] }),
  });

  const preferredIds = new Set(preferred.map((p) => p.carrier_user_id));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Preferred Carrier Network</h3>
        <span className="ml-auto text-xs text-slate-400">{preferred.length} carrier{preferred.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Loads marked "Preferred Partners Only" are visible only to carriers in this network.
        </p>

        {/* Search to add */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setAddError(null); }}
            placeholder="Search carrier by name or phone…"
            className={inputCls.replace("px-3", "pl-9")}
          />
        </div>

        {addError && <p className="text-xs text-red-600">{addError}</p>}

        {search.length >= 2 && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
            {searching ? (
              <p className="text-xs text-slate-400 p-3">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-slate-400 p-3">No carriers found</p>
            ) : (
              searchResults.map((c) => {
                const alreadyAdded = preferredIds.has(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.full_name}</p>
                      <p className="text-xs text-slate-400">{c.phone} · {c.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PartnerBadge tier={c.partner_tier} />
                      {alreadyAdded ? (
                        <span className="text-xs text-teal-600 font-semibold">Added</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addMut.mutate(c.id)}
                          disabled={addMut.isPending}
                          className="text-xs bg-secondary text-white px-3 py-1 rounded-lg font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Current preferred carriers list */}
        {isLoading ? (
          <p className="text-xs text-slate-400 py-2">Loading…</p>
        ) : preferred.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No preferred carriers yet. Search above to add.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {preferred.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.carrier_name}</p>
                  <p className="text-xs text-slate-400">{p.carrier_phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PartnerBadge tier={p.partner_tier} />
                  <button
                    type="button"
                    onClick={() => removeMut.mutate(p.carrier_user_id)}
                    disabled={removeMut.isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CompanySettingsPage() {
  const qc = useQueryClient();
  const { companies, createCompany, fetchCompanies, activeCompanyId, setActiveCompany } = useCompanyStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", kra_pin: "", industry: "", country_code: "KE", website: "" });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: activeCompany } = useQuery({
    queryKey: ["company", activeCompanyId],
    queryFn: () => companiesApi.getCompany(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  const createMut = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      fetchCompanies();
      setShowCreate(false);
      setForm({ name: "", kra_pin: "", industry: "", country_code: "KE", website: "" });
      qc.invalidateQueries(["company"]);
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Company Account</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your business profile and team access.</p>
      </div>

      {/* Company switcher */}
      {companies.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Active Company</label>
          <select
            value={activeCompanyId || ""}
            onChange={(e) => setActiveCompany(e.target.value)}
            className={inputCls}
          >
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Active company card */}
      {activeCompany && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-secondary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{activeCompany.name}</h2>
                {activeCompany.is_verified && (
                  <span className="flex items-center gap-1 text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{activeCompany.industry || "—"}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
                {activeCompany.kra_pin && <span>KRA PIN: <span className="text-slate-800 dark:text-slate-100 font-mono">{activeCompany.kra_pin}</span></span>}
                {activeCompany.website && <span>Website: <a href={activeCompany.website} target="_blank" rel="noopener noreferrer" className="text-secondary underline">{activeCompany.website}</a></span>}
                <span>Country: <span className="text-slate-800 dark:text-slate-100">{activeCompany.country_code}</span></span>
                <span>Members: <span className="text-slate-800 dark:text-slate-100">{activeCompany.member_count}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferred carriers */}
      {activeCompanyId && (
        <PreferredCarriersPanel companyId={activeCompanyId} />
      )}

      {/* Create new company */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-sm text-secondary font-semibold hover:underline"
        >
          + {companies.length === 0 ? "Create your company account" : "Add another company"}
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">New Company</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Company Name *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="Acme Logistics Ltd" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">KRA PIN</label>
              <input value={form.kra_pin} onChange={(e) => set("kra_pin", e.target.value)} className={inputCls} placeholder="P051234567X" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Industry</label>
              <input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={inputCls} placeholder="Manufacturing" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Country</label>
              <select value={form.country_code} onChange={(e) => set("country_code", e.target.value)} className={inputCls}>
                <option value="KE">Kenya</option>
                <option value="UG">Uganda</option>
                <option value="TZ">Tanzania</option>
                <option value="RW">Rwanda</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Website</label>
              <input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="https://example.com" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={createMut.isPending} className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60">
              <Save className="w-4 h-4" /> {createMut.isPending ? "Creating…" : "Create Company"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
