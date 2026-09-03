import { useMemo, useState } from "react";
import { Loader2, Mic2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoeda } from "@/lib/format";
import { nomeDoArtista, type LinhaShow } from "@/lib/report";
import { supabase } from "@/lib/supabase";

type Resumo = {
  nome: string;
  ids: string[];
  totalCents: number;
};

/**
 * Remoção dos artistas que aparecem no filtro dos relatórios.
 *
 * Artista não é cadastro próprio no sistema: é um campo do show. Então
 * "remover um artista da lista" só pode querer dizer uma coisa — apagar os
 * shows dele —, e é isso que este diálogo faz, dizendo antes quantos são e o
 * que vai junto. É o caminho para tirar da tela os shows de teste sem abrir o
 * banco.
 *
 * Cliente é diferente: lá existe cadastro, e a tela de Clientes oferece
 * ocultar em vez de excluir, preservando o histórico.
 */
export function ArtistManagerDialog({
  open,
  onOpenChange,
  shows,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Os mesmos shows que alimentam o relatório. */
  shows: LinhaShow[];
  /** Chamado depois de apagar, para a tela recarregar os números. */
  onChanged: () => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const artistas = useMemo(() => {
    const mapa = new Map<string, Resumo>();
    for (const show of shows) {
      const nome = nomeDoArtista(show)?.trim();
      if (!nome) continue;
      const atual = mapa.get(nome) ?? { nome, ids: [], totalCents: 0 };
      atual.ids.push(show.id);
      atual.totalCents += show.value_cents ?? 0;
      mapa.set(nome, atual);
    }
    return [...mapa.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [shows]);

  async function apagar(resumo: Resumo) {
    setApagando(resumo.nome);
    setErro(null);
    const { error } = await supabase
      .from("shows")
      .delete()
      .in("id", resumo.ids);
    setApagando(null);
    setConfirmando(null);
    if (error) {
      setErro(error.message);
      return;
    }
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar artistas</DialogTitle>
          <DialogDescription>
            Estes são os nomes que aparecem no filtro. Apagar um artista apaga
            os shows dele — use para tirar cadastros de teste do caminho.
          </DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

        {artistas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum show cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {artistas.map((artista) => {
              const confirmar = confirmando === artista.nome;
              return (
                <li key={artista.nome} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        <Mic2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {artista.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {artista.ids.length} show(s) ·{" "}
                        {formatMoeda(artista.totalCents)}
                      </p>
                    </div>

                    {!confirmar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirmando(artista.nome)}
                        title={`Apagar os shows de ${artista.nome}`}
                        aria-label={`Apagar os shows de ${artista.nome}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {/* A confirmação abre na própria linha, dizendo o tamanho do
                      estrago antes de acontecer. */}
                  {confirmar && (
                    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <p className="text-sm">
                        Apagar {artista.ids.length} show(s) de{" "}
                        <strong>{artista.nome}</strong>? Os contratos, tarefas e
                        o histórico desses shows vão junto. Não dá para desfazer.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void apagar(artista)}
                          disabled={apagando !== null}
                        >
                          {apagando === artista.nome ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Apagando…
                            </>
                          ) : (
                            "Apagar mesmo assim"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmando(null)}
                          disabled={apagando !== null}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Para tirar um <strong>cliente</strong> das listas sem perder o
          histórico, use “Ocultar” na tela de Clientes.
        </p>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
