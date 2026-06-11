import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { providerApi } from "@/features/provider/api/providerApi";
import { toast } from "@/components/ui/Toast";
import { ShieldCheck, ShieldAlert, Save } from "lucide-react";

const MOVER_SERVICES = ["packing", "unpacking", "storage", "assembly", "disassembly", "cleaning", "piano moving"];
const PARCEL_LEVELS  = ["standard", "express", "same_day"];
const COMMON_CITIES  = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Kampala", "Dar es Salaam", "Kigali"];

function CheckboxGroup({ label, options, selected = [], onChange }) {
  const toggle = (val) => {
    const next = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
    onChange(next);
  };
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-heading capitalize transition-colors ${
              selected.includes(opt)
                ? "border-[#fe6a34] bg-orange-900/30 text-orange-300"
                : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
            }`}>
            {opt.replace("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading block mb-2">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fe6a34]/50 focus:border-[#fe6a34]";

export default function ProviderProfilePage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["provider-profile"],
    queryFn: providerApi.getProfile,
  });

  const [form, setForm] = useState({});
  useEffect(() => {
    if (profile) setForm(profile); // eslint-disable-line react-hooks/set-state-in-effect
  }, [profile]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => providerApi.updateProfile(data),
    onSuccess: () => {
      toast("Profile updated", "success");
      queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    },
    onError: (err) => toast(err.response?.data?.detail ?? "Failed to save", "error"),
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {};
    const allowed = [
      "bio", "service_areas", "license_number", "insurance_number", "min_price_kes",
      "fleet_size", "services_offered",
      "iata_agent_code", "supported_airlines", "has_warehousing", "has_customs_clearance",
      "dangerous_goods_certified", "min_weight_kg", "max_weight_kg",
      "service_levels", "has_cod",
    ];
    allowed.forEach(k => { if (form[k] !== undefined && form[k] !== null) payload[k] = form[k]; });
    save(payload);
  };

  if (isLoading) return <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>;

  const isMover    = user?.role === "mover";
  const isAir      = user?.role === "air_freight";
  const isParcel   = user?.role === "parcel_carrier";

  return (
    <div className="space-y-6 py-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">My Profile</h1>
          <p className="text-slate-400 text-sm mt-1">Keep your profile complete to attract more bookings</p>
        </div>
        {form.is_verified ? (
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/50 rounded-full px-3 py-1.5">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-300 font-heading">Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/50 rounded-full px-3 py-1.5">
            <ShieldAlert className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-300 font-heading">Pending Verification</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">

        {/* Common fields */}
        <Field label="Bio / About your company">
          <textarea rows={3} value={form.bio ?? ""} onChange={e => set("bio", e.target.value)}
            placeholder="Describe your services, experience, and what sets you apart…"
            className={`${inputCls} resize-none`} />
        </Field>

        <CheckboxGroup
          label="Service Areas"
          options={COMMON_CITIES}
          selected={form.service_areas ?? []}
          onChange={val => set("service_areas", val)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="License Number">
            <input value={form.license_number ?? ""} onChange={e => set("license_number", e.target.value)}
              placeholder="e.g. TRK/2023/001" className={inputCls} />
          </Field>
          {(isMover || isParcel) && (
            <Field label="Insurance Policy Number">
              <input value={form.insurance_number ?? ""} onChange={e => set("insurance_number", e.target.value)}
                placeholder="Optional" className={inputCls} />
            </Field>
          )}
          <Field label="Minimum Price (KES)">
            <input type="number" min={0} value={form.min_price_kes ?? ""} onChange={e => set("min_price_kes", parseFloat(e.target.value))}
              placeholder="e.g. 5000" className={inputCls} />
          </Field>
        </div>

        {/* Mover-specific */}
        {isMover && (
          <>
            <Field label="Fleet Size (number of trucks/vans)">
              <input type="number" min={1} value={form.fleet_size ?? ""} onChange={e => set("fleet_size", parseInt(e.target.value))}
                placeholder="e.g. 5" className={inputCls} />
            </Field>
            <CheckboxGroup
              label="Services Offered"
              options={MOVER_SERVICES}
              selected={form.services_offered ?? []}
              onChange={val => set("services_offered", val)}
            />
          </>
        )}

        {/* Airfreight-specific */}
        {isAir && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IATA Agent Code">
                <input value={form.iata_agent_code ?? ""} onChange={e => set("iata_agent_code", e.target.value)}
                  placeholder="e.g. KQ001" className={inputCls} />
              </Field>
              <Field label="Min Cargo Weight (kg)">
                <input type="number" min={0} value={form.min_weight_kg ?? ""} onChange={e => set("min_weight_kg", parseFloat(e.target.value))}
                  placeholder="Optional" className={inputCls} />
              </Field>
              <Field label="Max Cargo Weight (kg)">
                <input type="number" min={0} value={form.max_weight_kg ?? ""} onChange={e => set("max_weight_kg", parseFloat(e.target.value))}
                  placeholder="Optional" className={inputCls} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { key: "has_warehousing",           label: "Warehousing Available" },
                { key: "has_customs_clearance",     label: "Customs Clearance" },
                { key: "dangerous_goods_certified", label: "Dangerous Goods Certified" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 accent-orange-500" />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {/* Parcel carrier-specific */}
        {isParcel && (
          <>
            <CheckboxGroup
              label="Supported Service Levels"
              options={PARCEL_LEVELS}
              selected={form.service_levels ?? []}
              onChange={val => set("service_levels", val)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Package Weight (kg)">
                <input type="number" min={0} value={form.max_weight_kg ?? ""} onChange={e => set("max_weight_kg", parseFloat(e.target.value))}
                  placeholder="e.g. 30" className={inputCls} />
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.has_cod} onChange={e => set("has_cod", e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 accent-orange-500" />
              <span className="text-sm text-slate-300">Cash on Delivery (COD) available</span>
            </label>
          </>
        )}

        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 bg-[#fe6a34] hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors font-heading text-sm">
          <Save className="w-4 h-4" />
          {isPending ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
