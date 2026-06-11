import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin, Navigation, CheckCircle2, AlertCircle, ChevronLeft,
  ChevronRight, AlertTriangle, XCircle,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { adminApi } from "@/features/admin/api/adminApi";
import PhotoDropZone from "@/components/ui/PhotoDropZone";
import { useGeolocation } from "@/hooks/useGeolocation";
import { inspectorIcon, taskIcon } from "@/utils/leafletIcons";
import FullscreenMapWrapper from "@/components/ui/FullscreenMapWrapper";
import ChecklistSection, { DEFAULT_CHECKLIST, isChecklistComplete, checklistIssues } from "@/features/admin/components/ChecklistSection";
import { toast } from "@/components/ui/Toast";

const PHOTO_ANGLES = ["front", "back", "left", "right", "interior", "plate"];
const ANGLE_LABELS = {
  front: "Front View", back: "Rear View", left: "Left Side",
  right: "Right Side", interior: "Interior", plate: "Plate Number",
};
const CONDITIONS = [
  { value: "clean", label: "Clean", color: "text-green-400" },
  { value: "good",  label: "Good",  color: "text-blue-400" },
  { value: "fair",  label: "Fair",  color: "text-yellow-400" },
  { value: "poor",  label: "Poor",  color: "text-red-400" },
];
const TRACKER_STATUSES = [
  { value: "not_installed", label: "Not Installed" },
  { value: "installed",     label: "Installed" },
  { value: "verified",      label: "Verified (Signal Confirmed)" },
];
const STEPS = ["Location", "Photos", "Checklist", "Tracker", "Submit"];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Step progress bar ─────────────────────────────────────────────────────────

function StepBar({ current, completed }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((label, i) => {
        const done = completed.has(i);
        const active = i === current;
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-heading border-2 transition-all ${
                done    ? "bg-green-600 border-green-600 text-white" :
                active  ? "bg-violet-600 border-violet-500 text-white" :
                          "bg-slate-800 border-slate-600 text-slate-500"
              }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-heading font-semibold uppercase tracking-wide truncate ${active ? "text-violet-400" : done ? "text-green-400" : "text-slate-600"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-1 mb-4 ${done ? "bg-green-600" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function StepNav({ step, setStep, canAdvance, onSubmit, submitting }) {
  return (
    <div className="flex gap-3 pt-4 border-t border-slate-800">
      {step > 0 && (
        <button type="button" onClick={() => setStep((s) => s - 1)}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-heading font-semibold transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      )}
      <div className="flex-1" />
      {step < 4 ? (
        <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}
          className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-heading font-semibold transition-colors">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      ) : (
        <button type="button" onClick={onSubmit} disabled={!canAdvance || submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-heading font-semibold transition-colors">
          {submitting
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
            : <><CheckCircle2 className="w-4 h-4" /> Submit Inspection</>
          }
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FieldOpsTaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { position } = useGeolocation();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  const [photos, setPhotos]     = useState({ front: null, back: null, left: null, right: null, interior: null, plate: null });
  const [condition, setCondition] = useState("");
  const [score, setScore]       = useState(3);
  const [roadworthy, setRoadworthy] = useState(true);
  const [trackerStatus, setTrackerStatus] = useState("not_installed");
  const [trackerId, setTrackerId] = useState("");
  const [notes, setNotes]       = useState("");
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [draftSaved, setDraftSaved] = useState(null);
  const saveTimer = useRef(null);

  // ── Draft persistence ───────────────────────────────────────────────────────
  const formState = { step, photos, condition, score, roadworthy, trackerStatus, trackerId, notes, checklist };

  useEffect(() => {
    if (!taskId) return;
    const saved = localStorage.getItem(`draft_${taskId}`);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(d.step ?? 0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.photos) setPhotos(d.photos);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.condition) setCondition(d.condition);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.score != null) setScore(d.score);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.roadworthy != null) setRoadworthy(d.roadworthy);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.trackerStatus) setTrackerStatus(d.trackerStatus);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.trackerId) setTrackerId(d.trackerId);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.notes) setNotes(d.notes);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.checklist) setChecklist(d.checklist);
        toast("Draft restored", "info");
      } catch { /* corrupt draft */ }
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(`draft_${taskId}`, JSON.stringify(formState));
      setDraftSaved(new Date());
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [JSON.stringify(formState)]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: task, isLoading } = useQuery({
    queryKey: ["field-ops-task", taskId],
    queryFn: () => adminApi.getTask(taskId),
  });

  const mutation = useMutation({
    mutationFn: (data) => adminApi.submitInspection(taskId, data),
    onSuccess: () => {
      localStorage.removeItem(`draft_${taskId}`);
      toast("Inspection submitted", "success");
      navigate("/admin/field-inspector");
    },
    onError: (e) => toast(e?.response?.data?.detail || "Submission failed", "error"),
  });

  // ── Per-step validity ───────────────────────────────────────────────────────
  const allPhotos = PHOTO_ANGLES.every((a) => !!photos[a]);
  const stepValid = [
    true,                               // Location — always passable
    allPhotos && !!condition,           // Photos + condition
    isChecklistComplete(checklist),     // Checklist
    true,                               // Tracker — always passable
    allPhotos && !!condition && isChecklistComplete(checklist), // Submit
  ];

  // Mark step as completed when advancing
  const advance = useCallback((next) => {
    setCompleted((c) => new Set([...c, step]));
    setStep(next);
  }, [step]);

  const handleSubmit = () => {
    mutation.mutate({
      photo_urls: photos,
      condition,
      score,
      roadworthy,
      tracker_status: trackerStatus,
      tracker_id: trackerStatus !== "not_installed" && trackerId ? trackerId : null,
      notes: notes || null,
      checklist,
      inspection_lat: position?.latitude ?? null,
      inspection_lon: position?.longitude ?? null,
    });
  };

  if (isLoading) {
    return <div className="py-8 space-y-4">{[0,1,2].map(i => <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />)}</div>;
  }

  const taskLat = task?.location_lat;
  const taskLng = task?.location_lon;
  const mapCenter = position ? [position.latitude, position.longitude] : taskLat ? [taskLat, taskLng] : [-1.2921, 36.8219];
  const dist = position && taskLat ? haversineKm(position.latitude, position.longitude, taskLat, taskLng).toFixed(1) : null;
  const mapsUrl = taskLat ? `https://www.google.com/maps/dir/?api=1&destination=${taskLat},${taskLng}` : null;

  const issues = checklistIssues(checklist);

  return (
    <div className="max-w-2xl mx-auto py-4 pb-12 space-y-5">

      {/* Header */}
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-heading mb-3 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-xl font-bold text-white font-heading">Inspection Form</h1>
        {task?.location && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-sm text-slate-400">{task.location}</p>
          </div>
        )}
        {draftSaved && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            Draft saved {draftSaved.toLocaleTimeString()}
          </p>
        )}
      </div>

      <StepBar current={step} completed={completed} />

      {/* ── Step 1: Location ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <FullscreenMapWrapper defaultHeight="192px" className="rounded-xl overflow-hidden border border-slate-800" dark>
            <MapContainer center={mapCenter} zoom={taskLat ? 14 : 11} className="h-full w-full" zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              {position && (
                <>
                  <Marker position={[position.latitude, position.longitude]} icon={inspectorIcon}>
                    <Popup>Your position</Popup>
                  </Marker>
                  {position.accuracy && (
                    <Circle center={[position.latitude, position.longitude]} radius={position.accuracy}
                      pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 1 }} />
                  )}
                </>
              )}
              {taskLat && (
                <Marker position={[taskLat, taskLng]} icon={taskIcon}>
                  <Popup>{task?.location ?? "Inspection site"}</Popup>
                </Marker>
              )}
            </MapContainer>
          </FullscreenMapWrapper>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${position ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
              <span className={`text-xs font-heading font-semibold ${position ? "text-green-400" : "text-slate-500"}`}>
                {position
                  ? `GPS locked · ±${Math.round(position.accuracy ?? 0)}m accuracy`
                  : "Waiting for GPS fix…"}
              </span>
            </div>
            {dist && <p className="text-xs text-slate-400">You are <span className="text-white font-semibold">{dist} km</span> from inspection site</p>}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-heading font-semibold transition-colors">
                <Navigation className="w-3.5 h-3.5" /> Navigate with Google Maps
              </a>
            )}
          </div>

          <StepNav step={step} setStep={advance} canAdvance={stepValid[0]} onSubmit={handleSubmit} submitting={mutation.isPending} />
        </div>
      )}

      {/* ── Step 2: Photos ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white font-heading">Vehicle Photos</h2>
              <span className="text-[10px] text-slate-500">{PHOTO_ANGLES.filter(a => photos[a]).length} / 6</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PHOTO_ANGLES.map((angle) => {
                const data = photos[angle];
                const url = typeof data === "object" && data !== null ? data.url : data;
                const tagged = typeof data === "object" && data?.lat;
                return (
                  <div key={angle} className="space-y-1">
                    <PhotoDropZone
                      label={ANGLE_LABELS[angle]}
                      currentUrl={url}
                      onUpload={(uploadedUrl) =>
                        setPhotos((p) => ({
                          ...p,
                          [angle]: {
                            url: uploadedUrl,
                            lat: position?.latitude ?? null,
                            lng: position?.longitude ?? null,
                            timestamp: new Date().toISOString(),
                          },
                        }))
                      }
                      hint="JPG or PNG"
                    />
                    {url && (
                      <p className={`text-[9px] font-heading font-semibold ${tagged ? "text-green-400" : "text-amber-400"}`}>
                        {tagged ? "📍 GPS tagged" : "⚠ No GPS at capture"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {!allPhotos && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> All 6 photos required
              </p>
            )}
          </div>

          {/* Condition here so photos + condition are one step */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-bold text-white font-heading">Condition Assessment</h2>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Vehicle Condition</p>
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map(({ value, label, color }) => (
                  <button type="button" key={value} onClick={() => setCondition(value)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold font-heading transition-colors ${
                      condition === value ? "bg-violet-900/60 border-violet-500 text-violet-200" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}>
                    <span className={condition === value ? "" : color}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Score: <span className="text-violet-400 text-sm">{score} / 5</span>
              </p>
              <input type="range" min={1} max={5} step={1} value={score}
                onChange={(e) => setScore(Number(e.target.value))} className="w-full accent-violet-500" />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-heading">
                <span>1 Poor</span><span>2</span><span>3 Average</span><span>4</span><span>5 Excellent</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Roadworthiness</p>
              <div className="flex gap-3">
                {[{ val: true, label: "Roadworthy" }, { val: false, label: "Not Roadworthy" }].map(({ val, label }) => (
                  <button type="button" key={String(val)} onClick={() => setRoadworthy(val)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold font-heading transition-colors ${
                      roadworthy === val
                        ? val ? "bg-green-900/50 border-green-600 text-green-300" : "bg-red-900/50 border-red-600 text-red-300"
                        : "bg-slate-800 border-slate-700 text-slate-500"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <StepNav step={step} setStep={advance} canAdvance={stepValid[1]} onSubmit={handleSubmit} submitting={mutation.isPending} />
        </div>
      )}

      {/* ── Step 3: Checklist ───────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Complete all sections of the vehicle checklist.</p>
          <ChecklistSection checklist={checklist} onChange={setChecklist} />
          <StepNav step={step} setStep={advance} canAdvance={stepValid[2]} onSubmit={handleSubmit} submitting={mutation.isPending} />
        </div>
      )}

      {/* ── Step 4: Tracker ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-white font-heading">Tracker / GPS Device</h2>
            <div className="space-y-2">
              {TRACKER_STATUSES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="tracker" value={value} checked={trackerStatus === value}
                    onChange={() => setTrackerStatus(value)} className="accent-violet-500" />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
            {trackerStatus !== "not_installed" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Device ID / Serial</label>
                <input value={trackerId} onChange={(e) => setTrackerId(e.target.value)} placeholder="e.g. TLT-001-KE"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
              </div>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Additional Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Any other observations…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
          </div>
          <StepNav step={step} setStep={advance} canAdvance={stepValid[3]} onSubmit={handleSubmit} submitting={mutation.isPending} />
        </div>
      )}

      {/* ── Step 5: Review & Submit ──────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white font-heading mb-2">Inspection Summary</h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Condition</p>
                <p className="font-semibold text-white capitalize">{condition || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Score</p>
                <p className="font-semibold text-white">{score} / 5</p>
              </div>
              <div>
                <p className="text-slate-500">Roadworthy</p>
                <p className={`font-semibold ${roadworthy ? "text-green-400" : "text-red-400"}`}>
                  {roadworthy ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Photos</p>
                <p className="font-semibold text-white">{PHOTO_ANGLES.filter(a => photos[a]).length} / 6</p>
              </div>
              <div>
                <p className="text-slate-500">Tracker</p>
                <p className="font-semibold text-white capitalize">{trackerStatus.replace("_", " ")}</p>
              </div>
              {position && (
                <div>
                  <p className="text-slate-500">GPS at submit</p>
                  <p className="font-semibold text-green-400 text-[10px]">
                    {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {issues.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-1.5">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-heading flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Issues Found
                </p>
                {issues.map((iss) => (
                  <div key={iss} className="flex items-center gap-2 text-xs text-slate-300">
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    {iss}
                  </div>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                No issues detected in checklist
              </div>
            )}
          </div>

          {!stepValid[4] && (
            <p className="text-xs text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {!allPhotos ? "Upload all 6 photos" : !condition ? "Select a condition" : "Complete the checklist"} before submitting
            </p>
          )}

          <StepNav step={step} setStep={advance} canAdvance={stepValid[4]} onSubmit={handleSubmit} submitting={mutation.isPending} />
        </div>
      )}
    </div>
  );
}
