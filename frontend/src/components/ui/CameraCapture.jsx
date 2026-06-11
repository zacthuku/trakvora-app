import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Video, X, Check, RotateCcw, StopCircle, Circle } from "lucide-react";

const MAX_PHOTOS = 3;
const MIN_PHOTOS = 2;
const MAX_VIDEO_SECONDS = 60;

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const recorderRef = useRef(null);
  const timerRef   = useRef(null);

  const [mode, setMode]           = useState("photo");   // "photo" | "video"
  const [photos, setPhotos]       = useState([]);        // { blob, url }[]
  const [videoBlob, setVideoBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed]     = useState(0);         // seconds recorded
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady]         = useState(false);

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      const constraints = {
        video: { facingMode: { exact: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        attach(stream);
      } catch {
        // Fallback: drop the 'exact' constraint
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          attach(stream);
        } catch (err) {
          if (!cancelled) setCameraError(err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access and try again."
            : "No camera found on this device.");
        }
      }
    }

    function attach(stream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
      clearInterval(timerRef.current);
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  // ── Photo capture ──────────────────────────────────────────────────────────

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || photos.length >= MAX_PHOTOS) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPhotos(prev => [...prev, { blob, url }]);
    }, "image/jpeg", 0.85);
  }

  function removePhoto(idx) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // ── Video recording ────────────────────────────────────────────────────────

  function startRecording() {
    if (!streamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      setVideoBlob(blob);
      setRecording(false);
      clearInterval(timerRef.current);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
    setElapsed(0);
    setVideoBlob(null);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= MAX_VIDEO_SECONDS) {
          stopRecording();
          return MAX_VIDEO_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  function handleUse() {
    stopStream();
    if (mode === "video" && videoBlob) {
      onCapture([videoBlob], "video");
    } else {
      onCapture(photos.map(p => p.blob), "photo");
    }
  }

  function handleCancel() {
    if (recording) stopRecording();
    stopStream();
    onClose();
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const remaining      = MAX_VIDEO_SECONDS - elapsed;
  const progressPct    = (elapsed / MAX_VIDEO_SECONDS) * 100;
  const isLowTime      = remaining <= 10 && recording;
  const canUsePhotos   = mode === "photo" && photos.length >= MIN_PHOTOS;
  const canUseVideo    = mode === "video" && videoBlob !== null;
  const canConfirm     = canUsePhotos || canUseVideo;
  const canCapture     = mode === "photo" && photos.length < MAX_PHOTOS && ready;
  const noCaptures     = photos.length === 0 && !videoBlob;

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cameraError) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center">
        <Camera className="w-12 h-12 text-slate-500 mb-4" />
        <p className="text-white font-semibold mb-2">Camera Unavailable</p>
        <p className="text-slate-400 text-sm mb-6">{cameraError}</p>
        <button onClick={handleCancel} className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-semibold text-sm hover:opacity-90">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">

      {/* Recording progress bar */}
      {recording && (
        <div className="absolute top-0 left-0 right-0 h-1 z-10">
          <div
            className={`h-full transition-all duration-1000 ${isLowTime ? "bg-red-500" : "bg-[#4fdbcc]"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-5 pb-2">
        <button
          onClick={handleCancel}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Mode toggle — only visible before any capture */}
        {noCaptures && !recording && (
          <div className="flex items-center bg-black/50 rounded-full p-1 gap-1">
            <button
              onClick={() => setMode("photo")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === "photo" ? "bg-white text-slate-900" : "text-white"
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Photo
            </button>
            <button
              onClick={() => setMode("video")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === "video" ? "bg-white text-slate-900" : "text-white"
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
          </div>
        )}

        {/* Recording timer */}
        {recording && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-sm font-mono font-bold ${isLowTime ? "text-red-400" : "text-white"}`}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {fmtTime(elapsed)} / {fmtTime(MAX_VIDEO_SECONDS)}
          </div>
        )}

        {/* Video done label */}
        {mode === "video" && videoBlob && !recording && (
          <span className="px-3 py-1.5 rounded-full bg-[#4fdbcc]/20 text-[#4fdbcc] text-xs font-semibold border border-[#4fdbcc]/30">
            Video ready
          </span>
        )}

        <div className="w-10" /> {/* spacer when timer/toggle not shown */}
      </div>

      {/* Live camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading overlay */}
      {!ready && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center pb-8 pt-4 gap-4">

        {/* Thumbnail strip (photo mode) */}
        {mode === "photo" && photos.length > 0 && (
          <div className="flex items-center gap-2 px-4">
            {Array.from({ length: MAX_PHOTOS }).map((_, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white/20 bg-white/10">
                {photos[idx] ? (
                  <>
                    <img src={photos[idx].url} alt={`photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/30 text-lg font-bold">{idx + 1}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* "Use" confirmation button */}
        {canConfirm && (
          <button
            onClick={handleUse}
            className="flex items-center gap-2 px-6 py-3 bg-[#4fdbcc] text-white rounded-full font-semibold text-sm shadow-lg active:opacity-80"
          >
            <Check className="w-4 h-4" />
            {mode === "video" ? "Use Video" : `Use ${photos.length} Photo${photos.length !== 1 ? "s" : ""}`}
          </button>
        )}

        {/* Photo hint */}
        {mode === "photo" && photos.length < MIN_PHOTOS && photos.length > 0 && (
          <p className="text-white/60 text-xs">
            Take {MIN_PHOTOS - photos.length} more photo{MIN_PHOTOS - photos.length !== 1 ? "s" : ""} to continue
          </p>
        )}

        {/* Capture / Record button */}
        <div className="flex items-center justify-center">
          {mode === "photo" ? (
            <button
              onClick={capturePhoto}
              disabled={!canCapture}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          ) : recording ? (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full border-4 border-red-400 bg-red-500/20 flex items-center justify-center active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 rounded-md bg-red-500" />
            </button>
          ) : (
            <button
              onClick={videoBlob ? () => { setVideoBlob(null); setElapsed(0); } : startRecording}
              disabled={!ready}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            >
              {videoBlob
                ? <RotateCcw className="w-8 h-8 text-white" />
                : <Circle className="w-10 h-10 text-red-500 fill-red-500" />}
            </button>
          )}
        </div>

        {/* Photo counter label */}
        {mode === "photo" && (
          <p className="text-white/70 text-xs font-semibold tracking-wider uppercase">
            {photos.length} / {MAX_PHOTOS}
          </p>
        )}
      </div>
    </div>
  );
}
