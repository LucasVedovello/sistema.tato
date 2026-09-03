import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { ClientFormDialog } from "@/components/ClientFormDialog";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** Cliente que está sendo removido — abre o diálogo de ocultar/excluir. */
  const [removendo, setRemovendo] = useState<ClientWithShowCount | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [salvando, setSalvando] = useState(false);

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

  const inativos = useMemo(
    () => clients.filter((c) => !c.active).length,
    [clients]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Inativos ficam fora por padrão: some das listas sem perder o histórico.
    const visiveis = mostrarInativos ? clients : clients.filter((c) => c.active);
    if (!term) return visiveis;
    return visiveis.filter((c) =>
      [c.name, c.full_name, c.phone, c.email, c.cidade]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term))
    );
  }, [clients, search, mostrarInativos]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setDialogOpen(true);
  }

  /** Liga/desliga o cliente sem tocar no histórico. */
  async function definirAtivo(client: ClientWithShowCount, ativo: boolean) {
    setSalvando(true);
    const { error } = await supabase
      .from("clients")
      .update({ active: ativo })
      .eq("id", client.id);
    setSalvando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRemovendo(null);
    void load();
  }

  async function excluir(client: ClientWithShowCount) {
    setSalvando(true);
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    setSalvando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRemovendo(null);
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
            {clients.filter((c) => c.active).length} cliente(s) ativo(s)
            {inativos > 0 ? ` · ${inativos} inativo(s)` : ""}.
          </p>
        </div>
        {/* No celular as duas ações dividem a largura da tela; a partir de
            sm voltam a ficar à direita do título. */}
        <div className="flex w-full flex-col items-stretch gap-2 min-[420px]:flex-row sm:w-auto sm:items-start">
          {inativos > 0 && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setMostrarInativos((v) => !v)}
            >
              {mostrarInativos ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {mostrarInativos
                ? "Ocultar inativos"
                : `Ver inativos (${inativos})`}
            </Button>
          )}
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
                    {!client.active && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inativo
                      </span>
                    )}
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
                  {client.active ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setRemovendo(client)}
                      title={`Remover ${client.name}`}
                      aria-label={`Remover ${client.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void definirAtivo(client, true)}
                      title={`Reativar ${client.name}`}
                      aria-label={`Reativar ${client.name}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/*
        Remover tem dois sentidos, e o diálogo separa os dois: ocultar tira o
        nome das listas e preserva o histórico; excluir apaga o cadastro e
        deixa os shows sem contratante. Com shows vinculados, ocultar é o
        caminho recomendado.
      */}
      <Dialog
        open={removendo !== null}
        onOpenChange={(aberto) => !aberto && setRemovendo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover “{removendo?.name}”?</DialogTitle>
            <DialogDescription>
              {(removendo?.shows?.[0]?.count ?? 0) > 0
                ? `Este cliente tem ${removendo?.shows?.[0]?.count} show(s) vinculado(s).`
                : "Este cliente não tem shows vinculados."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="rounded-md border bg-muted/40 p-3">
              <span className="font-medium text-foreground">Ocultar:</span> o
              nome sai das listagens e do seletor de cliente do show, mas os
              shows e contratos antigos continuam intactos. Dá para reativar
              quando quiser.
            </p>
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <span className="font-medium text-destructive">Excluir:</span>{" "}
              apaga o cadastro de vez.
              {(removendo?.shows?.[0]?.count ?? 0) > 0
                ? " Os shows não são apagados, mas ficam sem contratante."
                : ""}{" "}
              Não dá para desfazer.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemovendo(null)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removendo && void excluir(removendo)}
              disabled={salvando}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
            <Button
              type="button"
              onClick={() => removendo && void definirAtivo(removendo, false)}
              disabled={salvando}
            >
              <EyeOff className="h-4 w-4" />
              Ocultar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
