import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Mic2, Settings2, TrendingUp, XCircle } from "lucide-react";

import { ArtistManagerDialog } from "@/components/ArtistManagerDialog";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  artistasDisponiveis,
  calcularFechadoPorPeriodo,
  nomeDoArtista,
  calcularRelatorio,
  ETAPAS_FUNIL,
  MESES,
  PERIODOS_ARTISTA,
  TODOS_OS_ARTISTAS,
  TODOS_OS_MESES,
  type LinhaShow,
  type PeriodoArtista,
} from "@/lib/report";
import { exportReportToExcel } from "@/lib/report-export";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";
import { formatData, formatMoeda, parseDateOnly } from "@/lib/format";
import type { ShowStatus } from "@/types/database";

/** Cor da barra de cada etapa — a mesma usada no Kanban e no calendário. */
const BARRA: Record<ShowStatus, string> = {
  criado: "bg-slate-400",
  em_fechamento: "bg-amber-500",
  fechado: "bg-emerald-500",
  cancelado: "bg-rose-500",
};

/** Número grande, sem gráfico: é uma manchete, não uma série. */
function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof TrendingUp;
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function Reports() {
  const [shows, setShows] = useState<LinhaShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState<string>(String(hoje.getMonth()));
  const [artista, setArtista] = useState<string>(TODOS_OS_ARTISTAS);
  const [periodoArtista, setPeriodoArtista] = useState<PeriodoArtista>("mes");

  const [gerenciarAberto, setGerenciarAberto] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("shows")
      .select(
        "id, status, value_cents, event_date, artist_name, artist_full_name"
      );

    if (error) setError(error.message);
    else setShows((data as LinhaShow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Artistas que aparecem nos dados (todos os anos, não só o filtrado). */
  const artistas = useMemo(() => artistasDisponiveis(shows), [shows]);

  /**
   * Mês de referência do painel por artista.
   *
   * Com "Ano inteiro" escolhido no filtro não existe mês selecionado, e o
   * painel precisa de um para recortar o mês e o semestre: cai no mês corrente
   * quando o ano filtrado é o de hoje, e em janeiro nos demais. Cada cartão
   * mostra o período que representa, então não sobra ambiguidade na leitura.
   */
  const mesReferencia =
    mes === TODOS_OS_MESES
      ? Number(ano) === hoje.getFullYear()
        ? hoje.getMonth()
        : 0
      : Number(mes);

  const fechadoPorPeriodo = useMemo(
    () => calcularFechadoPorPeriodo(shows, ano, mesReferencia, artista),
    [shows, ano, mesReferencia, artista]
  );

  /** Anos que aparecem nos dados, mais o ano corrente. */
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([hoje.getFullYear()]);
    for (const show of shows) {
      if (show.event_date) set.add(parseDateOnly(show.event_date).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
    // hoje.getFullYear() é estável dentro da sessão; não precisa de dependência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shows]);

  /**
   * Números do período. A conta mora em `lib/report.ts` porque a exportação
   * para Excel usa exatamente a mesma — planilha e tela não podem divergir.
   */
  const {
    porStatus,
    valorPorStatus,
    totalPeriodo,
    fechadosNoMes,
    fechadosNoAno,
    somaMes,
    somaAno,
    conversao,
    semData,
    rotuloPeriodo,
  } = useMemo(
    () => calcularRelatorio(shows, ano, mes, artista),
    [shows, ano, mes, artista]
  );

  const maiorEtapa = Math.max(
    1,
    ...ETAPAS_FUNIL.map((status) => porStatus[status])
  );

  if (loading) {
    return <p className="text-muted-foreground">Carregando relatórios…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-primary" />
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Por data do evento. Período: {rotuloPeriodo}
            {artista === TODOS_OS_ARTISTAS ? "" : ` · Artista: ${artista}`}.
          </p>
        </div>

        {/* Filtros numa linha só, acima dos números. No celular os dois
            selects dividem a largura e a exportação desce para a linha de
            baixo. */}
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {/* O artista recorta o relatório inteiro — funil e conversão
              inclusive —, e não só o painel de valores fechados. */}
          <Select value={artista} onValueChange={setArtista}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Artista">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_ARTISTAS}>
                Todos os artistas
              </SelectItem>
              {artistas.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Some com nomes que não deveriam estar na lista (cadastros de
              teste, sobras) sem precisar abrir o banco. */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setGerenciarAberto(true)}
            title="Gerenciar artistas"
            aria-label="Gerenciar artistas"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-32 flex-1 sm:w-40 sm:flex-none" aria-label="Mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_MESES}>Ano inteiro</SelectItem>
              {MESES.map((nome, i) => (
                <SelectItem key={nome} value={String(i)}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24 flex-1 sm:w-28 sm:flex-none" aria-label="Ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Exporta o período selecionado, com os mesmos números da tela. */}
          <ExportExcelButton
            onExport={() => exportReportToExcel(ano, mes, artista, mesReferencia)}
            emptyMessage="Nenhum show no período — a planilha saiu com os totais zerados."
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="kpis">
        <StatTile
          label={
            mes === TODOS_OS_MESES
              ? `Fechado em ${ano}`
              : `Fechado em ${MESES[Number(mes)]}`
          }
          value={formatMoeda(somaMes)}
          hint={`${fechadosNoMes} show(s) fechado(s)`}
        />
        <StatTile
          label={`Fechado no ano de ${ano}`}
          value={formatMoeda(somaAno)}
          hint={`${fechadosNoAno} show(s) fechado(s)`}
        />
        <StatTile
          label="Taxa de conversão"
          icon={TrendingUp}
          value={conversao === null ? "—" : `${conversao.toFixed(0)}%`}
          hint={
            conversao === null
              ? "Sem shows no período"
              : `${porStatus.fechado} fechado(s) de ${totalPeriodo} no período`
          }
        />
      </div>

      {/* Valor fechado por artista, nos três recortes de tempo. Os cartões
          são também o seletor: o período escolhido manda na lista abaixo. */}
      <Card data-testid="fechado-por-artista">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="h-4 w-4 text-primary" />
            Fechado por artista
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {artista === TODOS_OS_ARTISTAS
              ? "Todos os artistas"
              : artista}{" "}
            · só shows com status “Fechado”. Toque num período para ver os
            shows dele.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3" role="tablist">
            {PERIODOS_ARTISTA.map(({ key, label }) => {
              const dados = fechadoPorPeriodo[key];
              const ativo = key === periodoArtista;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setPeriodoArtista(key)}
                  data-testid={`periodo-${key}`}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    ativo
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {formatMoeda(dados.totalCents)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dados.rotulo} · {dados.quantidade} show(s)
                  </p>
                </button>
              );
            })}
          </div>

          {fechadoPorPeriodo[periodoArtista].shows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum show fechado em {fechadoPorPeriodo[periodoArtista].rotulo}.
            </p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {fechadoPorPeriodo[periodoArtista].shows.map((show) => (
                <li
                  key={show.id}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {nomeDoArtista(show)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatData(show.event_date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoeda(show.value_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil por status</CardTitle>
          <p className="text-sm text-muted-foreground">
            Distribuição atual dos shows de {rotuloPeriodo}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalPeriodo === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum show neste período.
            </p>
          ) : (
            <>
              {/* Cada barra carrega rótulo e número: a identidade nunca depende
                  só da cor. */}
              <ol className="space-y-3" data-testid="funil">
                {ETAPAS_FUNIL.map((status) => {
                  const quantidade = porStatus[status];
                  const largura = (quantidade / maiorEtapa) * 100;
                  return (
                    <li key={status} data-testid={`etapa-${status}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {STATUS_STYLES[status].label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {quantidade} show(s) ·{" "}
                          {formatMoeda(valorPorStatus[status])}
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-sm bg-muted">
                        <div
                          className={cn("h-3 rounded-sm", BARRA[status])}
                          style={{ width: `${largura}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="flex items-center justify-between gap-2 border-t pt-3 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  Cancelados (fora do funil)
                </span>
                <span className="tabular-nums font-medium">
                  {porStatus.cancelado} show(s)
                </span>
              </div>
            </>
          )}

          {semData > 0 && (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {semData} show(s) sem data de evento não entram em nenhum
              período e ficam fora destes números.
            </p>
          )}
        </CardContent>
      </Card>

      <ArtistManagerDialog
        open={gerenciarAberto}
        onOpenChange={setGerenciarAberto}
        shows={shows}
        onChanged={() => {
          // O artista escolhido pode ter acabado de sair da lista.
          setArtista(TODOS_OS_ARTISTAS);
          void carregar();
        }}
      />
    </div>
  );
}
