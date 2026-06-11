import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Shield, ShieldOff, Edit2,
  ChevronLeft, ChevronRight, X, UserX, RefreshCw, Globe, Camera, ImagePlus,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import apiClient from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { mediaUrl } from "@/utils/mediaUrl";
import { toast } from "@/components/ui/Toast";
import { useCountryConfig } from "@/hooks/useCountryConfig";

const ADMIN_ROLES = [
  { value: "super_admin",        label: "Super Admin",        desc: "Full platform access",                      color: "bg-violet-900/50 text-violet-300 border-violet-700/50" },
  { value: "operations_admin",   label: "Operations Admin",   desc: "Tasks, workforce, trucks, shipments",       color: "bg-blue-900/50 text-blue-300 border-blue-700/50" },
  { value: "field_inspector",    label: "Field Inspector",    desc: "Physical vehicle inspections",              color: "bg-amber-900/50 text-amber-300 border-amber-700/50" },
  { value: "iot_technician",     label: "IoT Technician",     desc: "GPS device installation",                   color: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50" },
  { value: "compliance_officer", label: "Compliance Officer", desc: "Review and approve inspections",            color: "bg-teal-900/50 text-teal-300 border-teal-700/50" },
  { value: "support_agent",      label: "Support Agent",      desc: "Users, drivers, loads, shipments",         color: "bg-slate-700/50 text-slate-300 border-slate-600/50" },
  { value: "finance_admin",      label: "Finance Admin",      desc: "Wallets, transactions, payouts, billing",   color: "bg-green-900/50 text-green-300 border-green-700/50" },
];

function roleMeta(value) {
  return ADMIN_ROLES.find((r) => r.value === value) ?? { label: value, color: "bg-slate-700/50 text-slate-300 border-slate-600" };
}

function RoleBadge({ role }) {
  const meta = roleMeta(role);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-heading font-semibold ${active ? "text-green-400" : "text-red-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-400" : "bg-red-400"}`} />
      {active ? "Active" : "Suspended"}
    </span>
  );
}

// ── Create Admin Modal ────────────────────────────────────────────────────────

function CreateAdminModal({ onClose }) {
  const { dialCode } = useCountryConfig();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", admin_role: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () => adminApi.createAdmin(form),
    onSuccess: (u) => {
      toast(`${u.full_name} added as ${roleMeta(u.admin_role).label} — credentials emailed`, "success");
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      onClose();
    },
    onError: (e) => toast(e?.response?.data?.detail || "Failed to create admin", "error"),
  });

  const valid = form.full_name && form.email && form.phone && form.admin_role;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-heading font-bold text-white text-sm uppercase tracking-widest">Create Admin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { label: "Full Name", key: "full_name", type: "text", placeholder: "Jane Doe" },
            { label: "Email",     key: "email",     type: "email", placeholder: "jane@trakvora.com" },
            { label: "Phone",     key: "phone",     type: "tel",  placeholder: `${dialCode}700000000` },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Role</label>
            <select
              value={form.admin_role}
              onChange={set("admin_role")}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="">Select a role…</option>
              {ADMIN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}: {r.desc}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-2">
              A temporary password will be auto-generated and emailed to this address.
            </p>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-heading font-semibold hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-heading font-semibold transition-colors"
          >
            {create.isPending ? "Creating…" : "Create Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Role Modal ───────────────────────────────────────────────────────────

function EditRoleModal({ admin, onClose }) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(admin.admin_role ?? "");

  const update = useMutation({
    mutationFn: () => adminApi.updateAdminRole(admin.id, selectedRole),
    onSuccess: () => {
      toast(`${admin.full_name}'s role updated`, "success");
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      onClose();
    },
    onError: (e) => toast(e?.response?.data?.detail || "Failed to update role", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-heading font-bold text-white text-sm uppercase tracking-widest">Change Role</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-slate-400 font-heading">Changing role for <span className="text-white font-semibold">{admin.full_name}</span></p>
          <div className="space-y-2">
            {ADMIN_ROLES.map((r) => (
              <label key={r.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedRole === r.value ? "border-violet-500 bg-violet-900/20" : "border-slate-700 hover:border-slate-600"}`}>
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={selectedRole === r.value}
                  onChange={() => setSelectedRole(r.value)}
                  className="mt-0.5 accent-violet-500"
                />
                <div>
                  <p className="text-xs font-semibold text-white font-heading">{r.label}</p>
                  <p className="text-[10px] text-slate-400">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-heading font-semibold hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => update.mutate()}
            disabled={!selectedRole || selectedRole === admin.admin_role || update.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-heading font-semibold transition-colors"
          >
            {update.isPending ? "Saving…" : "Save Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <h2 className="font-heading font-bold text-white text-sm uppercase tracking-widest">{title}</h2>
        <p className="text-sm text-slate-300">{message}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-heading font-semibold hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-heading font-semibold disabled:opacity-50 transition-colors ${danger ? "bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"}`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Silhouette placeholder (no gender field in DB — generic person outline) ───
function PersonSilhouette({ className = "" }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="40" cy="28" r="14" fill="#fe6a34" fillOpacity="0.35" />
      <ellipse cx="40" cy="68" rx="24" ry="16" fill="#fe6a34" fillOpacity="0.25" />
    </svg>
  );
}

// ── Team Visibility Modal ─────────────────────────────────────────────────────

function TeamVisibilityModal({ admin, onClose }) {
  const qc       = useQueryClient();
  const fileRef  = useRef(null);

  const [jobTitle,    setJobTitle]    = useState(admin.job_title   ?? "");
  const [bio,         setBio]         = useState(admin.bio         ?? "");
  const [adminRole,   setAdminRole]   = useState(admin.admin_role  ?? "");
  // Default to true — the intent of opening this modal is to set up a public profile
  const [showOnPage,  setShowOnPage]  = useState(true);
  const showOnPageRef = useRef(showOnPage);

  // Photo state
  const [photoUrl,    setPhotoUrl]    = useState(admin.profile_photo_url ?? null);
  const [stagedFile,  setStagedFile]  = useState(null);   // File object awaiting save
  const [previewSrc,  setPreviewSrc]  = useState(null);   // local object URL for preview
  const [photoMode,   setPhotoMode]   = useState("keep"); // "keep" | "replace"
  const [uploading,   setUploading]   = useState(false);
  const [photoError,  setPhotoError]  = useState("");

  function stageFile(file) {
    if (!file) return;
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!ALLOWED.has(file.type)) { setPhotoError("Use a JPG, PNG, or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Photo must be under 5 MB."); return; }
    setPhotoError("");
    setStagedFile(file);
    setPreviewSrc(URL.createObjectURL(file));
  }

  function cancelReplace() {
    setStagedFile(null);
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
    setPhotoError("");
    setPhotoMode("keep");
  }

  // Keep ref in sync so the PATCH always reads the current toggle value
  // eslint-disable-next-line react-hooks/refs
  showOnPageRef.current = showOnPage;

  async function uploadIfNeeded() {
    if (!stagedFile) return photoUrl;
    const form = new FormData();
    form.append("file", stagedFile);
    const { data } = await apiClient.post("/uploads/photo", form, {
      headers: { "Content-Type": undefined },
    });
    return data.url;
  }

  const save = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let resolvedPhotoUrl;
      try {
        resolvedPhotoUrl = await uploadIfNeeded();
      } finally {
        setUploading(false);
      }
      return apiClient.patch(`/admin/admins/${admin.id}/team-visibility`, {
        show_on_team_page: showOnPageRef.current,
        job_title:         jobTitle.trim() || null,
        bio:               bio.trim()      || null,
        admin_role:        adminRole,
        profile_photo_url: resolvedPhotoUrl,
      });
    },
    onSuccess: () => {
      toast("Team profile saved", "success");
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      onClose();
    },
    onError: () => toast("Failed to save", "error"),
  });

  const isBusy  = save.isPending || uploading;
  const canSave = !!adminRole && !isBusy;

  // Decide what to render for the photo section
  const hasExistingPhoto = !!photoUrl && !stagedFile;
  const showReplaceArea  = !photoUrl || photoMode === "replace";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="font-heading font-bold text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-400" /> Edit Team Profile
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-xs text-slate-400">
            Public profile for <span className="text-white font-semibold">{admin.full_name}</span> on the <code className="text-violet-400">/company</code> team section.
          </p>

          {/* ── Photo section ── */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-2">
              Profile Photo
            </label>

            {hasExistingPhoto && photoMode === "keep" ? (
              /* Has existing photo — show it with replace option */
              <div className="flex items-center gap-4">
                <img
                  src={mediaUrl(photoUrl)}
                  alt={admin.full_name}
                  className="w-20 h-20 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
                />
                <div>
                  <p className="text-xs text-slate-400 mb-2">Current photo</p>
                  <button
                    type="button"
                    onClick={() => setPhotoMode("replace")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-xs font-heading font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Camera className="w-3 h-3" /> Replace Photo
                  </button>
                </div>
              </div>
            ) : (
              /* No photo OR replacing — show upload area */
              <div className="space-y-3">
                {/* Preview / silhouette */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-[#fe6a34]/10 ring-1 ring-[#fe6a34]/25 flex items-center justify-center overflow-hidden shrink-0">
                    {previewSrc ? (
                      <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <PersonSilhouette className="w-14 h-14" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 mb-2">
                      {stagedFile ? stagedFile.name : "No photo uploaded"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fe6a34]/15 border border-[#fe6a34]/30 text-[#fe6a34] text-xs font-heading font-semibold hover:bg-[#fe6a34]/25 transition-colors disabled:opacity-50"
                      >
                        <ImagePlus className="w-3 h-3" />
                        {stagedFile ? "Change" : "Upload Photo"}
                      </button>
                      {photoMode === "replace" && !stagedFile && (
                        <button
                          type="button"
                          onClick={cancelReplace}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-heading font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Keep Current
                        </button>
                      )}
                      {stagedFile && (
                        <button
                          type="button"
                          onClick={cancelReplace}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-heading font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => stageFile(e.target.files[0])}
                />
                {photoError && <p className="text-[10px] text-red-400">{photoError}</p>}
                <p className="text-[10px] text-slate-500">JPG, PNG or WebP · max 5 MB. Photo is uploaded when you click Save Profile.</p>
              </div>
            )}
          </div>

          {/* Show on page toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnPage}
              onChange={(e) => { showOnPageRef.current = e.target.checked; setShowOnPage(e.target.checked); }}
              className="sr-only"
            />
            <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${showOnPage ? "bg-violet-600" : "bg-slate-700"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showOnPage ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-white font-medium">Show on company team page</span>
          </label>

          {/* Role — required */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">
              Role <span className="text-[#fe6a34]">*</span>
            </label>
            <select
              value={adminRole}
              onChange={(e) => setAdminRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="" disabled>Select a role…</option>
              {ADMIN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Job title */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Job Title (optional)</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Founder & CEO, Head of Operations"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Falls back to role label if left blank.</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 font-heading mb-1">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Short bio shown on the public team page…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">{bio.length}/300 characters</p>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-slate-900 pt-3 border-t border-slate-800">
          <button onClick={onClose} disabled={isBusy} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-heading font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-heading font-semibold transition-colors"
          >
            {isBusy ? (uploading ? "Uploading…" : "Saving…") : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAdminsPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate,     setShowCreate]     = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [teamVisTarget,  setTeamVisTarget]  = useState(null);
  const [confirmDialog,  setConfirmDialog]  = useState(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-admins", page, search, roleFilter],
    queryFn: () => adminApi.getAdmins({ page, limit: 20, search: search || undefined, admin_role: roleFilter || undefined }),
    keepPreviousData: true,
  });

  const suspendMutation = useMutation({
    mutationFn: (id) => adminApi.suspendAdmin(id),
    onSuccess: (res) => {
      toast(res.is_active ? "Admin reactivated" : "Admin suspended", "success");
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      setConfirmDialog(null);
    },
    onError: (e) => toast(e?.response?.data?.detail || "Action failed", "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => adminApi.revokeAdminAccess(id),
    onSuccess: () => {
      toast("Admin access revoked", "success");
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      setConfirmDialog(null);
    },
    onError: (e) => toast(e?.response?.data?.detail || "Action failed", "error"),
  });

  const isSuperAdmin = user?.admin_role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Shield className="w-12 h-12 text-slate-700" />
        <p className="text-slate-400 font-heading font-semibold text-sm">Super Admin access required</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Admin Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} admin{total !== 1 ? "s" : ""} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-heading font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Admin
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">All Roles</option>
          {ADMIN_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No admins found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Admin", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((admin) => {
                  const isSelf = admin.id === user?.id;
                  return (
                    <tr key={admin.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white flex items-center gap-2">
                          {admin.full_name}
                          {isSelf && <span className="text-[10px] text-violet-400 font-heading">(you)</span>}
                          {admin.show_on_team_page && (
                            <span className="text-[9px] font-bold text-emerald-400 border border-emerald-700/60 px-1.5 py-0.5 rounded-full font-heading uppercase tracking-widest">
                              On team page
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{admin.email}</div>
                        {admin.job_title && <div className="text-xs text-violet-400 font-medium">{admin.job_title}</div>}
                        {!admin.job_title && admin.phone && <div className="text-xs text-slate-500">{admin.phone}</div>}
                      </td>
                      <td className="px-5 py-4"><RoleBadge role={admin.admin_role} /></td>
                      <td className="px-5 py-4"><StatusDot active={admin.is_active} /></td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {!isSelf && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditTarget(admin)}
                              title="Change role"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-300 hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setTeamVisTarget(admin)}
                              title="Team page visibility"
                              className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${admin.show_on_team_page ? "text-emerald-400" : "text-slate-400 hover:text-emerald-300"}`}
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDialog({ type: "suspend", admin })}
                              title={admin.is_active ? "Suspend" : "Reactivate"}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                            >
                              {admin.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setConfirmDialog({ type: "revoke", admin })}
                              title="Revoke admin access"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-800">
              {items.map((admin) => {
                const isSelf = admin.id === user?.id;
                return (
                  <div key={admin.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white text-sm">
                          {admin.full_name} {isSelf && <span className="text-[10px] text-violet-400 font-heading">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-400">{admin.email}</p>
                      </div>
                      <StatusDot active={admin.is_active} />
                    </div>
                    <div className="flex items-center justify-between">
                      <RoleBadge role={admin.admin_role} />
                      <span className="text-[10px] text-slate-500">
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    {!isSelf && (
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <button onClick={() => setEditTarget(admin)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-heading font-semibold hover:bg-slate-800 transition-colors">
                          <Edit2 className="w-3 h-3" /> Role
                        </button>
                        <button onClick={() => setTeamVisTarget(admin)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-heading font-semibold transition-colors ${admin.show_on_team_page ? "border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/20" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                          <Globe className="w-3 h-3" /> Team
                        </button>
                        <button onClick={() => setConfirmDialog({ type: "suspend", admin })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-700 text-amber-300 text-xs font-heading font-semibold hover:bg-slate-800 transition-colors">
                          {admin.is_active ? <><ShieldOff className="w-3 h-3" /> Suspend</> : <><RefreshCw className="w-3 h-3" /> Reactivate</>}
                        </button>
                        <button onClick={() => setConfirmDialog({ type: "revoke", admin })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-800/60 text-red-400 text-xs font-heading font-semibold hover:bg-red-900/20 transition-colors">
                          <UserX className="w-3 h-3" /> Revoke
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-heading font-semibold text-white">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate    && <CreateAdminModal onClose={() => setShowCreate(false)} />}
      {editTarget    && <EditRoleModal admin={editTarget} onClose={() => setEditTarget(null)} />}
      {teamVisTarget && <TeamVisibilityModal admin={teamVisTarget} onClose={() => setTeamVisTarget(null)} />}

      {confirmDialog?.type === "suspend" && (
        <ConfirmDialog
          title={confirmDialog.admin.is_active ? "Suspend Admin" : "Reactivate Admin"}
          message={
            confirmDialog.admin.is_active
              ? `Suspend ${confirmDialog.admin.full_name}? They will lose platform access immediately.`
              : `Reactivate ${confirmDialog.admin.full_name}? They will regain access to the admin console.`
          }
          confirmLabel={confirmDialog.admin.is_active ? "Suspend" : "Reactivate"}
          danger={confirmDialog.admin.is_active}
          loading={suspendMutation.isPending}
          onConfirm={() => suspendMutation.mutate(confirmDialog.admin.id)}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {confirmDialog?.type === "revoke" && (
        <ConfirmDialog
          title="Revoke Admin Access"
          message={`Remove ${confirmDialog.admin.full_name}'s admin privileges? Their account will be downgraded to a regular user. This cannot be undone from this page.`}
          confirmLabel="Revoke Access"
          danger
          loading={revokeMutation.isPending}
          onConfirm={() => revokeMutation.mutate(confirmDialog.admin.id)}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
