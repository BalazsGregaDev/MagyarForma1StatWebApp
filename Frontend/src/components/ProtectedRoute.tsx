// ---------------------------------------------------------------------
//  src/components/ProtectedRoute.tsx
//
//  Admin-only útvonalak őre. A régi App.tsx-ben az /admin/* útvonalak
//  bárki számára elérhetők voltak — csak a gombok voltak elrejtve.
//
//  Megjegyzés: ez UX-védelem, nem biztonsági. A valódi védelmet az
//  adatbázis admin_write RLS-policy-je adja.
// ---------------------------------------------------------------------
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-state" role="status" aria-live="polite">
        Betöltés…
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
