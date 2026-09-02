import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { ClientFormDialog } from "@/components/ClientFormDialog";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { exportClientsToExcel } from "@/lib/clients-export";
import { formatEndereco, formatTelefone } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Client, ClientWithShowCount } from "@/types/database";

export function Clients() {
  const [clients, setClients] = useState<ClientWithShowCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*, shows(count)")
      .order("name");

    if (error) setError(error.message);
    else setClients((data as unknown as ClientWithShowCount[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      [c.name, c.full_name, c.phone, c.email, c.cidade]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term))
    );
  }, [clients, search]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setDialogOpen(true);
  }

  async function handleDelete(client: ClientWithShowCount) {
    const shows = client.shows?.[0]?.count ?? 0;
    const aviso =
      shows > 0
        ? `\n\n${shows} show(s) ficarão sem cliente vinculado (os shows não são apagados).`
        : "";
    if (!window.confirm(`Excluir "${client.name}"?${aviso}`)) return;

    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) {
      setError(error.message);
      return;
    }
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente(s) cadastrado(s).
          </p>
        </div>
        {/* No celular as duas ações dividem a largura da tela; a partir de
            sm voltam a ficar à direita do título. */}
        <div className="flex w-full flex-col items-stretch gap-2 min-[420px]:flex-row sm:w-auto sm:items-start">
          <ExportExcelButton
            onExport={exportClientsToExcel}
            emptyMessage="Nenhum cliente cadastrado ainda."
            className="w-full sm:w-auto"
          />
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail"
          className="pl-9"
          aria-label="Buscar clientes"
        />
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando clientes…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {clients.length === 0
            ? "Nenhum cliente cadastrado ainda."
            : "Nenhum cliente encontrado para essa busca."}
        </Card>
      ) : (
        <Card className="divide-y">
          {filtered.map((client) => {
            const showCount = client.shows?.[0]?.count ?? 0;
            return (
              <div
                key={client.id}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{client.name}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {showCount} show(s)
                    </span>
                  </div>
                  {/* O nome completo só aparece quando difere do da ficha —
                      repetir a mesma linha duas vezes não informa nada. */}
                  {client.full_name && client.full_name !== client.name && (
                    <p className="text-sm text-muted-foreground">
                      {client.full_name}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {client.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {formatTelefone(client.phone)}
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {client.email}
                      </span>
                    )}
                  </div>
                  {formatEndereco(client) && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatEndereco(client)}</span>
                    </p>
                  )}
                  {client.notes && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {client.notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(client)}
                    title={`Editar ${client.name}`}
                    aria-label={`Editar ${client.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(client)}
                    title={`Excluir ${client.name}`}
                    aria-label={`Excluir ${client.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
