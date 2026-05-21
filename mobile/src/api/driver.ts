import apiClient from "./client";

export const driverApi = {
  getMarketplace: (params?: any) =>
    apiClient.get("/loads/marketplace", { params }).then((r) => r.data),

  getActiveShipment: () => apiClient.get("/shipments/my-active").then((r) => r.data),
  getShipment: (id: number | string) => apiClient.get(`/shipments/${id}`).then((r) => r.data),
  updateStatus: (id: number | string, data: any) =>
    apiClient.patch(`/shipments/${id}/status`, data).then((r) => r.data),
  updateLocation: (id: number | string, data: { latitude: number; longitude: number }) =>
    apiClient.patch(`/shipments/${id}/location`, data).then((r) => r.data),

  uploadPhoto: (uri: string, fileName: string) => {
    const form = new FormData();
    form.append("file", { uri, name: fileName, type: "image/jpeg" } as any);
    return apiClient
      .post("/uploads/photo", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  uploadDocument: (uri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    form.append("file", { uri, name: fileName, type: mimeType } as any);
    return apiClient
      .post("/uploads/document", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },

  getWallet: () => apiClient.get("/payments/wallet").then((r) => r.data),
  getTransactions: (params?: any) =>
    apiClient.get("/payments/transactions", { params }).then((r) => r.data),

  getProfile: () => apiClient.get("/drivers/me").then((r) => r.data),
  createProfile: (data: any) => apiClient.post("/drivers/me", data).then((r) => r.data),
  updateProfile: (data: any) => apiClient.patch("/drivers/me", data).then((r) => r.data),
  updateAvailability: (data: any) =>
    apiClient.patch("/drivers/me/availability", data).then((r) => r.data),

  respondToOffer: (loadId: number, accept: boolean, notificationId?: number, reason?: string) =>
    apiClient.post(`/loads/${loadId}/offer-response`, {
      accept,
      reason: reason ?? null,
      notification_id: notificationId ?? null,
    }).then((r) => r.data),
  getMyDirectOffers: () => apiClient.get("/loads/my-direct-offers").then((r) => r.data),

  getMyTrucks: () => apiClient.get("/trucks").then((r) => r.data),
  getAssignedTruck: () => apiClient.get("/trucks/assigned-to-me").then((r) => r.data),

  placeBid: (data: any) => apiClient.post("/bids", data).then((r) => r.data),
  getMyBids: () => apiClient.get("/bids/my-bids").then((r) => r.data),
  withdrawBid: (bidId: number | string) =>
    apiClient.patch(`/bids/${bidId}/withdraw`).then((r) => r.data),
};
