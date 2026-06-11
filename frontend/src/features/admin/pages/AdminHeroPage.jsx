import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Save, Trash2, X, GripVertical, Globe } from "lucide-react";
import apiClient from "@/services/apiClient";

const api = {
  list:   (cc) => apiClient.get("/admin/hero-slides", { params: cc !== "global" ? { country_code: cc } : { country_code: "global" } }).then(r => r.data),
  create: (b)  => apiClient.post("/admin/hero-slides", b).then(r => r.data),
  update: (id, b) => apiClient.put(`/admin/hero-slides/${id}`, b).then(r => r.data),
  remove: (id)    => apiClient.delete(`/admin/hero-slides/${id}`).then(r => r.data),
  reorder: (items) => apiClient.patch("/admin/hero-slides/reorder", items).then(r => r.data),
};

const TABS = [
  { key: "global", label: "Global (all countries)" },
  { key: "KE",     label: "Kenya" },
  { key: "UG",     label: "Uganda" },
  { key: "TZ",     label: "Tanzania" },
];

const IMAGE_TYPES = [
  { value: "dispatch_os",  label: "Dispatch OS Dashboard" },
  { value: "mobile_app",   label: "Mobile App" },
  { value: "fleet_mgmt",   label: "Fleet Management" },
  { value: "finance",      label: "Finance & Billing" },
];

const EMPTY_SLIDE = {
  headline: "", highlight_word: "", description: "",
  image_type: "dispatch_os",
  cta_primary_text: "Get Started", cta_primary_url: "/register",
  cta_secondary_text: "", cta_secondary_url: "",
  sort_order: 0, country_code: null,
};

function SlidePreview({ slide }) {
  const parts = slide.highlight_word && slide.headline.includes(slide.highlight_word)
    ? slide.headline.split(slide.highlight_word)
    : null;
  return (
    <div className="bg-primary text-white rounded-xl p-4 flex-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-full">
        {IMAGE_TYPES.find(t => t.value === slide.image_type)?.label || slide.image_type}
      </span>
      <p className="text-lg font-black font-heading mt-2 leading-tight">
        {parts
          ? <>{parts[0]}<span className="text-secondary">{slide.highlight_word}</span>{parts[1]}</>
          : slide.headline}
      </p>
      <p className="text-xs text-slate-300 mt-2 leading-relaxed">{slide.description}</p>
      <div className="flex gap-2 mt-3">
        {slide.cta_primary_text && (
          <span className="text-[10px] bg-secondary text-white px-3 py-1 rounded-lg font-semibold">
            {slide.cta_primary_text}
          </span>
        )}
        {slide.cta_secondary_text && (
          <span className="text-[10px] border border-white/30 text-white px-3 py-1 rounded-lg">
            {slide.cta_secondary_text}
          </span>
        )}
      </div>
    </div>
  );
}

function SlideForm({ initial, countryKey, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...EMPTY_SLIDE,
    ...initial,
    country_code: countryKey === "global" ? null : countryKey,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = "w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";

  return (
    <div className="flex gap-4 items-start">
      {/* Form */}
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Headline</label>
          <input value={form.headline} onChange={e => set("headline", e.target.value)} className={inputCls} placeholder="Africa's Intelligent Logistics Operating System" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Highlight Word</label>
          <input value={form.highlight_word} onChange={e => set("highlight_word", e.target.value)} className={inputCls} placeholder="Operating" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Image Type</label>
          <select value={form.image_type} onChange={e => set("image_type", e.target.value)} className={inputCls}>
            {IMAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Description</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
            className={inputCls + " resize-none"} placeholder="Short subtitle…" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Primary CTA Text</label>
          <input value={form.cta_primary_text} onChange={e => set("cta_primary_text", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Primary CTA URL</label>
          <input value={form.cta_primary_url} onChange={e => set("cta_primary_url", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Secondary CTA Text (optional)</label>
          <input value={form.cta_secondary_text || ""} onChange={e => set("cta_secondary_text", e.target.value || null)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Secondary CTA URL</label>
          <input value={form.cta_secondary_url || ""} onChange={e => set("cta_secondary_url", e.target.value || null)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Sort Order</label>
          <input type="number" value={form.sort_order} onChange={e => set("sort_order", parseInt(e.target.value))} className={inputCls} />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => onSave(form)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-slate-200">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
      {/* Live preview */}
      <div className="w-56 shrink-0">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-2">Preview</p>
        <SlidePreview slide={form} />
      </div>
    </div>
  );
}

export default function AdminHeroPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("global");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["admin-hero-slides", tab],
    queryFn: () => api.list(tab),
  });

  const createMut = useMutation({
    mutationFn: (b) => api.create(b),
    onSuccess: () => { qc.invalidateQueries(["admin-hero-slides"]); setAdding(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.update(id, body),
    onSuccess: () => { qc.invalidateQueries(["admin-hero-slides"]); setEditingId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: () => qc.invalidateQueries(["admin-hero-slides"]),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => api.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(["admin-hero-slides"]),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">Hero Slides</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage landing page hero carousel. Global slides appear in all countries.
          Country-specific slides supplement global ones for that market.
        </p>
      </div>

      {/* Country tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setAdding(false); setEditingId(null); }}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors
              ${tab === t.key ? "border-secondary text-secondary" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}>
            {t.key === "global" && <Globe className="w-3 h-3 inline mr-1" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Add slide form */}
      {adding ? (
        <div className="bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 rounded-xl p-5">
          <p className="text-sm font-bold text-slate-800 dark:text-white mb-4">New Slide</p>
          <SlideForm
            initial={{ country_code: tab === "global" ? null : tab }}
            countryKey={tab}
            onSave={(body) => createMut.mutate(body)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-secondary/80">
          <Plus className="w-4 h-4" /> Add slide
        </button>
      )}

      {/* Slides list */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          No slides for this scope. Add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide) => (
            <div key={slide.id}
              className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden transition
                ${slide.is_active ? "border-slate-200 dark:border-slate-700" : "border-slate-200 dark:border-slate-700 opacity-60"}`}>
              {editingId === slide.id ? (
                <div className="p-5">
                  <p className="text-sm font-bold text-slate-800 dark:text-white mb-4">Edit Slide</p>
                  <SlideForm
                    initial={slide}
                    countryKey={tab}
                    onSave={(body) => updateMut.mutate({ id: slide.id, body })}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4">
                  <GripVertical className="w-4 h-4 text-slate-300 mt-1 shrink-0 cursor-grab" />
                  <div className="flex gap-3 flex-1 min-w-0">
                    {/* Preview */}
                    <SlidePreview slide={slide} />
                    {/* Meta + actions */}
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      <div className="flex gap-1">
                        <button onClick={() => toggleMut.mutate({ id: slide.id, is_active: !slide.is_active })}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title={slide.is_active ? "Hide" : "Show"}>
                          {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditingId(slide.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { if (confirm("Delete this slide?")) deleteMut.mutate(slide.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400">Sort: {slide.sort_order}</span>
                      {slide.country_code && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                          {slide.country_code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
