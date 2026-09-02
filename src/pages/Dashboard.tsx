import { useNavigate } from "react-router-dom";

import { ExportExcelButton } from "@/components/ExportExcelButton";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TasksSummary } from "@/components/TasksSummary";
import { exportAllShowsToExcel } from "@/lib/shows-export";

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre as colunas para mudar o status. Shows com a
            data já passada vão sozinhos para “Realizados”.
          </p>
        </div>
        {/* O Kanban mostra os shows de todos os status — a planilha traz os
            mesmos, não só os fechados (esses têm a tela "Fechados"). */}
        <ExportExcelButton
          onExport={exportAllShowsToExcel}
          emptyMessage="Nenhum show cadastrado ainda."
        />
      </div>

      <TasksSummary />

      <KanbanBoard onOpenShow={(id) => navigate(`/shows/${id}`)} />
    </div>
  );
}
