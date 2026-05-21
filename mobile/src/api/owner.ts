import apiClient from "./client";

export const ownerApi = {
  getMyTrucks: (params?: any) => apiClient.get("/trucks", { params }).then((r) => r.data),
  getTruck: (id: number | string) => apiClient.get(`/trucks/${id}`).then((r) => r.data),
  createTruck: (data: any) => apiClient.post("/trucks", data).then((r) => r.data),
  updateTruck: (id: number | string, data: any) =>
    apiClient.patch(`/trucks/${id}`, data).then((r) => r.data),
  assignDriver: (truckId: number, driverUserId: number) =>
    apiClient.patch(`/trucks/${truckId}/assign-driver`, { driver_user_id: driverUserId }).then((r) => r.data),

  getMyTeam: () => apiClient.get("/drivers/my-team").then((r) => r.data),
  getSeekingDrivers: () => apiClient.get("/drivers/seeking").then((r) => r.data),
  inviteDriver: (driverId: number) => apiClient.post(`/drivers/${driverId}/invite`).then((r) => r.data),
  dismissDriver: (driverId: number) => apiClient.delete(`/drivers/${driverId}/dismiss`).then((r) => r.data),

  getFleetLoads: (params?: any) => apiClient.get("/loads/fleet", { params }).then((r) => r.data),
  getLoad: (id: number | string) => apiClient.get(`/loads/${id}`).then((r) => r.data),
  getMarketplace: (params?: any) =>
    apiClient.get("/loads/marketplace", { params }).then((r) => r.data),

  placeBid: (data: any) => apiClient.post("/bids", data).then((r) => r.data),
  getMyBids: () => apiClient.get("/bids/my-bids").then((r) => r.data),
  withdrawBid: (bidId: number | string) =>
    apiClient.patch(`/bids/${bidId}/withdraw`).then((r) => r.data),

  getShipmentByLoad: (loadId: number | string) =>
    apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data),
  getActiveFleetPositions: () =>
    apiClient.get("/admin/fleet/active-positions").then((r) => r.data),

  getWallet: () => apiClient.get("/payments/wallet").then((r) => r.data),
  getTransactions: (params?: any) =>
    apiClient.get("/payments/transactions", { params }).then((r) => r.data),

  getReturnWindows: () => apiClient.get("/return-windows").then((r) => r.data),
  createReturnWindow: (data: any) => apiClient.post("/return-windows", data).then((r) => r.data),
  deleteReturnWindow: (id: number) => apiClient.delete(`/return-windows/${id}`).then((r) => r.data),
  getReturnWindowMatches: () => apiClient.get("/return-windows/matches").then((r) => r.data),
};
