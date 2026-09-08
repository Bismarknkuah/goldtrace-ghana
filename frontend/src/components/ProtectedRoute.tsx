import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../app/hooks";

export default function ProtectedRoute() {
  const access = useAppSelector((s) => s.auth.access);
  return access ? <Outlet /> : <Navigate to="/login" replace />;
}
