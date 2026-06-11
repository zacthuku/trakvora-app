import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Star, MapPin, Truck, ShieldCheck, Briefcase,
  Clock, CheckCircle2, WifiOff, FileText, User, Phone, Mail,
} from "lucide-react";
import { driverApi } from "@/features/driver/api/driverApi";
import { PageSpinner } from "@/components/ui/Spinner";
import { getCountryConfig } from "@/utils/countryConfig";

const STATUS_CONFIG = {
  available: { label: "Available",  dot: "bg-emerald-400", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_job:    { label: "On Job",     dot: "bg-sky-400 animate-pulse", pill: "bg-sky-50 text-sky-700 border-sky-200"   },
  offline:   { label: "Offline",    dot: "bg-slate-400", pill: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600" },
};

const TRUCK_TYPE_COLORS = {
  flatbed: "bg-sky-50 text-sky-700 border-sky-200",
  dry_van: "bg-violet-50 text-violet-700 border-violet-200",
  reefer:  "bg-teal-50 text-teal-700 border-teal-200",
  tanker:  "bg-blue-50 text-blue-700 border-blue-200",
  lowbed:  "bg-amber-50 text-amber-700 border-amber-200",
  tipper:  "bg-orange-50 text-orange-700 border-orange-200",
};

function InfoChip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <Icon className="w-4 h-4 text-secondary" />
        <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function DriverPublicProfilePage() {
  const { userId } = useParams();

  const { data: driver, isLoading, isError } = useQuery({
    queryKey: ["driver-public", userId],
    queryFn: () => driverApi.getDriverByUserId(userId),
    enabled: Boolean(userId),
  });

  const { data: truck } = useQuery({
    queryKey: ["driver-truck-public", driver?.id],
    queryFn: () => driverApi.getDriverById(driver.id).then(() =>
      // We don't have a direct trucks-by-driver-id endpoint; show owned truck info from profile
      null
    ),
    enabled: false, // trucks shown via driver profile data
  });

  const cfg = getCountryConfig(driver?.country ?? "KE");

  if (isLoading) return <PageSpinner />;

  if (isError || !driver) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-heading font-bold text-slate-700 dark:text-slate-200 mb-2">Driver Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">This driver profile doesn't exist or isn't publicly visible.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-secondary font-semibold text-sm hover:underline">
          <ArrowLeft className="w-4 h-4" /> Go back
        </Link>
      </div>
    );
  }

  const statusCfg  = STATUS_CONFIG[driver.availability_status] || STATUS_CONFIG.offline;
  const initials   = (driver.full_name || "D").split(" ").map((n) => n[0]).slice(0, 2).join("");
  const rating     = driver.rating || 0;
  const fullStars  = Math.floor(rating);
  const hasHalf    = rating - fullStars >= 0.5;

  const toArray = (v) =>
    Array.isArray(v) ? v
    : typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const preferredRoutes     = toArray(driver.preferred_routes);
  const preferredTruckTypes = toArray(driver.preferred_truck_types);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Back */}
      <div className="mb-5">
        <button onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Profile header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center border-2 border-secondary/30 shrink-0">
            <span className="text-2xl font-black text-secondary font-heading">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-heading font-bold text-slate-900 dark:text-white">
                  {driver.full_name || "Driver"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{driver.email}</p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${statusCfg.pill}`}>
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </div>
                {driver.seeking_employment && !driver.employer_id && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                    Open to Work
                  </span>
                )}
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center flex-wrap gap-2 mt-3">
              {driver.ntsa_verified && (
                <InfoChip className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <ShieldCheck className="w-3 h-3 mr-1" /> {cfg.transportAuthority} Verified
                </InfoChip>
              )}
              {driver.licence_class && (
                <InfoChip className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                  Class {driver.licence_class} Licence
                </InfoChip>
              )}
              {driver.experience_years != null && driver.experience_years > 0 && (
                <InfoChip className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                  {driver.experience_years}y experience
                </InfoChip>
              )}
            </div>

            {/* Rating + trips */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i <= fullStars
                        ? "text-amber-400 fill-amber-400"
                        : i === fullStars + 1 && hasHalf
                        ? "text-amber-400 fill-amber-200"
                        : "text-slate-200 fill-slate-200"
                    }`}
                  />
                ))}
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">
                  {rating > 0 ? rating.toFixed(1) : "No ratings"}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {driver.total_trips || 0} trips completed
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Availability */}
        <SectionCard title="Availability" icon={Clock}>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${statusCfg.pill}`}>
                <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </div>
            </div>

            {driver.availability_location && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Location</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                  {driver.availability_location}
                </p>
              </div>
            )}

            {driver.available_from && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Available From</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {new Date(driver.available_from).toLocaleDateString(cfg.locale, {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            )}

            {preferredRoutes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preferred Routes</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferredRoutes.map((r) => (
                    <InfoChip key={r} className="bg-primary/10 text-primary border-primary/20">{r}</InfoChip>
                  ))}
                </div>
              </div>
            )}

            {preferredTruckTypes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preferred Truck Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferredTruckTypes.map((t) => (
                    <InfoChip
                      key={t}
                      className={TRUCK_TYPE_COLORS[t] || "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"}
                    >
                      {t.replace("_", " ")}
                    </InfoChip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Professional */}
        <SectionCard title="Professional Profile" icon={Briefcase}>
          <div className="space-y-3">
            {driver.bio && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">About</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{driver.bio}</p>
              </div>
            )}

            {driver.licence_class && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Licence Class</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Class {driver.licence_class}</p>
              </div>
            )}

            {driver.licence_expiry && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Licence Expires</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {new Date(driver.licence_expiry).toLocaleDateString(cfg.locale, {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            )}

            {!driver.bio && !driver.licence_class && (
              <p className="text-sm text-slate-400 italic">Profile details not provided</p>
            )}
          </div>
        </SectionCard>

        {/* Verification */}
        <SectionCard title={`${cfg.transportAuthority} Verification`} icon={ShieldCheck}>
          <div className="space-y-2.5">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${driver.ntsa_verified ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"}`}>
              {driver.ntsa_verified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-700">All documents verified by {cfg.transportAuthority}</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Verification pending</span>
                </>
              )}
            </div>

            {[
              { key: "psv_badge_url",       label: "PSV Badge"           },
              { key: "police_clearance_url", label: "Police Clearance"    },
              { key: "good_conduct_url",     label: "Good Conduct Cert"   },
              { key: "medical_cert_url",     label: "Medical Certificate" },
            ].map(({ key, label }) => {
              const hasDoc = Boolean(driver[key]);
              return (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-slate-400" />
                    {label}
                  </span>
                  {hasDoc ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Truck info */}
        {(driver.current_truck_id || driver.employer_id) && (
          <SectionCard title="Current Assignment" icon={Truck}>
            <div className="space-y-3">
              {driver.employer_id && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Fleet Owner</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">Contracted to a fleet owner</p>
                </div>
              )}
              {driver.current_truck_id && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned Truck</p>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                    <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Truck assigned</span>
                    <span className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      driver.availability_status === "on_job"
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        driver.availability_status === "on_job" ? "bg-sky-400 animate-pulse" : "bg-emerald-400"
                      }`} />
                      {driver.availability_status === "on_job" ? "On Job" : "Available"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* If seeking employment — CTA */}
      {driver.seeking_employment && !driver.employer_id && (
        <div className="mt-5 bg-gradient-to-r from-secondary/10 to-amber-50 border border-secondary/20 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base">
                {driver.full_name?.split(" ")[0]} is open to employment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                This driver is actively looking for fleet employment or owner-operators to work with.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
