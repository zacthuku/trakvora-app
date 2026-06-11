import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/utils/mediaUrl";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, X, CheckCheck, Trash2,
  Zap, CreditCard, Package, Gavel, XCircle,
  AlertCircle, CheckCircle2, Info, ToggleLeft, ToggleRight,
  Briefcase, UserCheck, Star, Building2,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { useNotificationStore } from "@/store/notificationStore";
import { useInboxStore } from "@/store/inboxStore";

const TYPE_CONFIG = {
  system:         { icon: Info,         bg: "bg-slate-100",  text: "text-slate-600",  dot: "bg-slate-500"  },
  feature:        { icon: Zap,          bg: "bg-violet-50",  text: "text-violet-600", dot: "bg-violet-500" },
  payment:        { icon: CreditCard,   bg: "bg-teal-50",    text: "text-teal-600",   dot: "bg-[#4fdbcc]"  },
  bid:            { icon: Gavel,        bg: "bg-orange-50",  text: "text-secondary",  dot: "bg-secondary"  },
  bid_received:   { icon: Gavel,        bg: "bg-orange-50",  text: "text-secondary",  dot: "bg-secondary"  },
  bid_accepted:   { icon: CheckCircle2, bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  bid_rejected:   { icon: XCircle,      bg: "bg-red-50",     text: "text-red-600",    dot: "bg-red-500"    },
  load:           { icon: Package,      bg: "bg-sky-50",     text: "text-sky-600",    dot: "bg-sky-500"    },
  alert:          { icon: AlertCircle,  bg: "bg-red-50",     text: "text-red-600",    dot: "bg-red-500"    },
  success:        { icon: CheckCircle2, bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-[#4fdbcc]"  },
  owner_invite:   { icon: UserCheck,    bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  job_post:       { icon: Briefcase,    bg: "bg-orange-50",  text: "text-secondary",  dot: "bg-secondary"  },
};

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ notification, onClose }) {
  const [owner, setOwner] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | accepted | declined | error
  const fetchUnreadCount = useInboxStore(s => s.fetchUnreadCount);

  useEffect(() => {
    if (!notification.reference_id) return;
    apiClient.get(`/users/${notification.reference_id}/public`)
      .then(r => setOwner(r.data))
      .catch(() => {});
  }, [notification.reference_id]);

  const initials = owner?.full_name
    ? owner.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const handleAccept = async () => {
    setStatus("loading");
    try {
      await apiClient.post("/drivers/invite/accept", {
        owner_id:        notification.reference_id,
        notification_id: notification.id,
      });
      setStatus("accepted");
      fetchUnreadCount();
    } catch {
      setStatus("error");
    }
  };

  const handleDecline = async () => {
    setStatus("loading");
    try {
      await apiClient.post("/drivers/invite/decline", {
        owner_id:        notification.reference_id,
        notification_id: notification.id,
      });
      setStatus("declined");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white text-base">Employment Invitation</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Owner card */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0">
            {owner?.profile_photo_url
              ? <img src={mediaUrl(owner.profile_photo_url)} alt="owner" className="w-full h-full object-cover" />
              : <span className="text-sm font-bold text-slate-600 font-heading">{initials}</span>}
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-slate-900 dark:text-white text-sm truncate">
              {owner?.full_name || "Fleet Owner"}
            </p>
            {owner?.company_name && (
              <div className="flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{owner.company_name}</p>
              </div>
            )}
            {owner?.rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-xs text-slate-500">{owner.rating.toFixed(1)} · {owner.total_trips} trips</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {owner?.company_name || owner?.full_name || "A fleet owner"} has invited you to join their team.
          If you accept, your contact details will be shared with them.
        </p>

        {status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-800">You've joined the team!</p>
            <p className="text-xs text-green-600 mt-1">Your contact info has been shared with the owner.</p>
            <button onClick={onClose} className="mt-3 text-xs font-semibold text-green-700 hover:underline">Close</button>
          </div>
        )}

        {status === "declined" && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-slate-700">Invitation declined.</p>
            <button onClick={onClose} className="mt-3 text-xs font-semibold text-slate-500 hover:underline">Close</button>
          </div>
        )}

        {status === "error" && (
          <p className="text-xs text-red-500 text-center mb-4">Something went wrong. Please try again.</p>
        )}

        {(status === "idle" || status === "error") && (
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={status === "loading"}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={status === "loading"}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.3)] disabled:opacity-50"
            >
              {status === "loading" ? "Processing…" : "Accept"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Job Post Detail Modal ─────────────────────────────────────────────────────

function JobPostDetailModal({ notification, onClose }) {
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    if (!notification.reference_id) return;
    apiClient.get(`/users/${notification.reference_id}/public`)
      .then(r => setOwner(r.data))
      .catch(() => {});
  }, [notification.reference_id]);

  const initials = owner?.full_name
    ? owner.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-secondary" />
            </div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-sm leading-tight line-clamp-2 max-w-[200px]">
              {notification.title}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Posted by */}
        {owner && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0">
              {owner.profile_photo_url
                ? <img src={mediaUrl(owner.profile_photo_url)} alt="owner" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-heading">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{owner.full_name}</p>
              {owner.company_name && (
                <p className="text-[10px] text-slate-400 truncate">{owner.company_name}</p>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-48 overflow-y-auto">
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{notification.body}</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); navigate("/driver/jobs"); }}
            className="flex-1 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(254,106,52,0.3)]"
          >
            View Job Feed
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notification Panel ────────────────────────────────────────────────────────

export default function NotificationPanel({ variant = "light" }) {
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const panelRef = useRef(null);

  const { notifications, enabled, markRead, markAllRead, dismiss, clearAll, setEnabled, fetchNotifications } =
    useNotificationStore();

  const unread = notifications.filter((n) => !n.read).length;

  // Fetch on mount and whenever panel opens
  useEffect(() => { fetchNotifications(); }, []);
  useEffect(() => { if (open) fetchNotifications(); }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const bellBtn =
    variant === "dark"
      ? "p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
      : "p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-full transition-colors";

  const handleNotificationClick = (n) => {
    markRead(n.id);
    if (n.reference_type === "owner_invite") {
      setOpen(false);
      setActiveModal({ type: "owner_invite", notification: n });
    } else if (n.reference_type === "job_post") {
      setOpen(false);
      setActiveModal({ type: "job_post", notification: n });
    }
  };

  return (
    <>
      <div className="relative" ref={panelRef}>
        {/* Bell button */}
        <button
          onClick={() => setOpen((s) => !s)}
          className={`relative ${bellBtn}`}
          aria-label="Notifications"
        >
          {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          {enabled && unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-secondary rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5 leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">Notifications</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    title="Mark all as read"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Enable / disable toggle */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Push Notifications</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {enabled ? "Receiving alerts" : "Notifications paused"}
                </p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
              >
                {enabled
                  ? <ToggleRight className="w-8 h-8 text-secondary" />
                  : <ToggleLeft className="w-8 h-8 text-slate-300" />}
              </button>
            </div>

            {/* Notification list */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.reference_type] || TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                  const Icon = cfg.icon;
                  const isActionable = n.reference_type === "owner_invite" || n.reference_type === "job_post";
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${!n.read ? "bg-orange-50/30 dark:bg-orange-900/10" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${cfg.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-snug ${n.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>
                            {n.title}
                            {!n.read && (
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} ml-1.5 mb-0.5 align-middle`} />
                            )}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                            className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-slate-400">{timeAgo(n.time)}</p>
                          {isActionable && !n.read && (
                            <p className="text-[10px] text-secondary font-semibold">Tap to respond</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center">
                <button
                  onClick={markAllRead}
                  className="text-xs text-secondary font-semibold hover:opacity-80 transition-opacity"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals portalled to document.body to escape layout stacking contexts */}
      {activeModal?.type === "owner_invite" && createPortal(
        <InviteModal
          notification={activeModal.notification}
          onClose={() => setActiveModal(null)}
        />,
        document.body,
      )}
      {activeModal?.type === "job_post" && createPortal(
        <JobPostDetailModal
          notification={activeModal.notification}
          onClose={() => setActiveModal(null)}
        />,
        document.body,
      )}
    </>
  );
}
