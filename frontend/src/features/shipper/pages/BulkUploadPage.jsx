/**
 * BulkUploadPage — CSV bulk load posting for business customers.
 * Route: /shipper/bulk-upload
 */
import { useRef, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, Download } from "lucide-react";
import apiClient from "@/services/apiClient";
import { toast } from "@/components/ui/Toast";

const TEMPLATE_HEADERS = [
  "pickup_location", "pickup_lat", "pickup_long",
  "dropoff_location", "dropoff_lat", "dropoff_long",
  "cargo_type", "weight_tonnes", "price_kes",
  "pickup_date", "delivery_date", "notes",
];

const EXAMPLE_ROWS = [
  ["Westlands, Nairobi", "-1.265", "36.804", "Mombasa Port", "-4.043", "39.668", "general", "10", "25000", "2026-06-01", "2026-06-03", "Handle with care"],
  ["Kisumu CBD", "-0.102", "34.762", "Eldoret, Kenya", "0.520", "35.269", "machinery", "5", "12000", "2026-06-05", "2026-06-06", ""],
];

function downloadTemplate() {
  const lines = [TEMPLATE_HEADERS.join(",")];
  EXAMPLE_ROWS.forEach((r) => lines.push(r.join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trakvora_bulk_upload_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUploadPage() {
  const fileInputRef = useRef(null);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState([]);    // first 10 rows parsed
  const [headers, setHeaders]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);  // {created, failed}

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      toast("Please upload a CSV file", "error");
      return;
    }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split("\n").filter(Boolean);
      const [headerLine, ...dataLines] = lines;
      setHeaders(headerLine.split(",").map(h => h.trim()));
      setPreview(dataLines.slice(0, 10).map(l => l.split(",").map(v => v.trim())));
    };
    reader.readAsText(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await apiClient.post("/loads/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(resp.data);
      if (resp.data.created > 0) {
        toast(`${resp.data.created} load(s) posted successfully`, "success");
      }
      if (resp.data.failed?.length > 0) {
        toast(`${resp.data.failed.length} row(s) failed — see details below`, "error");
      }
    } catch (err) {
      toast(err.response?.data?.detail || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Bulk Load Upload</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Post multiple loads at once using a CSV file.</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>
      </div>

      {/* Required columns info */}
      <div className="card p-4 mb-6 bg-blue-50 border-blue-100">
        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Required CSV Columns</h3>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_HEADERS.map((h) => (
            <span key={h} className="font-mono text-xs bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded">
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="card p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-secondary cursor-pointer transition-colors"
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <div className="text-slate-600 dark:text-slate-300 font-medium">Click to upload CSV file</div>
          <div className="text-xs text-slate-400 mt-1">or drag and drop</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <>
          <div className="card p-4 mb-4 flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-secondary" />
              <div>
                <div className="font-medium text-sm text-slate-800 dark:text-slate-100">{file.name}</div>
                <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · {preview.length} rows previewed</div>
              </div>
            </div>
            <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700">
                    <th className="px-2 py-1.5 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">#</th>
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700 font-mono">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-1.5 text-slate-400">{idx + 2}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{cell || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length === 10 && (
                <div className="text-xs text-slate-400 mt-1 text-center">Showing first 10 rows</div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 rounded-lg bg-secondary text-white font-medium text-sm disabled:opacity-60"
          >
            {uploading ? "Uploading…" : `Post ${preview.length}+ loads`}
          </button>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-teal-50 border border-teal-200 mb-4">
            <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
            <div className="text-sm text-teal-800">
              <span className="font-semibold">{result.created} load(s)</span> posted successfully.
            </div>
          </div>

          {result.failed?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-red-700 mb-2">
                <AlertCircle className="w-4 h-4" />
                {result.failed.length} row(s) failed
              </div>
              <div className="card divide-y divide-slate-100 dark:divide-slate-700">
                {result.failed.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">Row {f.row}</span>
                    <span className="text-red-600">{f.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
