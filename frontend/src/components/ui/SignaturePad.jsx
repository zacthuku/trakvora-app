/**
 * SignaturePad — canvas-based signature capture with touch + mouse support.
 *
 * Props:
 *   onCapture(dataUrl: string) — called with PNG data URL when the user finishes drawing
 *   className                  — extra classes on the wrapper div
 */
import { useEffect, useRef, useState } from "react";
import { Pen, RotateCcw, Check } from "lucide-react";

export default function SignaturePad({ onCapture, className = "" }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const [hasLines, setHasLines] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // ── Canvas setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#041727";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // White background for clean PNG export
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing.current = true;
    setConfirmed(false);
    const pos = getPos(e, canvasRef.current);
    lastPos.current = pos;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasLines(true);
  }

  function stopDraw(e) {
    e.preventDefault();
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasLines(false);
    setConfirmed(false);
  }

  function confirm() {
    if (!hasLines) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setConfirmed(true);
    onCapture?.(dataUrl);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <Pen className="w-4 h-4 text-secondary" />
        Recipient Signature
      </div>

      <div
        className={`rounded-lg border-2 overflow-hidden ${
          confirmed ? "border-teal-400 bg-teal-50" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
        }`}
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full block cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {!confirmed && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Have the recipient sign inside the box using touch or mouse.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear
        </button>

        <button
          type="button"
          onClick={confirm}
          disabled={!hasLines}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            hasLines
              ? "bg-secondary text-white hover:bg-orange-600"
              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          {confirmed ? "Signature saved ✓" : "Confirm Signature"}
        </button>
      </div>
    </div>
  );
}
