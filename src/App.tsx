import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Clients } from "@/pages/Clients";
import { ClosedShows } from "@/pages/ClosedShows";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";
import { ShowForm } from "@/pages/ShowForm";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/shows/novo" element={<ShowForm />} />
          <Route path="/shows/:id/editar" element={<ShowForm />} />
          <Route path="/shows/fechados" element={<ClosedShows />} />
          <Route path="/clientes" element={<Clients />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
