import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Mic2,
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
import { cn } from "@/lib/utils";
import type { Client, ClientWithShowCount, Papel } from "@/types/database";

/** Abas de papel da listagem. "todos" mostra o cadastro inteiro. */
type FiltroPapel = Papel | "todos";

const FILTROS_PAPEL: { key: FiltroPapel; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "cliente", label: "Clientes" },
  { key: "artista", label: "Artistas" },
];

const temPapel = (client: Client, papel: FiltroPapel) =>
  papel === "todos" ||
  (papel === "cliente" ? client.is_client : client.is_artist);

/** Total de shows em que a pessoa aparece, somando os dois papéis. */
const totalShows = (client: ClientWithShowCount) =>
  (client.shows?.[0]?.count ?? 0) + (client.shows_artista?.[0]?.count ?? 0);

export function Clients() {
  const [clients, setClients] = useState<ClientWithShowCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [papel, setPapel] = useState<FiltroPapel>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  /** Papel pré-marcado ao abrir "Novo cliente" / "Novo artista". */
  const [papelNovo, setPapelNovo] = useState<Papel>("cliente");
  /** Cliente que está sendo removido — abre o diálogo de ocultar/excluir. */
  const [removendo, setRemovendo] = useState<ClientWithShowCount | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*, shows!shows_client_id_fkey(count), shows_artista:shows!shows_artist_id_fkey(count)")
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
    const visiveis = (
      mostrarInativos ? clients : clients.filter((c) => c.active)
    ).filter((c) => temPapel(c, papel));
    if (!term) return visiveis;
    return visiveis.filter((c) =>
      [c.name, c.full_name, c.phone, c.email, c.cidade]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term))
    );
  }, [clients, search, mostrarInativos, papel]);

  /** Contagem de ativos por papel, para o subtítulo. */
  const ativos = useMemo(() => {
    const lista = clients.filter((c) => c.active);
    return {
      clientes: lista.filter((c) => c.is_client).length,
      artistas: lista.filter((c) => c.is_artist).length,
    };
  }, [clients]);

  function openNew(papel: Papel) {
    setEditing(null);
    setPapelNovo(papel);
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
            Clientes e artistas
          </h1>
          <p className="text-sm text-muted-foreground">
            {ativos.clientes} cliente(s) · {ativos.artistas} artista(s)
            {inativos > 0 ? ` · ${inativos} inativo(s)` : ""}.
          </p>
        </div>
        {/* No celular as ações dividem a largura da tela; a partir de sm
            voltam a ficar à direita do título. Os dois "Novo" têm o mesmo
            peso: cliente e artista são cadastros irmãos. */}
        <div className="flex w-full flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:flex-wrap sm:w-auto sm:items-start">
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
          <Button
            onClick={() => openNew("cliente")}
            className="w-full sm:w-auto"
            data-testid="novo-cliente"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
          <Button
            onClick={() => openNew("artista")}
            className="w-full sm:w-auto"
            data-testid="novo-artista"
          >
            <Mic2 className="h-4 w-4" />
            Novo artista
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Abas de papel, no mesmo desenho das abas dos relatórios. */}
        <div
          className="flex rounded-md border p-0.5"
          role="tablist"
          aria-label="Filtrar por papel"
        >
          {FILTROS_PAPEL.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={papel === key}
              onClick={() => setPapel(key)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                papel === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="pl-9"
            aria-label="Buscar cadastros"
          />
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando cadastros…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {clients.length === 0
            ? "Nenhum cadastro ainda."
            : "Nenhum cadastro encontrado para essa busca."}
        </Card>
      ) : (
        <Card className="divide-y">
          {filtered.map((client) => {
            const showCount = totalShows(client);
            return (
              <div
                key={client.id}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{client.name}</p>
                    {/* Selos de papel: na aba "Todos" é o que diz se a
                        pessoa contrata, se apresenta, ou os dois. */}
                    {client.is_client && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
                        <Users className="h-3 w-3" />
                        Cliente
                      </span>
                    )}
                    {client.is_artist && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        <Mic2 className="h-3 w-3" />
                        Artista
                      </span>
                    )}
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
              {removendo && totalShows(removendo) > 0
                ? `Este cadastro tem ${totalShows(removendo)} show(s) vinculado(s).`
                : "Este cadastro não tem shows vinculados."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="rounded-md border bg-muted/40 p-3">
              <span className="font-medium text-foreground">Ocultar:</span> o
              nome sai das listagens e dos seletores da ficha do show, mas os
              shows e contratos antigos continuam intactos. Dá para reativar
              quando quiser.
            </p>
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <span className="font-medium text-destructive">Excluir:</span>{" "}
              apaga o cadastro de vez.
              {removendo && totalShows(removendo) > 0
                ? " Os shows não são apagados, mas perdem o vínculo (ficam sem contratante ou só com o nome do artista)."
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
        papel={papelNovo}
        onSaved={() => void load()}
      />
    </div>
  );
}
