import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Upload, X } from "lucide-react";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { mediaUrl } from "@/utils/mediaUrl";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export default function ProfilePhotoPicker({ user, initials = "U", size = "md", onUpdated }) {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const { updateUser } = useAuthStore();
  const storePhotoUrl = useAuthStore((state) => state.user?.profile_photo_url);

  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");

  const avatarSize = size === "lg" ? "w-16 h-16" : "w-14 h-14";
  const iconSize = size === "lg" ? "w-6 h-6" : "w-5 h-5";
  const cameraIconSize = size === "lg" ? "w-3 h-3" : "w-2.5 h-2.5";

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const validate = (file) => {
    if (!file) return "Select a profile photo.";
    if (!ALLOWED_TYPES.has(file.type)) return "Use a JPG, PNG, or WebP image.";
    if (file.size > MAX_BYTES) return "Profile photo must be under 5 MB.";
    return "";
  };

  const uploadFile = async (file) => {
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/uploads/photo", form, {
        headers: { "Content-Type": undefined },
      });
      await apiClient.patch("/users/me", { profile_photo_url: data.url });
      updateUser({ profile_photo_url: data.url });
      onUpdated?.({ profile_photo_url: data.url });
      setOpen(false);
      setCameraOpen(false);
      stopCamera();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update profile photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const startCamera = async () => {
    setError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const setReady = () => setCameraReady(true);
        videoRef.current.onloadedmetadata = setReady;
        videoRef.current.oncanplay = setReady;
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(err?.name === "NotAllowedError"
        ? "Camera permission denied. Allow camera access and try again."
        : "Camera is unavailable on this device.");
      setCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not capture photo. Try again.");
        return;
      }
      uploadFile(new File([blob], "profile-photo.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    uploadFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative ${avatarSize} rounded-full overflow-hidden border-2 border-slate-700 bg-slate-900 flex items-center justify-center group`}
        aria-label="Change profile photo"
      >
        {storePhotoUrl ? (
          <img src={mediaUrl(storePhotoUrl)} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className={`${size === "lg" ? "text-xl" : "text-lg"} font-black text-white font-heading`}>{initials}</span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Camera className="w-5 h-5 text-white" />}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute bottom-0 right-0 ${iconSize} bg-secondary rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:opacity-90 transition-opacity`}
        aria-label="Change profile photo"
      >
        <Camera className={`${cameraIconSize} text-white`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-heading font-bold text-slate-900 dark:text-white">Profile Photo</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">JPG, PNG, or WebP · max 5 MB</p>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); closeCamera(); }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cameraOpen ? (
              <div className="p-5">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-7 h-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!cameraReady || uploading}
                    className="flex-1 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Use Photo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && inputRef.current?.click()}
                  className={`h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4 cursor-pointer transition-all ${
                    dragging ? "border-secondary bg-orange-50" : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-secondary hover:bg-orange-50/30 dark:hover:bg-slate-600"
                  }`}
                >
                  {uploading ? (
                    <>
                      <span className="w-7 h-7 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-3">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className={`w-7 h-7 ${dragging ? "text-secondary" : "text-slate-400"}`} />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                        {dragging ? "Drop photo here" : "Drag and drop or browse"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Choose a clear square-ish profile photo</p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4" /> Browse
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" /> Take Photo
                  </button>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(event) => uploadFile(event.target.files[0])}
                />
              </div>
            )}

            {error && (
              <div className="px-5 pb-5">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
