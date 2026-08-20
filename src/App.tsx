import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Calendar } from "@/pages/Calendar";
import { Clients } from "@/pages/Clients";
import { Contract } from "@/pages/Contract";
import { ContractDetail } from "@/pages/ContractDetail";
import { ClosedShows } from "@/pages/ClosedShows";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";
import { PublicSign } from "@/pages/PublicSign";
import { Reports } from "@/pages/Reports";
import { ShowForm } from "@/pages/ShowForm";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Assinatura do cliente: sem login e fora do Layout — quem abre é o
          contratante, que não tem conta no sistema. */}
      <Route path="/assinar/:token" element={<PublicSign />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/shows/novo" element={<ShowForm />} />
          <Route path="/shows/fechados" element={<ClosedShows />} />
          {/* Ficha do show. O React Router v6 pontua segmento estático acima
              de dinâmico, então /shows/novo e /shows/fechados continuam
              ganhando de /shows/:id independentemente da ordem aqui. */}
          <Route path="/shows/:id" element={<ShowForm />} />
          {/* Rota antiga, mantida para links já salvos. */}
          <Route path="/shows/:id/editar" element={<ShowForm />} />
          <Route path="/shows/:id/contrato" element={<Contract />} />
          <Route path="/contratos/:id" element={<ContractDetail />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/relatorios" element={<Reports />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
