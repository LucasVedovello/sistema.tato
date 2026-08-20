import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Music4,
  PenLine,
} from "lucide-react";

import {
  ContractPdfView,
  type SignatureOverlay,
} from "@/components/ContractPdfView";
import { SignatureDialog } from "@/components/SignatureDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signatureField } from "@/lib/contract-templates";
import { deadlineInfo, publicContractPdfUrl } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { PublicContract } from "@/types/database";

function PublicHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Music4 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">
            Assinatura de contrato
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  );
}

function Aviso({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
        {icon}
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </main>
  );
}

/**
 * Página pública do CLIENTE (`/assinar/:token`) — sem login.
 *
 * O acesso é só pelo token: a leitura passa por uma RPC security definer e o
 * PDF é aberto por URL assinada na hora, autorizada pela policy do Storage que
 * casa o token com o arquivo. Nada aqui expõe o resto do sistema.
 */
export function PublicSign() {
  const { token } = useParams();

  const [contract, setContract] = useState<PublicContract | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase.rpc("public_get_contract", {
        p_token: token,
      });

      if (!active) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = data as PublicContract;
      setContract(row);
      if (row.status === "assinado" || row.client_signed_at) setDone(true);
      setPdfUrl(publicContractPdfUrl(token, "preparado"));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const overlays: SignatureOverlay[] = useMemo(
    () => [
      {
        box: signatureField("client").box,
        party: "client",
        imageUrl: signature ?? contract?.client_signature,
        label: "Assine aqui",
      },
      {
        box: signatureField("office").box,
        party: "office",
        imageUrl: contract?.office_signature,
        label: "Assinatura do contratado",
      },
    ],
    [contract, signature]
  );

  async function handleFinish() {
    if (!token) return;
    if (!accepted) {
      setError("Confirme a leitura e o aceite do contrato.");
      return;
    }
    if (!signature) {
      setError("Assine no quadro antes de finalizar.");
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error } = await supabase.rpc("public_sign_contract", {
      p_token: token,
      p_signature: signature,
    });
    setSaving(false);

    if (error) {
      setError("Falha ao registrar a assinatura. Tente novamente.");
      return;
    }
    if (!data) {
      setError("Este contrato não está mais disponível para assinatura.");
      return;
    }

    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !contract) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <Aviso
          icon={<Clock className="h-12 w-12 text-muted-foreground" />}
          title="Link inválido"
        >
          Este link não existe mais: ou o contrato foi cancelado, ou o prazo de
          assinatura expirou. Peça um novo ao escritório.
        </Aviso>
      </div>
    );
  }

  if (done) {
    const finalizado = contract.status === "assinado";
    return (
      <div className="min-h-screen">
        <PublicHeader subtitle={contract.template_label} />
        <Aviso
          icon={<CheckCircle2 className="h-14 w-14 text-emerald-600" />}
          title="Assinatura concluída!"
        >
          Obrigado, {contract.client_name}. O contrato do show de{" "}
          {contract.artist_name}{" "}
          {finalizado
            ? `foi assinado pelas duas partes. A via final está disponível abaixo.`
            : `foi assinado e seguiu para a assinatura de ${contract.office_name}. Você receberá a via final assinada pelas duas partes.`}
        </Aviso>
        {finalizado && token && (
          <div className="flex justify-center pb-16">
            <Button asChild>
              <a
                href={publicContractPdfUrl(token, "assinado")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                Baixar contrato assinado
              </a>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <PublicHeader
        subtitle={`${contract.template_label} — ${contract.client_name}`}
      />

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold">Leia e assine seu contrato</h2>
          <p className="text-sm text-muted-foreground">
            Show de {contract.artist_name}
            {contract.event_date ? ` em ${formatDate(contract.event_date)}` : ""}
            {contract.location ? ` · ${contract.location}` : ""}. Role o
            documento até o fim e assine no campo destacado.
          </p>
          {/* O prazo é o mesmo que corre no banco: passou dele sem as duas
              assinaturas, o contrato é cancelado. */}
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlarmClock className="h-4 w-4" />
            Assine até {deadlineInfo(contract).texto}.
          </p>
        </div>

        {pdfUrl ? (
          <div className="rounded-lg border bg-neutral-200 p-3 dark:bg-neutral-800 sm:p-6">
            <ContractPdfView url={pdfUrl} overlays={overlays} />
          </div>
        ) : (
          <p className="text-sm text-destructive">
            {error ?? "Documento indisponível."}
          </p>
        )}

        <Card>
          <CardContent className="space-y-3 pt-6">
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              Declaro que li e estou de acordo com todo o conteúdo deste
              contrato.
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setSignOpen(true)}>
                <PenLine className="h-4 w-4" />
                {signature ? "Refazer assinatura" : "Assinar"}
              </Button>
              <Button
                className="flex-1"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar e finalizar
                  </>
                )}
              </Button>
            </div>

            {signature && (
              <p className="text-xs text-emerald-600">
                Assinatura registrada. Confira no documento acima e finalize.
              </p>
            )}
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      </main>

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sua assinatura"
        description="Desenhe sua assinatura. Ela será inserida sobre a linha do CONTRATANTE."
        onConfirm={(dataUrl) => {
          setSignature(dataUrl);
          setSignOpen(false);
          setError(null);
        }}
      />
    </div>
  );
}
