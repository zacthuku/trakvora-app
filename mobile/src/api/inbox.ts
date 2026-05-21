import apiClient from "./client";

export const inboxApi = {
  getMessages: (params?: any) =>
    apiClient.get("/inbox", { params }).then((r) => r.data),
  sendMessage: (data: { recipient_id: number; subject: string; body: string }) =>
    apiClient.post("/inbox", data).then((r) => r.data),
  markRead: (id: number) =>
    apiClient.patch(`/inbox/${id}/read`).then((r) => r.data),
};
