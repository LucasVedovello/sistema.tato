import { useNavigate } from "react-router-dom";

import { ExportExcelButton } from "@/components/ExportExcelButton";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TasksSummary } from "@/components/TasksSummary";

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre as colunas para mudar o status.
          </p>
        </div>
        <ExportExcelButton />
      </div>

      <TasksSummary />

      <KanbanBoard onOpenShow={(id) => navigate(`/shows/${id}`)} />
    </div>
  );
}
