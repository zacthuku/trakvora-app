import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const DASHBOARD = {
  shipper:        "/shipper",
  driver:         "/driver",
  owner:          "/owner",
  mover:          "/mover",
  air_freight:    "/airfreight",
  parcel_carrier: "/parcel-carrier",
};

/**
 * Smart CTA wrapper for public landing page register buttons.
 * - Guest: renders a Link to `to` with original children
 * - Logged-in non-admin: redirects to their dashboard ("Go to Dashboard")
 * - Admin: disabled button with "Already signed in as admin" caption
 */
export default function RoleCta({ to, children, className }) {
  const user = useAuthStore((s) => s.user);

  if (user?.role === "admin") {
    return (
      <span className="inline-flex flex-col items-center gap-1.5">
        <button
          disabled
          title="You're signed in as an admin account"
          className={`${className} opacity-40 cursor-not-allowed`}
        >
          {children}
        </button>
        <span className="text-[11px] text-gray-500 italic">Already signed in as admin</span>
      </span>
    );
  }

  if (user) {
    return (
      <Link to={DASHBOARD[user.role] ?? "/"} className={className}>
        Go to Dashboard
      </Link>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
