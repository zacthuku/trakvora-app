import apiClient from "@/services/apiClient";

export const providerApi = {
  getProfile: () => apiClient.get("/provider/profile").then((r) => r.data),
  updateProfile: (data) => apiClient.patch("/provider/profile", data).then((r) => r.data),
  getStats: () => apiClient.get("/provider/stats").then((r) => r.data),

  getAvailableBookings: (params = {}) =>
    apiClient.get("/provider/bookings/available", { params }).then((r) => r.data),
  acceptBooking: (id) =>
    apiClient.post(`/provider/bookings/${id}/accept`).then((r) => r.data),

  getMyJobs: (params = {}) =>
    apiClient.get("/provider/jobs", { params }).then((r) => r.data),
};
