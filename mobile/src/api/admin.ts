import apiClient from "./client";

export const adminApi = {
  getDashboard: () => apiClient.get("/admin/dashboard").then((r) => r.data),

  getUsers: (params?: any) => apiClient.get("/admin/users", { params }).then((r) => r.data),
  suspendUser: (id: number) => apiClient.patch(`/admin/users/${id}/suspend`).then((r) => r.data),
  verifyUser: (id: number) => apiClient.patch(`/admin/users/${id}/verify`).then((r) => r.data),
  reviewKYC: (id: number, approved: boolean, reason?: string) =>
    apiClient.patch(`/admin/users/${id}/kyc-review`, { approved, reason: reason ?? null }).then((r) => r.data),

  getDrivers: (params?: any) => apiClient.get("/admin/drivers", { params }).then((r) => r.data),
  updateDriverVerification: (id: number, status: string) =>
    apiClient.patch(`/admin/drivers/${id}/verification`, { status }).then((r) => r.data),

  getLoads: (params?: any) => apiClient.get("/admin/loads", { params }).then((r) => r.data),
  cancelLoad: (id: number) => apiClient.patch(`/admin/loads/${id}/cancel`).then((r) => r.data),

  getShipments: (params?: any) => apiClient.get("/admin/shipments", { params }).then((r) => r.data),
  resolveDispute: (id: number, note?: string) =>
    apiClient.patch(`/admin/shipments/${id}/resolve-dispute`, { note: note ?? null }).then((r) => r.data),

  getTransactions: (params?: any) =>
    apiClient.get("/admin/transactions", { params }).then((r) => r.data),
  approveWithdrawal: (id: number) =>
    apiClient.post(`/admin/transactions/${id}/approve-withdrawal`, { provider: "flutterwave" }).then((r) => r.data),
  rejectWithdrawal: (id: number, reason: string) =>
    apiClient.post(`/admin/transactions/${id}/reject-withdrawal`, { reason }).then((r) => r.data),

  getTrucks: (params?: any) => apiClient.get("/admin/trucks", { params }).then((r) => r.data),

  getTasks: (params?: any) => apiClient.get("/admin/field-ops/tasks", { params }).then((r) => r.data),
  getTask: (taskId: number) => apiClient.get(`/admin/field-ops/tasks/${taskId}`).then((r) => r.data),
  createTask: (data: any) => apiClient.post("/admin/field-ops/tasks", data).then((r) => r.data),
  assignTask: (taskId: number, inspectorUserId: number) =>
    apiClient.patch(`/admin/field-ops/tasks/${taskId}/assign`, { inspector_user_id: inspectorUserId }).then((r) => r.data),

  getPendingReviews: (params?: any) =>
    apiClient.get("/admin/compliance/pending", { params }).then((r) => r.data),
  submitReview: (inspectionId: number, data: any) =>
    apiClient.post(`/admin/compliance/${inspectionId}/review`, data).then((r) => r.data),

  getActiveFleetPositions: () =>
    apiClient.get("/admin/fleet/active-positions").then((r) => r.data),

  getIoTDashboard: () => apiClient.get("/admin/iot/dashboard").then((r) => r.data),
  getIoTDevices: (params?: any) =>
    apiClient.get("/admin/iot/devices", { params }).then((r) => r.data),
  createIoTDevice: (data: any) => apiClient.post("/admin/iot/devices", data).then((r) => r.data),
  getIoTAlerts: (params?: any) =>
    apiClient.get("/admin/iot/alerts", { params }).then((r) => r.data),
  resolveAlert: (id: number) =>
    apiClient.patch(`/admin/iot/alerts/${id}/resolve`).then((r) => r.data),

  getActivityLog: (params?: any) =>
    apiClient.get("/admin/activity-log", { params }).then((r) => r.data),

  getAdmins: (params?: any) => apiClient.get("/admin/admins", { params }).then((r) => r.data),
  createAdmin: (data: any) => apiClient.post("/admin/admins", data).then((r) => r.data),
  updateAdminRole: (id: number, admin_role: string) =>
    apiClient.patch(`/admin/admins/${id}/role`, { admin_role }).then((r) => r.data),
  suspendAdmin: (id: number) => apiClient.patch(`/admin/admins/${id}/suspend`).then((r) => r.data),
};
