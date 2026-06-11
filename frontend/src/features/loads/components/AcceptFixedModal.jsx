import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Tag, Truck, X } from "lucide-react";
import apiClient from "@/services/apiClient";
import { loadsApi } from "@/features/loads/api/loadsApi";
import { useCurrency } from "@/hooks/useCurrency";
import { CARGO_TRUCK_REQUIRED } from "@/utils/constants";
import { toast } from "@/components/ui/Toast";

export default function AcceptFixedModal({ load, onClose, onSuccess }) {
  const { format } = useCurrency();
  const qc = useQueryClient();
  const [selectedTruckId, setSelectedTruckId] = useState(null);

  const { data: trucks = [] } = useQuery({
    queryKey: ["my-trucks"],
    queryFn: () => apiClient.get("/trucks").then(r => r.data),
  });

  const activeTrucks = trucks.filter(t => t.is_active);
  const effectiveId = selectedTruckId ?? (activeTrucks.length === 1 ? activeTrucks[0].id : null);

  const selectedTruck = activeTrucks.find(t => t.id === effectiveId);

  // Blocking eligibility issues for the selected truck
  const blockingIssues = [];
  if (selectedTruck) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!selectedTruck.is_verified) {
      blockingIssues.push("Truck not verified — submit compliance documents first.");
    }
    if ((selectedTruck.capacity_tonnes ?? 0) < (load.weight_tonnes ?? 0)) {
      blockingIssues.push(`Truck capacity (${selectedTruck.capacity_tonnes}t) is below load weight (${load.weight_tonnes}t).`);
    }
    const reqByType = CARGO_TRUCK_REQUIRED[load.cargo_type];
    if (reqByType && selectedTruck.truck_type !== reqByType) {
      blockingIssues.push(`This load requires a ${reqByType} truck. Your ${selectedTruck.truck_type} is not suitable.`);
    }
    if (load.required_truck_type && selectedTruck.truck_type !== load.required_truck_type) {
      blockingIssues.push(`This load requires a ${load.required_truck_type} truck.`);
    }
    if (load.requires_insurance) {
      if (!selectedTruck.insurance_url) {
        blockingIssues.push("This load requires cargo insurance — upload your document first.");
      } else if (selectedTruck.insurance_expiry && new Date(selectedTruck.insurance_expiry) < today) {
        blockingIssues.push(`Cargo insurance expired ${new Date(selectedTruck.insurance_expiry).toLocaleDateString()} — renew first.`);
      }
    }
    if (selectedTruck.ntsa_inspection_expiry && new Date(selectedTruck.ntsa_inspection_expiry) < today) {
      blockingIssues.push(`NTSA inspection expired ${new Date(selectedTruck.ntsa_inspection_expiry).toLocaleDateString()} — renew first.`);
    }
  }

  const mutation = useMutation({
    mutationFn: () => loadsApi.acceptFixedPrice(load.id, effectiveId),
    onSuccess: (updated) => {
      toast(`Job confirmed at ${format(load.price_kes)}!`);
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      qc.invalidateQueries({ queryKey: ["owner-active-loads"] });
      qc.invalidateQueries({ queryKey: ["driver-jobs"] });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      onSuccess?.(updated);
      onClose();
    },
    onError: (e) => {
      const detail = e?.response?.data?.detail;
      toast(typeof detail === "string" ? detail : "Could not accept load. Try again.", "error");
    },
  });

  const canConfirm = effectiveId && blockingIssues.length === 0 && !mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white">Accept at Fixed Price</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Price block */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fixed Price</p>
            <p className="text-3xl font-heading font-black text-emerald-700 dark:text-emerald-400">{format(load.price_kes)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">First carrier to accept wins this job</p>
          </div>

          {/* Cargo summary */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span className="capitalize">{load.cargo_type?.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>{load.weight_tonnes}t</span>
            {load.pickup_date && <><span>·</span><span>{new Date(load.pickup_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span></>}
          </div>

          {/* Truck picker */}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">Select the truck you'll use:</p>
            {activeTrucks.length === 0 ? (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No active trucks. Activate a truck in Fleet Management first.
              </div>
            ) : (
              <div className="space-y-2">
                {activeTrucks.map(truck => (
                  <label
                    key={truck.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                      effectiveId === truck.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={effectiveId === truck.id}
                      onChange={() => setSelectedTruckId(truck.id)}
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${effectiveId === truck.id ? "border-emerald-500" : "border-slate-300"}`}>
                      {effectiveId === truck.id && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-slate-900 dark:text-white text-sm">{truck.registration_number}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{truck.truck_type?.replace(/_/g, " ")} · {truck.capacity_tonnes}t</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Blocking issues */}
          {blockingIssues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 space-y-1">
              {blockingIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {mutation.isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
            Accept at {format(load.price_kes)}
          </button>
        </div>
      </div>
    </div>
  );
}
