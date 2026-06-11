import { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, MapPin, Wallet,
  HelpCircle, Settings, LogOut, Search,
  Home, List, User, Navigation2, MoreHorizontal, X, MessageSquare,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { mediaUrl } from "@/utils/mediaUrl";
import { LogoIcon, LogoWordmark } from "@/components/ui/Logo";
import { ToastContainer } from "@/components/ui/Toast";
import NotificationPanel from "@/components/ui/NotificationPanel";
import InboxIcon from "@/components/ui/InboxIcon";
import { useNotificationStore } from "@/store/notificationStore";
import { useInboxStore } from "@/store/inboxStore";

const NAV_TOP = [
  { to: "/driver",          end: true, icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/driver/jobs",                icon: Briefcase,       label: "Job Feed"   },
  { to: "/driver/active",              icon: Navigation2,     label: "Active Job" },
  { to: "/driver/earnings",            icon: Wallet,          label: "Finance"    },
  { to: "/driver/profile",             icon: User,            label: "My Profile" },
  { to: "/driver/inbox",               icon: MessageSquare,   label: "Inbox"      },
];

const NAV_BOTTOM = [
  { to: "/driver/support",  icon: HelpCircle, label: "Support"  },
  { to: "/driver/settings", icon: Settings,   label: "Settings" },
];

function SideNavLink({ to, end, icon: Icon, label, badge = 0 }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) =>
        isActive
          ? "flex items-center gap-3 bg-slate-800 text-secondary border-l-4 border-secondary px-4 py-3 text-[11px] font-semibold uppercase tracking-widest font-heading"
          : "flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading"
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
      {badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-secondary text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

export default function DriverLayout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const fetchNotifications = useNotificationStore(s => s.fetchNotifications);
  const notifUnread = useNotificationStore(s => s.notifications.filter(n => !n.read).length);
  const msgUnread = useInboxStore(s => s.unreadCount);
  const inboxUnread = notifUnread + msgUnread;
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { fetchNotifications(); }, []);
  useBackgroundTracking();

  const _nameParts = (user?.full_name || "").trim().split(/\s+/).filter(Boolean);
  const initials = _nameParts.length >= 2
    ? (_nameParts[0][0] + _nameParts[_nameParts.length - 1][0]).toUpperCase()
    : (user?.full_name || "").trim().slice(0, 2).toUpperCase() || "??";

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ── Sidebar ── */}
      <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 border-r border-slate-800 bg-slate-900 flex-col py-6 z-50">
        <Link to="/driver/home" className="px-6 mb-8 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <LogoIcon size={42} />
          <div>
            <LogoWordmark size="xl" variant="dark" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Driver Hub</p>
          </div>
        </Link>

        {/* Driver status pill */}
        <div className="px-4 mb-5">
          <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 shrink-0 overflow-hidden flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={mediaUrl(user.profile_photo_url)} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-white font-heading">{initials}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || "Driver"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4fdbcc] animate-pulse" />
                <p className="text-[10px] text-slate-400">Online · {user?.total_trips || 0} trips</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ul>
            {NAV_TOP.map((link) => (
              <li key={link.to}>
                <SideNavLink {...link} badge={link.to === "/driver/inbox" ? inboxUnread : 0} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto">
          <ul>
            {NAV_BOTTOM.map((link) => (
              <li key={link.to}><SideNavLink {...link} /></li>
            ))}
            <li>
              <button onClick={() => { clearAuth(); navigate("/login"); }}
                className="w-full flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading">
                <LogOut className="w-4 h-4 shrink-0" />
                Logout
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* ── Mobile Header ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4">
        <Link to="/driver/home" className="flex items-center gap-2">
          <LogoIcon size={32} />
          <LogoWordmark size="lg" />
        </Link>
        <div className="flex items-center gap-1">
          <InboxIcon to="/driver/inbox" variant="light" />
          <NotificationPanel variant="light" />
          <Link to="/driver/settings">
            <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={mediaUrl(user.profile_photo_url)} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-[10px] font-bold text-slate-600 font-heading">{initials}</span>}
            </div>
          </Link>
        </div>
      </header>

      {/* ── Desktop Header ── */}
      <header className="hidden md:flex justify-between items-center fixed top-0 left-64 right-0 z-40 px-8 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search jobs, loads..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors" />
        </div>

        <div className="flex items-center gap-2">
          <InboxIcon to="/driver/inbox" variant="light" />
          <NotificationPanel variant="light" />
          <Link to="/driver/jobs"
            className="bg-secondary text-white px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity">
            Find Jobs
          </Link>
          <Link to="/driver/settings">
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 shrink-0 hover:ring-2 hover:ring-secondary/30 transition-all cursor-pointer overflow-hidden flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={mediaUrl(user.profile_photo_url)} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-slate-600 font-heading">{initials}</span>}
            </div>
          </Link>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-[72px] pb-24 md:pb-12 px-4 md:px-8 w-full min-h-screen">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
      )}
      {moreOpen && (
        <div className="md:hidden fixed bottom-[64px] left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(26,43,60,0.12)] px-4 py-2">
          <NavLink to="/driver/profile" onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <User className="w-5 h-5 text-slate-400" /> My Profile
          </NavLink>
          <NavLink to="/driver/settings" onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <Settings className="w-5 h-5 text-slate-400" /> Settings
          </NavLink>
          <NavLink to="/driver/support" onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5 text-slate-400" /> Support
          </NavLink>
          <button onClick={() => { setMoreOpen(false); clearAuth(); navigate("/login"); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" /> Log out
          </button>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pt-3 pb-4 z-50 border-t rounded-t-xl bg-white border-slate-200 shadow-[0_-4px_20px_rgba(26,43,60,0.08)]">
        {[
          { to: "/driver",         end: true, icon: Home,   label: "Home"     },
          { to: "/driver/jobs",               icon: List,   label: "Jobs"     },
          { to: "/driver/active",             icon: MapPin, label: "Active"   },
          { to: "/driver/earnings",           icon: Wallet, label: "Finance"  },
        ].map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold font-heading uppercase ${isActive ? "text-secondary" : "text-slate-400"}`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-bold font-heading uppercase ${moreOpen ? "text-secondary" : "text-slate-400"}`}
        >
          {moreOpen ? <X className="w-5 h-5 mb-0.5" /> : <MoreHorizontal className="w-5 h-5 mb-0.5" />}
          More
        </button>
      </nav>

      <ToastContainer />
    </div>
  );
}
