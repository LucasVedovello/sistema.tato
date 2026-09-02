import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  PenLine,
} from "lucide-react";

import {
  ContractPdfView,
  type SignatureOverlay,
} from "@/components/ContractPdfView";
import { SignatureDialog } from "@/components/SignatureDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signatureField } from "@/lib/contract-templates";
import {
  contractFileUrl,
  deadlineInfo,
  downloadContractFile,
  publicSignUrl,
  signAsOffice,
  STATUS_META,
} from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatData } from "@/lib/format";
import type { Show, ShowContract } from "@/types/database";

/**
 * Ficha de um contrato emitido — é aqui que o CONTRATADO assina.
 *
 * O campo do contratado só abre depois que o cliente assinou pelo link
 * público; enquanto isso, a página mostra o link para reenviar.
 */
export function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [contract, setContract] = useState<ShowContract | null>(null);
  const [show, setShow] = useState<Show | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("show_contracts")
      .select("*, shows(*)")
      .eq("id", id)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const row = data as unknown as ShowContract & { shows: Show | null };
    setContract(row);
    setShow(row.shows);
    setError(null);

    // O documento exibido é sempre o mais avançado que existe: o assinado, se
    // já houver; senão o preparado, com as assinaturas sobrepostas na tela.
    try {
      const path = row.signed_pdf_path ?? row.prepared_pdf_path;
      setPdfUrl(await contractFileUrl(path));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao abrir o PDF do contrato."
      );
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const overlays: SignatureOverlay[] = useMemo(() => {
    if (!contract) return [];
    // Com o PDF final em tela as assinaturas já estão impressas nele; repetir
    // o overlay duplicaria os traços.
    if (contract.signed_pdf_path) return [];
    return [
      {
        box: signatureField("client").box,
        party: "client",
        imageUrl: contract.client_signature,
        label: "Aguardando o cliente",
      },
      {
        box: signatureField("office").box,
        party: "office",
        imageUrl: contract.office_signature,
        label: "Assinatura do contratado",
      },
    ];
  }, [contract]);

  async function handleSign(dataUrl: string) {
    if (!contract) return;
    setSignOpen(false);
    setSaving(true);
    setError(null);
    try {
      await signAsOffice(contract, dataUrl);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao registrar a assinatura."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!contract) return;
    try {
      await navigator.clipboard.writeText(publicSignUrl(contract.public_token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie à mão.");
    }
  }

  async function handleDownload() {
    if (!contract?.signed_pdf_path || !show) return;
    setDownloading(true);
    try {
      await downloadContractFile(
        contract.signed_pdf_path,
        show.artist_name,
        show.event_date
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao baixar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;

  if (!contract) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error ?? "Contrato não encontrado."}
      </Card>
    );
  }

  const meta = STATUS_META[contract.status];
  const link = publicSignUrl(contract.public_token);
  const prazo = deadlineInfo(contract);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/shows/${contract.show_id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o show
        </Button>

        <div className="flex flex-wrap gap-2">
          {contract.status === "aguardando_contratado" && (
            <Button onClick={() => setSignOpen(true)} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF final…
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Assinar como contratado
                </>
              )}
            </Button>
          )}
          {contract.signed_pdf_path && (
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4" />
              {downloading ? "Baixando…" : "Baixar PDF assinado"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            {contract.template_label}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                meta.badge
              )}
            >
              {meta.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="text-foreground">Artista:</span>{" "}
              {show?.artist_name ?? "—"}
            </p>
            <p>
              <span className="text-foreground">Contratante:</span>{" "}
              {contract.client_name}
            </p>
            <p>
              <span className="text-foreground">Data do evento:</span>{" "}
              {formatData(show?.event_date)}
            </p>
            <p>
              <span className="text-foreground">Contratado:</span>{" "}
              {contract.office_name}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {contract.client_signed_at ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Cliente assinou em{" "}
                  {new Date(contract.client_signed_at).toLocaleString("pt-BR")}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-amber-600" />
                  Aguardando a assinatura do cliente
                </>
              )}
            </p>
            {prazo.relevante && (
              <p
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  prazo.vencido ? "text-destructive" : "text-muted-foreground"
                )}
              >
                <AlarmClock className="h-4 w-4" />
                {prazo.vencido
                  ? `Prazo vencido em ${prazo.texto} — o show será cancelado na próxima verificação`
                  : `Prazo para as duas assinaturas: ${prazo.texto}`}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm font-medium">
              {contract.office_signed_at ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Contratado assinou em{" "}
                  {new Date(contract.office_signed_at).toLocaleString("pt-BR")}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {contract.client_signed_at
                    ? "Pronto para a assinatura do contratado"
                    : "O campo do contratado abre depois que o cliente assinar"}
                </>
              )}
            </p>
          </div>

          {contract.status === "aguardando_cliente" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Link de assinatura do cliente</p>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.target.select()} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopy}
                  title="Copiar link"
                  aria-label="Copiar link"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie ao cliente. Ele assina sem precisar de conta; o seu campo
                é liberado logo depois.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {pdfUrl && (
        <div className="rounded-lg border bg-neutral-200 p-3 dark:bg-neutral-800 sm:p-6">
          <ContractPdfView url={pdfUrl} overlays={overlays} />
        </div>
      )}

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Assinatura do contratado"
        description={`Desenhe a assinatura de ${contract.office_name}. Ela entra sobre a linha do CONTRATADO e o PDF final é gerado na hora.`}
        onConfirm={handleSign}
      />
    </div>
  );
}
