import apiClient from "@/services/apiClient";

export const ownerApi = {
  // Trucks
  getMyTrucks: (params) =>
    apiClient.get("/trucks", { params }).then((r) => r.data),
  getTruck: (id) =>
    apiClient.get(`/trucks/${id}`).then((r) => r.data),
  createTruck: (data) =>
    apiClient.post("/trucks", data).then((r) => r.data),
  updateTruck: (id, data) =>
    apiClient.patch(`/trucks/${id}`, data).then((r) => r.data),
  assignDriver: (truckId, driverUserId) =>
    apiClient
      .patch(`/trucks/${truckId}/assign-driver`, { driver_user_id: driverUserId })
      .then((r) => r.data),

  // Drivers / team
  getMyTeam: () =>
    apiClient.get("/drivers/my-team").then((r) => r.data),
  getSeekingDrivers: () =>
    apiClient.get("/drivers/seeking").then((r) => r.data),
  inviteDriver: (driverId) =>
    apiClient.post(`/drivers/${driverId}/invite`).then((r) => r.data),
  dismissDriver: (driverId) =>
    apiClient.delete(`/drivers/${driverId}/dismiss`).then((r) => r.data),

  // Loads & fleet
  getFleetLoads: (params) =>
    apiClient.get("/loads/fleet", { params }).then((r) => r.data),
  getLoad: (id) =>
    apiClient.get(`/loads/${id}`).then((r) => r.data),
  getMarketplace: (params) =>
    apiClient.get("/loads/marketplace", { params }).then((r) => r.data),
  getSuggestedCarriers: (loadId) =>
    apiClient.get(`/loads/${loadId}/suggested-carriers`).then((r) => r.data),

  // Bids
  placeBid: (data) =>
    apiClient.post("/bids", data).then((r) => r.data),
  getMyBids: () =>
    apiClient.get("/bids/my-bids").then((r) => r.data),
  withdrawBid: (bidId) =>
    apiClient.patch(`/bids/${bidId}/withdraw`).then((r) => r.data),

  // Shipments
  getActiveShipment: () =>
    apiClient.get("/shipments/my-active").then((r) => r.data),
  getFleetActiveShipments: () =>
    apiClient.get("/shipments/my-fleet-active").then((r) => r.data),
  getShipmentByLoad: (loadId) =>
    apiClient.get(`/shipments/by-load/${loadId}`).then((r) => r.data),
  submitDelivery: (shipmentId, data) =>
    apiClient.patch(`/shipments/${shipmentId}/status`, data).then((r) => r.data),

  // Fleet map
  getActiveFleetPositions: () =>
    apiClient.get("/admin/fleet/active-positions").then((r) => r.data),

  // Wallet
  getWallet: () =>
    apiClient.get("/payments/wallet").then((r) => r.data),
  getTransactions: (params) =>
    apiClient.get("/payments/transactions", { params }).then((r) => r.data),

  // Return windows (backhaul)
  getReturnWindows: () =>
    apiClient.get("/return-windows").then((r) => r.data),
  createReturnWindow: (data) =>
    apiClient.post("/return-windows", data).then((r) => r.data),
  deleteReturnWindow: (id) =>
    apiClient.delete(`/return-windows/${id}`).then((r) => r.data),
  toggleReturnWindow: (id, is_active) =>
    apiClient.patch(`/return-windows/${id}`, { is_active }).then((r) => r.data),
  getReturnWindowMatches: () =>
    apiClient.get("/return-windows/matches").then((r) => r.data),
  browseReturnWindows: (params) =>
    apiClient.get("/return-windows/browse", { params }).then((r) => r.data),

  // Commissions
  getCommissions: (params) =>
    apiClient.get("/commissions", { params }).then((r) => r.data),

  // Fleet reports
  getFleetReport: () =>
    apiClient.get("/reports/fleet").then((r) => r.data),
  exportShipmentsCSV: () =>
    apiClient
      .get("/reports/shipments.csv", { responseType: "blob" })
      .then((r) => r.data),
};
