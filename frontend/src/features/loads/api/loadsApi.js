import apiClient from "@/services/apiClient";

export const loadsApi = {
  getMarketplace: (params) =>
    apiClient.get("/loads/marketplace", { params }).then((r) => r.data),
  getLoad: (id) => apiClient.get(`/loads/${id}`).then((r) => r.data),
  placeBid: (data) => apiClient.post("/bids", data).then((r) => r.data),
  getMyTrucks: () => apiClient.get("/trucks").then((r) => r.data),
  getMyBids: () => apiClient.get("/bids/my-bids").then((r) => r.data),
  withdrawBid: (bidId) => apiClient.patch(`/bids/${bidId}/withdraw`).then((r) => r.data),
  getMyDirectOffers: () => apiClient.get("/loads/my-direct-offers").then((r) => r.data),
  respondToDirectOffer: (loadId, data) =>
    apiClient.post(`/loads/${loadId}/offer-response`, data).then((r) => r.data),
  acceptFixedPrice: (loadId, truckId) =>
    apiClient.post(`/loads/${loadId}/accept-fixed`, { truck_id: truckId ?? null }).then((r) => r.data),
};
