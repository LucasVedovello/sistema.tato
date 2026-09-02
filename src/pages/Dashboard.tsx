import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, LayoutDashboard } from "lucide-react";

import { ExportExcelButton } from "@/components/ExportExcelButton";
import { KanbanBoard } from "@/components/KanbanBoard";
import { RealizedShows } from "@/components/RealizedShows";
import { TasksSummary } from "@/components/TasksSummary";
import {
  exportAllShowsToExcel,
  exportRealizedShowsToExcel,
} from "@/lib/shows-export";
import { cn } from "@/lib/utils";

type Aba = "quadro" | "realizados";

const ABAS: { key: Aba; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "quadro", label: "Quadro", icon: LayoutDashboard },
  { key: "realizados", label: "Realizados", icon: CalendarCheck },
];

const DESCRICAO: Record<Aba, string> = {
  quadro: "Arraste os cards entre as colunas para mudar o status.",
  realizados: "Shows cuja data do evento já passou.",
};

export function Dashboard() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("quadro");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{DESCRICAO[aba]}</p>
        </div>
        {/* A planilha acompanha a aba: no quadro sai tudo o que o Kanban
            mostra; em "Realizados", só o que já aconteceu. */}
        {aba === "quadro" ? (
          <ExportExcelButton
            onExport={exportAllShowsToExcel}
            emptyMessage="Nenhum show cadastrado ainda."
          />
        ) : (
          <ExportExcelButton
            onExport={exportRealizedShowsToExcel}
            emptyMessage="Nenhum show com data já passada."
          />
        )}
      </div>

      <TasksSummary />

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Seções do dashboard"
      >
        {ABAS.map(({ key, label, icon: Icon }) => {
          const ativa = key === aba;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(key)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                ativa
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {aba === "quadro" ? (
          <KanbanBoard onOpenShow={(id) => navigate(`/shows/${id}`)} />
        ) : (
          <RealizedShows onOpenShow={(id) => navigate(`/shows/${id}`)} />
        )}
      </div>
    </div>
  );
}
