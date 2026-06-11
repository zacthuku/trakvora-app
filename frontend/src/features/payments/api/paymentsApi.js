import apiClient from "@/services/apiClient";

export const paymentsApi = {
  getWallet: () =>
    apiClient.get("/payments/wallet").then((r) => r.data),

  getTransactions: (params) =>
    apiClient.get("/payments/transactions", { params }).then((r) => r.data),

  // Initiate an IntaSend top-up (returns payment link)
  initiateTopUp: (amount) =>
    apiClient.post("/payments/topup/initiate", { amount }).then((r) => r.data),

  requestWithdrawal: (amount, payoutDetails) =>
    apiClient
      .post("/payments/withdrawals", { amount, ...payoutDetails })
      .then((r) => r.data),

  // Subscription plans & management
  getSubscriptionPlans: () =>
    apiClient.get("/subscriptions/plans").then((r) => r.data),

  getMySubscription: () =>
    apiClient.get("/subscriptions/me").then((r) => r.data),

  subscribe: (planId) =>
    apiClient.post("/subscriptions", { plan_id: planId }).then((r) => r.data),

  cancelSubscription: () =>
    apiClient.patch("/subscriptions/me/cancel").then((r) => r.data),

  // CSV export
  exportShipmentsCSV: () =>
    apiClient
      .get("/reports/shipments.csv", { responseType: "blob" })
      .then((r) => r.data),

  openDispute: (loadId, reason) =>
    apiClient.post(`/payments/shipments/${loadId}/open-dispute`, { reason }).then((r) => r.data),

  // KRA eTIMS tax receipts
  getEtimsInvoices: (params) =>
    apiClient.get("/etims/invoices", { params }).then((r) => r.data),

  getEtimsInvoice: (id) =>
    apiClient.get(`/etims/invoices/${id}`).then((r) => r.data),

  downloadReceiptPdf: (id) =>
    apiClient.get(`/etims/invoices/${id}/pdf`, { responseType: "blob" }).then((r) => r.data),
};
