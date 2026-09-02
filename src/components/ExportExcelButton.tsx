import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de exportação para Excel, igual em todas as telas.
 *
 * Cada tela passa a sua função de exportação; ela busca os dados no banco no
 * momento do clique — nunca reaproveita o que a tela já tinha carregado — e
 * devolve quantos registros entraram, para o botão avisar quando o arquivo
 * saiu vazio.
 */
export function ExportExcelButton({
  onExport,
  emptyMessage = "Nada para exportar — a planilha saiu só com o cabeçalho.",
  label = "Exportar para Excel",
  variant = "outline",
  disabled = false,
  className,
}: {
  onExport: () => Promise<number>;
  emptyMessage?: string;
  label?: string;
  variant?: "default" | "outline";
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setEmpty(false);
    try {
      const total = await onExport();
      if (total === 0) setEmpty(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao gerar a planilha."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        variant={variant}
        onClick={handleClick}
        disabled={busy || disabled}
        className="w-full sm:w-auto"
      >
        <FileSpreadsheet className="h-4 w-4" />
        {/* O rótulo encolhe onde a largura é disputada. */}
        <span className="truncate">{busy ? "Gerando…" : label}</span>
      </Button>
      {empty && <p className="text-xs text-muted-foreground">{emptyMessage}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
