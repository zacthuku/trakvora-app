import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Truck, Plus, Edit2, X, Search,
  MapPin, Activity, ToggleLeft, ToggleRight, ChevronDown,
  AlertCircle, CheckCircle2, Wifi, WifiOff,
  UserCheck, UserX, User, ExternalLink, Clock,
  FileText, ShieldCheck, ShieldX, ShieldAlert, Upload,
  Key, RefreshCw, Copy, Battery, Signal, CreditCard,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { timeAgo } from "@/utils/time";

const TRUCK_TYPES = [
  { value: "flatbed",            label: "Flatbed"             },
  { value: "dry_van",            label: "Dry Van"             },
  { value: "reefer",             label: "Reefer"              },
  { value: "tanker",             label: "Tanker"              },
  { value: "lowbed",             label: "Lowbed"              },
  { value: "tipper",             label: "Tipper"              },
  { value: "van",                label: "Van / Tuk Tuk"       },
  { value: "pickup",             label: "Pickup"              },
  { value: "motorcycle_courier", label: "Motorcycle Courier"  },
  { value: "cargo_bike",         label: "Cargo Bike"          },
];

const TYPE_COLORS = {
  flatbed:            "bg-sky-50 text-sky-700 border-sky-200",
  dry_van:            "bg-violet-50 text-violet-700 border-violet-200",
  reefer:             "bg-teal-50 text-teal-700 border-teal-200",
  tanker:             "bg-blue-50 text-blue-700 border-blue-200",
  lowbed:             "bg-amber-50 text-amber-700 border-amber-200",
  tipper:             "bg-orange-50 text-orange-700 border-orange-200",
  van:                "bg-green-50 text-green-700 border-green-200",
  pickup:             "bg-lime-50 text-lime-700 border-lime-200",
  motorcycle_courier: "bg-rose-50 text-rose-700 border-rose-200",
  cargo_bike:         "bg-pink-50 text-pink-700 border-pink-200",
};

// One-time onboarding fee schedule matching backend ONBOARDING_FEE_KES
const ONBOARDING_FEE_KES = {
  motorcycle_courier: 500,
  cargo_bike:         500,
  van:                750,
  pickup:             1_000,
  dry_van:            1_500,
  tipper:             2_000,
  flatbed:            2_000,
  reefer:             3_000,
  tanker:             3_000,
  lowbed:             5_000,
};

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500";

// ── Truck Edit/Create Modal ────────────────────────────────────────────────────
function TruckModal({ truck, onClose }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isEdit = Boolean(truck?.id);
  const isOwner = user?.role === "owner";

  const [form, setForm] = useState({
    registration_number: truck?.registration_number || "",
    truck_type:          truck?.truck_type || "flatbed",
    capacity_tonnes:     truck?.capacity_tonnes || "",
    make:                truck?.make || "",
    model:               truck?.model || "",
    year:                truck?.year || "",
    gps_tracker_id:      truck?.gps_tracker_id || "",
  });
  const [error, setError]             = useState("");
  const [paymentUrl, setPaymentUrl]   = useState(null);
  const [initiating, setInitiating]   = useState(false);
  const [verifying, setVerifying]     = useState(false);
  const needsFeeCheck = !isEdit && isOwner;
  const feeKes = ONBOARDING_FEE_KES[form.truck_type] ?? 2_000;

  // Check if an unconsumed paid fee record already exists for this truck_type
  const { data: feeStatusData, refetch: recheckFeeStatus } = useQuery({
    queryKey: ["onboarding-fee-status", form.truck_type],
    queryFn: () =>
      apiClient
        .get(`/trucks/onboarding-fee/status?truck_type=${form.truck_type}`)
        .then((r) => r.data),
    enabled: needsFeeCheck,
    refetchOnWindowFocus: false,
  });

  const feePaid = Boolean(feeStatusData?.fee_paid);

  const handlePayFee = async () => {
    setInitiating(true);
    setError("");
    try {
      const { data } = await apiClient.post("/trucks/onboarding-payment/initiate", {
        truck_type: form.truck_type,
      });
      setPaymentUrl(data.payment_url);
      window.open(data.payment_url, "_blank");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to initiate payment. Please try again.");
    } finally {
      setInitiating(false);
    }
  };

  const handleVerifyPayment = async () => {
    setVerifying(true);
    setError("");
    try {
      const { data } = await recheckFeeStatus();
      if (data?.fee_paid) {
        // feeStatusData updated by recheckFeeStatus — feePaid derived automatically
      } else {
        setError("Payment not yet confirmed. Please wait a moment and try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? apiClient.patch(`/trucks/${truck.id}`, data).then((r) => r.data)
        : apiClient.post("/trucks", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-trucks"] });
      qc.invalidateQueries({ queryKey: ["onboarding-fee-status", form.truck_type] });
      onClose();
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 402 && typeof detail === "object" && detail?.fee_kes) {
        // Fee gate returned 402 — feePaid is derived from feeStatusData (already false)
        setError("");
      } else if (err?.response?.status === 402) {
        setError("Plan limit reached. Please upgrade your plan to add more trucks.");
      } else {
        setError(typeof detail === "string" ? detail : "Failed to save truck");
      }
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    mutation.mutate({
      ...form,
      capacity_tonnes: parseFloat(form.capacity_tonnes),
      year:            form.year ? parseInt(form.year, 10) : null,
      gps_tracker_id:  form.gps_tracker_id || null,
      make:            form.make || null,
      model:           form.model || null,
    });
  };

  const submitBlocked = needsFeeCheck && !feePaid;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">
              {isEdit ? "Edit Truck Details" : "Register New Truck"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {isEdit ? "Update your fleet unit's information." : "Add a new unit to your fleet registry."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Onboarding fee banner — only shown for owners creating a new truck */}
          {needsFeeCheck && (
            feePaid ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  Platform fee paid — you can now register this vehicle.
                </span>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      One-time platform onboarding fee required
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Registering a{" "}
                      <span className="font-semibold">
                        {TRUCK_TYPES.find((t) => t.value === form.truck_type)?.label || form.truck_type}
                      </span>{" "}
                      requires a one-time fee of{" "}
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        KES {feeKes.toLocaleString()}
                      </span>
                      .
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePayFee}
                    disabled={initiating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {initiating ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5" />
                    )}
                    {initiating ? "Opening payment…" : `Pay KES ${feeKes.toLocaleString()}`}
                  </button>
                  {paymentUrl && (
                    <button
                      type="button"
                      onClick={handleVerifyPayment}
                      disabled={verifying}
                      className="flex items-center gap-1.5 px-4 py-2 border border-amber-400 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                    >
                      {verifying ? (
                        <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {verifying ? "Checking…" : "I've paid — verify"}
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Registration No. *
              </label>
              <input
                value={form.registration_number} onChange={set("registration_number")}
                required disabled={isEdit} placeholder="KAA 123B"
                className={`${inputCls} ${isEdit ? "bg-slate-50 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Truck Type *
              </label>
              <select value={form.truck_type} onChange={set("truck_type")} disabled={isEdit} className={inputCls}>
                {TRUCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Capacity (Tonnes) *
            </label>
            <input
              type="number" step="0.5" min="0.5" max="100"
              value={form.capacity_tonnes} onChange={set("capacity_tonnes")} required
              placeholder="e.g. 30" className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Make</label>
              <input value={form.make} onChange={set("make")} placeholder="Isuzu" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Model</label>
              <input value={form.model} onChange={set("model")} placeholder="NQR" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Year</label>
              <input
                type="number" min="1990" max="2030"
                value={form.year} onChange={set("year")} placeholder="2022" className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              GPS Tracker ID
            </label>
            <input
              value={form.gps_tracker_id} onChange={set("gps_tracker_id")}
              placeholder="TRK-GPS-001 (optional)" className={inputCls}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Used for live telemetry on the dashboard map.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || submitBlocked}
              title={submitBlocked ? "Pay the onboarding fee to register this truck" : undefined}
              className="flex-1 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              ) : (
                <>{isEdit ? "Save Changes" : "Register Truck"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Assign Driver Modal ────────────────────────────────────────────────────────
function AssignDriverModal({ truck, teamDrivers, trucks, onClose }) {
  const qc = useQueryClient();
  const { transportAuthority } = useCountryConfig();
  const [search,         setSearch]         = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [error,          setError]          = useState("");

  // All employed drivers; only approved ones can actually be assigned
  const filtered = teamDrivers.filter((d) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (d.full_name  || "").toLowerCase().includes(q) ||
      (d.licence_class || "").toLowerCase().includes(q)
    );
  });

  const mutation = useMutation({
    mutationFn: (driverUserId) =>
      apiClient
        .patch(`/trucks/${truck.id}/assign-driver`, { driver_user_id: driverUserId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-trucks"] });
      qc.invalidateQueries({ queryKey: ["my-team"] });
      onClose();
    },
    onError: (err) => setError(err?.response?.data?.detail || "Failed to assign driver"),
  });

  function handleSelect(userId) {
    const driver = teamDrivers.find((d) => d.user_id === userId);
    if (driver?.verification_status !== "approved") return; // can't select unverified
    setSelectedUserId((prev) => prev === userId ? null : userId);
    setConfirmReassign(false);
    setError("");
  }

  function handleAssign() {
    if (!selectedUserId) return;
    const driver = teamDrivers.find((d) => d.user_id === selectedUserId);
    const alreadyOnTruck = driver?.current_truck_id && driver.current_truck_id !== truck.assigned_driver_id;
    if (alreadyOnTruck && !confirmReassign) {
      setConfirmReassign(true);
      return;
    }
    mutation.mutate(selectedUserId);
  }

  const selectedDriver = teamDrivers.find((d) => d.user_id === selectedUserId);
  const selectedOnAnotherTruck = selectedDriver?.current_truck_id
    && selectedDriver.current_truck_id !== truck.assigned_driver_id;
  const reassignTruck = selectedOnAnotherTruck
    ? trucks.find((t) => t.id === selectedDriver.current_truck_id)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Assign Driver</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Truck <span className="font-mono font-semibold">{truck.registration_number}</span>
              {" · "}verified drivers from your team only
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or licence class…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Reassign confirmation */}
          {confirmReassign && reassignTruck && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Reassign driver?</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  <span className="font-semibold">{selectedDriver?.full_name}</span> is currently on{" "}
                  <span className="font-mono font-semibold">{reassignTruck.registration_number}</span>.
                  Confirming will unassign them from that truck.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-4 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-sm">
              {teamDrivers.length === 0 ? (
                <div>
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No drivers in your team yet.</p>
                  <p className="text-xs mt-1 text-slate-300">Add drivers from the Drivers page.</p>
                </div>
              ) : "No drivers match your search"}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((driver) => {
                const isVerified     = driver.verification_status === "approved";
                const isSelected     = selectedUserId === driver.user_id;
                const onAnotherTruck = driver.current_truck_id && driver.current_truck_id !== truck.assigned_driver_id;
                const otherTruck     = onAnotherTruck ? trucks.find((t) => t.id === driver.current_truck_id) : null;
                const initials       = (driver.full_name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

                return (
                  <button
                    key={driver.id}
                    onClick={() => handleSelect(driver.user_id)}
                    disabled={!isVerified}
                    title={!isVerified ? "Driver must be verified before assignment" : undefined}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      !isVerified
                        ? "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 opacity-60 cursor-not-allowed"
                        : isSelected
                          ? "border-secondary bg-orange-50 dark:bg-orange-900/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/40 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border font-heading font-bold text-sm ${
                      isSelected ? "bg-secondary/10 border-secondary/30 text-secondary" : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                    }`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{driver.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {driver.licence_class && `Class ${driver.licence_class}`}
                        {driver.experience_years && ` · ${driver.experience_years}y exp`}
                        {driver.ntsa_verified && (
                          <span className="ml-1 text-emerald-600 font-medium">· {transportAuthority} ✓</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!isVerified ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600 text-[9px] font-bold uppercase tracking-wider">
                          Unverified
                        </span>
                      ) : onAnotherTruck ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-wider">
                          On {otherTruck?.registration_number ?? "truck"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-bold uppercase tracking-wider">
                          Free
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            disabled={!selectedUserId || mutation.isPending}
            onClick={handleAssign}
            className="flex-1 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning…</>
            ) : confirmReassign ? (
              <><AlertCircle className="w-4 h-4" /> Confirm Reassign</>
            ) : (
              <><UserCheck className="w-4 h-4" /> Assign Driver</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verification Badge ─────────────────────────────────────────────────────────
function VerificationBadge({ truck }) {
  const s = truck.inspection_status;
  if (s === "approved" && truck.is_verified) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
        <ShieldCheck className="w-3 h-3" /> Verified
      </span>
    );
  }
  if (s === "submitted" || s === "pending" || s === "in_progress") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider border border-sky-200">
        <ShieldAlert className="w-3 h-3" /> Under Review
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider border border-red-200">
        <ShieldX className="w-3 h-3" /> Rejected
      </span>
    );
  }
  // not_requested or anything else
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
      <ShieldAlert className="w-3 h-3" /> Unverified
    </span>
  );
}

// ── Tracker Status Pill (rideshare-style LIVE / DELAYED / OFFLINE) ─────────────
function TrackerStatusPill({ truck }) {
  if (!truck.gps_tracker_id) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-600">
        <WifiOff className="w-3 h-3" /> No Tracker
      </span>
    );
  }
  if (!truck.last_seen_at) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-600">
        <Signal className="w-3 h-3" /> Never Pinged
      </span>
    );
  }
  const minutesAgo = (Date.now() - new Date(truck.last_seen_at).getTime()) / 60000; // eslint-disable-line react-hooks/purity
  if (minutesAgo < 2) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider border border-teal-200">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Live
      </span>
    );
  }
  if (minutesAgo < 15) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Delayed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider border border-red-200">
      <WifiOff className="w-3 h-3" /> Offline
    </span>
  );
}

// ── Tracker Provision Modal — shows one-time secret ────────────────────────────
function TrackerProvisionModal({ truck, onClose }) {
  const qc = useQueryClient();
  const [secret, setSecret] = useState(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/trucks/${truck.id}/provision-tracker`).then((r) => r.data),
    onSuccess: (data) => {
      setSecret(data.secret);
      qc.invalidateQueries({ queryKey: ["owner-trucks"] });
    },
    onError: (err) => alert(err?.response?.data?.detail || "Failed to generate secret"),
  });

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">Tracker Secret</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{truck.registration_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!secret ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-1">⚠️ Read before continuing</p>
              <p>Generating a new secret <strong>invalidates the old one immediately</strong>.
              Any existing hardware device will stop reporting until you program the new secret into it.
              The secret is shown <strong>once only</strong> — copy it before closing.</p>
            </div>

            {truck.gps_tracker_id && (
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">GPS Tracker ID</p>
                  <p className="font-mono text-sm text-slate-800 dark:text-slate-100 font-semibold">{truck.gps_tracker_id}</p>
                </div>
              </div>
            )}
            {!truck.gps_tracker_id && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-red-700">
                No GPS Tracker ID set. Edit the truck first and enter the device serial number.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !truck.gps_tracker_id}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {mutation.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Key className="w-4 h-4" /> Generate Secret</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2">
                ✅ Secret generated — copy now
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-slate-700 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 break-all">
                  {secret}
                </code>
                <button
                  onClick={copySecret}
                  className="shrink-0 p-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200">How to configure your device:</p>
              <p>1. Open your GPS device configuration tool (e.g. Teltonika Configurator)</p>
              <p>2. Set <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">Server URL</span> → <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">{window.location.origin}/device/ping</span></p>
              <p>3. Set <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">Device ID</span> → <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">{truck.gps_tracker_id}</span></p>
              <p>4. Set <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">X-Device-Secret</span> header → the secret above</p>
              <p>5. Set ping interval → <span className="font-mono bg-white dark:bg-slate-600 px-1 rounded">5–30 seconds</span></p>
            </div>

            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-600">
              Done — I've saved the secret
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Truck Document Submission Modal ───────────────────────────────────────────
function TruckDocumentModal({ truck, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    logbook_url:             truck.logbook_url             || "",
    insurance_url:           truck.insurance_url           || "",
    insurance_expiry:        truck.insurance_expiry        || "",
    ntsa_inspection_url:     truck.ntsa_inspection_url     || "",
    ntsa_inspection_expiry:  truck.ntsa_inspection_expiry  || "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data) =>
      apiClient.patch(`/trucks/${truck.id}/submit-documents`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-trucks"] });
      setSuccess(true);
      setTimeout(onClose, 1600);
    },
    onError: (err) => setError(err?.response?.data?.detail || "Failed to submit documents"),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const payload = {};
    if (form.logbook_url)            payload.logbook_url            = form.logbook_url;
    if (form.insurance_url)          payload.insurance_url          = form.insurance_url;
    if (form.insurance_expiry)       payload.insurance_expiry       = form.insurance_expiry;
    if (form.ntsa_inspection_url)    payload.ntsa_inspection_url    = form.ntsa_inspection_url;
    if (form.ntsa_inspection_expiry) payload.ntsa_inspection_expiry = form.ntsa_inspection_expiry;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" /> Submit Compliance Documents
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Truck <span className="font-mono font-semibold">{truck.registration_number}</span>
              {" · "}Admin review required before shippers can hire this truck
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-heading font-bold text-slate-900 dark:text-white text-lg">Submitted for Review</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Our team will verify your documents shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {truck.inspection_status === "rejected" && truck.verification_notes && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <ShieldX className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Rejection Reason</p>
                  <p className="text-xs text-red-600 mt-0.5">{truck.verification_notes}</p>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              <p className="font-semibold mb-0.5">Required documents</p>
              <p>Upload your document files to cloud storage (e.g. Google Drive, Dropbox) and paste the shareable link below.</p>
            </div>

            {[
              { key: "logbook_url", label: "Logbook / Ownership Document URL", placeholder: "https://drive.google.com/…" },
              { key: "insurance_url", label: "Insurance Certificate URL", placeholder: "https://drive.google.com/…" },
              { key: "ntsa_inspection_url", label: "NTSA Inspection Certificate URL", placeholder: "https://drive.google.com/…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">{label}</label>
                <input
                  value={form[key]} onChange={set(key)}
                  placeholder={placeholder} className={inputCls}
                />
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Insurance Expiry</label>
                <input type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">NTSA Cert Expiry</label>
                <input type="date" value={form.ntsa_inspection_expiry} onChange={set("ntsa_inspection_expiry")} className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {mutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Submit for Review</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Truck Card ─────────────────────────────────────────────────────────────────
function TruckCard({ truck, teamDrivers, onEdit, onAssign, onSubmitDocs, onProvision }) {
  const qc = useQueryClient();
  const { transportAuthority, locale } = useCountryConfig();

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/trucks/${truck.id}`, { is_active: !truck.is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-trucks"] }),
  });

  const unassignMutation = useMutation({
    mutationFn: () =>
      apiClient
        .patch(`/trucks/${truck.id}/assign-driver`, { driver_user_id: null })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-trucks"] });
      qc.invalidateQueries({ queryKey: ["my-team"] });
    },
  });

  // Look up assigned driver from the already-fetched team list — no extra API call
  const assignedDriver = truck.assigned_driver_id
    ? teamDrivers.find((d) => d.id === truck.assigned_driver_id) ?? null
    : null;

  const hasGps      = Boolean(truck.gps_tracker_id);
  const hasLocation = Boolean(truck.current_latitude && truck.current_longitude);


  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`h-[3px] w-full ${truck.is_active ? "bg-[#4fdbcc]" : "bg-slate-200 dark:bg-slate-600"}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-slate-900 dark:text-white text-base tracking-wide">
                {truck.registration_number}
              </span>
              {truck.is_active ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider border border-teal-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" /> Idle
                </span>
              )}
              <VerificationBadge truck={truck} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {truck.make && truck.model
                ? `${truck.make} ${truck.model}${truck.year ? ` · ${truck.year}` : ""}`
                : "Details not set"}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border capitalize ${TYPE_COLORS[truck.truck_type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {truck.truck_type.replace("_", " ")}
          </span>
        </div>

        {/* Verification notice banners */}
        {truck.inspection_status === "rejected" && truck.verification_notes && (
          <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-red-50 rounded-lg border border-red-200">
            <ShieldX className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-800">Rejected — {truck.verification_notes}</p>
              <button
                onClick={() => onSubmitDocs(truck)}
                className="mt-1 text-[10px] font-bold text-red-700 underline hover:no-underline"
              >
                Resubmit corrected documents →
              </button>
            </div>
          </div>
        )}
        {!truck.is_verified && truck.inspection_status !== "submitted" && truck.inspection_status !== "pending" && truck.inspection_status !== "in_progress" && truck.inspection_status !== "rejected" && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-[10px] text-amber-700 font-medium">
              Not visible to shippers until verified.
            </p>
            <button
              onClick={() => onSubmitDocs(truck)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-md hover:bg-amber-700 transition-colors"
            >
              <Upload className="w-3 h-3" /> Submit Docs
            </button>
          </div>
        )}
        {(truck.inspection_status === "submitted" || truck.inspection_status === "pending" || truck.inspection_status === "in_progress") && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-sky-50 rounded-lg border border-sky-200">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <p className="text-[10px] text-sky-700 font-medium">Documents submitted — awaiting admin review.</p>
          </div>
        )}

        {/* Assigned driver banner */}
        {truck.assigned_driver_id ? (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 font-heading font-bold text-xs text-emerald-700 shrink-0">
              {assignedDriver?.full_name
                ? assignedDriver.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800 truncate">
                {assignedDriver?.full_name ?? "Driver assigned"}
              </p>
              <p className="text-[10px] text-emerald-600">
                {assignedDriver?.licence_class ? `Class ${assignedDriver.licence_class}` : ""}
                {assignedDriver?.ntsa_verified && ` · ${transportAuthority} ✓`}
              </p>
            </div>
            {assignedDriver?.user_id && (
              <Link
                to={`/driver-profile/${assignedDriver.user_id}`}
                className="p-1 hover:bg-emerald-100 rounded transition-colors"
                title="View driver profile"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              </Link>
            )}
            <button
              onClick={() => unassignMutation.mutate()}
              disabled={unassignMutation.isPending}
              className="p-1 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
              title="Unassign driver"
            >
              <UserX className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAssign(truck)}
            className="w-full flex items-center justify-center gap-1.5 mb-4 px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-secondary hover:text-secondary hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" /> Assign Driver
          </button>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2.5 px-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Capacity</p>
            <p className="font-heading font-bold text-slate-900 dark:text-white text-base">{truck.capacity_tonnes}t</p>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2.5 px-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">GPS</p>
            <div className="flex items-center justify-center gap-1">
              {hasGps ? (
                <><Wifi className="w-3.5 h-3.5 text-teal-500" /><p className="font-semibold text-teal-700 text-xs">Active</p></>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-slate-400" /><p className="font-semibold text-slate-400 dark:text-slate-500 text-xs">None</p></>
              )}
            </div>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2.5 px-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Location</p>
            <div className="flex items-center justify-center gap-1">
              {hasLocation ? (
                <><MapPin className="w-3.5 h-3.5 text-[#4fdbcc]" /><p className="font-semibold text-slate-700 dark:text-slate-200 text-xs">Live</p></>
              ) : (
                <><MapPin className="w-3.5 h-3.5 text-slate-400" /><p className="font-semibold text-slate-400 dark:text-slate-500 text-xs">—</p></>
              )}
            </div>
          </div>
        </div>

        {/* Live location banner — active trucks with GPS coordinates */}
        {truck.is_active && hasLocation && (
          <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2.5 bg-teal-50 rounded-lg border border-teal-100">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#4fdbcc] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-teal-800 font-mono">
                  {truck.current_latitude.toFixed(4)}, {truck.current_longitude.toFixed(4)}
                </p>
                {truck.last_seen_at && (
                  <p className="text-[10px] text-teal-600 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {timeAgo(truck.last_seen_at)}
                  </p>
                )}
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${truck.current_latitude},${truck.current_longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 whitespace-nowrap"
              title="Open in Google Maps"
            >
              Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* ── Tracker panel (rideshare-style status + provision) ─────────── */}
        <div className="mb-4 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">GPS Tracker</span>
            </div>
            <TrackerStatusPill truck={truck} />
          </div>
          <div className="px-3 py-2.5">
            {truck.gps_tracker_id ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-200 font-semibold">{truck.gps_tracker_id}</span>
                  {truck.battery_level != null && (
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${truck.battery_level < 20 ? "text-red-600" : truck.battery_level < 50 ? "text-amber-500" : "text-teal-600"}`}>
                      <Battery className="w-3 h-3" /> {Math.round(truck.battery_level)}%
                    </span>
                  )}
                  {truck.signal_strength != null && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <Signal className="w-3 h-3" /> {truck.signal_strength} dBm
                    </span>
                  )}
                  {truck.last_seen_at && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Last ping: {timeAgo(truck.last_seen_at)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onProvision(truck)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-[10px] font-bold hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                  title="Generate or rotate tracker secret"
                >
                  <Key className="w-3 h-3" /> Secret
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">No tracker ID — edit truck to add one</p>
                <button
                  onClick={() => onEdit(truck)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="w-3 h-3" /> Set ID
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700 flex-wrap">
          <button onClick={() => onEdit(truck)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              truck.is_active
                ? "border border-orange-200 text-secondary hover:bg-orange-50"
                : "border border-teal-200 text-teal-700 hover:bg-teal-50"
            }`}
          >
            {truck.is_active ? (
              <><ToggleRight className="w-3.5 h-3.5" /> Deactivate</>
            ) : (
              <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>
            )}
          </button>
          {/* Show submit docs button unless already verified */}
          {truck.inspection_status !== "approved" && (
            <button
              onClick={() => onSubmitDocs(truck)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-[11px] font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {truck.inspection_status === "submitted" || truck.inspection_status === "pending"
                ? "Update Docs"
                : truck.inspection_status === "rejected"
                ? "Resubmit"
                : "Submit Docs"}
            </button>
          )}
          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {new Date(truck.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function FleetManagementPage() {
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === "admin";
  const [search, setSearch]           = useState("");
  const [filterType, setFilterType]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal, setModal]             = useState(null); // null | "add" | truck object
  const [assignModal, setAssignModal] = useState(null); // null | truck object
  const [docsModal, setDocsModal]     = useState(null); // null | truck object
  const [provisionModal, setProvisionModal] = useState(null); // null | truck object

  const { data: trucks = [], isLoading } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => apiClient.get("/trucks").then((r) => r.data),
  });

  // Fetch team once; used by TruckCard (name display) and AssignDriverModal (picker)
  const { data: teamDrivers = [] } = useQuery({
    queryKey: ["my-team"],
    queryFn: () => apiClient.get("/drivers/my-team").then((r) => r.data),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    return trucks.filter((t) => {
      const matchSearch =
        !search ||
        t.registration_number.toLowerCase().includes(search.toLowerCase()) ||
        (t.make || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.model || "").toLowerCase().includes(search.toLowerCase());
      const matchType   = !filterType   || t.truck_type === filterType;
      const matchStatus = !filterStatus || (filterStatus === "active" ? t.is_active : !t.is_active);
      return matchSearch && matchType && matchStatus;
    });
  }, [trucks, search, filterType, filterStatus]);

  const totalCapacity  = trucks.reduce((sum, t) => sum + t.capacity_tonnes, 0);
  const activeCount    = trucks.filter((t) => t.is_active).length;
  const gpsCount       = trucks.filter((t) => t.gps_tracker_id).length;
  const assignedCount  = trucks.filter((t) => t.assigned_driver_id).length;

  const selectCls =
    "pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 appearance-none";

  return (
    <div className="w-full">
      {modal !== null && (
        <TruckModal truck={modal === "add" ? null : modal} onClose={() => setModal(null)} />
      )}
      {assignModal !== null && (
        <AssignDriverModal
          truck={assignModal}
          teamDrivers={teamDrivers}
          trucks={trucks}
          onClose={() => setAssignModal(null)}
        />
      )}
      {docsModal !== null && (
        <TruckDocumentModal truck={docsModal} onClose={() => setDocsModal(null)} />
      )}
      {provisionModal !== null && (
        <TrackerProvisionModal truck={provisionModal} onClose={() => setProvisionModal(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Fleet Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Register, configure and monitor every unit in your fleet.</p>
        </div>
        <button
          onClick={() => !isAdmin && setModal("add")}
          disabled={isAdmin}
          title={isAdmin ? "Admins cannot register trucks" : undefined}
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Register Truck
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          { label: "Total Units",     value: trucks.length,                              color: "text-slate-900 dark:text-white",         sub: "registered"         },
          { label: "Active",          value: activeCount,                                color: "text-[#4fdbcc]",          sub: "in service"          },
          { label: "Drivers Assigned",value: assignedCount,                              color: "text-primary",           sub: `${trucks.length - assignedCount} unassigned` },
          { label: "Total Capacity",  value: `${totalCapacity.toLocaleString()}t`,       color: "text-secondary",         sub: `${gpsCount} GPS-enabled` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-5 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plate, make, model…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="relative">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
            <option value="">All Types</option>
            {TRUCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium">
          {filtered.length} unit{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Truck grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-52 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
          <Truck className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            {trucks.length === 0 ? "No trucks registered yet." : "No trucks match your filters."}
          </p>
          {trucks.length === 0 && !isAdmin && (
            <button onClick={() => setModal("add")}
              className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Register your first truck
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((truck) => (
            <TruckCard
              key={truck.id}
              truck={truck}
              teamDrivers={teamDrivers}
              onEdit={(t) => setModal(t)}
              onAssign={(t) => setAssignModal(t)}
              onSubmitDocs={(t) => setDocsModal(t)}
              onProvision={(t) => setProvisionModal(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
