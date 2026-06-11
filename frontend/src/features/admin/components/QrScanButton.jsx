import { useEffect, useRef, useState } from "react";
import { X, ScanLine, Keyboard } from "lucide-react";

export default function QrScanButton({ onResult, label = "Scan Truck", autoStart = false }) {
  const [mode, setMode] = useState("idle"); // idle | scanning | fallback
  const [textVal, setTextVal] = useState("");
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  function stopCamera() {
    clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (autoStart) startScan(); }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startScan() {
    setError(null);
    if (!("BarcodeDetector" in window)) {
      setMode("fallback");
      return;
    }
    setMode("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "code_128", "code_39", "ean_13"],
      });

      intervalRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            stopCamera();
            setMode("idle");
            onResult(codes[0].rawValue);
          }
        } catch {
          // detector not ready yet, keep polling
        }
      }, 300);
    } catch (err) {
      stopCamera();
      setMode("fallback");
      setError("Camera unavailable. Enter registration manually.");
    }
  }

  function cancel() {
    stopCamera();
    setMode("idle");
    setTextVal("");
    setError(null);
  }

  function submitText() {
    const v = textVal.trim();
    if (!v) return;
    setMode("idle");
    setTextVal("");
    onResult(v);
  }

  if (mode === "idle") {
    return (
      <button
        onClick={startScan}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-heading font-semibold transition-colors"
      >
        <ScanLine className="w-4 h-4" />
        {label}
      </button>
    );
  }

  if (mode === "scanning") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between p-4">
          <p className="text-white font-heading font-semibold text-sm">Point camera at truck QR or barcode</p>
          <button onClick={cancel} className="text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-amber-400 rounded-2xl" />
          </div>
        </div>
        <div className="p-4 flex justify-center">
          <button
            onClick={() => { stopCamera(); setMode("fallback"); }}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white font-heading"
          >
            <Keyboard className="w-4 h-4" />
            Enter manually instead
          </button>
        </div>
      </div>
    );
  }

  // fallback — text input
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-white text-sm uppercase tracking-widest">Find Truck</h2>
          <button onClick={cancel} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-amber-400">{error}</p>}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">
            Registration Number or Tracker ID
          </label>
          <input
            autoFocus
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitText()}
            placeholder="e.g. KCA 001A"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={cancel} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-heading font-semibold hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={submitText}
            disabled={!textVal.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-heading font-semibold transition-colors"
          >
            Find Truck
          </button>
        </div>
      </div>
    </div>
  );
}
