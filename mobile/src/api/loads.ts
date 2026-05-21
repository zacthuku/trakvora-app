import apiClient from "./client";

export const loadsApi = {
  getMarketplace: (params?: any) =>
    apiClient.get("/loads/marketplace", { params }).then((r) => r.data),
  getLoad: (id: number | string) =>
    apiClient.get(`/loads/${id}`).then((r) => r.data),
  getMyDirectOffers: () =>
    apiClient.get("/loads/my-direct-offers").then((r) => r.data),
  respondToDirectOffer: (loadId: number, data: any) =>
    apiClient.post(`/loads/${loadId}/offer-response`, data).then((r) => r.data),
};
