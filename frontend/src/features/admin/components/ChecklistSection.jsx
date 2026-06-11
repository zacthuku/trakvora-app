import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

// ── Accordion wrapper ─────────────────────────────────────────────────────────

function Accordion({ title, touched, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          {touched
            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            : <div className="w-4 h-4 rounded-full border-2 border-slate-600 shrink-0" />
          }
          <span className="text-xs font-bold uppercase tracking-widest text-white font-heading">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-4 bg-slate-900 space-y-4">{children}</div>}
    </div>
  );
}

// ── Three-way toggle: Good / Worn / Damaged ───────────────────────────────────

const TYRE_STATES = ["good", "worn", "damaged"];
const TYRE_COLORS = {
  good:    "bg-green-600 text-white border-green-600",
  worn:    "bg-amber-600 text-white border-amber-600",
  damaged: "bg-red-600 text-white border-red-600",
};

function TyreToggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-300 w-20 shrink-0">{label}</span>
      <div className="flex gap-1">
        {TYRE_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-heading border transition-colors capitalize ${
              value === s ? TYRE_COLORS[s] : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pass / Fail toggle ────────────────────────────────────────────────────────

function PassFail({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-300">{label}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-heading border transition-colors ${
            value === true ? "bg-green-700 text-white border-green-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
          }`}
        >
          <CheckCircle2 className="w-3 h-3" /> Pass
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-heading border transition-colors ${
            value === false ? "bg-red-700 text-white border-red-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
          }`}
        >
          <XCircle className="w-3 h-3" /> Fail
        </button>
      </div>
    </div>
  );
}

// ── Damage location chips ─────────────────────────────────────────────────────

const DAMAGE_LOCATIONS = ["Front Bumper", "Driver Door", "Passenger Door", "Roof", "Rear", "Underbody", "Other"];

function DamageChips({ selected, onChange }) {
  function toggle(loc) {
    onChange(selected.includes(loc) ? selected.filter((l) => l !== loc) : [...selected, loc]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {DAMAGE_LOCATIONS.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => toggle(loc)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold font-heading border transition-colors ${
            selected.includes(loc)
              ? "bg-red-700 text-white border-red-600"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
          }`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}

// ── Default checklist state ───────────────────────────────────────────────────

export const DEFAULT_CHECKLIST = {
  tyres:     { front_left: null, front_right: null, rear_left: null, rear_right: null, spare: false },
  lights:    { headlights: null, tail_lights: null, indicators: null, brake_lights: null, hazards: null },
  insurance: { valid: false, policy_number: "", expiry_date: "" },
  tracker:   { physically_present: false, wiring_intact: false, signal_observed: false },
  damage:    { has_damage: false, description: "", locations: [] },
};

// ── Touched detection ─────────────────────────────────────────────────────────

export function isSectionTouched(section, data) {
  if (section === "tyres") {
    return Object.values(data.tyres).some((v) => v !== null && v !== false);
  }
  if (section === "lights") {
    return Object.values(data.lights).some((v) => v !== null);
  }
  if (section === "insurance") {
    return data.insurance.valid || data.insurance.policy_number || data.insurance.expiry_date;
  }
  if (section === "tracker") {
    return Object.values(data.tracker).some(Boolean);
  }
  if (section === "damage") {
    return data.damage.has_damage || data.damage.locations.length > 0 || data.damage.description;
  }
  return false;
}

export function isChecklistComplete(checklist) {
  return ["tyres", "lights", "insurance", "tracker", "damage"].every((s) =>
    isSectionTouched(s, checklist)
  );
}

// ── Summary helpers for review step ──────────────────────────────────────────

export function checklistIssues(checklist) {
  const issues = [];
  const { tyres, lights, damage } = checklist;
  ["front_left", "front_right", "rear_left", "rear_right"].forEach((w) => {
    if (tyres[w] === "damaged") issues.push(`Tyre ${w.replace("_", " ")}: Damaged`);
    if (tyres[w] === "worn") issues.push(`Tyre ${w.replace("_", " ")}: Worn`);
  });
  Object.entries(lights).forEach(([k, v]) => {
    if (v === false) issues.push(`${k.replace("_", " ")}: Failed`);
  });
  if (damage.has_damage) issues.push(`Body damage: ${damage.locations.join(", ") || "unspecified"}`);
  if (!checklist.insurance.valid) issues.push("Insurance: marked invalid");
  return issues;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChecklistSection({ checklist, onChange }) {
  const set = (section) => (field, value) => {
    onChange({ ...checklist, [section]: { ...checklist[section], [field]: value } });
  };

  const tyresT  = isSectionTouched("tyres", checklist);
  const lightsT  = isSectionTouched("lights", checklist);
  const insuranceT = isSectionTouched("insurance", checklist);
  const trackerT = isSectionTouched("tracker", checklist);
  const damageT  = isSectionTouched("damage", checklist);

  return (
    <div className="space-y-3">

      {/* Tyres */}
      <Accordion title="Tyres" touched={tyresT}>
        <TyreToggle label="Front Left"  value={checklist.tyres.front_left}  onChange={(v) => set("tyres")("front_left", v)} />
        <TyreToggle label="Front Right" value={checklist.tyres.front_right} onChange={(v) => set("tyres")("front_right", v)} />
        <TyreToggle label="Rear Left"   value={checklist.tyres.rear_left}   onChange={(v) => set("tyres")("rear_left", v)} />
        <TyreToggle label="Rear Right"  value={checklist.tyres.rear_right}  onChange={(v) => set("tyres")("rear_right", v)} />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.tyres.spare}
            onChange={(e) => set("tyres")("spare", e.target.checked)}
            className="accent-amber-500"
          />
          <span className="text-xs text-slate-300">Spare tyre present and in good condition</span>
        </label>
      </Accordion>

      {/* Lights */}
      <Accordion title="Lights" touched={lightsT}>
        <PassFail label="Headlights"   value={checklist.lights.headlights}   onChange={(v) => set("lights")("headlights", v)} />
        <PassFail label="Tail Lights"  value={checklist.lights.tail_lights}  onChange={(v) => set("lights")("tail_lights", v)} />
        <PassFail label="Indicators"   value={checklist.lights.indicators}   onChange={(v) => set("lights")("indicators", v)} />
        <PassFail label="Brake Lights" value={checklist.lights.brake_lights} onChange={(v) => set("lights")("brake_lights", v)} />
        <PassFail label="Hazards"      value={checklist.lights.hazards}      onChange={(v) => set("lights")("hazards", v)} />
      </Accordion>

      {/* Insurance */}
      <Accordion title="Insurance" touched={insuranceT}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.insurance.valid}
            onChange={(e) => set("insurance")("valid", e.target.checked)}
            className="accent-green-500"
          />
          <span className="text-xs text-slate-300">Insurance is currently valid</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Policy Number</label>
            <input
              type="text"
              value={checklist.insurance.policy_number}
              onChange={(e) => set("insurance")("policy_number", e.target.value)}
              placeholder="POL-123456"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Expiry Date</label>
            <input
              type="date"
              value={checklist.insurance.expiry_date}
              onChange={(e) => set("insurance")("expiry_date", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </Accordion>

      {/* Tracker */}
      <Accordion title="Tracker / GPS" touched={trackerT}>
        {[
          ["physically_present", "Device physically present on vehicle"],
          ["wiring_intact",       "Wiring and connectors intact"],
          ["signal_observed",     "Signal/LED activity observed"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.tracker[key]}
              onChange={(e) => set("tracker")(key, e.target.checked)}
              className="accent-violet-500"
            />
            <span className="text-xs text-slate-300">{label}</span>
          </label>
        ))}
      </Accordion>

      {/* Damage */}
      <Accordion title="Body & Damage" touched={damageT}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange({ ...checklist, damage: { ...checklist.damage, has_damage: false } })}
            className={`flex-1 py-2 rounded-lg text-xs font-bold font-heading border transition-colors ${
              !checklist.damage.has_damage ? "bg-green-700 text-white border-green-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
            }`}
          >
            No Damage
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...checklist, damage: { ...checklist.damage, has_damage: true } })}
            className={`flex-1 py-2 rounded-lg text-xs font-bold font-heading border transition-colors ${
              checklist.damage.has_damage ? "bg-red-700 text-white border-red-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
            }`}
          >
            Damage Found
          </button>
        </div>

        {checklist.damage.has_damage && (
          <>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-2">Damage Locations</label>
              <DamageChips
                selected={checklist.damage.locations}
                onChange={(locs) => set("damage")("locations", locs)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Description</label>
              <textarea
                value={checklist.damage.description}
                onChange={(e) => set("damage")("description", e.target.value)}
                placeholder="Describe the damage observed…"
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </>
        )}
      </Accordion>

    </div>
  );
}
