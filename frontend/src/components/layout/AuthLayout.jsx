import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const ROLE_PATHS = {
  shipper:        "/shipper",
  driver:         "/driver",
  owner:          "/owner",
  admin:          "/admin",
  mover:          "/mover",
  air_freight:    "/airfreight",
  parcel_carrier: "/parcel-carrier",
};

export default function AuthLayout() {
  const user  = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (user && token) {
    return <Navigate to={ROLE_PATHS[user.role] ?? "/"} replace />;
  }
  return <Outlet />;
}
