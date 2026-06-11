/**
 * PlaybackTimeline — scrub through a shipment's GPS trail
 *
 * Props:
 *   shipmentId  (string)  — UUID of the shipment to replay
 *   onPoint     (fn)      — called with { lat, lng, speed_kmh, recorded_at } when scrubbing/playing
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, SkipBack } from "lucide-react";
import apiClient from "@/services/apiClient";

const SPEEDS = [1, 2, 4];

export default function PlaybackTimeline({ shipmentId, onPoint }) {
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex]     = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed]     = useState(1);
  const timerRef              = useRef(null);

  const { data: trailData, isLoading } = useQuery({
    queryKey: ["playback-trail", shipmentId],
    queryFn: () =>
      apiClient.get(`/tracking/${shipmentId}/trail`, { params: { limit: 1000 } }).then((r) => r.data),
    enabled: Boolean(shipmentId) && enabled,
    staleTime: 60000,
  });

  const points = trailData?.points ?? [];

  // Notify parent when index changes
  useEffect(() => {
    if (points.length && onPoint) {
      const p = points[index];
      onPoint({ lat: p.lat ?? p.latitude, lng: p.lng ?? p.longitude, speed_kmh: p.speed_kmh, recorded_at: p.recorded_at });
    }
  }, [index, points]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback timer
  useEffect(() => {
    if (!playing || points.length === 0) return;
    const interval = Math.max(200, 1000 / speed);
    timerRef.current = setInterval(() => {
      setIndex((prev) => {
        if (prev >= points.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [playing, speed, points.length]);

  if (!enabled) {
    return (
      <div className="card p-4 mt-4">
        <button
          onClick={() => setEnabled(true)}
          className="text-sm text-secondary font-medium hover:underline flex items-center gap-2"
        >
          <Play className="w-4 h-4" /> Replay GPS Trail
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card p-4 mt-4 text-sm text-slate-500 animate-pulse">Loading trail data…</div>
    );
  }

  if (!points.length) {
    return (
      <div className="card p-4 mt-4 text-sm text-slate-500">No GPS data recorded for this shipment.</div>
    );
  }

  const current = points[index];

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-slate-800">GPS Trail Playback</h3>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 text-xs rounded font-mono ${
                speed === s
                  ? "bg-secondary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={points.length - 1}
        value={index}
        onChange={(e) => {
          setPlaying(false);
          setIndex(Number(e.target.value));
        }}
        className="w-full h-2 appearance-none rounded-full bg-slate-200 accent-secondary cursor-pointer"
      />

      {/* Timestamp + speed info */}
      <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
        <span>
          {current?.recorded_at
            ? new Date(current.recorded_at).toLocaleString()
            : "—"}
        </span>
        <span className="font-mono">
          {current?.speed_kmh != null ? `${Math.round(current.speed_kmh)} km/h` : "—"}
        </span>
        <span>
          {index + 1} / {points.length}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => { setPlaying(false); setIndex(0); }}
          className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          title="Reset to start"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-white text-sm font-medium"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}
