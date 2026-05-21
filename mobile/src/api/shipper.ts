import apiClient from "./client";

export const shipperApi = {
  createLoad: (data: any) => apiClient.post("/loads", data).then((r) => r.data),
  myLoads: (params?: any) => apiClient.get("/loads/my-loads", { params }).then((r) => r.data),
  getLoad: (id: number | string) => apiClient.get(`/loads/${id}`).then((r) => r.data),
  cancelLoad: (id: number | string) => apiClient.delete(`/loads/${id}`).then((r) => r.data),

  getBids: (loadId: number | string) => apiClient.get(`/bids/load/${loadId}`).then((r) => r.data),
  acceptBid: (bidId: number | string) => apiClient.patch(`/bids/${bidId}/accept`).then((r) => r.data),

  getShipment: (id: number | string) => apiClient.get(`/shipments/${id}`).then((r) => r.data),
  getShipmentByLoad: (loadId: number | string) =>
    apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data),
  confirmDelivery: (shipmentId: number | string) =>
    apiClient.post(`/shipments/${shipmentId}/confirm-delivery`).then((r) => r.data),
  respondToOffer: (loadId: number, data: any) =>
    apiClient.post(`/loads/${loadId}/offer-response`, data).then((r) => r.data),
  searchDrivers: (q?: string) =>
    apiClient.get("/drivers/search-carriers", { params: q ? { q } : {} }).then((r) => r.data),

  createParcel: (data: any) => apiClient.post("/parcels", data).then((r) => r.data),
  listParcels: () => apiClient.get("/parcels").then((r) => r.data),
  createMoveRequest: (data: any) => apiClient.post("/move-requests", data).then((r) => r.data),
  listMoveRequests: () => apiClient.get("/move-requests").then((r) => r.data),
  createAirfreight: (data: any) => apiClient.post("/airfreight", data).then((r) => r.data),
  listAirfreight: () => apiClient.get("/airfreight").then((r) => r.data),
};
