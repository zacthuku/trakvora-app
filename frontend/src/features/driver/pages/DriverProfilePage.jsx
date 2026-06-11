import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User, Briefcase, Truck, FileText, Shield, CheckCircle2,
  AlertCircle, Save, Star, Clock, Search,
  Wifi, ExternalLink, BadgeCheck, Upload, Plus,
  ShieldCheck, ShieldX, ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import PhotoDropZone from "@/components/ui/PhotoDropZone";
import DocumentDropZone from "@/components/ui/DocumentDropZone";
import ProfilePhotoPicker from "@/components/ui/ProfilePhotoPicker";

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-50 dark:disabled:bg-slate-600 disabled:text-slate-400";

const AVAILABILITY_META = {
  available: { label: "Available", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-400" },
  on_job: { label: "On Job", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-400" },
  offline: { label: "Offline", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-400" },
};

const TRUCK_TYPES = ["flatbed", "dry_van", "reefer", "tanker", "lowbed", "tipper"];
const CORRIDORS = [
  "Nairobi-Mombasa", "Nairobi-Kisumu", "Nairobi-Eldoret",
  "Nairobi-Nakuru", "Mombasa-Dar es Salaam", "Nairobi-Kampala",
  "Kisumu-Kampala", "Nairobi-Arusha", "Eldoret-Kampala",
];

function SectionCard({ icon: Icon, title, sub, children, badge }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-slate-900 dark:text-white">{title}</h2>
            {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function DocRow({ label, field, url, onSave, verified }) {
  const handleUpload = (newUrl) => {
    onSave(newUrl || "");
  };

  return (
    <div className="py-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        {url ? (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${verified ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
            {verified ? <BadgeCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {verified ? "Verified" : "Pending"}
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold uppercase">Missing</span>
        )}
      </div>
      <DocumentDropZone currentUrl={url} onUpload={handleUpload} hint="PDF, JPG, or PNG · max 5 MB" />
    </div>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  const selected = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next.join(", "));
  };
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              selected.includes(opt)
                ? "bg-secondary text-white border-secondary"
                : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-secondary/50"
            }`}>
            {opt.replace("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DriverProfilePage() {
  const { user } = useAuthStore();
  const cfg = useCountryConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "D";

  // ── Fetch driver profile ────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: () => apiClient.get("/drivers/me").then(r => r.data).catch(() => null),
  });

  // ── Fetch assigned / owned truck ────────────────────────────────────────
  const { data: assignedTruck } = useQuery({
    queryKey: ["driver-assigned-truck"],
    queryFn: () => apiClient.get("/trucks/assigned-to-me").then(r => r.data).catch(() => null),
  });
  const { data: ownedTrucks } = useQuery({
    queryKey: ["driver-owned-trucks"],
    queryFn: () => apiClient.get("/trucks").then(r => r.data).catch(() => []),
  });

  // ── Profile form ────────────────────────────────────────────────────────
  const [prof, setProf] = useState({
    bio: "",
    experience_years: "",
    licence_class: "",
    licence_expiry: "",
  });
  const [profMsg, setProfMsg] = useState(null);

  const profileMutation = useMutation({
    mutationFn: (data) => {
      if (profile) return apiClient.patch("/drivers/me", data).then(r => r.data);
      return apiClient.post("/drivers/me", { licence_number: "PENDING", ...data }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-profile"] });
      setProfMsg({ type: "ok", text: "Profile saved." });
      setTimeout(() => setProfMsg(null), 3000);
    },
    onError: (e) => setProfMsg({ type: "err", text: e?.response?.data?.detail || "Failed to save." }),
  });

  const handleProfSave = (e) => {
    e.preventDefault();
    profileMutation.mutate({
      bio: prof.bio || undefined,
      experience_years: prof.experience_years ? Number(prof.experience_years) : undefined,
      licence_class: prof.licence_class || undefined,
      licence_expiry: prof.licence_expiry || undefined,
    });
  };

  // ── Availability ────────────────────────────────────────────────────────
  const [avail, setAvail] = useState({
    availability_status: "offline",
    availability_location: "",
    available_from: "",
    seeking_employment: false,
    preferred_routes: "",
    preferred_truck_types: "",
  });
  const [availMsg, setAvailMsg] = useState(null);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProf({
      bio: profile.bio || "",
      experience_years: profile.experience_years || "",
      licence_class: profile.licence_class || "",
      licence_expiry: profile.licence_expiry || "",
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvail({
      availability_status: profile.availability_status || "offline",
      availability_location: profile.availability_location || "",
      available_from: profile.available_from || "",
      seeking_employment: profile.seeking_employment || false,
      preferred_routes: profile.preferred_routes || "",
      preferred_truck_types: profile.preferred_truck_types || "",
    });
  }, [profile]);

  const availMutation = useMutation({
    mutationFn: (data) => apiClient.patch("/drivers/me/availability", data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-profile"] });
      setAvailMsg({ type: "ok", text: "Availability updated." });
      setTimeout(() => setAvailMsg(null), 3000);
    },
    onError: (e) => setAvailMsg({ type: "err", text: e?.response?.data?.detail || "Failed to save." }),
  });

  const handleAvailSave = (e) => {
    e.preventDefault();
    availMutation.mutate({
      availability_status: avail.availability_status,
      availability_location: avail.availability_location || undefined,
      available_from: avail.available_from || undefined,
      seeking_employment: avail.seeking_employment,
      preferred_routes: avail.preferred_routes || undefined,
      preferred_truck_types: avail.preferred_truck_types || undefined,
    });
  };

  const saveDoc = (field) => (url) => {
    apiClient.patch("/drivers/me", { [field]: url }).then(() => qc.invalidateQueries({ queryKey: ["driver-profile"] }));
  };

  // ── Truck form ──────────────────────────────────────────────────────────
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMode, setUpgradeMode] = useState(false); // true when registering 2nd truck → fleet owner
  const [truckForm, setTruckForm] = useState({
    registration_number: "", truck_type: "flatbed", capacity_tonnes: "",
    make: "", model: "", year: "",
  });
  const [truckMsg, setTruckMsg] = useState(null);

  // ── Truck document upload state (keyed by truck.id) ──────────────────────
  const [truckDocForms, setTruckDocForms] = useState({});
  const [truckDocMsgs, setTruckDocMsgs] = useState({});

  const setTruckDocField = (truckId, field, value) =>
    setTruckDocForms(f => ({ ...f, [truckId]: { ...f[truckId], [field]: value } }));

  const submitTruckDocsMutation = useMutation({
    mutationFn: ({ truckId, data }) =>
      apiClient.patch(`/trucks/${truckId}/submit-documents`, data).then(r => r.data),
    onSuccess: (_, { truckId }) => {
      qc.invalidateQueries({ queryKey: ["driver-owned-trucks"] });
      setTruckDocMsgs(m => ({ ...m, [truckId]: { type: "ok", text: "Documents submitted for review." } }));
      setTimeout(() => setTruckDocMsgs(m => ({ ...m, [truckId]: null })), 5000);
    },
    onError: (e, { truckId }) =>
      setTruckDocMsgs(m => ({ ...m, [truckId]: { type: "err", text: e?.response?.data?.detail || "Failed to submit." } })),
  });

  const INSPECTION_STYLE = {
    not_requested: "bg-slate-100 text-slate-400 border-slate-200",
    pending:       "bg-amber-50 text-amber-700 border-amber-200",
    in_progress:   "bg-sky-50 text-sky-700 border-sky-200",
    submitted:     "bg-blue-50 text-blue-700 border-blue-200",
    approved:      "bg-teal-50 text-teal-700 border-teal-200",
    rejected:      "bg-red-50 text-red-700 border-red-200",
    re_inspection: "bg-orange-50 text-orange-700 border-orange-200",
  };

  const ownedDriverTrucks = ownedTrucks?.filter(t => t.is_driver_owned) || [];
  const hasOwnedTruck = ownedDriverTrucks.length > 0;

  // ── Submit documents for review ────────────────────────────────────────────
  const [submitMsg, setSubmitMsg] = useState(null);
  const submitDocsMutation = useMutation({
    mutationFn: () => apiClient.patch("/drivers/me/submit-documents").then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-profile"] });
      setSubmitMsg({ type: "ok", text: "Documents submitted for review. Our team will verify them shortly." });
      setTimeout(() => setSubmitMsg(null), 5000);
    },
    onError: (e) => setSubmitMsg({ type: "err", text: e?.response?.data?.detail || "Failed to submit. Please upload your licence photo first." }),
  });

  const truckMutation = useMutation({
    mutationFn: async (data) => {
      const truck = await apiClient.post("/trucks", data).then(r => r.data);
      if (upgradeMode) {
        await apiClient.post("/users/me/upgrade-to-owner");
      }
      return truck;
    },
    onSuccess: () => {
      if (upgradeMode) {
        navigate("/owner");
        return;
      }
      qc.invalidateQueries({ queryKey: ["driver-owned-trucks"] });
      setShowTruckForm(false);
      setTruckMsg({ type: "ok", text: "Truck registered." });
      setTimeout(() => setTruckMsg(null), 3000);
    },
    onError: (e) => setTruckMsg({ type: "err", text: e?.response?.data?.detail || "Failed to register truck." }),
  });

  const handleTruckSubmit = (e) => {
    e.preventDefault();
    truckMutation.mutate({
      registration_number: truckForm.registration_number,
      truck_type: truckForm.truck_type,
      capacity_tonnes: Number(truckForm.capacity_tonnes),
      make: truckForm.make || undefined,
      model: truckForm.model || undefined,
      year: truckForm.year ? Number(truckForm.year) : undefined,
      is_driver_owned: true,
    });
  };

  const handleAddAnotherTruck = () => {
    if (hasOwnedTruck) {
      setUpgradeMode(true);
      setShowUpgradeModal(true);
    } else {
      setUpgradeMode(false);
      setShowTruckForm(true);
    }
  };

  const statusMeta = AVAILABILITY_META[avail.availability_status] || AVAILABILITY_META.offline;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">My Driver Profile</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your availability, professional profile, documents, and truck.</p>
      </div>

      {/* ── Profile header card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5 mb-5 flex items-center gap-5">
        <ProfilePhotoPicker user={user} initials={initials} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-slate-900 dark:text-white text-lg leading-tight">{user?.full_name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{user?.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${statusMeta.bg} ${statusMeta.border} ${statusMeta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} ${avail.availability_status === "available" ? "animate-pulse" : ""}`} />
              {statusMeta.label}
            </span>
            {profile?.ntsa_verified && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase">
                <BadgeCheck className="w-3 h-3" /> {cfg.transportAuthority} Verified
              </span>
            )}
            {avail.seeking_employment && !profile?.employer_id && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold uppercase">
                <Search className="w-3 h-3" /> Open to Work
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black font-heading text-slate-900 dark:text-white">{user?.rating?.toFixed(1) || "—"}</p>
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-3 h-3 ${s <= Math.round(user?.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{user?.total_trips || 0} trips</p>
        </div>
      </div>

      {/* ── Verification status banner ── */}
      {profile && (() => {
        const vs = profile.verification_status;
        const submitted = profile.documents_submitted;
        if (vs === "approved") {
          return (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 mb-5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Driver Verified ✓</p>
                <p className="text-xs text-emerald-600 mt-0.5">You can bid on loads and be hired by shippers.</p>
              </div>
            </div>
          );
        }
        if (vs === "rejected") {
          return (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 mb-5">
              <ShieldX className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Verification Rejected</p>
                {profile.verification_notes && (
                  <p className="text-xs text-red-600 mt-0.5">Reason: {profile.verification_notes}</p>
                )}
                <p className="text-xs text-red-500 mt-1">Please correct your documents and re-submit for review below.</p>
              </div>
            </div>
          );
        }
        if (submitted) {
          return (
            <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-5 py-3.5 mb-5">
              <ShieldAlert className="w-5 h-5 text-sky-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-sky-800">Documents Submitted — Under Review</p>
                <p className="text-xs text-sky-600 mt-0.5">Our team is reviewing your documents. You'll be notified once approved.</p>
              </div>
            </div>
          );
        }
        // pending, not yet submitted
        return (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-5">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Verification Required</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Upload your documents below, then click <strong>Submit for Review</strong>.
                You cannot bid on loads or be hired until verified.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Availability ── */}
      <SectionCard icon={Wifi} title="Availability & Job Preferences"
        sub="Your status is visible to fleet owners and shippers."
        badge={
          <button onClick={() => navigate("/driver-profile/" + user?.id)}
            className="text-xs text-secondary font-semibold flex items-center gap-1 hover:underline">
            <ExternalLink className="w-3 h-3" /> View public profile
          </button>
        }>
        <form onSubmit={handleAvailSave} className="space-y-5">
          {/* Status selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">Status</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(AVAILABILITY_META).map(([key, meta]) => (
                <button key={key} type="button"
                  onClick={() => setAvail(a => ({ ...a, availability_status: key }))}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    avail.availability_status === key
                      ? `${meta.bg} ${meta.border}`
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                  }`}>
                  <span className={`w-3 h-3 rounded-full ${meta.dot}`} />
                  <span className={`text-xs font-semibold ${avail.availability_status === key ? meta.color : "text-slate-500"}`}>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Available From</label>
              <input type="date" value={avail.available_from}
                onChange={e => setAvail(a => ({ ...a, available_from: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Available Location</label>
              <input value={avail.availability_location} placeholder="e.g. Nairobi, Mombasa"
                onChange={e => setAvail(a => ({ ...a, availability_location: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <MultiSelect label="Preferred Routes" value={avail.preferred_routes} options={CORRIDORS}
            onChange={val => setAvail(a => ({ ...a, preferred_routes: val }))} />

          <MultiSelect label="Preferred Truck Types" value={avail.preferred_truck_types} options={TRUCK_TYPES}
            onChange={val => setAvail(a => ({ ...a, preferred_truck_types: val }))} />

          {/* Seeking employment toggle */}
          {(() => {
            const isEmployed = !!profile?.employer_id;
            const hasTruck = (ownedTrucks?.filter(t => t.is_driver_owned).length > 0);
            const disabledReason = isEmployed
              ? "You are currently contracted to a fleet owner."
              : hasTruck
              ? "You operate your own truck — disable employment mode."
              : null;
            const toggleDisabled = !!disabledReason;
            return (
              <div className={`flex items-center justify-between py-3 px-4 rounded-xl border ${toggleDisabled ? "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 opacity-70" : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Open to Employment</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {disabledReason || "Fleet owners can see you're looking for a job."}
                  </p>
                </div>
                <div
                  onClick={toggleDisabled ? undefined : () => setAvail(a => ({ ...a, seeking_employment: !a.seeking_employment }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${toggleDisabled ? "cursor-not-allowed" : "cursor-pointer"} ${avail.seeking_employment && !toggleDisabled ? "bg-secondary" : "bg-slate-200 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${avail.seeking_employment && !toggleDisabled ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </div>
            );
          })()}

          {availMsg && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${availMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {availMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {availMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={availMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {availMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Availability</>}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Professional info ── */}
      <SectionCard icon={Briefcase} title="Professional Profile" sub="Displayed to fleet owners and shippers reviewing your bids.">
        <form onSubmit={handleProfSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Bio</label>
            <textarea value={prof.bio} onChange={e => setProf(p => ({ ...p, bio: e.target.value }))}
              placeholder="Briefly describe your driving experience, specialities, and work ethic…"
              rows={3} className={inputCls + " resize-none"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Years of Experience</label>
              <input type="number" min={0} max={50} value={prof.experience_years}
                onChange={e => setProf(p => ({ ...p, experience_years: e.target.value }))}
                placeholder="e.g. 8" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Licence Class</label>
              <select value={prof.licence_class} onChange={e => setProf(p => ({ ...p, licence_class: e.target.value }))} className={inputCls}>
                <option value="">Select class</option>
                {["A", "B", "C", "D", "E", "CE", "BCE"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Licence Expiry Date</label>
            <input type="date" value={prof.licence_expiry}
              onChange={e => setProf(p => ({ ...p, licence_expiry: e.target.value }))}
              className={inputCls} />
          </div>

          {profMsg && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${profMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {profMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {profMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={profileMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {profileMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Profile</>}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Passport / ID Photo ── */}
      <SectionCard icon={User} title="Passport / ID Photo"
        sub="Required for identity verification before your first shipment."
        badge={
          profile?.passport_photo_url
            ? <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Uploaded</span>
            : <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold uppercase"><AlertCircle className="w-3 h-3" /> Required</span>
        }>
        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg p-3 mb-4 border border-slate-100 dark:border-slate-600">
          Upload a clear photo of your face matching your national ID or passport. Used for KYC identity verification and kept confidential.
        </div>
        <PhotoDropZone
          currentUrl={profile?.passport_photo_url}
          onUpload={(url) => {
            apiClient.patch("/drivers/me", { passport_photo_url: url || "" })
              .then(() => qc.invalidateQueries({ queryKey: ["driver-profile"] }));
          }}
          label="Passport / ID Photo"
          hint="Clear face photo · JPG, PNG, or WebP · max 5 MB"
        />
      </SectionCard>

      {/* ── Documents ── */}
      <SectionCard icon={FileText} title="Documents & Certifications"
        sub={`Upload URLs to your verified documents. Required for ${cfg.transportAuthority} compliance.`}
        badge={
          profile?.ntsa_verified
            ? <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase"><BadgeCheck className="w-3 h-3" /> {cfg.transportAuthority} Verified</span>
            : <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase"><Clock className="w-3 h-3" /> Pending</span>
        }>
        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg p-3 mb-4 border border-slate-100 dark:border-slate-600">
          Paste publicly accessible URLs to your document images or PDFs. Documents are reviewed by trakvora staff and cross-checked with {cfg.transportAuthority} records.
        </div>
        <DocRow label="Driver's Licence" field="licence_photo_url" url={profile?.licence_photo_url} onSave={saveDoc("licence_photo_url")} verified={profile?.ntsa_verified} />
        <DocRow label="PSV Badge" field="psv_badge_url" url={profile?.psv_badge_url} onSave={saveDoc("psv_badge_url")} verified={profile?.ntsa_verified} />
        <DocRow label="Police Clearance Certificate" field="police_clearance_url" url={profile?.police_clearance_url} onSave={saveDoc("police_clearance_url")} verified={false} />
        <DocRow label="Certificate of Good Conduct" field="good_conduct_url" url={profile?.good_conduct_url} onSave={saveDoc("good_conduct_url")} verified={false} />
        <DocRow label="Medical Fitness Certificate" field="medical_cert_url" url={profile?.medical_cert_url} onSave={saveDoc("medical_cert_url")} verified={false} />

        {/* Submit for Review */}
        {profile?.verification_status !== "approved" && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            {submitMsg && (
              <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border mb-3 ${submitMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                {submitMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {submitMsg.text}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Ready for review?</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {profile?.documents_submitted
                    ? "Already submitted — you can resubmit if you updated any documents."
                    : "Upload your licence photo (required) + other docs, then submit."}
                </p>
              </div>
              <button
                onClick={() => submitDocsMutation.mutate()}
                disabled={submitDocsMutation.isPending || !profile?.licence_photo_url}
                title={!profile?.licence_photo_url ? "Upload your licence photo first" : ""}
                className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                {submitDocsMutation.isPending
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                  : <><Upload className="w-4 h-4" /> Submit for Review</>}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── My Truck ── */}
      <SectionCard icon={Truck} title="My Truck"
        sub={profile?.employer_id ? "Contracted truck from your fleet owner." : "Truck you own and operate."}>

        {truckMsg && (
          <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border mb-4 ${truckMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {truckMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {truckMsg.text}
          </div>
        )}

        {/* Contracted truck (assigned by fleet owner) */}
        {assignedTruck && (
          <div className="flex items-center gap-4 p-4 bg-sky-50/50 border border-sky-200 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-sky-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 font-heading">{assignedTruck.registration_number}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {assignedTruck.truck_type.replace("_", " ")} · {assignedTruck.capacity_tonnes}t
                {assignedTruck.make && ` · ${assignedTruck.make} ${assignedTruck.model || ""}`.trim()}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold uppercase border border-sky-200">Contracted</span>
          </div>
        )}

        {/* Driver-owned trucks */}
        {ownedTrucks?.filter(t => t.is_driver_owned).map(truck => {
          const docForm = truckDocForms[truck.id] || {};
          const docMsg = truckDocMsgs[truck.id];
          const inspStatus = truck.inspection_status || "not_requested";
          const inspStyle = INSPECTION_STYLE[inspStatus] || INSPECTION_STYLE.not_requested;
          return (
            <div key={truck.id} className="border border-slate-200 dark:border-slate-700 rounded-xl mb-3 overflow-hidden">
              {/* Truck header */}
              <div className="flex items-center gap-4 p-4 bg-slate-50/60 dark:bg-slate-700/60">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-600 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">{truck.registration_number}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {truck.truck_type.replace("_", " ")} · {truck.capacity_tonnes}t
                    {truck.make && ` · ${truck.make} ${truck.model || ""}`.trim()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${truck.is_active ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                    {truck.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${inspStyle}`}>
                    {inspStatus.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Truck document section */}
              <div className="px-4 pt-3 pb-4 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Truck Documents</p>

                {docMsg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border mb-3 ${docMsg.type === "ok" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {docMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {docMsg.text}
                  </div>
                )}

                {/* Logbook */}
                <div className="py-2.5 border-b border-slate-50 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Logbook</p>
                    {(docForm.logbook_url ?? truck.logbook_url)
                      ? <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100">Uploaded</span>
                      : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">Missing</span>}
                  </div>
                  <DocumentDropZone
                    currentUrl={docForm.logbook_url ?? truck.logbook_url}
                    onUpload={url => setTruckDocField(truck.id, "logbook_url", url || "")}
                    hint="PDF, JPG or PNG · max 5 MB"
                  />
                </div>

                {/* Insurance */}
                <div className="py-2.5 border-b border-slate-50 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Insurance Certificate</p>
                    {(docForm.insurance_url ?? truck.insurance_url)
                      ? <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100">Uploaded</span>
                      : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">Missing</span>}
                  </div>
                  <DocumentDropZone
                    currentUrl={docForm.insurance_url ?? truck.insurance_url}
                    onUpload={url => setTruckDocField(truck.id, "insurance_url", url || "")}
                    hint="PDF, JPG or PNG · max 5 MB"
                  />
                  <div className="mt-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Insurance Expiry</label>
                    <input type="date"
                      value={docForm.insurance_expiry ?? truck.insurance_expiry ?? ""}
                      onChange={e => setTruckDocField(truck.id, "insurance_expiry", e.target.value)}
                      className={inputCls} />
                  </div>
                </div>

                {/* NTSA Inspection */}
                <div className="py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">NTSA Inspection Certificate</p>
                    {(docForm.ntsa_inspection_url ?? truck.ntsa_inspection_url)
                      ? <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100">Uploaded</span>
                      : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">Missing</span>}
                  </div>
                  <DocumentDropZone
                    currentUrl={docForm.ntsa_inspection_url ?? truck.ntsa_inspection_url}
                    onUpload={url => setTruckDocField(truck.id, "ntsa_inspection_url", url || "")}
                    hint="PDF, JPG or PNG · max 5 MB"
                  />
                  <div className="mt-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Inspection Expiry</label>
                    <input type="date"
                      value={docForm.ntsa_inspection_expiry ?? truck.ntsa_inspection_expiry ?? ""}
                      onChange={e => setTruckDocField(truck.id, "ntsa_inspection_expiry", e.target.value)}
                      className={inputCls} />
                  </div>
                </div>

                {inspStatus !== "approved" && (
                  <button
                    onClick={() => submitTruckDocsMutation.mutate({ truckId: truck.id, data: docForm })}
                    disabled={submitTruckDocsMutation.isPending}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {submitTruckDocsMutation.isPending ? "Submitting…" : "Submit Truck Documents"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!assignedTruck && ownedDriverTrucks.length === 0 && !showTruckForm && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Truck className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No truck linked yet</p>
            <p className="text-xs text-red-500 font-semibold mb-4">You need a truck to accept jobs — register your own or get assigned by a fleet owner.</p>
            <button onClick={handleAddAnotherTruck}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Register My Truck
            </button>
          </div>
        )}

        {!showTruckForm && ownedDriverTrucks.length > 0 && (
          <button onClick={handleAddAnotherTruck}
            className="mt-2 flex items-center gap-2 text-sm text-secondary font-semibold hover:underline">
            <Plus className="w-4 h-4" /> Register another truck
          </button>
        )}

        {/* Register truck form */}
        {showTruckForm && (
          <form onSubmit={handleTruckSubmit} className="mt-4 space-y-4 border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-700/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Register your truck</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Registration No. *</label>
                <input required value={truckForm.registration_number}
                  onChange={e => setTruckForm(f => ({ ...f, registration_number: e.target.value }))}
                  placeholder="KAA 000A" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Truck Type *</label>
                <select value={truckForm.truck_type}
                  onChange={e => setTruckForm(f => ({ ...f, truck_type: e.target.value }))} className={inputCls}>
                  {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Capacity (tonnes) *</label>
                <input type="number" required min={0.1} step={0.1} value={truckForm.capacity_tonnes}
                  onChange={e => setTruckForm(f => ({ ...f, capacity_tonnes: e.target.value }))}
                  placeholder="30" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Year</label>
                <input type="number" min={1980} max={2026} value={truckForm.year}
                  onChange={e => setTruckForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2018" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Make</label>
                <input value={truckForm.make}
                  onChange={e => setTruckForm(f => ({ ...f, make: e.target.value }))}
                  placeholder="Scania" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Model</label>
                <input value={truckForm.model}
                  onChange={e => setTruckForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="R450" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowTruckForm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={truckMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {truckMutation.isPending ? "Registering…" : <><Save className="w-4 h-4" /> Register Truck</>}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* Fleet owner upgrade confirmation modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="font-heading font-bold text-slate-900 dark:text-white">Upgrade to Fleet Owner?</h2>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                You already have a registered truck. Adding a second truck will <strong>upgrade your account to Fleet Owner</strong> — giving you access to fleet management, driver hiring, and multi-truck dispatch.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                This cannot be undone. You will be redirected to the Fleet Owner dashboard after registering the truck.
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowUpgradeModal(false); setUpgradeMode(false); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowUpgradeModal(false); setShowTruckForm(true); }}
                className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Continue as Fleet Owner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
