// frontend/src/components/common/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute
 * - Simple wrapper that checks for an auth token in localStorage.
 * - If token is missing, redirects to /login.
 * - Otherwise renders children.
 *
 * Note: This keeps typing minimal by using React.ReactNode to avoid
 * any JSX namespace issues during build.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  let token: string | null = null;
  try {
    token = localStorage.getItem("token");
  } catch {
    // localStorage may be unavailable in some environments; treat as no token
    token = null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
