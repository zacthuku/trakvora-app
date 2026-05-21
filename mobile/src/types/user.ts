export type UserRole = "shipper" | "owner" | "driver" | "admin";

export type AdminRole =
  | "super_admin"
  | "operations_admin"
  | "finance_admin"
  | "field_inspector"
  | "iot_technician"
  | "compliance_officer"
  | "support_agent";

export type KycStatus = "pending" | "submitted" | "approved" | "rejected";

export type AvailabilityStatus = "available" | "on_job" | "offline";

export type LoadStatus =
  | "available"
  | "bidding"
  | "booked"
  | "en_route_pickup"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "cancelled";
