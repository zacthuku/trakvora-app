import apiClient from "@/services/apiClient";

export const shipperApi = {
  createLoad: (data) => apiClient.post("/loads", data).then((r) => r.data),
  myLoads: () => apiClient.get("/loads/marketplace").then((r) => r.data),
  getLoad: (id) => apiClient.get(`/loads/${id}`).then((r) => r.data),
  cancelLoad: (id) => apiClient.delete(`/loads/${id}`).then((r) => r.data),

  getBids: (loadId) => apiClient.get(`/bids/load/${loadId}`).then((r) => r.data),
  acceptBid: (bidId) => apiClient.patch(`/bids/${bidId}/accept`).then((r) => r.data),

  getShipment: (id) => apiClient.get(`/shipments/${id}`).then((r) => r.data),
  getShipmentByLoad: (loadId) => apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data),
  confirmDelivery: (shipmentId, body) =>
    apiClient.post(`/shipments/${shipmentId}/confirm-delivery`, body || {}).then((r) => r.data),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post("/uploads/photo", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  respondToOffer: (loadId, data) => apiClient.post(`/loads/${loadId}/offer-response`, data).then((r) => r.data),
  reOfferLoad: (loadId, payload) => apiClient.post(`/loads/${loadId}/re-offer`, payload).then((r) => r.data),
  convertToBid: (loadId) => apiClient.patch(`/loads/${loadId}/convert-to-bid`).then((r) => r.data),
  searchDrivers: (q) => apiClient.get("/drivers/search-carriers", { params: q ? { q } : {} }).then((r) => r.data),
  searchOwners: (q) => apiClient.get("/users/owners/search", { params: q ? { q } : {} }).then((r) => r.data),

  // Multi-modal bookings
  createParcel: (data) => apiClient.post("/parcels", data).then((r) => r.data),
  listParcels: () => apiClient.get("/parcels").then((r) => r.data),

  createMoveRequest: (data) => apiClient.post("/move-requests", data).then((r) => r.data),
  listMoveRequests: () => apiClient.get("/move-requests").then((r) => r.data),

  createAirfreight: (data) => apiClient.post("/airfreight", data).then((r) => r.data),
  listAirfreight: () => apiClient.get("/airfreight").then((r) => r.data),
};
