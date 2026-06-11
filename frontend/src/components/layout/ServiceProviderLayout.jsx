import { useEffect, useState } from "react";
import { mediaUrl } from "@/utils/mediaUrl";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, ClipboardList, UserCircle,
  CreditCard, Bell, LogOut, Menu, X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { LogoIcon, LogoWordmark } from "@/components/ui/Logo";
import { ToastContainer } from "@/components/ui/Toast";
import NotificationPanel from "@/components/ui/NotificationPanel";
import InboxIcon from "@/components/ui/InboxIcon";
import { useInboxStore } from "@/store/inboxStore";

const ROLE_META = {
  mover:          { label: "Mover Company",     base: "/mover"          },
  air_freight:    { label: "Air Freight Agent", base: "/airfreight"     },
  parcel_carrier: { label: "Parcel Carrier",    base: "/parcel-carrier" },
};

function buildNav(base) {
  return [
    { to: base,           end: true, icon: LayoutDashboard, label: "Dashboard"        },
    { to: `${base}/bookings`,        icon: Briefcase,       label: "Available Jobs"   },
    { to: `${base}/jobs`,            icon: ClipboardList,   label: "My Jobs"          },
    { to: `${base}/profile`,         icon: UserCircle,      label: "Profile"          },
    { to: `${base}/wallet`,          icon: CreditCard,      label: "Wallet"           },
    { to: `${base}/inbox`,           icon: Bell,            label: "Inbox"            },
  ];
}

function SideNavLink({ to, end, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        isActive
          ? "flex items-center gap-3 bg-orange-900/50 text-orange-300 border-l-4 border-[#fe6a34] px-4 py-3 text-[11px] font-semibold uppercase tracking-widest font-heading"
          : "flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading"
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-[#fe6a34] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

export default function ServiceProviderLayout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { unreadCount: inboxUnreadCount, fetchUnreadCount } = useInboxStore();

  useEffect(() => { fetchUnreadCount(); }, []);

  const meta = ROLE_META[user?.role] ?? { label: "Service Provider", base: "/" };
  const navItems = buildNav(meta.base);

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")
    : "P";

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop Sidebar ── */}
      <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 border-r border-slate-800 bg-slate-900 flex-col py-6 z-50">
        <Link to={meta.base} className="px-6 mb-8 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <LogoIcon size={42} />
          <div>
            <LogoWordmark size="xl" variant="dark" />
            <p className="text-[10px] text-orange-400 uppercase tracking-widest mt-0.5 font-heading font-semibold">{meta.label}</p>
          </div>
        </Link>

        <div className="flex-1 overflow-y-auto">
          <p className="px-4 text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2 font-heading">Navigation</p>
          <ul>
            {navItems.map(({ to, end, icon, label }) => (
              <li key={to}>
                <SideNavLink to={to} end={end} icon={icon} label={label}
                  badge={label === "Inbox" ? inboxUnreadCount : 0} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-700 shrink-0 overflow-hidden flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={mediaUrl(user.profile_photo_url)} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-white font-heading">{initials}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => { clearAuth(); navigate("/login"); }}
            className="w-full flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading">
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Desktop Top Header ── */}
      <header className="hidden md:flex justify-between items-center fixed top-0 left-64 right-0 z-40 px-8 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span className="text-[11px] font-semibold text-orange-700 font-heading">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <InboxIcon to={`${meta.base}/inbox`} variant="light" />
          <NotificationPanel variant="light" />
        </div>
      </header>

      {/* ── Mobile Top Header ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4">
        <Link to={meta.base} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoIcon size={32} />
          <LogoWordmark size="xl" />
        </Link>
        <div className="flex items-center gap-1">
          <InboxIcon to={`${meta.base}/inbox`} variant="light" />
          <NotificationPanel variant="light" />
          <button onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
      )}

      {/* ── Mobile Drawer ── */}
      <div className={`md:hidden fixed top-0 left-0 h-full w-72 bg-slate-900 z-50 flex flex-col py-6 border-r border-slate-800 transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 mb-6 flex items-center justify-between">
          <Link to={meta.base} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <LogoIcon size={36} />
            <LogoWordmark size="xl" variant="dark" />
          </Link>
          <button onClick={closeDrawer} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul>
            {navItems.map(({ to, end, icon, label }) => (
              <li key={to}>
                <SideNavLink to={to} end={end} icon={icon} label={label}
                  badge={label === "Inbox" ? inboxUnreadCount : 0} onClick={closeDrawer} />
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-slate-800 pt-4">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-700 shrink-0 overflow-hidden flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={mediaUrl(user.profile_photo_url)} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-white font-heading">{initials}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => { clearAuth(); navigate("/login"); }}
            className="w-full flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading">
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pt-2 pb-4 z-40 border-t bg-white border-slate-200 shadow-[0_-4px_20px_rgba(26,43,60,0.08)]">
        {navItems.slice(0, 5).map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[9px] font-bold font-heading uppercase tracking-widest transition-colors ${isActive ? "text-orange-600" : "text-slate-400 hover:text-slate-700"}`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-[60px] pb-24 md:pb-12 px-4 md:px-8 w-full min-h-screen bg-slate-50">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
