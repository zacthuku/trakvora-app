import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Package2, Truck, Users2, CheckCircle, ChevronRight, ChevronLeft,
  User, Mail, Phone, MapPin, Building2, Calendar, ArrowRight,
  LayoutGrid, ShoppingBag, Receipt, Banknote, Smartphone, Sparkles,
} from "lucide-react";
import MainNav from "@/components/layout/MainNav";

const ROLES = [
  { value: "shipper",   label: "Shipper",         desc: "I ship cargo and need reliable carriers.", icon: Package2 },
  { value: "owner",     label: "Fleet Owner",      desc: "I own trucks and want to maximize revenue.", icon: Truck    },
  { value: "both",      label: "Both",             desc: "I operate on both sides of the network.",  icon: Users2   },
];

const FLEET_SIZES      = ["1–5 trucks", "6–20 trucks", "21–50 trucks", "51–200 trucks", "200+ trucks"];
const SHIPMENT_VOLUMES = ["1–10/month", "11–50/month", "51–200/month", "200+/month"];

const COUNTRIES = [
  "Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia",
  "Nigeria", "Ghana", "Zambia", "Zimbabwe", "South Africa", "Other",
];

const FEATURES = [
  { value: "dispatch",    label: "Dispatch OS",       icon: LayoutGrid  },
  { value: "marketplace", label: "Marketplace",       icon: ShoppingBag },
  { value: "fleet",       label: "Fleet Management",  icon: Truck       },
  { value: "mobile_app",  label: "Mobile App",        icon: Smartphone  },
  { value: "billing",     label: "Smart Billing",     icon: Receipt     },
  { value: "finance",     label: "Finance & Capital", icon: Banknote    },
];

const TIMES = [
  "Morning (8am – 12pm)",
  "Afternoon (12pm – 4pm)",
  "Evening (4pm – 7pm)",
  "Any time works",
];

const TOTAL_STEPS = 3;

function StepProgress({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            n < current   ? "bg-[#fe6a34] text-white"        :
            n === current ? "bg-[#fe6a34] text-white ring-4 ring-orange-500/20" :
                            "bg-gray-100 dark:bg-slate-700 text-slate-400"
          }`}>
            {n < current ? <CheckCircle className="w-4 h-4" /> : n}
          </div>
          {n < 3 && <div className={`h-px w-10 sm:w-16 transition-colors ${n < current ? "bg-[#fe6a34]" : "bg-gray-200 dark:bg-slate-600"}`} />}
        </div>
      ))}
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-medium">Step {current} of {TOTAL_STEPS}</span>
    </div>
  );
}

function InputField({ label, icon: Icon, error, children, ...rest }) {
  const hasError = Boolean(error);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">{label}</label>
      {children ?? (
        <div className="relative">
          {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />}
          <input
            {...rest}
            className={`w-full ${Icon ? "pl-10" : "pl-4"} pr-4 py-3 bg-gray-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-all ${
              hasError ? "border-red-400 focus:ring-red-300" : "border-gray-200 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-200"
            }`}
          />
        </div>
      )}
      {hasError && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SelectField({ label, icon: Icon, value, onChange, options, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />}
        <select
          value={value}
          onChange={onChange}
          className={`w-full ${Icon ? "pl-10" : "pl-4"} pr-4 py-3 bg-gray-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all appearance-none cursor-pointer ${
            error ? "border-red-400 focus:ring-red-300" : "border-gray-200 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-200"
          }`}
        >
          <option value="" disabled className="text-slate-400">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90" />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function BookDemoPage() {
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);

  const [form, setForm] = useState({
    role:              "",
    company:           "",
    fleet_size:        "",
    monthly_shipments: "",
    name:              "",
    email:             "",
    phone:             "",
    country:           "",
    features:          [],
    preferred_time:    "",
    notes:             "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleFeature = (val) => {
    setForm((f) => ({
      ...f,
      features: f.features.includes(val)
        ? f.features.filter((v) => v !== val)
        : [...f.features, val],
    }));
    setFieldErrors((e) => ({ ...e, features: undefined }));
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.role)           errs.role    = "Please select a role";
    if (!form.company.trim()) errs.company = "Company name is required";
    if ((form.role === "owner" || form.role === "both") && !form.fleet_size)
      errs.fleet_size = "Please select a fleet size";
    if ((form.role === "shipper" || form.role === "both") && !form.monthly_shipments)
      errs.monthly_shipments = "Please select a shipment volume";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!form.name.trim())   errs.name    = "Full name is required";
    if (!form.email.trim())  errs.email   = "Work email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.phone.trim())  errs.phone   = "Phone number is required";
    if (!form.country)       errs.country = "Please select a country";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs = {};
    if (form.features.length === 0) errs.features      = "Select at least one feature";
    if (!form.preferred_time)       errs.preferred_time = "Please pick a preferred time";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
    setError("");
  };

  const back = () => {
    setStep((s) => s - 1);
    setError("");
  };

  const submit = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/demo/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Submission failed");
      }
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src="/auth-bg.png" alt="" className="w-full h-full object-cover object-center opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
      </div>

      <MainNav hideDemoBtn />

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 pt-[72px]">
        <div className="w-full max-w-lg">

          {done ? (
            /* ── Success screen ── */
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-2xl p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-[#fe6a34]" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-3">You're on the list!</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                Thanks <span className="text-slate-900 dark:text-white font-semibold">{form.name.split(" ")[0]}</span>. We received your demo request and will reach out to <span className="text-slate-900 dark:text-white font-semibold">{form.email}</span> within <strong className="text-slate-900 dark:text-white">1 business day</strong>.
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                In the meantime, feel free to explore the platform or check out our pricing.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/"
                  className="bg-[#fe6a34] hover:bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                  Back to Home
                </Link>
                <Link to="/pricing"
                  className="border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                  View Pricing
                </Link>
              </div>
            </div>
          ) : (
            /* ── Form wizard ── */
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-2xl p-8">

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#fe6a34]" />
                  <span className="text-xs font-bold text-[#fe6a34] uppercase tracking-widest">Book a Demo</span>
                </div>
                <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">
                  {step === 1 ? "Who are you?" : step === 2 ? "Contact details" : "Tell us more"}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {step === 1 ? "Tell us about your business so we can tailor the demo." :
                   step === 2 ? "How should our team reach you?" :
                                "What are you most interested in seeing?"}
                </p>
              </div>

              <StepProgress current={step} />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
                  {error}
                </div>
              )}

              {/* ── Step 1 ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Your role
                    </label>
                    {fieldErrors.role && <p className="text-xs text-red-500 mb-2">{fieldErrors.role}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {ROLES.map(({ value, label, desc, icon: Icon }) => {
                        const active = form.role === value;
                        return (
                          <button key={value} type="button"
                            onClick={() => set("role", value)}
                            className={`relative text-left p-3 rounded-xl border transition-all ${
                              active ? "border-[#fe6a34] bg-orange-50 dark:bg-orange-500/10"
                                     : "border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-500"
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-2 ${active ? "text-[#fe6a34]" : "text-slate-400"}`} />
                            <div className={`text-sm font-semibold font-heading mb-0.5 ${active ? "text-[#fe6a34]" : "text-slate-700 dark:text-slate-200"}`}>
                              {label}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{desc}</p>
                            {active && (
                              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#fe6a34] flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <InputField label="Company name" icon={Building2}
                    type="text" placeholder="Global Logistics Ltd" required
                    value={form.company} onChange={(e) => set("company", e.target.value)}
                    error={fieldErrors.company}
                  />

                  {(form.role === "owner" || form.role === "both") && (
                    <SelectField label="Fleet size" icon={Truck}
                      value={form.fleet_size}
                      onChange={(e) => set("fleet_size", e.target.value)}
                      options={FLEET_SIZES}
                      error={fieldErrors.fleet_size}
                    />
                  )}
                  {(form.role === "shipper" || form.role === "both") && (
                    <SelectField label="Monthly shipment volume" icon={Package2}
                      value={form.monthly_shipments}
                      onChange={(e) => set("monthly_shipments", e.target.value)}
                      options={SHIPMENT_VOLUMES}
                      error={fieldErrors.monthly_shipments}
                    />
                  )}
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <InputField label="Full name" icon={User}
                    type="text" placeholder="Jane Doe" required
                    value={form.name} onChange={(e) => set("name", e.target.value)}
                    error={fieldErrors.name}
                  />
                  <InputField label="Work email" icon={Mail}
                    type="email" placeholder="jane@company.com" required
                    value={form.email} onChange={(e) => set("email", e.target.value)}
                    error={fieldErrors.email}
                  />
                  <InputField label="Phone number" icon={Phone}
                    type="tel" placeholder="+254 700 000 000" required
                    value={form.phone} onChange={(e) => set("phone", e.target.value)}
                    error={fieldErrors.phone}
                  />
                  <SelectField label="Country" icon={MapPin}
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    options={COUNTRIES}
                    error={fieldErrors.country}
                  />
                </div>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Features you'd like to see
                    </label>
                    {fieldErrors.features && <p className="text-xs text-red-500 mb-2">{fieldErrors.features}</p>}
                    <div className="grid grid-cols-2 gap-2.5">
                      {FEATURES.map(({ value, label, icon: Icon }) => {
                        const active = form.features.includes(value);
                        return (
                          <button key={value} type="button"
                            onClick={() => toggleFeature(value)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                              active ? "border-[#fe6a34] bg-orange-50 dark:bg-orange-500/10"
                                     : "border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-500"
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#fe6a34]" : "text-slate-400"}`} />
                            <span className={`text-sm font-medium ${active ? "text-[#fe6a34]" : "text-slate-700 dark:text-slate-200"}`}>
                              {label}
                            </span>
                            {active && <CheckCircle className="w-3.5 h-3.5 text-[#fe6a34] ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <SelectField label="Preferred demo time" icon={Calendar}
                    value={form.preferred_time}
                    onChange={(e) => set("preferred_time", e.target.value)}
                    options={TIMES}
                    error={fieldErrors.preferred_time}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Additional notes <span className="text-slate-400 normal-case font-normal tracking-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Any specific questions or things you'd like us to focus on?"
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className={`flex mt-8 gap-3 ${step > 1 ? "justify-between" : "justify-end"}`}>
                {step > 1 && (
                  <button type="button" onClick={back}
                    className="flex items-center gap-2 border border-gray-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-500 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                {step < TOTAL_STEPS ? (
                  <button type="button" onClick={next}
                    className="flex items-center gap-2 bg-[#fe6a34] hover:bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors ml-auto">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={loading}
                    className="flex items-center gap-2 bg-[#fe6a34] hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors ml-auto">
                    {loading ? "Submitting…" : "Request Demo"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer note */}
          {!done && (
            <p className="text-center text-xs text-white/70 mt-6">
              Want to self-serve?{" "}
              <Link to="/register" className="text-white hover:text-orange-300 transition-colors font-medium">
                Create a free account
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
