import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Wraps any Leaflet map container with a fullscreen toggle button.
 *
 * Props:
 *   defaultHeight  — CSS height string when not fullscreen (e.g. "260px", "100%").
 *                    Omit for flex-1 / fill-parent maps that already have controlled height.
 *   className      — extra classes on the wrapper div (e.g. "rounded-xl overflow-hidden ...").
 *   dark           — use a dark-themed button (for dark-background dashboards).
 */
export default function FullscreenMapWrapper({ children, defaultHeight, className = "", dark = false }) {
  const ref = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => {
      const full = document.fullscreenElement === ref.current;
      setIsFullscreen(full);
      // Give the browser's fullscreen transition ~150ms, then tell Leaflet to resize.
      setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const heightStyle = defaultHeight
    ? { height: isFullscreen ? "100dvh" : defaultHeight }
    : {};

  const btnBase =
    "absolute top-3 right-3 z-[1000] rounded-lg shadow-md border p-1.5 transition-colors flex items-center justify-center";
  const btnStyle = dark
    ? `${btnBase} bg-slate-800/90 backdrop-blur-sm border-slate-700 hover:bg-slate-700 text-slate-300`
    : `${btnBase} bg-white/90 backdrop-blur-sm border-slate-200 hover:bg-white text-slate-700`;

  return (
    <div ref={ref} className={`relative ${className}`} style={heightStyle}>
      {children}
      <button
        onClick={toggle}
        className={btnStyle}
        title={isFullscreen ? "Exit fullscreen (Esc)" : "View fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen
          ? <Minimize2 className="w-4 h-4" />
          : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
