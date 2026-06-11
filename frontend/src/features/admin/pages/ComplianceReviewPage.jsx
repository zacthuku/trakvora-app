import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Star, CheckCircle2, XCircle, RotateCcw, Shield } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

const PHOTO_ANGLES = ["front", "back", "left", "right", "interior", "plate"];
const ANGLE_LABELS = {
  front: "Front", back: "Rear", left: "Left", right: "Right", interior: "Interior", plate: "Plate",
};

const CONDITION_COLORS = {
  clean: "text-green-400 bg-green-900/30 border-green-700/40",
  good:  "text-blue-400 bg-blue-900/30 border-blue-700/40",
  fair:  "text-yellow-400 bg-yellow-900/30 border-yellow-700/40",
  poor:  "text-red-400 bg-red-900/30 border-red-700/40",
};

const DECISIONS = [
  { value: "approved",      label: "Approve",          icon: CheckCircle2, color: "border-green-600 text-green-300 bg-green-900/30 hover:bg-green-900/50" },
  { value: "rejected",      label: "Reject",            icon: XCircle,      color: "border-red-600 text-red-300 bg-red-900/30 hover:bg-red-900/50" },
  { value: "re_inspection", label: "Request Re-Inspect", icon: RotateCcw,   color: "border-yellow-600 text-yellow-300 bg-yellow-900/30 hover:bg-yellow-900/50" },
];

function ScoreDots({ score }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < score ? "text-amber-400 fill-amber-400" : "text-slate-700"}`} />
      ))}
    </div>
  );
}

export default function ComplianceReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: inspection, isLoading } = useQuery({
    queryKey: ["inspection", id],
    queryFn: () => adminApi.getInspection(id),
  });

  const mutation = useMutation({
    mutationFn: () => adminApi.submitReview(id, { decision, notes: reviewNotes || null }),
    onSuccess: () => {
      toast("Review submitted", "success");
      navigate("/admin/compliance");
    },
    onError: (e) => toast(e?.response?.data?.detail || "Review failed", "error"),
  });

  if (isLoading) {
    return <div className="py-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />)}</div>;
  }

  if (!inspection) {
    return <div className="py-8 text-center text-slate-500">Inspection not found</div>;
  }

  const photos = inspection.photo_urls ?? {};

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <button onClick={() => navigate("/admin/compliance")}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Queue
      </button>

      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white font-heading">Inspection Review</h1>
        <span className="text-xs text-slate-500">#{id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Inspection data */}
        <div className="space-y-4">
          {/* Photos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-heading">Vehicle Photos</h2>
            <div className="grid grid-cols-3 gap-2">
              {PHOTO_ANGLES.map((angle) => (
                <div key={angle} className="space-y-1">
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-heading">{ANGLE_LABELS[angle]}</p>
                  {photos[angle] ? (
                    <img src={photos[angle]} alt={angle}
                      className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-700" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center">
                      <span className="text-[9px] text-slate-600">No photo</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Assessment */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-heading">Assessment</h2>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Condition</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize font-heading ${CONDITION_COLORS[inspection.condition] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                {inspection.condition ?? "—"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Score</span>
              {inspection.score ? <ScoreDots score={inspection.score} /> : <span className="text-slate-600 text-xs">—</span>}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Roadworthy</span>
              <span className={`text-xs font-semibold font-heading ${inspection.roadworthy ? "text-green-400" : "text-red-400"}`}>
                {inspection.roadworthy == null ? "—" : inspection.roadworthy ? "Yes" : "No"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Tracker</span>
              <span className="text-xs text-slate-300 capitalize">
                {inspection.tracker_status?.replace(/_/g, " ") ?? "—"}
                {inspection.tracker_id ? ` (${inspection.tracker_id})` : ""}
              </span>
            </div>

            {inspection.damages && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Damages</p>
                <p className="text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2">{inspection.damages}</p>
              </div>
            )}

            {inspection.notes && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Inspector Notes</p>
                <p className="text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2">{inspection.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Decision panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 md:sticky md:top-20">
            <h2 className="text-sm font-bold text-white font-heading">Submit Decision</h2>

            <div className="space-y-2">
              {DECISIONS.map(({ value, label, icon: Icon, color }) => (
                <button type="button" key={value} onClick={() => setDecision(value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold font-heading transition-colors ${
                    decision === value ? color : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notes (optional)</label>
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3}
                placeholder="Reason for decision, follow-up instructions…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={!decision || mutation.isPending}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {mutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
              ) : "Submit Decision"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
