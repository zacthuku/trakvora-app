import apiClient from "@/services/apiClient";

export const adminApi = {
  getDashboard: () => apiClient.get("/admin/dashboard").then((r) => r.data),

  // Users
  getUsers: (params) => apiClient.get("/admin/users", { params }).then((r) => r.data),
  suspendUser: (id) => apiClient.patch(`/admin/users/${id}/suspend`).then((r) => r.data),
  verifyUser: (id) => apiClient.patch(`/admin/users/${id}/verify`).then((r) => r.data),
  reviewKYC: (id, approved, reason = null) =>
    apiClient.patch(`/admin/users/${id}/kyc-review`, { approved, reason }).then((r) => r.data),
  updateCapabilities: (id, payload) =>
    apiClient.patch(`/admin/users/${id}/capabilities`, payload).then((r) => r.data),
  toggleEscrowAccess: (id) =>
    apiClient.patch(`/admin/users/${id}/can-use-escrow`).then((r) => r.data),

  // Drivers
  getDrivers: (params) => apiClient.get("/admin/drivers", { params }).then((r) => r.data),
  getDriver: (id) => apiClient.get(`/admin/drivers/${id}`).then((r) => r.data),
  updateDriverVerification: (id, status, notes = null) =>
    apiClient.patch(`/admin/drivers/${id}/verification`, { status, notes }).then((r) => r.data),
  retriggerDriverCheck: (id) =>
    apiClient.post(`/admin/drivers/${id}/retrigger-check`).then((r) => r.data),

  // Loads
  getLoads: (params) => apiClient.get("/admin/loads", { params }).then((r) => r.data),
  cancelLoad: (id) => apiClient.patch(`/admin/loads/${id}/cancel`).then((r) => r.data),

  // Shipments
  getShipments: (params) => apiClient.get("/admin/shipments", { params }).then((r) => r.data),
  getOverdueShipments: () => apiClient.get("/admin/shipments/overdue").then((r) => r.data),
  resolveDispute: (id, note) => apiClient.patch(`/admin/shipments/${id}/resolve-dispute`, { note: note || null }).then((r) => r.data),
  getDisputeEvidence: (id) => apiClient.get(`/admin/shipments/${id}/dispute-evidence`).then((r) => r.data),

  // Transactions
  getTransactions: (params) => apiClient.get("/admin/transactions", { params }).then((r) => r.data),
  approveWithdrawal: (id, data = { provider: "manual" }) =>
    apiClient.post(`/admin/transactions/${id}/approve-withdrawal`, data).then((r) => r.data),
  rejectWithdrawal: (id, reason) =>
    apiClient.post(`/admin/transactions/${id}/reject-withdrawal`, { reason }).then((r) => r.data),

  // Commissions
  getCommissionSummary: () => apiClient.get("/admin/commissions/summary").then((r) => r.data),
  getAdminCommissions: (params) => apiClient.get("/admin/commissions", { params }).then((r) => r.data),
  waiveCommission: (id, reason) => apiClient.post(`/admin/commissions/${id}/waive`, { reason }).then((r) => r.data),
  extendCommission: (id, hours) => apiClient.post(`/admin/commissions/${id}/extend`, { extension_hours: hours }).then((r) => r.data),
  forceCollectCommission: (id) => apiClient.post(`/admin/commissions/${id}/force-collect`).then((r) => r.data),

  // Trucks
  getTrucks: (params) => apiClient.get("/admin/trucks", { params }).then((r) => r.data),
  getTruck: (id) => apiClient.get(`/admin/trucks/${id}`).then((r) => r.data),
  toggleTruckActive: (id) => apiClient.patch(`/admin/trucks/${id}/toggle-active`).then((r) => r.data),
  verifyTruck: (id, action, rejectionReason = null, verificationScore = null) =>
    apiClient.patch(`/admin/trucks/${id}/verify`, { action, rejection_reason: rejectionReason, verification_score: verificationScore }).then((r) => r.data),
  retriggerTruckCheck: (id) =>
    apiClient.post(`/admin/trucks/${id}/retrigger-check`).then((r) => r.data),

  // Field Ops
  createTask: (data) => apiClient.post("/admin/field-ops/tasks", data).then((r) => r.data),
  getTasks: (params) => apiClient.get("/admin/field-ops/tasks", { params }).then((r) => r.data),
  getTask: (taskId) => apiClient.get(`/admin/field-ops/tasks/${taskId}`).then((r) => r.data),
  assignTask: (taskId, inspectorUserId) =>
    apiClient.patch(`/admin/field-ops/tasks/${taskId}/assign`, { inspector_user_id: inspectorUserId }).then((r) => r.data),

  // Inspections
  submitInspection: (taskId, data) => apiClient.post(`/admin/inspections/${taskId}/submit`, data).then((r) => r.data),
  getInspection: (inspectionId) => apiClient.get(`/admin/inspections/${inspectionId}`).then((r) => r.data),
  listInspections: (params) => apiClient.get("/admin/inspections", { params }).then((r) => r.data),

  // Compliance
  getPendingReviews: (params) => apiClient.get("/admin/compliance/pending", { params }).then((r) => r.data),
  submitReview: (inspectionId, data) => apiClient.post(`/admin/compliance/${inspectionId}/review`, data).then((r) => r.data),
  getReviewHistory: (params) => apiClient.get("/admin/compliance/history", { params }).then((r) => r.data),

  // Workforce
  listWorkforce: (params) => apiClient.get("/admin/workforce", { params }).then((r) => r.data),
  assignAdminRole: (data) => apiClient.post("/admin/workforce/assign-role", data).then((r) => r.data),
  promoteToAdmin: (data) => apiClient.post("/admin/workforce/promote", data).then((r) => r.data),

  // Fleet map
  getActiveFleetPositions: () => apiClient.get("/admin/fleet/active-positions").then((r) => r.data),

  // Field ops — truck lookup (QR scan)
  lookupTruck: (q) => apiClient.get("/admin/field-ops/trucks/lookup", { params: { q } }).then((r) => r.data),

  // IoT
  getIoTDashboard: () => apiClient.get("/admin/iot/dashboard").then((r) => r.data),
  getIoTDevices: (params) => apiClient.get("/admin/iot/devices", { params }).then((r) => r.data),
  createIoTDevice: (data) => apiClient.post("/admin/iot/devices", data).then((r) => r.data),
  getIoTDevice: (id) => apiClient.get(`/admin/iot/devices/${id}`).then((r) => r.data),
  updateIoTDevice: (id, data) => apiClient.patch(`/admin/iot/devices/${id}`, data).then((r) => r.data),
  provisionDevice: (id) => apiClient.post(`/admin/iot/devices/${id}/provision`).then((r) => r.data),
  testDevicePing: (id) => apiClient.post(`/admin/iot/devices/${id}/test-ping`).then((r) => r.data),
  getIoTAlerts: (params) => apiClient.get("/admin/iot/alerts", { params }).then((r) => r.data),
  resolveAlert: (id) => apiClient.patch(`/admin/iot/alerts/${id}/resolve`).then((r) => r.data),
  getFleetHealth: () => apiClient.get("/admin/iot/fleet-health").then((r) => r.data),
  getIoTTasks: (params) => apiClient.get("/admin/iot/tasks", { params }).then((r) => r.data),
  createIoTTask: (data) => apiClient.post("/admin/iot/tasks", data).then((r) => r.data),

  // Multimodal bookings
  listParcels: (page = 1) => apiClient.get("/admin/parcels", { params: { page } }).then((r) => r.data),
  listMoveRequests: (page = 1) => apiClient.get("/admin/move-requests", { params: { page } }).then((r) => r.data),
  listAirfreight: (page = 1) => apiClient.get("/admin/airfreight", { params: { page } }).then((r) => r.data),

  // Service providers
  getProviders: (params = {}) => apiClient.get("/admin/providers", { params }).then((r) => r.data),
  verifyProvider: (id) => apiClient.patch(`/admin/providers/${id}/verify`).then((r) => r.data),
  unverifyProvider: (id) => apiClient.patch(`/admin/providers/${id}/unverify`).then((r) => r.data),

  // KRA / ETIMS invoices
  getEtimsInvoices: (params = {}) => apiClient.get("/admin/etims", { params }).then((r) => r.data),

  // Activity log & per-user history
  getActivityLog: (params = {}) => apiClient.get("/admin/activity-log", { params }).then((r) => r.data),
  getUserTransactions: (id, params = {}) => apiClient.get(`/admin/users/${id}/transactions`, { params }).then((r) => r.data),
  getUserActivity: (id, params = {}) => apiClient.get(`/admin/users/${id}/activity`, { params }).then((r) => r.data),

  // Admin management (super_admin only)
  getAdmins: (params) => apiClient.get("/admin/admins", { params }).then((r) => r.data),
  createAdmin: (data) => apiClient.post("/admin/admins", data).then((r) => r.data),
  updateAdminRole: (id, admin_role) => apiClient.patch(`/admin/admins/${id}/role`, { admin_role }).then((r) => r.data),
  suspendAdmin: (id) => apiClient.patch(`/admin/admins/${id}/suspend`).then((r) => r.data),
  revokeAdminAccess: (id) => apiClient.delete(`/admin/admins/${id}/revoke`).then((r) => r.data),

  // Payroll
  getPayrollAdmins: () => apiClient.get("/admin/payroll/admins").then((r) => r.data),
  getPayroll: (params = {}) => apiClient.get("/admin/payroll", { params }).then((r) => r.data),
  upsertPayroll: (data) => apiClient.post("/admin/payroll", data).then((r) => r.data),
  approvePayroll: (id) => apiClient.post(`/admin/payroll/${id}/approve`).then((r) => r.data),
  markPayrollPaid: (id) => apiClient.post(`/admin/payroll/${id}/mark-paid`).then((r) => r.data),
  getP9: (userId, year) => apiClient.get("/admin/payroll/p9", { params: { user_id: userId, year } }).then((r) => r.data),
  getPayrollItaxCsvUrl: (month) => `/admin/payroll/itax-csv?month=${month}`,

  // Settings (super_admin only)
  getCountryConfigs: () => apiClient.get("/admin/settings/countries").then((r) => r.data),
  createCountryConfig: (data) => apiClient.post("/admin/settings/countries", data).then((r) => r.data),
  updateCountryConfig: (code, data) => apiClient.put(`/admin/settings/countries/${code}`, data).then((r) => r.data),
  deleteCountryConfig: (code) => apiClient.delete(`/admin/settings/countries/${code}`).then((r) => r.data),
  getPlatformFees: (cc) => apiClient.get("/admin/settings/platform-fees", { params: cc ? { country_code: cc } : {} }).then((r) => r.data),
  createPlatformFee: (data) => apiClient.post("/admin/settings/platform-fees", data).then((r) => r.data),
  updatePlatformFee: (id, data) => apiClient.put(`/admin/settings/platform-fees/${id}`, data).then((r) => r.data),
  getSubscriptionPlans: () => apiClient.get("/admin/settings/subscription-plans").then((r) => r.data),
  updateSubscriptionPlan: (id, data) => apiClient.put(`/admin/settings/subscription-plans/${id}`, data).then((r) => r.data),
};
