import { useRef, useState } from "react";
import { Camera, X, Upload } from "lucide-react";
import apiClient from "@/services/apiClient";

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function PhotoDropZone({ currentUrl, onUpload, label = "Photo", hint = "JPG, PNG, or WebP · max 5 MB" }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const process = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file (JPG, PNG, or WebP)."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB."); return; }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/uploads/photo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUpload(data.url);
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed. Please try again.");
      setPreview(currentUrl || null);
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
    setPreview(null);
    onUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{label}</p>}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all select-none overflow-hidden ${
          dragging ? "border-secondary bg-orange-50 scale-[1.01]" : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-secondary hover:bg-orange-50/30 dark:hover:bg-slate-600"
        } ${preview ? "h-40" : "h-32"}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
              <span className="ml-2 text-white text-sm font-semibold">Change photo</span>
            </div>
            <button
              type="button"
              onClick={clear}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
            <Upload className={`w-7 h-7 ${dragging ? "text-secondary" : "text-slate-400"}`} />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {dragging ? "Drop to upload" : "Drag & drop or click to browse"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => process(e.target.files[0])} />
    </div>
  );
}
