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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Client, Show, ShowContract } from "@/types/database";

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
  // outro e herdaria a escolha anterior.
  useEffect(() => {
    if (!open) return;
    setTemplateKey(null);
    setExtras(emptyExtras);
    setError(null);
  }, [open]);

  function update<K extends keyof ContractExtras>(
    key: K,
    value: ContractExtras[K]
  ) {
    setExtras((prev) => ({ ...prev, [key]: value }));
  }

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

        {!client && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            Este show não tem cliente vinculado. O contrato sai com a
            qualificação do contratante em branco — vincule um cliente na ficha
            antes de enviar para assinatura.
          </p>
        )}

        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Dados que serão inseridos</p>
          <p className="mt-1">
            Artista: {show.artist_name} · Contratante: {client?.name ?? "—"} ·
            Data: {formatDate(show.event_date)} · Local: {show.location ?? "—"} ·
            Valor: {formatCurrency(show.value_cents)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="client_address">Endereço do contratante</Label>
            <Input
              id="client_address"
              value={extras.clientAddress}
              onChange={(e) => update("clientAddress", e.target.value)}
              placeholder="Rua, nº, cidade"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event_name">Nome do evento</Label>
            <Input
              id="event_name"
              value={extras.eventName}
              onChange={(e) => update("eventName", e.target.value)}
              placeholder="Festa da Cidade"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event_time">Horário da apresentação</Label>
            <Input
              id="event_time"
              value={extras.eventTime}
              onChange={(e) => update("eventTime", e.target.value)}
              placeholder="23h às 01h"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract_city">Cidade da assinatura</Label>
            <Input
              id="contract_city"
              value={extras.city}
              onChange={(e) => update("city", e.target.value)}
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
