import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CheckCheck, Inbox, Loader2, Mail, UserCheck,
  CheckCircle2, XCircle, Gavel, Zap, ArrowRight,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { notificationsApi } from "@/api/notificationsApi";
import { useInboxStore } from "@/store/inboxStore";
import { useAuthStore } from "@/store/authStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

const TYPE_CONFIG = {
  bid_accepted:          { Icon: CheckCircle2, color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-900/30"      },
  bid_rejected:          { Icon: XCircle,      color: "text-red-500",     bg: "bg-red-50 dark:bg-red-900/30"        },
  bid_received:          { Icon: Gavel,        color: "text-secondary",   bg: "bg-secondary/10"                     },
  direct_offer:          { Icon: Zap,          color: "text-secondary",   bg: "bg-secondary/10"                     },
  direct_offer_response: { Icon: Bell,         color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/30"   },
  system:                { Icon: Bell,         color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-700"     },
};
const DEFAULT_CFG = { Icon: Bell, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-700" };

function getNavTarget(notif, role) {
  const prefix = role === "shipper" ? "/shipper"
               : role === "driver"  ? "/driver"
               : role === "admin"   ? "/admin"
               : "/owner"; // owner, owner_user

  const loadId = notif.reference_type === "load" ? notif.reference_id
               : notif.reference_type === "bid"  ? notif.resolved_load_id
               : null;

  if (loadId) {
    const path = role === "shipper" ? `${prefix}/bids/${loadId}` : `${prefix}/loads/${loadId}`;
    return { path, label: "View Job" };
  }
  if (notif.reference_type === "invite_accepted")
    return { path: `${prefix}/drivers`, label: "View Drivers" };
  if (notif.notification_type === "system" && !notif.reference_id) {
    const path = role === "admin" ? `${prefix}/finance` : `${prefix}/commissions`;
    return { path, label: "View Finance" };
  }
  return null;
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({ notif, role, expanded, onExpand }) {
  const qc = useQueryClient();
  const cfg = TYPE_CONFIG[notif.notification_type] || DEFAULT_CFG;
  const { Icon } = cfg;
  const navTarget = getNavTarget(notif, role);

  const handleClick = async () => {
    onExpand();
    if (!notif.is_read) {
      try {
        await notificationsApi.markRead(notif.id);
        qc.setQueryData(["inbox-notifications"], (old) =>
          old ? old.map(n => n.id === notif.id ? { ...n, is_read: true } : n) : old
        );
      } catch { /* optimistic — already expanded */ }
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      !notif.is_read
        ? "bg-secondary/5 border-secondary/20 dark:bg-secondary/10 dark:border-secondary/30"
        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
    }`}>
      <button className="w-full flex items-start gap-4 p-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors" onClick={handleClick}>
        {/* Type icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.color}`} style={{ width: "1.1rem", height: "1.1rem" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-snug ${!notif.is_read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {notif.title}
              {!notif.is_read && (
                <span className="inline-block w-2 h-2 rounded-full bg-secondary ml-2 mb-0.5 align-middle" />
              )}
            </p>
            <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {notif.body.slice(0, 120)}{notif.body.length > 120 ? "…" : ""}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-[52px] space-y-3">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3.5 border border-slate-100 dark:border-slate-600">
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{notif.body}</p>
            </div>
            {navTarget && (
              <Link
                to={navTarget.path}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {navTarget.label} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message Row (unchanged pattern from old InboxPage) ───────────────────────

function MessageRow({ message, expanded, onExpand }) {
  const { markRead } = useInboxStore();
  const isInviteAccepted = message.message_type === "invite_accepted";

  const handleClick = () => {
    if (!message.is_read) markRead(message.id);
    onExpand();
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      !message.is_read
        ? "bg-orange-50/40 dark:bg-orange-900/10 border-orange-200/60 dark:border-orange-800/40"
        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
    }`}>
      <button className="w-full flex items-start gap-4 p-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-700/60 transition-colors" onClick={handleClick}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isInviteAccepted ? "bg-green-50 dark:bg-green-900/30" : "bg-slate-100 dark:bg-slate-700"}`}>
          {isInviteAccepted
            ? <UserCheck className="w-4.5 h-4.5 text-green-600" style={{ width: "1.1rem", height: "1.1rem" }} />
            : <Mail className="w-4.5 h-4.5 text-slate-500" style={{ width: "1.1rem", height: "1.1rem" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-snug ${!message.is_read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {message.subject}
              {!message.is_read && (
                <span className="inline-block w-2 h-2 rounded-full bg-secondary ml-2 mb-0.5 align-middle" />
              )}
            </p>
            <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeAgo(message.created_at)}</span>
          </div>
          {message.sender_name && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">From: {message.sender_name}</p>
          )}
          {!expanded && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {message.body.slice(0, 120)}{message.body.length > 120 ? "…" : ""}
            </p>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-[52px] bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{message.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const user = useAuthStore(s => s.user);
  const role = user?.role || "owner";

  const qc = useQueryClient();
  const [tab, setTab] = useState("notifications");
  const [expandedId, setExpandedId] = useState(null);

  // Notifications — all history (no unread_only filter)
  const { data: notifications = [], isLoading: notifsLoading } = useQuery({
    queryKey: ["inbox-notifications"],
    queryFn: () => apiClient.get("/notifications").then(r => r.data),
    staleTime: 30_000,
  });

  // Messages
  const { messages, unreadCount: msgUnread, isLoading: msgsLoading, fetchMessages, markAllRead: markAllMsgsRead } = useInboxStore();
  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const notifUnread = notifications.filter(n => !n.is_read).length;
  const totalUnread = notifUnread + msgUnread;

  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  const handleMarkAllRead = async () => {
    // Optimistic update for notifications in query cache
    qc.setQueryData(["inbox-notifications"], (old) =>
      old ? old.map(n => ({ ...n, is_read: true })) : old
    );
    await Promise.all([
      notificationsApi.markAllRead().catch(() => {}),
      markAllMsgsRead(),
    ]);
    qc.invalidateQueries({ queryKey: ["inbox-notifications"] });
  };

  const isLoading = notifsLoading || msgsLoading;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-900 dark:text-white tracking-tight">Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
          </p>
        </div>
        {totalUnread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-5">
        {[
          { key: "notifications", label: "Notifications", count: notifUnread },
          { key: "messages",      label: "Messages",      count: msgUnread   },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setExpandedId(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {label}
            {count > 0 && (
              <span className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-secondary text-white text-[10px] font-bold" style={{ minWidth: "1.1rem", height: "1.1rem" }}>
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      )}

      {/* Notifications tab */}
      {!isLoading && tab === "notifications" && (
        notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-heading font-bold text-slate-500 dark:text-slate-400 text-base">No notifications yet</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Bid updates, direct offers, and system alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map(notif => (
              <NotificationRow
                key={notif.id}
                notif={notif}
                role={role}
                expanded={expandedId === notif.id}
                onExpand={() => toggle(notif.id)}
              />
            ))}
          </div>
        )
      )}

      {/* Messages tab */}
      {!isLoading && tab === "messages" && (
        messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-heading font-bold text-slate-500 dark:text-slate-400 text-base">No messages</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Team updates and contact details will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <MessageRow
                key={msg.id}
                message={msg}
                expanded={expandedId === msg.id}
                onExpand={() => toggle(msg.id)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
