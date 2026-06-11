import { useEffect, useState } from "react";
import { mediaUrl } from "@/utils/mediaUrl";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Truck, Package, Navigation2,
  CreditCard, ShieldCheck, LogOut, BarChart3, Menu, X,
  ClipboardList, CheckSquare, Users2, Map, ShieldAlert, Radio,
  Headphones, Activity, MessageSquare, FileText, Plane, Bell, ScrollText, Briefcase,
  SlidersHorizontal, AlertTriangle, Fingerprint, Inbox, TrendingUp, Layers, Home,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { LogoIcon, LogoWordmark } from "@/components/ui/Logo";
import { ToastContainer } from "@/components/ui/Toast";
import NotificationPanel from "@/components/ui/NotificationPanel";
import InboxIcon from "@/components/ui/InboxIcon";
import { useInboxStore } from "@/store/inboxStore";

const ALL_NAV = [
  { key: "dashboard",        to: "/admin",                      end: true, icon: LayoutDashboard, label: "Dashboard"  },
  { key: "inbox",            to: "/admin/inbox",                           icon: Bell,             label: "Inbox"      },
  { key: "activity-log",     to: "/admin/activity-log",                    icon: ScrollText,       label: "Activity"   },
  { key: "providers",        to: "/admin/providers",                        icon: Briefcase,        label: "Providers"  },
  { key: "ops-home",         to: "/admin/ops",                             icon: Activity,         label: "Operations" },
  { key: "field-inspector",  to: "/admin/field-inspector",                 icon: LayoutDashboard, label: "Dashboard"  },
  { key: "finance-home",     to: "/admin/finance",                         icon: BarChart3,        label: "Finance"    },
  { key: "support-home",     to: "/admin/support",                         icon: Headphones,       label: "Support"    },
  { key: "support-chat",    to: "/admin/support/chat",                    icon: MessageSquare,    label: "Live Chat"  },
  { key: "support-tickets", to: "/admin/support/tickets",                 icon: FileText,         label: "Tickets"    },
  { key: "feedback",        to: "/admin/feedback",                        icon: Inbox,            label: "Feedback"   },
  { key: "users",            to: "/admin/users",                           icon: Users,            label: "Users"     },
  { key: "drivers",   to: "/admin/drivers",                     icon: ShieldCheck,      label: "Drivers"   },
  { key: "kyc",       to: "/admin/kyc",                         icon: Fingerprint,      label: "KYC"       },
  { key: "loads",      to: "/admin/loads",                      icon: Package,          label: "Loads"      },
  { key: "shipments",  to: "/admin/shipments",                  icon: Navigation2,      label: "Shipments"  },
  { key: "late-deliveries", to: "/admin/late-deliveries",       icon: AlertTriangle,    label: "Late Deliveries" },
  { key: "parcels",    to: "/admin/parcels",                    icon: Package,          label: "Parcels"    },
  { key: "movers",     to: "/admin/movers",                     icon: Truck,            label: "Movers"     },
  { key: "airfreight", to: "/admin/airfreight",                 icon: Plane,            label: "Airfreight" },
  { key: "trucks",    to: "/admin/trucks",                      icon: Truck,            label: "Fleet"     },
  { key: "field-ops", to: "/admin/field-ops/tasks",             icon: ClipboardList,    label: "Field Ops" },
  { key: "compliance",to: "/admin/compliance",                  icon: CheckSquare,      label: "Compliance"},
  { key: "workforce", to: "/admin/workforce",                   icon: Users2,           label: "Workforce" },
  { key: "fleet-map", to: "/admin/fleet-map",                   icon: Map,              label: "Fleet Map" },
  { key: "admins",    to: "/admin/admins",                      icon: ShieldAlert,      label: "Admins"    },
  { key: "settings",   to: "/admin/settings",                   icon: SlidersHorizontal, label: "Settings"  },
  { key: "pricing",    to: "/admin/pricing",                    icon: TrendingUp,       label: "Pricing"   },
  { key: "payment-methods", to: "/admin/payment-methods",       icon: CreditCard,       label: "Pay Methods"},
  { key: "hero-slides",to: "/admin/hero-slides",                icon: Layers,           label: "Hero Slides"},
  { key: "iot",       to: "/admin/iot",                         icon: Radio,            label: "IoT Ops"   },
  { key: "iot-devices", to: "/admin/iot/devices",               icon: Package,          label: "Devices"   },
];

const ROLE_KEYS = {
  super_admin:        "all",
  operations_admin:   ["ops-home", "inbox", "activity-log", "providers", "field-ops", "workforce", "trucks", "users", "drivers", "kyc", "loads", "shipments", "late-deliveries", "parcels", "movers", "airfreight", "finance-home", "fleet-map", "feedback"],
  finance_admin:      ["finance-home", "inbox", "activity-log", "feedback", "pricing", "payment-methods"],
  field_inspector:    ["field-inspector", "inbox", "field-ops"],
  iot_technician:     ["iot", "iot-devices", "inbox", "field-ops"],
  compliance_officer: ["dashboard", "inbox", "compliance", "trucks", "kyc"],
  support_agent:      ["support-home", "inbox", "activity-log", "support-chat", "support-tickets", "users", "drivers", "loads", "shipments", "late-deliveries", "feedback"],
};

const ROLE_LABELS = {
  super_admin:        "Super Admin",
  operations_admin:   "Operations Admin",
  finance_admin:      "Finance Admin",
  field_inspector:    "Field Inspector",
  iot_technician:     "IoT Technician",
  compliance_officer: "Compliance Officer",
  support_agent:      "Support Agent",
};

function getNavItems(adminRole) {
  const allowed = ROLE_KEYS[adminRole] ?? "all";
  if (allowed === "all") return ALL_NAV.filter((item) => item.key !== "field-inspector");
  return ALL_NAV.filter((item) => allowed.includes(item.key));
}

function SideNavLink({ to, end, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        isActive
          ? "flex items-center gap-3 bg-violet-900/60 text-violet-300 border-l-4 border-violet-400 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest font-heading"
          : "flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors text-[11px] font-semibold uppercase tracking-widest font-heading"
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-violet-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { unreadCount: inboxUnreadCount, fetchUnreadCount } = useInboxStore();

  useEffect(() => { fetchUnreadCount(); }, []);

  const _nameParts = (user?.full_name || "").trim().split(/\s+/).filter(Boolean);
  const initials = _nameParts.length >= 2
    ? (_nameParts[0][0] + _nameParts[_nameParts.length - 1][0]).toUpperCase()
    : (user?.full_name || "").trim().slice(0, 2).toUpperCase() || "??";

  const closeDrawer = () => setDrawerOpen(false);
  const navItems = getNavItems(user?.admin_role);
  const roleLabel = ROLE_LABELS[user?.admin_role] ?? "Platform Admin";

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop Sidebar ── */}
      <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 border-r border-slate-800 bg-slate-900 flex-col py-6 z-50">
        <Link to="/admin/home" className="px-6 mb-8 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <LogoIcon size={42} />
          <div>
            <LogoWordmark size="xl" variant="dark" />
            <p className="text-[10px] text-violet-400 uppercase tracking-widest mt-0.5 font-heading font-semibold">Admin Console</p>
          </div>
        </Link>

        <div className="px-4 mb-6">
          <div className="bg-violet-900/30 border border-violet-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-violet-300 font-heading font-semibold">{roleLabel}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="px-4 text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2 font-heading">Management</p>
          <ul>{navItems.map(({ key, ...linkProps }) => (
            <li key={key}>
              <SideNavLink {...linkProps} badge={key === "inbox" ? inboxUnreadCount : 0} />
            </li>
          ))}</ul>
        </div>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-700 shrink-0 overflow-hidden flex items-center justify-center">
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
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-green-700 font-heading">System Online</span>
        </div>
        <div className="flex items-center gap-1">
          <InboxIcon to="/admin/inbox" variant="light" />
          <NotificationPanel variant="light" />
        </div>
      </header>

      {/* ── Mobile Top Header ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4">
        <Link to="/admin/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoIcon size={32} />
          <LogoWordmark size="xl" />
        </Link>
        <div className="flex items-center gap-1">
          <InboxIcon to="/admin/inbox" variant="light" />
          <NotificationPanel variant="light" />
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={closeDrawer}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <div className={`md:hidden fixed top-0 left-0 h-full w-72 bg-slate-900 z-50 flex flex-col py-6 border-r border-slate-800 transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Drawer header */}
        <div className="px-5 mb-6 flex items-center justify-between">
          <Link to="/admin/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <LogoIcon size={36} />
            <LogoWordmark size="xl" variant="dark" />
          </Link>
          <button onClick={closeDrawer} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin badge */}
        <div className="px-4 mb-5">
          <div className="bg-violet-900/30 border border-violet-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-violet-300 font-heading font-semibold">{roleLabel}</span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2 font-heading">Management</p>
          <ul>{navItems.map(({ key, ...linkProps }) => (
            <li key={key}>
              <SideNavLink {...linkProps} badge={key === "inbox" ? inboxUnreadCount : 0} onClick={closeDrawer} />
            </li>
          ))}</ul>
        </div>

        {/* User + logout */}
        <div className="border-t border-slate-800 pt-4">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-700 shrink-0 overflow-hidden flex items-center justify-center">
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

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-[60px] pb-24 md:pb-12 px-4 md:px-8 w-full min-h-screen bg-slate-50">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav — first 5 nav items ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pt-2 pb-4 z-40 border-t bg-white border-slate-200 shadow-[0_-4px_20px_rgba(26,43,60,0.08)]">
        {navItems.slice(0, 5).map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[9px] font-bold font-heading uppercase tracking-widest transition-colors ${isActive ? "text-violet-600" : "text-slate-400 hover:text-slate-700"}`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <ToastContainer />
    </div>
  );
}
