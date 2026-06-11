import apiClient from "@/services/apiClient";

export const inboxApi = {
  list:        ()    => apiClient.get("/inbox").then(r => r.data),
  unreadCount: ()    => apiClient.get("/inbox/unread-count").then(r => r.data),
  markRead:    (id)  => apiClient.post(`/inbox/${id}/read`).then(r => r.data),
  markAllRead: ()    => apiClient.post("/inbox/read-all"),
};
