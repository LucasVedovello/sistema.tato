import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportClosedShowsToExcel } from "@/lib/shows-export";

/**
 * Baixa a planilha dos shows fechados. Os dados são buscados no banco no
 * momento do clique, então o arquivo nunca sai desatualizado.
 */
export function ExportExcelButton({
  variant = "outline",
}: {
  variant?: "default" | "outline";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setEmpty(false);
    try {
      const total = await exportClosedShowsToExcel();
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
    <div className="flex flex-col items-end gap-1">
      <Button variant={variant} onClick={handleClick} disabled={busy}>
        <FileSpreadsheet className="h-4 w-4" />
        {busy ? "Gerando…" : "Exportar para Excel"}
      </Button>
      {empty && (
        <p className="text-xs text-muted-foreground">
          Nenhum show fechado — a planilha saiu só com o cabeçalho.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
