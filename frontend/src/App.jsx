import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/Toast";
import { useUIStore } from "@/store/uiStore";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import apiClient from "@/services/apiClient";
import { COUNTRY_MAP } from "@/utils/countryConfig";
import Spinner from "@/components/ui/Spinner";

// Layout components — kept eager since they're needed immediately on any route
import PublicLayout from "@/components/layout/PublicLayout";
import AuthLayout from "@/components/layout/AuthLayout";
import ShipperLayout from "@/components/layout/ShipperLayout";
import DriverLayout from "@/components/layout/DriverLayout";
import OwnerLayout from "@/components/layout/OwnerLayout";
import AdminLayout from "@/components/layout/AdminLayout";

// Landing / public pages
const LandingPage            = lazy(() => import("@/features/landing/LandingPage"));
const LandingPagePreview     = lazy(() => import("@/features/landing/LandingPagePreview"));
const HelpCenterPage         = lazy(() => import("@/features/landing/pages/HelpCenterPage"));
const TermsPage              = lazy(() => import("@/features/landing/pages/TermsPage"));
const PrivacyPage            = lazy(() => import("@/features/landing/pages/PrivacyPage"));
const CarrierAgreementPage   = lazy(() => import("@/features/landing/pages/CarrierAgreementPage"));
const ForShippersPage        = lazy(() => import("@/features/landing/pages/ForShippersPage"));
const ForFleetOwnersPage     = lazy(() => import("@/features/landing/pages/ForFleetOwnersPage"));
const ForDriversPage         = lazy(() => import("@/features/landing/pages/ForDriversPage"));
const EtimsPage              = lazy(() => import("@/features/landing/pages/EtimsPage"));
const OpenJobsPage           = lazy(() => import("@/features/landing/pages/OpenJobsPage"));
const AvailableTrucksPage    = lazy(() => import("@/features/landing/pages/AvailableTrucksPage"));
const CompanyPage            = lazy(() => import("@/features/landing/pages/CompanyPage"));
const FeedbackPage           = lazy(() => import("@/features/landing/pages/FeedbackPage"));
const ForDevelopersPage      = lazy(() => import("@/features/landing/pages/ForDevelopersPage"));
const BookDemoPage           = lazy(() => import("@/features/landing/pages/BookDemoPage"));

// Auth pages
const LoginPage              = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage           = lazy(() => import("@/features/auth/pages/RegisterPage"));
const InviteRegisterPage     = lazy(() => import("@/features/auth/pages/InviteRegisterPage"));
const ForgotPasswordPage     = lazy(() => import("@/features/auth/pages/ForgotPasswordPage"));
const ResetPasswordPage      = lazy(() => import("@/features/auth/pages/ResetPasswordPage"));

// Role home pages
const ShipperHomePage        = lazy(() => import("@/features/shipper/pages/ShipperHomePage"));
const DriverHomePage         = lazy(() => import("@/features/driver/pages/DriverHomePage"));
const OwnerHomePage          = lazy(() => import("@/features/owner/pages/OwnerHomePage"));
const AdminHomePage          = lazy(() => import("@/features/admin/pages/AdminHomePage"));

// Shipper pages
const ShipperDashboard       = lazy(() => import("@/features/shipper/pages/ShipperDashboard"));
const ShipperLoadTrackingPage = lazy(() => import("@/features/shipper/pages/ShipperLoadTrackingPage"));
const ShipperTrackingPage    = lazy(() => import("@/features/shipper/pages/ShipperTrackingPage"));
const ShipperSupportPage     = lazy(() => import("@/features/shipper/pages/ShipperSupportPage"));
const ShipperSettingsPage    = lazy(() => import("@/features/shipper/pages/ShipperSettingsPage"));
const PostLoadPage           = lazy(() => import("@/features/shipper/pages/PostLoadPage"));
const ActiveShipmentsPage    = lazy(() => import("@/features/shipper/pages/ActiveShipmentsPage"));
const BidComparisonPage      = lazy(() => import("@/features/shipper/pages/BidComparisonPage"));
const ShipmentHistoryPage    = lazy(() => import("@/features/shipper/pages/ShipmentHistoryPage"));
const ParcelBookingPage      = lazy(() => import("@/features/shipper/pages/ParcelBookingPage"));
const MoverBookingPage       = lazy(() => import("@/features/shipper/pages/MoverBookingPage"));
const AirfreightPage         = lazy(() => import("@/features/shipper/pages/AirfreightPage"));
const ScheduledReportsPage   = lazy(() => import("@/features/shipper/pages/ScheduledReportsPage"));
const BulkUploadPage         = lazy(() => import("@/features/shipper/pages/BulkUploadPage"));

// Driver pages
const DriverDashboard        = lazy(() => import("@/features/driver/pages/DriverDashboard"));
const JobFeedPage            = lazy(() => import("@/features/driver/pages/JobFeedPage"));
const ActiveJobPage          = lazy(() => import("@/features/driver/pages/ActiveJobPage"));
const EarningsWalletPage     = lazy(() => import("@/features/driver/pages/EarningsWalletPage"));
const DriverSettingsPage     = lazy(() => import("@/features/driver/pages/DriverSettingsPage"));
const DriverSupportPage      = lazy(() => import("@/features/driver/pages/DriverSupportPage"));
const DriverProfilePage      = lazy(() => import("@/features/driver/pages/DriverProfilePage"));
const DriverPublicProfilePage = lazy(() => import("@/features/driver/pages/DriverPublicProfilePage"));
const DriverPerformancePage  = lazy(() => import("@/features/driver/pages/DriverPerformancePage"));

// Load marketplace
const LoadMarketplacePage    = lazy(() => import("@/features/loads/pages/LoadMarketplacePage"));
const LoadDetailPage         = lazy(() => import("@/features/loads/pages/LoadDetailPage"));

// Owner pages
const OwnerDashboard         = lazy(() => import("@/features/owner/pages/OwnerDashboard"));
const FleetManagementPage    = lazy(() => import("@/features/owner/pages/FleetManagementPage"));
const OwnerFleetMapPage      = lazy(() => import("@/features/owner/pages/OwnerFleetMapPage"));
const OwnerActiveLoadsPage   = lazy(() => import("@/features/owner/pages/OwnerActiveLoadsPage"));
const DocumentsPage          = lazy(() => import("@/features/owner/pages/DocumentsPage"));
const OwnerSupportPage       = lazy(() => import("@/features/owner/pages/SupportPage"));
const OwnerSettingsPage      = lazy(() => import("@/features/owner/pages/SettingsPage"));
const OwnerDriversPage       = lazy(() => import("@/features/owner/pages/OwnerDriversPage"));
const OwnerMyBidsPage        = lazy(() => import("@/features/owner/pages/OwnerMyBidsPage"));
const OwnerTrackingPage      = lazy(() => import("@/features/owner/pages/OwnerTrackingPage"));
const ReturnWindowPage       = lazy(() => import("@/features/owner/pages/ReturnWindowPage"));
const CommissionsDashboard   = lazy(() => import("@/features/owner/pages/CommissionsDashboard"));

// Shared / cross-role pages
const InboxPage              = lazy(() => import("@/features/shared/pages/InboxPage"));
const TrackingPage           = lazy(() => import("@/features/tracking/pages/TrackingPage"));
const WalletPage             = lazy(() => import("@/features/payments/pages/WalletPage"));
const EtimsReceiptsPage      = lazy(() => import("@/features/payments/pages/EtimsReceiptsPage"));
const SubscriptionPage       = lazy(() => import("@/features/subscriptions/pages/SubscriptionPage"));
const CompanySettingsPage    = lazy(() => import("@/features/companies/pages/CompanySettingsPage"));
const TeamManagementPage     = lazy(() => import("@/features/companies/pages/TeamManagementPage"));
const BusinessAnalyticsPage  = lazy(() => import("@/features/companies/pages/BusinessAnalyticsPage"));

// Admin pages
const AdminDashboard         = lazy(() => import("@/features/admin/pages/AdminDashboard"));
const AdminUsersPage         = lazy(() => import("@/features/admin/pages/AdminUsersPage"));
const AdminDriversPage       = lazy(() => import("@/features/admin/pages/AdminDriversPage"));
const AdminKycPage           = lazy(() => import("@/features/admin/pages/AdminKycPage"));
const AdminLoadsPage         = lazy(() => import("@/features/admin/pages/AdminLoadsPage"));
const AdminShipmentsPage     = lazy(() => import("@/features/admin/pages/AdminShipmentsPage"));
const AdminLateDeliveriesPage = lazy(() => import("@/features/admin/pages/AdminLateDeliveriesPage"));
const AdminTrucksPage        = lazy(() => import("@/features/admin/pages/AdminTrucksPage"));
const FieldOpsTasksPage      = lazy(() => import("@/features/admin/pages/FieldOpsTasksPage"));
const FieldOpsTaskDetail     = lazy(() => import("@/features/admin/pages/FieldOpsTaskDetail"));
const FieldInspectorDashboard = lazy(() => import("@/features/admin/pages/FieldInspectorDashboard"));
const IoTDashboard           = lazy(() => import("@/features/admin/pages/IoTDashboard"));
const DeviceInventoryPage    = lazy(() => import("@/features/admin/pages/DeviceInventoryPage"));
const DeviceDetailPage       = lazy(() => import("@/features/admin/pages/DeviceDetailPage"));
const IoTAlertsPage          = lazy(() => import("@/features/admin/pages/IoTAlertsPage"));
const IoTTasksPage           = lazy(() => import("@/features/admin/pages/IoTTasksPage"));
const FieldOpsDeviceSetup    = lazy(() => import("@/features/admin/pages/FieldOpsDeviceSetup"));
const ComplianceDashboard    = lazy(() => import("@/features/admin/pages/ComplianceDashboard"));
const ComplianceReviewPage   = lazy(() => import("@/features/admin/pages/ComplianceReviewPage"));
const WorkforcePage          = lazy(() => import("@/features/admin/pages/WorkforcePage"));
const WorkforceAssignPage    = lazy(() => import("@/features/admin/pages/WorkforceAssignPage"));
const AdminFleetMapPage      = lazy(() => import("@/features/admin/pages/AdminFleetMapPage"));
const AdminAdminsPage        = lazy(() => import("@/features/admin/pages/AdminAdminsPage"));
const AdminSettingsPage      = lazy(() => import("@/features/admin/pages/AdminSettingsPage"));
const SupportAgentDashboard  = lazy(() => import("@/features/admin/pages/SupportAgentDashboard"));
const AdminLiveChatPage      = lazy(() => import("@/features/admin/pages/AdminLiveChatPage"));
const AdminTicketsPage       = lazy(() => import("@/features/admin/pages/AdminTicketsPage"));
const AdminFeedbackPage      = lazy(() => import("@/features/admin/pages/AdminFeedbackPage"));
const AdminParcelsPage       = lazy(() => import("@/features/admin/pages/AdminParcelsPage"));
const AdminMoversPage        = lazy(() => import("@/features/admin/pages/AdminMoversPage"));
const AdminAirfreightPage    = lazy(() => import("@/features/admin/pages/AdminAirfreightPage"));
const OperationsAdminDashboard = lazy(() => import("@/features/admin/pages/OperationsAdminDashboard"));
const FinanceAdminDashboard  = lazy(() => import("@/features/admin/pages/FinanceAdminDashboard"));
const AdminActivityLogPage   = lazy(() => import("@/features/admin/pages/AdminActivityLogPage"));
const AdminProvidersPage     = lazy(() => import("@/features/admin/pages/AdminProvidersPage"));
const AdminPricingPage       = lazy(() => import("@/features/admin/pages/AdminPricingPage"));
const AdminHeroPage          = lazy(() => import("@/features/admin/pages/AdminHeroPage"));
const AdminPaymentMethodsPage = lazy(() => import("@/features/admin/pages/AdminPaymentMethodsPage"));
const AdminEtimsPage         = lazy(() => import("@/features/admin/pages/AdminEtimsPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}

function RoleGuard({ allowedRoles, children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AuthGuard({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function CapabilityDenied({ message }) {
  useEffect(() => {
    toast(message || "This feature is not available on your current plan.", "warning");
  }, []);
  return <Navigate to="/" replace />;
}

function CapabilityGuard({ capabilityKey, children, message }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user[capabilityKey]) return <CapabilityDenied message={message} />;
  return children;
}

function RoleRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <LandingPage />;
  const roleHome = {
    shipper:        "/shipper/home",
    driver:         "/driver/home",
    owner:          "/owner/home",
    admin:          "/admin/home",
    mover:          "/mover",
    air_freight:    "/airfreight",
    parcel_carrier: "/parcel-carrier",
  };
  return <Navigate to={roleHome[user.role] ?? "/login"} replace />;
}

function SessionManager({ children }) {
  useSessionTimeout();
  return children;
}

function FCMRegistrar() {
  const user = useAuthStore((s) => s.user);
  const fcmToken = useAuthStore((s) => s.fcmToken);
  const setFcmToken = useAuthStore((s) => s.setFcmToken);

  useEffect(() => {
    if (!user) return;
    // Lazy-import so Firebase SDK is only loaded when user is logged in
    import("@/services/firebaseService").then(({ initFCM }) => {
      initFCM((payload) => {
        const { title, body } = payload?.notification || {};
        if (title) console.info("[FCM foreground]", title, body);
      }).then((token) => {
        if (token && token !== fcmToken) {
          setFcmToken(token);
          apiClient.patch("/users/me/fcm-token", { fcm_token: token }).catch(() => {});
        }
      });
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function CountryDetector() {
  const user         = useAuthStore((s) => s.user);
  const guestCountry = useUIStore((s) => s.guestCountry);
  const setGuestCountry = useUIStore((s) => s.setGuestCountry);

  useEffect(() => {
    if (user) return;
    if (guestCountry !== "KE") return;
    if (sessionStorage.getItem("trakvora-country-init")) return;
    sessionStorage.setItem("trakvora-country-init", "1");

    const OPERATING = new Set(["KE", "UG", "TZ"]);

    const lang   = navigator.language || (navigator.languages ?? [])[0] || "";
    const region = lang.split("-")[1]?.toUpperCase();
    if (region && OPERATING.has(region)) {
      setGuestCountry(region);
      return;
    }

    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then(({ country_code }) => {
        if (country_code && OPERATING.has(country_code)) setGuestCountry(country_code);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AdminIndexPage() {
  const { user } = useAuthStore();
  if (user?.admin_role === "finance_admin") return <Navigate to="/admin/finance" replace />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <SessionManager>
      <FCMRegistrar />
      <CountryDetector />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/book-demo" element={<BookDemoPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/register/invite/:token" element={<InviteRegisterPage />} />

          <Route element={<PublicLayout />}>
            <Route path="/how-it-works"      element={<Navigate to="/for-shippers" replace />} />
            <Route path="/help"              element={<HelpCenterPage />} />
            <Route path="/company"           element={<CompanyPage />} />
            <Route path="/terms"             element={<TermsPage />} />
            <Route path="/privacy"           element={<PrivacyPage />} />
            <Route path="/carrier-agreement" element={<CarrierAgreementPage />} />
            <Route path="/for-shippers"      element={<ForShippersPage />} />
            <Route path="/for-fleet-owners"  element={<ForFleetOwnersPage />} />
            <Route path="/for-drivers"       element={<ForDriversPage />} />
            <Route path="/etims"             element={<RoleGuard allowedRoles={["admin"]}><EtimsPage /></RoleGuard>} />
            <Route path="/jobs"              element={<OpenJobsPage />} />
            <Route path="/trucks"            element={<AvailableTrucksPage />} />
            <Route path="/feedback"          element={<FeedbackPage />} />
            <Route path="/for-developers"    element={<ForDevelopersPage />} />
            <Route path="/landing-preview"   element={<LandingPagePreview />} />
            <Route path="/shipper/home" element={<RoleGuard allowedRoles={["shipper"]}><ShipperHomePage /></RoleGuard>} />
            <Route path="/owner/home"   element={<RoleGuard allowedRoles={["owner","owner_user"]}><OwnerHomePage /></RoleGuard>} />
            <Route path="/driver/home"  element={<RoleGuard allowedRoles={["driver"]}><DriverHomePage /></RoleGuard>} />
            <Route path="/admin/home"   element={<RoleGuard allowedRoles={["admin"]}><AdminHomePage /></RoleGuard>} />
          </Route>

          <Route
            path="/shipper"
            element={
              <RoleGuard allowedRoles={["shipper"]}>
                <ShipperLayout />
              </RoleGuard>
            }
          >
            <Route index element={<ShipperDashboard />} />
            <Route path="post-load" element={<PostLoadPage />} />
            <Route path="shipments" element={<ActiveShipmentsPage />} />
            <Route path="bids/:loadId" element={<BidComparisonPage />} />
            <Route path="tracking" element={<ShipperTrackingPage />} />
            <Route path="history" element={<ShipmentHistoryPage />} />
            <Route path="track/:loadId" element={<ShipperLoadTrackingPage />} />
            <Route path="support" element={<ShipperSupportPage />} />
            <Route path="settings" element={<ShipperSettingsPage />} />
            <Route path="wallet" element={<CapabilityGuard capabilityKey="can_use_escrow"><WalletPage /></CapabilityGuard>} />
            <Route path="receipts" element={<EtimsReceiptsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="parcel" element={<ParcelBookingPage />} />
            <Route path="movers" element={<MoverBookingPage />} />
            <Route path="airfreight" element={<AirfreightPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="company" element={<CompanySettingsPage />} />
            <Route path="company/team" element={<TeamManagementPage />} />
            <Route path="company/analytics" element={<BusinessAnalyticsPage />} />
            <Route path="reports" element={<ScheduledReportsPage />} />
            <Route path="bulk-upload" element={<BulkUploadPage />} />
            <Route path="fleet" element={<CapabilityGuard capabilityKey="can_carry"><FleetManagementPage /></CapabilityGuard>} />
            <Route path="carrier-marketplace" element={<CapabilityGuard capabilityKey="can_carry"><LoadMarketplacePage /></CapabilityGuard>} />
            <Route path="carrier-marketplace/:loadId" element={<CapabilityGuard capabilityKey="can_carry"><LoadDetailPage /></CapabilityGuard>} />
            <Route path="carrier-bids" element={<CapabilityGuard capabilityKey="can_carry"><OwnerMyBidsPage /></CapabilityGuard>} />
          </Route>

          <Route
            path="/driver"
            element={
              <RoleGuard allowedRoles={["driver"]}>
                <DriverLayout />
              </RoleGuard>
            }
          >
            <Route index element={<DriverDashboard />} />
            <Route path="jobs" element={<JobFeedPage />} />
            <Route path="active" element={<ActiveJobPage />} />
            <Route path="earnings" element={<CommissionsDashboard />} />
            <Route path="support" element={<DriverSupportPage />} />
            <Route path="settings" element={<DriverSettingsPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
            <Route path="performance" element={<DriverPerformancePage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="loads/:loadId" element={<LoadDetailPage />} />
          </Route>

          <Route
            path="/owner"
            element={
              <RoleGuard allowedRoles={["owner", "owner_user"]}>
                <OwnerLayout />
              </RoleGuard>
            }
          >
            <Route index element={<OwnerDashboard />} />
            <Route path="fleet" element={<FleetManagementPage />} />
            <Route path="fleet-map" element={<OwnerFleetMapPage />} />
            <Route path="drivers" element={<OwnerDriversPage />} />
            <Route path="drivers/:driverId/performance" element={<DriverPerformancePage />} />
            <Route path="loads" element={<OwnerActiveLoadsPage />} />
            <Route path="loads/:loadId" element={<LoadDetailPage />} />
            <Route path="marketplace" element={<LoadMarketplacePage />} />
            <Route path="marketplace/:loadId" element={<LoadDetailPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="support" element={<OwnerSupportPage />} />
            <Route path="settings" element={<OwnerSettingsPage />} />
            <Route path="wallet" element={<Navigate to="/owner/commissions" replace />} />
            <Route path="receipts" element={<EtimsReceiptsPage />} />
            <Route path="commissions" element={<CommissionsDashboard />} />
            <Route path="bids" element={<OwnerMyBidsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="track/:loadId" element={<OwnerTrackingPage />} />
            <Route path="return-windows" element={<ReturnWindowPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="company" element={<CompanySettingsPage />} />
            <Route path="company/team" element={<TeamManagementPage />} />
            <Route path="company/analytics" element={<BusinessAnalyticsPage />} />
            <Route path="reports" element={<ScheduledReportsPage />} />
            <Route path="post-load" element={<CapabilityGuard capabilityKey="can_ship"><PostLoadPage /></CapabilityGuard>} />
            <Route path="posted-loads" element={<CapabilityGuard capabilityKey="can_ship"><ActiveShipmentsPage /></CapabilityGuard>} />
          </Route>

          <Route
            path="/admin"
            element={
              <RoleGuard allowedRoles={["admin"]}>
                <AdminLayout />
              </RoleGuard>
            }
          >
            <Route index element={<AdminIndexPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="drivers" element={<AdminDriversPage />} />
            <Route path="kyc" element={<AdminKycPage />} />
            <Route path="loads" element={<AdminLoadsPage />} />
            <Route path="shipments" element={<AdminShipmentsPage />} />
            <Route path="late-deliveries" element={<AdminLateDeliveriesPage />} />
            <Route path="parcels" element={<AdminParcelsPage />} />
            <Route path="movers" element={<AdminMoversPage />} />
            <Route path="airfreight" element={<AdminAirfreightPage />} />
            <Route path="wallets" element={<Navigate to="/admin/finance" replace />} />
            <Route path="trucks" element={<AdminTrucksPage />} />
            <Route path="field-ops/tasks" element={<FieldOpsTasksPage />} />
            <Route path="field-ops/tasks/:taskId" element={<FieldOpsTaskDetail />} />
            <Route path="field-ops/device-setup" element={<FieldOpsDeviceSetup />} />
            <Route path="compliance" element={<ComplianceDashboard />} />
            <Route path="compliance/:id" element={<ComplianceReviewPage />} />
            <Route path="workforce" element={<WorkforcePage />} />
            <Route path="workforce/assign" element={<WorkforceAssignPage />} />
            <Route path="fleet-map" element={<AdminFleetMapPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="field-inspector" element={<FieldInspectorDashboard />} />
            <Route path="support" element={<SupportAgentDashboard />} />
            <Route path="support/chat" element={<AdminLiveChatPage />} />
            <Route path="support/tickets" element={<AdminTicketsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="ops" element={<OperationsAdminDashboard />} />
            <Route path="finance" element={<FinanceAdminDashboard />} />
            <Route path="iot" element={<IoTDashboard />} />
            <Route path="iot/devices" element={<DeviceInventoryPage />} />
            <Route path="iot/devices/:deviceId" element={<DeviceDetailPage />} />
            <Route path="iot/alerts" element={<IoTAlertsPage />} />
            <Route path="iot/tasks" element={<IoTTasksPage />} />
            <Route path="etims" element={<AdminEtimsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="activity-log" element={<AdminActivityLogPage />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="pricing" element={<AdminPricingPage />} />
            <Route path="payment-methods" element={<AdminPaymentMethodsPage />} />
            <Route path="hero-slides" element={<AdminHeroPage />} />
          </Route>

          <Route
            path="/driver-profile/:userId"
            element={
              <AuthGuard>
                <DriverPublicProfilePage />
              </AuthGuard>
            }
          />

          <Route path="/track/:shipmentId" element={<TrackingPage />} />

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SessionManager>
  );
}
