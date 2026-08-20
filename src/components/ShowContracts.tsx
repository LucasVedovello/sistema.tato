import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Copy,
  Download,
  FileSignature,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";

import { ContractDialog } from "@/components/ContractDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadContractFile,
  publicSignUrl,
  STATUS_META,
} from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Client, Show, ShowContract } from "@/types/database";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ShowWithClient = Show & { clients: Client | null };

/**
 * Contratos do show: emissão a partir dos modelos do Storage, link de
 * assinatura do cliente e entrega do PDF final.
 *
 * O show e o cliente são lidos do banco aqui (e não recebidos do formulário)
 * de propósito: o contrato tem de sair com o que está SALVO, nunca com um
 * rascunho ainda não gravado na ficha.
 */
export function ShowContracts({ showId }: { showId: string }) {
  const [show, setShow] = useState<ShowWithClient | null>(null);
  const [contracts, setContracts] = useState<ShowContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [showResult, contractsResult] = await Promise.all([
      supabase.from("shows").select("*, clients(*)").eq("id", showId).single(),
      supabase
        .from("show_contracts")
        .select("*")
        .eq("show_id", showId)
        .order("created_at", { ascending: false }),
    ]);

    if (showResult.error) setError(showResult.error.message);
    else setShow(showResult.data as unknown as ShowWithClient);

    if (contractsResult.error) setError(contractsResult.error.message);
    else setContracts((contractsResult.data as ShowContract[]) ?? []);

    setLoading(false);
  }, [showId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCopyLink(contract: ShowContract) {
    try {
      await navigator.clipboard.writeText(publicSignUrl(contract.public_token));
      setCopiedId(contract.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Não foi possível copiar o link. Copie da tela do contrato.");
    }
  }

  async function handleDownload(contract: ShowContract) {
    if (!contract.signed_pdf_path || !show) return;
    setBusyId(contract.id);
    try {
      await downloadContractFile(
        contract.signed_pdf_path,
        show.artist_name,
        show.event_date
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao baixar o contrato."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(contract: ShowContract) {
    if (
      !window.confirm(
        "Excluir este contrato? O link de assinatura deixa de funcionar."
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("show_contracts")
      .delete()
      .eq("id", contract.id);
    if (error) {
      setError(error.message);
      return;
    }
    void load();
  }

  return (
    <Card data-testid="contracts">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4 text-primary" />
          Contratos
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={!show}
          title="Gerar contrato a partir de um dos modelos"
        >
          <Plus className="h-4 w-4" />
          Criar contrato
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando contratos…</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato gerado ainda. Escolha um modelo em “Criar contrato”.
          </p>
        ) : (
          <ul className="space-y-3">
            {contracts.map((contract) => {
              const meta = STATUS_META[contract.status];
              return (
                <li
                  key={contract.id}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {contract.template_label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        meta.badge
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Gerado em {DATA_HORA.format(new Date(contract.created_at))}
                    {contract.created_by_email
                      ? ` · ${contract.created_by_email}`
                      : ""}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/contratos/${contract.id}`}>
                        <PenLine className="h-4 w-4" />
                        {contract.status === "aguardando_contratado"
                          ? "Assinar"
                          : "Abrir"}
                      </Link>
                    </Button>

                    {contract.status === "aguardando_cliente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(contract)}
                      >
                        {copiedId === contract.id ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Link do cliente
                          </>
                        )}
                      </Button>
                    )}

                    {contract.signed_pdf_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(contract)}
                        disabled={busyId === contract.id}
                      >
                        <Download className="h-4 w-4" />
                        {busyId === contract.id ? "Baixando…" : "PDF assinado"}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => handleDelete(contract)}
                      title="Excluir contrato"
                      aria-label="Excluir contrato"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Precisa do modelo antigo em texto?{" "}
          <Link
            to={`/shows/${showId}/contrato`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Abrir contrato em texto
          </Link>
        </p>
      </CardContent>

      {show && (
        <ContractDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          show={show}
          client={show.clients}
          onCreated={() => void load()}
        />
      )}
    </Card>
  );
}
