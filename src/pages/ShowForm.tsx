import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";

import { ClientFormDialog } from "@/components/ClientFormDialog";
import { ShowContracts } from "@/components/ShowContracts";
import { ShowTasks } from "@/components/ShowTasks";
import { ShowTimeline } from "@/components/ShowTimeline";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCTION_ROLES } from "@/lib/production";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  centavosParaMoeda,
  dataValida,
  formatHora,
  formatMoeda,
  horaValida,
  maskMoeda,
  moedaParaCentavos,
  normalizarTexto,
  titleCase,
} from "@/lib/format";
import {
  SHOW_STATUSES,
  SHOW_STATUS_LABELS,
  type Client,
  type ShowStatus,
} from "@/types/database";

interface FormState {
  /** Nome da ficha (artístico) — o que aparece nas telas. */
  artist_name: string;
  /** Nome completo — o único que sai no contrato. */
  artist_full_name: string;
  client_id: string;
  event_date: string;
  event_time: string;
  location: string;
  status: ShowStatus;
  value: string;
  /** Chaves de PRODUCTION_ROLES marcadas para este show. */
  production_roles: string[];
  payment_terms: string;
  notes: string;
}

const emptyForm: FormState = {
  artist_name: "",
  artist_full_name: "",
  client_id: "",
  event_date: "",
  event_time: "",
  location: "",
  status: "criado",
  value: "",
  production_roles: [],
  payment_terms: "",
  notes: "",
};

export function ShowForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  // O calendário manda ?data=AAAA-MM-DD ao clicar num dia livre.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(() => {
    const preset = searchParams.get("data");
    return preset ? { ...emptyForm, event_date: preset } : emptyForm;
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  /** Status com que o show foi carregado, para detectar a virada p/ "fechado". */
  const [initialStatus, setInitialStatus] = useState<ShowStatus | null>(null);
  /** Erros de validação por campo, mostrados abaixo de cada um. */
  const [erros, setErros] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );

  /**
   * Cliente recém-cadastrado pelo diálogo: entra na lista (mantendo a ordem
   * alfabética do select) e fica pendente de seleção.
   *
   * A seleção NÃO pode acontecer aqui. O Radix Select mantém um <select>
   * nativo espelhado e dispara um evento `change` de verdade quando o valor
   * muda; se a <option> do cliente novo ainda não estiver no DOM (o que
   * acontece quando lista e valor mudam no mesmo commit), o navegador força o
   * valor de volta para "" e o onValueChange devolve string vazia, desfazendo
   * a seleção. Por isso o id fica pendente e só é aplicado no efeito abaixo,
   * depois que a opção existe.
   */
  function handleClientSaved(client: Client) {
    setClients((prev) =>
      [...prev.filter((c) => c.id !== client.id), client].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      )
    );
    setPendingClientId(client.id);
  }

  useEffect(() => {
    if (!pendingClientId) return;
    if (!clients.some((c) => c.id === pendingClientId)) return;
    setForm((prev) => ({ ...prev, client_id: pendingClientId }));
    setPendingClientId(null);
  }, [pendingClientId, clients]);

  /**
   * Leva o olho até o card de contratos. É para lá que aponta tanto o botão
   * do cabeçalho quanto o fechamento do show — e como a ficha já é a rota
   * atual, navegar não faria nada visível.
   */
  function scrollToContracts() {
    window.setTimeout(() => {
      document
        .querySelector('[data-testid="contracts"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Normaliza um nome próprio quando o campo perde o foco.
   *
   * No blur, e não a cada tecla: corrigir a caixa no meio da digitação move o
   * cursor e atrapalha quem está escrevendo.
   */
  function normalizarNome(key: "artist_name" | "artist_full_name" | "location") {
    setForm((prev) => ({ ...prev, [key]: titleCase(prev[key]) }));
  }

  /** Valida o formulário inteiro; devolve os erros encontrados. */
  function validar(atual: FormState) {
    const novos: Partial<Record<keyof FormState, string>> = {};
    if (!normalizarTexto(atual.artist_name)) {
      novos.artist_name = "Informe o nome da ficha do artista.";
    }
    if (atual.event_date && !dataValida(atual.event_date)) {
      novos.event_date = "Data inválida.";
    }
    if (atual.event_time && !horaValida(atual.event_time)) {
      novos.event_time = "Horário inválido (use HH:MM).";
    }
    return novos;
  }

  /** Liga/desliga uma função de produção, preservando as demais. */
  function toggleProduction(key: string) {
    setForm((prev) => ({
      ...prev,
      production_roles: prev.production_roles.includes(key)
        ? prev.production_roles.filter((atual) => atual !== key)
        : [...prev.production_roles, key],
    }));
  }

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .order("name")
      .then(({ data }) => setClients((data as Client[]) ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .eq("id", id)
        .single();

      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        setInitialStatus(data.status);
        setForm({
          artist_name: data.artist_name,
          artist_full_name: data.artist_full_name ?? "",
          client_id: data.client_id ?? "",
          event_date: data.event_date ?? "",
          event_time: formatHora(data.event_time),
          location: data.location ?? "",
          status: data.status,
          value: centavosParaMoeda(data.value_cents),
          // Shows gravados antes da coluna existir voltam sem o campo.
          production_roles: data.production_roles ?? [],
          payment_terms: data.payment_terms ?? "",
          notes: data.notes ?? "",
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Os textos livres vão para o banco já normalizados (sem espaço sobrando,
    // com a caixa arrumada): é o que o contrato vai imprimir.
    const limpo: FormState = {
      ...form,
      artist_name: titleCase(form.artist_name),
      artist_full_name: titleCase(form.artist_full_name),
      location: titleCase(form.location),
      payment_terms: normalizarTexto(form.payment_terms),
      notes: form.notes.trim(),
    };
    const novosErros = validar(limpo);
    setForm(limpo);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSaving(true);
    setError(null);

    const payload = {
      artist_name: limpo.artist_name,
      artist_full_name: limpo.artist_full_name || null,
      client_id: limpo.client_id || null,
      event_date: limpo.event_date || null,
      event_time: limpo.event_time || null,
      location: limpo.location || null,
      status: limpo.status,
      value_cents: limpo.value ? moedaParaCentavos(limpo.value) : null,
      production_roles: limpo.production_roles,
      payment_terms: limpo.payment_terms || null,
      notes: limpo.notes || null,
    };

    // .select("id").single() para saber o id também no cadastro novo — ele é
    // necessário para abrir o contrato logo depois.
    const { data, error } = isEditing
      ? await supabase
          .from("shows")
          .update(payload)
          .eq("id", id!)
          .select("id")
          .single()
      : await supabase.from("shows").insert(payload).select("id").single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Virou "fechado" agora? Segue direto para o contrato.
    const savedId = data?.id ?? id;
    const acabouDeFechar =
      limpo.status === "fechado" && initialStatus !== "fechado";

    // Show fechado é show que vira contrato: em vez do dashboard, a ficha —
    // com o card de contratos à vista.
    if (acabouDeFechar && savedId) {
      navigate(`/shows/${savedId}`);
      scrollToContracts();
      return;
    }
    navigate("/");
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm("Excluir este show? Esta ação não pode ser desfeita."))
      return;
    const { error } = await supabase.from("shows").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/");
  }

  if (loading) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }

  return (
    // Cadastro novo é uma coluna estreita; a ficha de um show existente abre
    // em duas colunas, com a timeline ao lado.
    <div
      className={cn(
        "mx-auto space-y-4",
        isEditing ? "max-w-6xl" : "max-w-2xl"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToContracts}
          >
            <FileText className="h-4 w-4" />
            Criar contrato
          </Button>
        )}
      </div>

      <div
        className={cn(
          isEditing &&
            // `min-w-0` nos itens: sem isso o grid respeita a largura mínima
            // do conteúdo (um botão com whitespace-nowrap, por exemplo) e a
            // página inteira passa a rolar na horizontal no celular.
            "grid items-start gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
              {isEditing ? "Ficha do show" : "Novo show"}
              {isEditing && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[form.status].badge
                  )}
                >
                  {STATUS_STYLES[form.status].label}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dois nomes de propósito: o curto é o que circula no dia a dia
                (Kanban, calendário, ficha técnica) e o completo é o único que
                entra no contrato. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="artist_name">Nome da ficha (artista) *</Label>
                <Input
                  id="artist_name"
                  value={form.artist_name}
                  onChange={(e) => update("artist_name", e.target.value)}
                  onBlur={() => normalizarNome("artist_name")}
                  placeholder="Nome artístico / da banda"
                  aria-invalid={Boolean(erros.artist_name)}
                  required
                />
                {erros.artist_name ? (
                  <p className="text-xs font-medium text-destructive">
                    {erros.artist_name}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aparece nas telas e na ficha técnica.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist_full_name">Nome completo</Label>
                <Input
                  id="artist_full_name"
                  value={form.artist_full_name}
                  onChange={(e) => update("artist_full_name", e.target.value)}
                  onBlur={() => normalizarNome("artist_full_name")}
                  placeholder="Nome civil completo"
                />
                <p className="text-xs text-muted-foreground">
                  É este que sai no contrato. Em branco, o contrato usa o nome
                  da ficha.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente</Label>
                <div className="flex gap-2">
                  {/* "" (e não undefined) mantém o Select controlado quando
                      ainda não há cliente; o Radix exibe o placeholder do
                      mesmo jeito. */}
                  <Select
                    value={form.client_id}
                    onValueChange={(v) => update("client_id", v)}
                  >
                    <SelectTrigger id="client_id" className="flex-1">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhum cliente cadastrado
                        </div>
                      )}
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setClientDialogOpen(true)}
                    title="Cadastrar novo cliente"
                    aria-label="Cadastrar novo cliente"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v as ShowStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOW_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {SHOW_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="event_date">Data do evento</Label>
                {/* type="date"/"time": o próprio navegador já entrega
                    "AAAA-MM-DD" e "HH:MM" (e mostra no formato do país), então
                    a máscara aqui seria um passo a mais para errar. */}
                <Input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => update("event_date", e.target.value)}
                  aria-invalid={Boolean(erros.event_date)}
                />
                {erros.event_date && (
                  <p className="text-xs font-medium text-destructive">
                    {erros.event_date}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_time">Horário</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={form.event_time}
                  onChange={(e) => update("event_time", e.target.value)}
                  aria-invalid={Boolean(erros.event_time)}
                />
                {erros.event_time && (
                  <p className="text-xs font-medium text-destructive">
                    {erros.event_time}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                {/* O "R$" é fixo à esquerda e o campo recebe só os centavos
                    digitados, já pontuados — assim o valor entra no banco
                    sempre como número, e sai no contrato sempre igual. */}
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="value"
                    inputMode="numeric"
                    className="pl-9"
                    value={form.value}
                    onChange={(e) => update("value", maskMoeda(e.target.value))}
                    placeholder="0,00"
                  />
                </div>
                {form.value && (
                  <p className="text-xs text-muted-foreground">
                    {formatMoeda(moedaParaCentavos(form.value))}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                onBlur={() => normalizarNome("location")}
                placeholder="Casa de show / arena"
              />
              <p className="text-xs text-muted-foreground">
                Onde o show acontece. No contrato entra como local da
                apresentação.
              </p>
            </div>

            {/* Produção deixou de ser sim/não: um show pode ter várias
                funções ao mesmo tempo, e é isso que vai para a planilha. */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">
                Produção
              </legend>
              <p className="text-xs text-muted-foreground">
                Marque tudo o que este show inclui. Pode ser mais de uma opção.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRODUCTION_ROLES.map((role) => {
                  const marcado = form.production_roles.includes(role.key);
                  return (
                    <label
                      key={role.key}
                      className={cn(
                        // min-h-11: alvo de toque confortável no celular.
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm transition-colors",
                        marcado
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary"
                        checked={marcado}
                        onChange={() => toggleProduction(role.key)}
                      />
                      {role.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Forma de pagamento</Label>
              <Input
                id="payment_terms"
                value={form.payment_terms}
                onChange={(e) => update("payment_terms", e.target.value)}
                placeholder="50% na assinatura e 50% no dia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Detalhes de contratação, rider, etc."
                rows={4}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </form>
          </CardContent>
        </Card>

        {isEditing && id && (
          <div className="space-y-4">
            <ShowContracts showId={id} />
            <ShowTasks showId={id} />
            <ShowTimeline showId={id} />
          </div>
        )}
      </div>

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSaved={handleClientSaved}
      />
    </div>
  );
}
