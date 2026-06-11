import { Link } from "react-router-dom";
import { LogoFull } from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";

const ROLE_PAGE = {
  shipper:    "/for-shippers",
  driver:     "/for-drivers",
  owner:      "/for-fleet-owners",
  owner_user: "/for-fleet-owners",
};

function getPlatformLinks(user) {
  if (!user || user.role === "admin") {
    return [
      { label: "For Shippers",     to: "/for-shippers"     },
      { label: "For Fleet Owners", to: "/for-fleet-owners" },
      { label: "For Drivers",      to: "/for-drivers"      },
      { label: "Available Trucks", to: "/trucks"           },
      { label: "Open Jobs",        to: "/jobs"             },
    ];
  }
  return [
    { label: "How It Works",     to: ROLE_PAGE[user.role] ?? "/for-shippers" },
    { label: "Available Trucks", to: "/trucks" },
    { label: "Open Jobs",        to: "/jobs"   },
  ];
}

const FOOTER_COMPANY = [
  { label: "About trakvora",    to: "/company"          },
  { label: "Share Feedback",    to: "/feedback"         },
  { label: "Contact Us",        to: "/help#contact"     },
];

const FOOTER_DEVELOPERS = [
  { label: "API Reference",     to: "/for-developers#api"          },
  { label: "Webhooks",          to: "/for-developers#webhooks"     },
  { label: "Integration Guide", to: "/for-developers#integrations" },
  { label: "Tracking API",      to: "/for-developers#tracking"     },
];

const FOOTER_LEGAL = [
  { label: "Terms of Service",  to: "/terms"             },
  { label: "Privacy Policy",    to: "/privacy"           },
  { label: "Carrier Agreement", to: "/carrier-agreement" },
  { label: "Cookie Policy",     to: "/privacy#cookies"   },
];

export default function Footer() {
  const user = useAuthStore((s) => s.user);
  const platformLinks = getPlatformLinks(user);
  const cta =
    !user                     ? { label: "Start for Free",      to: "/register" }
    : user.role === "shipper" ? { label: "Ship Your Cargo Now", to: "/shipper"  }
    : user.role === "driver"  ? { label: "Find Your Next Load", to: "/driver"   }
    : user.role === "owner"   ? { label: "Grow Your Fleet",     to: "/owner"    }
    :                           { label: "Go to Admin Panel",   to: "/admin"    };

  return (
    <footer className="bg-primary text-white">
      {/* CTA band */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="text-center md:text-left">
            <p className="font-heading text-lg sm:text-xl font-bold text-white">Ready to move freight smarter?</p>
            <p className="text-slate-400 text-sm mt-1">Join thousands of shippers, drivers, and owners on trakvora.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 shrink-0">
            <Link to={cta.to}
              className="bg-secondary text-white px-6 py-2.5 rounded-xl font-heading font-semibold text-sm hover:opacity-90 transition-opacity">
              {cta.label}
            </Link>
            <Link to={ROLE_PAGE[user?.role] ?? "/for-shippers"}
              className="border border-white/20 text-white px-6 py-2.5 rounded-xl font-heading font-semibold text-sm hover:bg-white/10 transition-colors">
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8">
        {/* Brand — full width on mobile */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/"><LogoFull iconSize={36} variant="dark" /></Link>
          <p className="text-slate-400 text-xs mt-3 leading-relaxed">
            Africa's freight exchange. Nairobi · Mombasa · Kampala · Dar es Salaam.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {["NBO", "MSA", "KLA", "DAR"].map((city) => (
              <span key={city} className="text-[10px] font-bold font-heading text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                {city}
              </span>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div>
          <p className="text-xs font-bold font-heading text-white uppercase tracking-widest mb-3">Platform</p>
          <ul className="space-y-2">
            {platformLinks.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <p className="text-xs font-bold font-heading text-white uppercase tracking-widest mb-3">Company</p>
          <ul className="space-y-2">
            {FOOTER_COMPANY.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Developers */}
        <div>
          <p className="text-xs font-bold font-heading text-white uppercase tracking-widest mb-3">Developers</p>
          <ul className="space-y-2">
            {FOOTER_DEVELOPERS.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <p className="text-xs font-bold font-heading text-white uppercase tracking-widest mb-3">Legal</p>
          <ul className="space-y-2">
            {FOOTER_LEGAL.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-xs text-slate-500">© 2026 Intellora Solutions Limited. All rights reserved.</p>
          <p className="text-xs text-slate-600">Governed by the laws of Kenya · Nairobi, Kenya</p>
        </div>
      </div>
    </footer>
  );
}
