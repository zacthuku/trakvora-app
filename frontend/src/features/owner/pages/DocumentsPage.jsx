import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, CheckCircle2, XCircle,
  Truck, Shield, Clipboard, Award, ChevronDown, ChevronUp,
  Calendar, Search, AlertTriangle,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import DocumentDropZone from "@/components/ui/DocumentDropZone";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const getDocTypes = (ta) => [
  {
    id: "registration",
    label: "Vehicle Registration",
    icon: FileText,
    description: `${ta} certificate of registration (logbook)`,
    required: true,
  },
  {
    id: "insurance",
    label: "Insurance Certificate",
    icon: Shield,
    description: "Comprehensive motor insurance: third party or comprehensive",
    required: true,
  },
  {
    id: "inspection",
    label: "Inspection Certificate",
    icon: Clipboard,
    description: `Annual ${ta} roadworthiness inspection sticker`,
    required: true,
  },
  {
    id: "goods_transit",
    label: "Goods in Transit Licence",
    icon: Truck,
    description: `${ta} goods in transit permit for commercial haulage`,
    required: true,
  },
  {
    id: "operating_permit",
    label: "PSV / Operating Permit",
    icon: Award,
    description: "County or national operating licence for commercial vehicles",
    required: false,
  },
];

const MONTHS_UNTIL = (dateStr) => {
  if (!dateStr) return null;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24 * 30);
  return Math.round(diff);
};

function DocStatus({ months }) {
  if (months === null) return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      <XCircle className="w-3.5 h-3.5" /> Not Uploaded
    </span>
  );
  if (months < 0) return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
      <XCircle className="w-3.5 h-3.5" /> Expired
    </span>
  );
  if (months < 2) return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
      <AlertTriangle className="w-3.5 h-3.5" /> Expiring Soon
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
      <CheckCircle2 className="w-3.5 h-3.5" /> Valid
    </span>
  );
}

function DocRow({ doc }) {
  const Icon = doc.icon;
  const { locale } = useCountryConfig();
  const [expiry, setExpiry] = useState("");
  const [docUrl, setDocUrl] = useState(null);
  const [open, setOpen] = useState(false);
  const months = docUrl ? (expiry ? MONTHS_UNTIL(expiry) : 0) : null;

  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            docUrl ? "bg-teal-50 text-teal-600" : "bg-slate-100 text-slate-400"
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{doc.label}</p>
              {doc.required && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-red-50 text-red-500 rounded border border-red-100">Required</span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:block">{doc.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4 shrink-0">
          {expiry && docUrl && (
            <div className="hidden md:block text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Expiry</p>
              <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">
                {new Date(expiry).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
          <DocStatus months={months} />
          <button
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            {docUrl ? "Replace" : "Upload"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <DocumentDropZone
                currentUrl={docUrl}
                onUpload={(url) => { setDocUrl(url); if (url) setOpen(false); }}
                hint="PDF, JPG, or PNG · max 5 MB"
              />
            </div>
            <div className="sm:w-52 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Document Expiry Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TruckDocSection({ truck }) {
  const { transportAuthority } = useCountryConfig();
  const docTypes = getDocTypes(transportAuthority);
  const [open, setOpen] = useState(false);
  const uploadedCount = 0;
  const total = docTypes.length;
  const pct = Math.round((uploadedCount / total) * 100);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-mono font-bold text-slate-900 dark:text-white">{truck.registration_number}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
              {truck.truck_type.replace("_", " ")}
              {truck.make ? ` · ${truck.make}` : ""}
              {truck.model ? ` ${truck.model}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 ml-4">
          {/* Compliance bar */}
          <div className="hidden md:block w-40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Compliance</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-[#4fdbcc]" : pct > 60 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            truck.is_active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
          }`}>
            {truck.is_active ? "Active" : "Idle"}
          </span>

          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Document list */}
      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4 space-y-2.5 bg-white dark:bg-slate-800">
          {docTypes.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const { transportAuthority } = useCountryConfig();
  const docTypes = getDocTypes(transportAuthority);
  const [search, setSearch] = useState("");

  const { data: trucks = [], isLoading } = useQuery({
    queryKey: ["owner-trucks"],
    queryFn: () => apiClient.get("/trucks").then((r) => r.data),
  });

  const filtered = trucks.filter((t) =>
    !search ||
    t.registration_number.toLowerCase().includes(search.toLowerCase()) ||
    (t.make || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalRequired = trucks.length * docTypes.filter((d) => d.required).length;

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Fleet Documents</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track compliance certificates, insurance and permits for every unit.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          {
            label: "Total Trucks",
            value: trucks.length,
            color: "text-slate-900",
            sub: "in registry",
          },
          {
            label: "Fully Compliant",
            value: 0,
            color: "text-[#4fdbcc]",
            sub: "all docs valid",
          },
          {
            label: "Expiring Soon",
            value: 0,
            color: "text-amber-600",
            sub: "within 60 days",
          },
          {
            label: "Docs Required",
            value: totalRequired,
            color: "text-secondary",
            sub: `${docTypes.filter((d) => d.required).length} per truck`,
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-5 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by plate or make…"
          className="flex-1 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Per-truck document accordions */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center shadow-sm">
          <FileText className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            {trucks.length === 0 ? "No trucks in your fleet yet." : "No trucks match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((truck) => (
            <TruckDocSection key={truck.id} truck={truck} />
          ))}
        </div>
      )}
    </div>
  );
}
