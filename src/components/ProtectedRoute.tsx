import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { useContractExpiry } from "@/lib/contract-expiry";

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();
  /**
   * Contratos com prazo vencido são fechados antes de qualquer tela aparecer;
   * do contrário o Kanban mostraria como "em fechamento" um show que já devia
   * estar cancelado. Só roda com sessão — a RPC exige autenticação.
   */
  const { checking } = useContractExpiry(Boolean(session) && !loading);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return <Outlet />;
}
