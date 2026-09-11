import { useEffect, useState } from "react";
import { FileSignature, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_LIST, type ContractTemplateKey } from "@/lib/contract-templates";
import {
  createContract,
  emptyExtras,
  type ContractExtras,
} from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  formatData,
  formatDocumento,
  formatEndereco,
  formatMoeda,
  formatTelefone,
  horarioParaContrato,
  titleCase,
} from "@/lib/format";
import type { Client, Show, ShowContract } from "@/types/database";

/**
 * O que a cláusula do objeto diz sobre o artista, por modelo.
 *
 * Mostrado na prévia para ninguém procurar o nome da ficha do show no
 * documento: o modelo Carnellos sempre imprime "Carnellos", e o de Produção
 * não cita artista algum.
 */
function artistaNoContrato(key: ContractTemplateKey | null): string {
  if (key === "carnellos") return "Carnellos (fixo no modelo)";
  if (key === "producao") return "não citado (o modelo fala em “artistas”)";
  return "definido pelo modelo";
}

/**
 * Escolha do modelo e emissão do contrato.
 *
 * Os campos avulsos existem porque o modelo pede coisas que o cadastro do show
 * não guarda (endereço do contratante, nome do evento, horário). Ficam
 * opcionais: sem preencher, o contrato sai com a lacuna visível em vez de um
 * dado inventado.
 */
export function ContractDialog({
  open,
  onOpenChange,
  show,
  client,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  show: Show;
  client: Client | null;
  onCreated: (contract: ShowContract) => void;
}) {
  const [templateKey, setTemplateKey] = useState<ContractTemplateKey | null>(
    null
  );
  const [extras, setExtras] = useState<ContractExtras>(emptyExtras);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada abertura recomeça limpa — o diálogo fica montado entre um contrato e
  // outro e herdaria a escolha anterior. O horário vem preenchido com o
  // intervalo do cadastro ("22:00 às 00:00"), e continua editável.
  useEffect(() => {
    if (!open) return;
    setTemplateKey(null);
    setExtras({
      ...emptyExtras,
      eventTime: horarioParaContrato(show.event_time, show.event_end_time),
    });
    setError(null);
  }, [open, show.event_time, show.event_end_time]);

  function update<K extends keyof ContractExtras>(
    key: K,
    value: ContractExtras[K]
  ) {
    setExtras((prev) => ({ ...prev, [key]: value }));
  }

  /** Nome próprio digitado aqui entra no contrato com a caixa arrumada. */
  function normalizarNome(key: "eventName" | "city") {
    setExtras((prev) => ({ ...prev, [key]: titleCase(prev[key]) }));
  }

  /** Endereço do contratante, montado do cadastro (nunca digitado aqui). */
  const enderecoCliente = client ? formatEndereco(client) : "";

  async function handleGenerate() {
    if (!templateKey) return;
    setGenerating(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const contract = await createContract({
        show,
        client,
        templateKey,
        extras,
        authorEmail: userData.user?.email ?? null,
      });
      onCreated(contract);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao gerar o contrato."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar contrato</DialogTitle>
          <DialogDescription>
            Escolha o modelo. Os dados do show entram sobre o PDF original e as
            duas assinaturas são coletadas depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {TEMPLATE_LIST.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => setTemplateKey(template.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                templateKey === template.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              )}
            >
              <FileSignature
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  templateKey === template.key
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {template.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {template.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        {client && !enderecoCliente && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            O cliente está sem endereço no cadastro — a qualificação do
            contratante sai com a lacuna. Preencha o endereço em Clientes para
            o contrato sair completo.
          </p>
        )}

        {!client && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            Este show não tem cliente vinculado. O contrato sai com a
            qualificação do contratante em branco — vincule um cliente na ficha
            antes de enviar para assinatura.
          </p>
        )}

        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Dados que serão inseridos</p>
          {/* O contratante mostrado é o que vai para o documento: o nome
              completo, com o da ficha como reserva. O artista NÃO vem da
              ficha do show: cada modelo decide (Carnellos fixo / nenhum). */}
          <p className="mt-1">
            Artista: {artistaNoContrato(templateKey)} · Contratante:{" "}
            {client?.full_name?.trim() || client?.name || "—"} · Data:{" "}
            {formatData(show.event_date)} · Local: {show.location ?? "—"} ·
            Valor: {formatMoeda(show.value_cents)}
          </p>
          <p className="mt-1">
            Documento: {formatDocumento(client?.document) || "—"} · Telefone:{" "}
            {formatTelefone(client?.phone) || "—"}
          </p>
          <p className="mt-1">Endereço: {enderecoCliente || "—"}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="event_name">Nome do evento</Label>
            <Input
              id="event_name"
              value={extras.eventName}
              onChange={(e) => update("eventName", e.target.value)}
              onBlur={() => normalizarNome("eventName")}
              placeholder="Festa da Cidade"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event_time">Horário da apresentação</Label>
            {/* Preenchido com início e término do show; pode ser detalhado
                aqui. "22:00 às 00:00" sai como "das 22:00 às 00:00". */}
            <Input
              id="event_time"
              value={extras.eventTime}
              onChange={(e) => update("eventTime", e.target.value)}
              placeholder="22:00 às 00:00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract_city">Cidade da assinatura</Label>
            <Input
              id="contract_city"
              value={extras.city}
              onChange={(e) => update("city", e.target.value)}
              onBlur={() => normalizarNome("city")}
              placeholder="Paulínia"
            />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!templateKey || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando…
              </>
            ) : (
              "Gerar contrato"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
