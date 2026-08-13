import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";

import { ClientFormDialog } from "@/components/ClientFormDialog";
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
import { supabase } from "@/lib/supabase";
import { formatCurrency, parseCurrencyToCents } from "@/lib/utils";
import {
  SHOW_STATUSES,
  SHOW_STATUS_LABELS,
  type Client,
  type ShowStatus,
} from "@/types/database";

interface FormState {
  artist_name: string;
  client_id: string;
  event_date: string;
  location: string;
  status: ShowStatus;
  value: string;
  notes: string;
}

const emptyForm: FormState = {
  artist_name: "",
  client_id: "",
  event_date: "",
  location: "",
  status: "criado",
  value: "",
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          client_id: data.client_id ?? "",
          event_date: data.event_date ?? "",
          location: data.location ?? "",
          status: data.status,
          value: data.value_cents ? String(data.value_cents / 100) : "",
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
    setSaving(true);
    setError(null);

    const payload = {
      artist_name: form.artist_name.trim(),
      client_id: form.client_id || null,
      event_date: form.event_date || null,
      location: form.location.trim() || null,
      status: form.status,
      value_cents: form.value ? parseCurrencyToCents(form.value) : null,
      notes: form.notes.trim() || null,
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
      form.status === "fechado" && initialStatus !== "fechado";

    navigate(acabouDeFechar && savedId ? `/shows/${savedId}/contrato` : "/");
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
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/shows/${id}/contrato`)}
          >
            <FileText className="h-4 w-4" />
            Criar contrato
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {isEditing ? "Editar show" : "Novo show"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="artist_name">Artista *</Label>
              <Input
                id="artist_name"
                value={form.artist_name}
                onChange={(e) => update("artist_name", e.target.value)}
                placeholder="Nome do artista/banda"
                required
              />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_date">Data do evento</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => update("event_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">Valor (R$)</Label>
                <Input
                  id="value"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => update("value", e.target.value)}
                  placeholder="0,00"
                />
                {form.value && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(parseCurrencyToCents(form.value))}
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
                placeholder="Cidade / casa de show"
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

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSaved={handleClientSaved}
      />
    </div>
  );
}
