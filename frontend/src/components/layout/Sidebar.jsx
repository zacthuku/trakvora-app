import { NavLink, Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { LogoIcon, LogoWordmark } from "@/components/ui/Logo";

export default function Sidebar({ links, title = "trakvora" }) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col shrink-0">
      <Link to="/" className="px-4 py-4 border-b border-slate-800 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <LogoIcon size={42} />
        <LogoWordmark size="xl" variant="dark" />
      </Link>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
