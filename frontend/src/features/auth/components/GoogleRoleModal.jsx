import { useState } from "react";
import { Link } from "react-router-dom";
import { Package2, Truck, UserCircle2, CheckCircle, X } from "lucide-react";

const ROLES = [
  { value: "shipper", label: "Shipper",     desc: "Post loads and manage freight.", icon: Package2    },
  { value: "owner",   label: "Fleet Owner", desc: "Dispatch trucks and monitor drivers.", icon: Truck       },
  { value: "driver",  label: "Driver",      desc: "Accept loads and update status.", icon: UserCircle2 },
];

export default function GoogleRoleModal({ userInfo, onConfirm, onClose, loading }) {
  const [role, setRole] = useState("shipper");
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Google user info */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100 dark:border-slate-700">
          {userInfo.profile_photo_url ? (
            <img
              src={userInfo.profile_photo_url}
              alt={userInfo.full_name}
              className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-600"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <span className="text-secondary font-bold font-heading text-lg">
                {userInfo.full_name?.charAt(0) || "?"}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900 dark:text-white font-heading">{userInfo.full_name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{userInfo.email}</p>
          </div>
        </div>

        <h3 className="font-heading font-semibold text-slate-900 dark:text-white mb-1">Choose your role</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This configures your trakvora dashboard.</p>

        <div className="flex flex-col gap-2 mb-6">
          {ROLES.map(({ value, label, desc, icon: Icon }) => {
            const active = role === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  active
                    ? "border-secondary bg-orange-50 dark:bg-orange-900/20"
                    : "border-slate-200 dark:border-slate-600 hover:border-secondary/40 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? "text-secondary" : "text-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold font-heading ${active ? "text-primary dark:text-white" : "text-slate-700 dark:text-slate-200"}`}>
                    {label}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                </div>
                {active && <CheckCircle className="w-4 h-4 text-secondary shrink-0" />}
              </button>
            );
          })}
        </div>

        <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none mb-4">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-secondary shrink-0"
          />
          <span className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
            I have read and agree to the{" "}
            <Link to="/terms" className="text-secondary underline hover:opacity-80">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-secondary underline hover:opacity-80">
              Privacy Policy
            </Link>
            . I acknowledge that Trakvora is a logistics marketplace and does not hold or process shipper-to-carrier payments.
          </span>
        </label>

        <button
          onClick={() => onConfirm(role, termsAccepted)}
          disabled={loading || !termsAccepted}
          className="w-full bg-secondary text-white font-semibold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
