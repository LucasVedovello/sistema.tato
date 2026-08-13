import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contractFileName, downloadContractPdf } from "@/lib/contract-pdf";
import { renderContract, type ContractVars } from "@/lib/contract-template";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, Show } from "@/types/database";

type ShowWithFullClient = Show & { clients: Client | null };

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function Contract() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [show, setShow] = useState<ShowWithFullClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campos ajustáveis na hora de emitir o contrato.
  const [paymentTerms, setPaymentTerms] = useState("");
  const [city, setCity] = useState("");
  const [savingTerms, setSavingTerms] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, clients(*)")
        .eq("id", id)
        .single();

      if (!active) return;
      if (error) setError(error.message);
      else if (data) {
        const row = data as unknown as ShowWithFullClient;
        setShow(row);
        setPaymentTerms(row.payment_terms ?? "");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const contract = useMemo(() => {
    if (!show) return null;
    const vars: ContractVars = {
      artista: show.artist_name,
      contratante: show.clients?.name ?? "",
      contratanteDoc: show.clients?.document ?? "",
      contratanteEmail: show.clients?.email ?? "",
      contratanteTel: show.clients?.phone ?? "",
      dataEvento: show.event_date ? formatDate(show.event_date) : "",
      local: show.location ?? "",
      valor: show.value_cents != null ? formatCurrency(show.value_cents) : "",
      formaPagamento: paymentTerms,
      cidade: city,
      dataAssinatura: LONG_DATE.format(new Date()),
    };
    return renderContract(vars);
  }, [show, paymentTerms, city]);

  /** Grava a forma de pagamento de volta no show. */
  async function handleSaveTerms() {
    if (!id) return;
    setSavingTerms(true);
    const { error } = await supabase
      .from("shows")
      .update({ payment_terms: paymentTerms.trim() || null })
      .eq("id", id);
    setSavingTerms(false);
    if (error) setError(error.message);
  }

  async function handleDownload() {
    if (!contract || !show) return;
    setGenerating(true);
    try {
      await downloadContractPdf(
        contract,
        contractFileName(show.artist_name, show.event_date)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao gerar o PDF do contrato."
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!show || !contract) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error ?? "Show não encontrado."}
      </Card>
    );
  }

  const missing = [
    !show.clients && "cliente",
    !show.event_date && "data do evento",
    !show.location && "local",
    show.value_cents == null && "valor",
    !paymentTerms.trim() && "forma de pagamento",
    !city.trim() && "cidade de assinatura",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handleDownload} disabled={generating}>
          <Download className="h-4 w-4" />
          {generating ? "Gerando…" : "Baixar PDF"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Contrato — {show.artist_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Forma de pagamento</Label>
              <div className="flex gap-2">
                <Input
                  id="payment_terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="50% na assinatura e 50% no dia do evento"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleSaveTerms}
                  disabled={savingTerms}
                  title="Salvar forma de pagamento no show"
                  aria-label="Salvar forma de pagamento no show"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade de assinatura</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ribeirão Preto"
              />
            </div>
          </div>

          {missing.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              Faltando preencher: {missing.join(", ")}. O contrato sai com “—”
              nesses campos.
            </p>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/*
        O preview imita a folha impressa, então fica sempre claro (papel branco
        com texto preto) mesmo no tema escuro — é uma representação do
        documento, não parte da interface.
      */}
      <div className="overflow-x-auto rounded-lg border bg-neutral-200 p-4 dark:bg-neutral-800 sm:p-8">
        <article
          data-testid="contract-preview"
          className="mx-auto w-full max-w-[210mm] space-y-4 bg-white p-8 font-serif text-[13px] leading-relaxed text-black shadow-lg sm:p-12"
        >
          <h2 className="text-center text-base font-bold uppercase">
            {contract.title}
          </h2>

          <p className="text-justify">{contract.preamble}</p>

          {contract.clauses.map((clause) => (
            <div key={clause.heading} className="space-y-1">
              <h3 className="font-bold">{clause.heading}</h3>
              <p className="text-justify">{clause.body}</p>
            </div>
          ))}

          <p className="text-justify">{contract.closing}</p>
          <p className="pt-2">{contract.placeAndDate}</p>

          <div className="space-y-8 pt-8">
            {contract.signatures.map((signature) => (
              <div key={signature.role} className="space-y-1">
                <div className="h-px w-64 bg-black" />
                <p>{signature.name}</p>
                <p className="text-xs">{signature.role}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
