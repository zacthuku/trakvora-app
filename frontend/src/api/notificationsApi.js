import apiClient from "@/services/apiClient";

export const notificationsApi = {
  list:        ()    => apiClient.get("/notifications?unread_only=true").then(r => r.data),
  markRead:    (id)  => apiClient.post(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: ()    => apiClient.post("/notifications/read-all"),
};
