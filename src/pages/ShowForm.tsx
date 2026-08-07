import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";

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

  const [form, setForm] = useState<FormState>(emptyForm);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const query = isEditing
      ? supabase.from("shows").update(payload).eq("id", id!)
      : supabase.from("shows").insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      setError(error.message);
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
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

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
                <Select
                  value={form.client_id || undefined}
                  onValueChange={(v) => update("client_id", v)}
                >
                  <SelectTrigger id="client_id">
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
    </div>
  );
}
