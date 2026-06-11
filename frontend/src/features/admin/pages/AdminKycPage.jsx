import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Fingerprint, CheckCircle2, XCircle, Loader2,
  User, Mail, Clock, AlertCircle, Eye,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { PageSpinner } from "@/components/ui/Spinner";

const ROLE_LABELS = {
  driver:         "Driver",
  shipper:        "Shipper",
  owner:          "Fleet Owner",
  mover:          "Mover",
  air_freight:    "Air Freight",
  parcel_carrier: "Parcel Carrier",
};

const ROLE_COLORS = {
  driver:         "bg-sky-50 text-sky-700 border-sky-200",
  shipper:        "bg-violet-50 text-violet-700 border-violet-200",
  owner:          "bg-amber-50 text-amber-700 border-amber-200",
  mover:          "bg-teal-50 text-teal-700 border-teal-200",
  air_freight:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  parcel_carrier: "bg-pink-50 text-pink-700 border-pink-200",
};

const ID_TYPE_LABELS = {
  NATIONAL_ID:     "National ID",
  PASSPORT:        "Passport",
  DRIVERS_LICENSE: "Driver's Licence",
  VOTER_ID:        "Voter ID",
};

const TABS = ["pending", "approved", "rejected"];
const TAB_LABELS = { pending: "Pending Review", approved: "Approved", rejected: "Rejected" };
const TAB_COLORS = {
  pending:  "border-amber-500 text-amber-600",
  approved: "border-teal-500 text-teal-600",
  rejected: "border-red-500 text-red-600",
};

function UserRow({ user, onApprove, onReject, actionPending }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [showSelfie, setShowSelfie] = useState(false);

  const roleCls = ROLE_COLORS[user.role] || "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-start gap-4">
        {/* Selfie / Avatar */}
        <div className="shrink-0">
          {user.kyc_selfie_url ? (
            <button onClick={() => setShowSelfie(true)} className="relative group">
              <img
                src={user.kyc_selfie_url}
                alt="selfie"
                className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-600 group-hover:border-secondary transition-colors"
              />
              <span className="absolute inset-0 rounded-xl bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </span>
            </button>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center">
              <User className="w-6 h-6 text-slate-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.full_name}</p>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleCls}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
            <Mail className="w-3 h-3" /> {user.email}
          </p>
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <Fingerprint className="w-3 h-3 text-slate-400" />
              <span className="font-medium">{ID_TYPE_LABELS[user.id_type] || user.id_type}:</span>
              <span className="font-mono">{user.national_id || "—"}</span>
            </span>
            {user.created_at && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                {new Date(user.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          {user.kyc_rejection_reason && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 border border-red-200 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {user.kyc_rejection_reason}
            </p>
          )}
        </div>

        {/* Actions — only shown on pending tab */}
        {user.kyc_status === "pending" && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => onApprove(user.id)}
              disabled={actionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => setShowReject((v) => !v)}
              disabled={actionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        )}
      </div>

      {/* Rejection reason input */}
      {showReject && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Rejection reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ID number does not match government records"
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 resize-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { onReject(user.id, reason); setShowReject(false); }}
              disabled={!reason.trim() || actionPending}
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(""); }}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selfie lightbox */}
      {showSelfie && user.kyc_selfie_url && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowSelfie(false)}
        >
          <img
            src={user.kyc_selfie_url}
            alt="KYC selfie"
            className="max-w-sm max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminKycPage() {
  const [tab, setTab] = useState("pending");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kyc-users", tab],
    queryFn: () => adminApi.getUsers({ kyc_status: tab, page_size: 50 }),
  });

  const approveMut = useMutation({
    mutationFn: (id) => adminApi.reviewKYC(id, true, null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc-users"] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => adminApi.reviewKYC(id, false, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc-users"] });
    },
  });

  const users = data?.users ?? data?.items ?? [];
  const actionPending = approveMut.isPending || rejectMut.isPending;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-slate-900 dark:text-white">Identity Verification</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Review and approve user KYC submissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? TAB_COLORS[t]
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Fingerprint className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {tab === "pending" ? "No pending KYC submissions" : `No ${tab} submissions`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              actionPending={actionPending}
              onApprove={(id) => approveMut.mutate(id)}
              onReject={(id, reason) => rejectMut.mutate({ id, reason })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
