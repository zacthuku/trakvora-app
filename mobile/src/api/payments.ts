import apiClient from "./client";

export const paymentsApi = {
  getWallet: () => apiClient.get("/payments/wallet").then((r) => r.data),
  getTransactions: (params?: any) =>
    apiClient.get("/payments/transactions", { params }).then((r) => r.data),
  initiateTopUp: (amount: number) =>
    apiClient.post("/payments/topup/initiate", { amount }).then((r) => r.data),
  requestWithdrawal: (amount: number, payoutDetails: any) =>
    apiClient.post("/payments/withdrawals", { amount, ...payoutDetails }).then((r) => r.data),
  openDispute: (loadId: number, reason: string) =>
    apiClient.post(`/payments/shipments/${loadId}/open-dispute`, { reason }).then((r) => r.data),
  getEtimsInvoices: (params?: any) =>
    apiClient.get("/etims/invoices", { params }).then((r) => r.data),
  getEtimsInvoice: (id: number) =>
    apiClient.get(`/etims/invoices/${id}`).then((r) => r.data),
};
