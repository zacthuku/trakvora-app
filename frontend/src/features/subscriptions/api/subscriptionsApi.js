import apiClient from "@/services/apiClient";

export const subscriptionsApi = {
  listPlans: (role) => {
    const params = role ? { role } : {};
    return apiClient.get("/subscriptions/plans", { params }).then((r) => r.data);
  },

  subscribe: (planId) =>
    apiClient.post("/subscriptions", { plan_id: planId }).then((r) => r.data),

  getMySubscription: () =>
    apiClient.get("/subscriptions/me").then((r) => r.data),

  cancel: () =>
    apiClient.patch("/subscriptions/me/cancel").then((r) => r.data),
};
