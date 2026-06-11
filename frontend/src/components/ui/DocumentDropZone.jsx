import { useRef, useState } from "react";
import { FileText, Upload, X, CheckCircle2, ExternalLink } from "lucide-react";
import apiClient from "@/services/apiClient";

const DEFAULT_ACCEPT = "application/pdf,image/jpeg,image/png";
const DEFAULT_HINT = "PDF, JPG, or PNG · max 5 MB";
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function fileIcon(type) {
  if (type === "application/pdf") return "PDF";
  if (type?.startsWith("image/")) return "IMG";
  return "DOC";
}

export default function DocumentDropZone({
  onUpload,
  currentUrl = null,
  label,
  hint = DEFAULT_HINT,
  accept = DEFAULT_ACCEPT,
  allowedTypes = ALLOWED_TYPES,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [error, setError] = useState(null);

  const process = async (file) => {
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError(`Unsupported file type. Accepted: ${[...allowedTypes].map(t => t.split("/")[1].toUpperCase()).join(", ")}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB."); return; }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/uploads/document", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploaded({ name: file.name, type: file.type, url: data.url });
      onUpload(data.url);
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    process(e.dataTransfer.files[0]);
  };

  const clear = (e) => {
    e.stopPropagation();
    setUploaded(null);
    onUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasFile = uploaded || currentUrl;

  return (
    <div className="space-y-1.5">
      {label && <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{label}</p>}

      {hasFile ? (
        <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
          <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest">
              {uploaded ? fileIcon(uploaded.type) : "DOC"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
              {uploaded?.name || "Document on file"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Uploaded</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={uploaded?.url || currentUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-secondary hover:bg-orange-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={clear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none ${
            dragging ? "border-secondary bg-orange-50 scale-[1.01]" : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-secondary hover:bg-orange-50/30 dark:hover:bg-slate-600"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-4 text-center">
              {dragging
                ? <FileText className="w-7 h-7 text-secondary" />
                : <Upload className="w-7 h-7 text-slate-400" />}
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {dragging ? "Drop to upload" : "Drag & drop, or click to browse"}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => process(e.target.files[0])} />
    </div>
  );
}
