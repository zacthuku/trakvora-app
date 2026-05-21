import apiClient from "./client";

export const notificationsApi = {
  getNotifications: (params?: any) =>
    apiClient.get("/notifications", { params }).then((r) => r.data),
  markRead: (id: number) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch("/notifications/read-all").then((r) => r.data),
  registerPushToken: (token: string) =>
    apiClient.patch("/users/me", { expo_push_token: token }).then((r) => r.data),
};
