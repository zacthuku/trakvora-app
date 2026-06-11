import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, NavLink } from "react-router-dom";
import {
  Menu, X, ChevronDown, ChevronRight,
  Package, Truck, Users, FileCheck,
  Box, MoveRight, ScrollText, MessageSquare, Sparkles,
} from "lucide-react";
import { LogoFull } from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import CountrySelector from "@/components/ui/CountrySelector";
import NotificationPanel from "@/components/ui/NotificationPanel";
import apiClient from "@/services/apiClient";
import { mediaUrl } from "@/utils/mediaUrl";

const NAV_PRODUCTS = [
  {
    label: "For Shippers",
    desc:  "Post loads and get competitive bids",
    tags:  ["Post loads", "Live tracking", "Smart billing"],
    badge: "Most popular",
    to:    "/for-shippers",
    icon:  Package,
  },
  {
    label: "For Fleet Owners",
    desc:  "Dispatch vehicles and earn more per km",
    tags:  ["List trucks", "Accept bids", "Fleet map"],
    to:    "/for-fleet-owners",
    icon:  Truck,
  },
  {
    label: "For Drivers",
    desc:  "Find jobs and get paid fast",
    tags:  ["Browse jobs", "POD capture", "Instant pay"],
    to:    "/for-drivers",
    icon:  Users,
  },
];

const NAV_SOLUTIONS = [
  { group: "Marketplace" },
  { label: "Open Jobs",        desc: "Browse available freight loads",    to: "/jobs",          icon: Package  },
  { label: "Available Trucks", desc: "Find transport capacity near you",  to: "/trucks",        icon: Truck    },
  { group: "Services" },
  { label: "Parcel Delivery",  desc: "Same-day and scheduled parcels",    to: "/for-shippers",  icon: Box      },
  { label: "Moving Services",  desc: "Residential and office relocation", to: "/for-shippers",  icon: MoveRight },
];

const ROLE_SOLUTIONS = {
  shipper: [
    { group: "My Activity" },
    { label: "My Loads",         desc: "Your posted freight loads",        to: "/shipper/loads",               icon: Package  },
    { label: "Available Trucks", desc: "Find transport capacity near you", to: "/trucks",                      icon: Truck    },
    { group: "Services" },
    { label: "Parcel Delivery",  desc: "Same-day and scheduled parcels",   to: "/for-shippers",                icon: Box      },
    { label: "Moving Services",  desc: "Residential and office relocation",to: "/for-shippers",                icon: MoveRight },
  ],
  driver: [
    { group: "My Activity" },
    { label: "Job Feed",         desc: "Browse available freight jobs",    to: "/driver/jobs",                 icon: Package  },
  ],
  owner: [
    { group: "My Activity" },
    { label: "Load Marketplace", desc: "Find loads to bid on",             to: "/owner/marketplace",           icon: Package  },
    { label: "Available Trucks", desc: "All available transport capacity", to: "/trucks",                      icon: Truck    },
  ],
  mover: [
    { group: "My Activity" },
    { label: "Available Jobs",   desc: "Moving jobs near you",             to: "/mover/available-jobs",        icon: Package  },
  ],
  air_freight: [
    { group: "My Activity" },
    { label: "Available Jobs",   desc: "Air freight requests",             to: "/airfreight/available-jobs",   icon: Package  },
  ],
  parcel_carrier: [
    { group: "My Activity" },
    { label: "Available Jobs",   desc: "Parcel delivery requests",         to: "/parcel-carrier/available-jobs", icon: Package },
  ],
};

const NAV_RESOURCES = [
  { group: "Learn" },
  { label: "Help Center",       desc: "Guides, FAQs and documentation",       to: "/help",               icon: FileCheck     },
  { label: "Carrier Agreement", desc: "Terms for fleet owners and drivers",    to: "/carrier-agreement",  icon: ScrollText    },
  { group: "Account" },
  { label: "Contact Sales",     desc: "Talk to our team",                      to: "/help#contact",       icon: MessageSquare },
];

function NavDropdownPanel({ items, onClose, width = "w-72", featured = null, header = null }) {
  return (
    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 ${width} bg-white border border-gray-200 rounded-xl shadow-2xl py-2 z-50`}>

      {/* Optional top header row */}
      {header && (
        <div className="px-4 pt-2 pb-2 flex items-center justify-between border-b border-gray-100 mb-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{header.label}</p>
          {header.badge && (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              {header.badge}
            </span>
          )}
        </div>
      )}

      {items.map((item, i) =>
        item.group ? (
          <div key={item.group + i} className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.group}</p>
          </div>
        ) : (
          <Link key={item.label} to={item.to} onClick={onClose}
            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-orange-100 transition-colors">
              <item.icon className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 font-heading leading-tight">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-bold text-orange-400 border border-orange-400/30 px-1.5 py-0.5 rounded-full leading-none shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
              {item.tags && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.tags.map((t) => (
                    <span key={t} className="text-[9px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-400 mt-1 shrink-0 transition-colors" />
          </Link>
        )
      )}

      {/* Optional featured / CTA card at bottom */}
      {featured && (
        <div className="mx-3 mb-2 mt-1 border-t border-gray-100 pt-2">
          <Link to={featured.to} onClick={onClose}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors group">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-orange-400 leading-tight">{featured.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{featured.desc}</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

// transparent=true: starts clear on hero, turns dark on scroll (landing page)
// transparent=false (default): always dark/opaque (public pages)
export default function MainNav({ transparent = false, hideDemoBtn = false }) {
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(null);
  const [scrolled,       setScrolled]       = useState(!transparent);
  const navRef = useRef(null);
  const user        = useAuthStore((s) => s.user);
  const updateUser  = useAuthStore((s) => s.updateUser);
  const { guestCountry, setGuestCountry } = useUIStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dashboardTo =
    user?.role === "shipper" ? "/shipper" :
    user?.role === "driver"  ? "/driver"  :
    user?.role === "owner"   ? "/owner"   :
    user?.role === "admin"   ? "/admin"   : "/login";

  const showProducts = !user || user.role === "admin";
  const activeSolutions =
    user && user.role !== "admin"
      ? (ROLE_SOLUTIONS[user.role] ?? NAV_SOLUTIONS)
      : NAV_SOLUTIONS;

  const toggleDropdown = (key) => setActiveDropdown((prev) => (prev === key ? null : key));

  const handleCountryChange = useCallback(async (code) => {
    setActiveDropdown(null);
    setGuestCountry(code);
    if (user) {
      updateUser({ country: code });
      try {
        await apiClient.patch("/users/me", { country: code });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["my-wallet"] });
        queryClient.invalidateQueries({ queryKey: ["driver-wallet"] });
        queryClient.invalidateQueries({ queryKey: ["owner-wallet"] });
      } catch {
        updateUser({ country: user.country });
      }
    }
  }, [user, setGuestCountry, updateUser, queryClient]);

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/95 border-b border-gray-200 backdrop-blur-md" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between" ref={navRef}>

        {/* Desktop: logo + country selector grouped left */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link to="/" onClick={() => setMenuOpen(false)}>
            <LogoFull iconSize={54} variant="light" tagline="Move Freight. Build Business." />
          </Link>
          <CountrySelector
            value={user?.country ?? guestCountry}
            onChange={handleCountryChange}
          />
        </div>

        {/* Mobile: logo only */}
        <Link to="/" onClick={() => setMenuOpen(false)} className="md:hidden shrink-0">
          <LogoFull iconSize={36} variant="light" tagline="Move Freight. Build Business." />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Products dropdown — hidden for logged-in non-admin users */}
          {showProducts && (
            <div className="relative">
              <button
                onClick={() => toggleDropdown("products")}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                  activeDropdown === "products" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Products
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === "products" ? "rotate-180 text-orange-400" : ""}`} />
              </button>
              {activeDropdown === "products" && (
                <NavDropdownPanel
                  items={NAV_PRODUCTS}
                  onClose={() => setActiveDropdown(null)}
                  width="w-[420px]"
                  header={{ label: "Choose your role" }}
                />
              )}
            </div>
          )}

          {/* Solutions dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("solutions")}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                activeDropdown === "solutions" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Solutions
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === "solutions" ? "rotate-180 text-orange-400" : ""}`} />
            </button>
            {activeDropdown === "solutions" && (
              <NavDropdownPanel
                items={activeSolutions}
                onClose={() => setActiveDropdown(null)}
                width="w-80"
                header={{ label: "Platform", badge: "Live" }}
              />
            )}
          </div>

          {/* Resources dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("resources")}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                activeDropdown === "resources" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Resources
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === "resources" ? "rotate-180 text-orange-400" : ""}`} />
            </button>
            {activeDropdown === "resources" && (
              <NavDropdownPanel
                items={NAV_RESOURCES}
                onClose={() => setActiveDropdown(null)}
                width="w-80"
                featured={{ title: "Book a demo", desc: "See trakvora in action with our team", to: "/book-demo" }}
              />
            )}
          </div>

          <NavLink to="/company"
            onClick={() => setActiveDropdown(null)}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium transition-colors rounded-lg ${isActive ? "text-orange-500" : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"}`
            }>
            Company
          </NavLink>
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          {user?.role === "admin" ? (
            <>
              <NotificationPanel variant="light" />
              <Link to="/admin"
                className="bg-[#fe6a34] hover:bg-orange-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
                Dashboard
              </Link>
              <button disabled
                className="text-gray-400 text-sm font-medium px-3 py-2 cursor-not-allowed opacity-50">
                Log in
              </button>
              <button disabled
                className="bg-gray-200 text-gray-400 font-semibold px-5 py-2 rounded-lg text-sm cursor-not-allowed opacity-50">
                Book a Demo
              </button>
            </>
          ) : user ? (
            <>
              <NotificationPanel variant="light" />
              <Link to={dashboardTo}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 shrink-0 hover:opacity-90 transition-opacity"
                title={user.full_name}
              >
                {user.profile_photo_url ? (
                  <img src={mediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.full_name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                )}
              </Link>
              <Link to={dashboardTo}
                className="bg-[#fe6a34] hover:bg-orange-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login"
                className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors px-3 py-2">
                Log in
              </Link>
              {!hideDemoBtn && (
                <Link to="/book-demo"
                  className="bg-[#fe6a34] hover:bg-orange-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
                  Book a Demo
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden p-2 text-gray-700 hover:text-gray-900 transition-colors">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white backdrop-blur-md px-4 py-3 space-y-1">
          {/* Menu header with logo */}
          <div className="flex items-center justify-between py-2 mb-2 border-b border-gray-100">
            <Link to="/" onClick={() => setMenuOpen(false)}>
              <LogoFull iconSize={32} variant="light" tagline="Move Freight. Build Business." />
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {[
            ...(showProducts ? [{ key: "products",  label: "Products",  items: NAV_PRODUCTS  }] : []),
            { key: "solutions", label: "Solutions", items: activeSolutions },
            { key: "resources", label: "Resources", items: NAV_RESOURCES },
          ].map(({ key, label, items }) => (
            <div key={key}>
              <button
                onClick={() => setMobileExpanded((p) => (p === key ? null : key))}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {label}
                <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpanded === key ? "rotate-180 text-orange-400" : ""}`} />
              </button>
              {mobileExpanded === key && (
                <div className="ml-3 mt-1 space-y-0.5">
                  {items.filter((it) => !it.group).map((it) => (
                    <Link key={it.to} to={it.to} onClick={() => setMenuOpen(false)}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors group">
                      <it.icon className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-900 font-medium leading-tight">{it.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{it.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <NavLink to="/company" onClick={() => setMenuOpen(false)}
            className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
            Company
          </NavLink>
          <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <CountrySelector
                value={user?.country ?? guestCountry}
                onChange={handleCountryChange}
              />
              <div className="flex items-center gap-2">
                {user && <NotificationPanel variant="light" />}
                {user && (
                  <Link to={dashboardTo} onClick={() => setMenuOpen(false)}
                    className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 shrink-0 hover:opacity-90 transition-opacity"
                    title={user.full_name}
                  >
                    {user.profile_photo_url ? (
                      <img src={mediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                        {user.full_name?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                    )}
                  </Link>
                )}
              </div>
            </div>
            {user?.role === "admin" ? (
              <>
                <Link to="/admin" onClick={() => setMenuOpen(false)}
                  className="bg-[#fe6a34] text-white font-bold py-3 text-sm text-center rounded-lg">
                  Dashboard
                </Link>
                <button disabled
                  className="border border-gray-200 text-gray-400 font-semibold py-3 text-sm text-center rounded-lg cursor-not-allowed opacity-50">
                  Log In
                </button>
                <button disabled
                  className="bg-gray-200 text-gray-400 font-bold py-3 text-sm text-center rounded-lg cursor-not-allowed opacity-50">
                  Book a Demo
                </button>
              </>
            ) : user ? (
              <Link to={dashboardTo} onClick={() => setMenuOpen(false)}
                className="bg-[#fe6a34] text-white font-bold py-3 text-sm text-center rounded-lg">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}
                  className="border border-gray-300 text-gray-900 font-semibold py-3 text-sm text-center rounded-lg hover:bg-gray-50 transition-colors">
                  Log In
                </Link>
                <Link to="/book-demo" onClick={() => setMenuOpen(false)}
                  className="bg-[#fe6a34] text-white font-bold py-3 text-sm text-center rounded-lg">
                  Book a Demo
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
