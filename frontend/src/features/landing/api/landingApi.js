import apiClient from "@/services/apiClient";

export const landingApi = {
  getStats: () => apiClient.get("/stats").then((r) => r.data),
  getFeaturedCompanies: () => apiClient.get("/landing/featured-companies").then((r) => r.data),
};
