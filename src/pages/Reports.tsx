import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, XCircle } from "lucide-react";

import { ExportExcelButton } from "@/components/ExportExcelButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calcularRelatorio,
  ETAPAS_FUNIL,
  MESES,
  TODOS_OS_MESES,
  type LinhaShow,
} from "@/lib/report";
import { exportReportToExcel } from "@/lib/report-export";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { cn, formatCurrency, parseDateOnly } from "@/lib/utils";
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

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, status, value_cents, event_date");

      if (!active) return;
      if (error) setError(error.message);
      else setShows((data as LinhaShow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

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
  } = useMemo(() => calcularRelatorio(shows, ano, mes), [shows, ano, mes]);

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
            Por data do evento. Período: {rotuloPeriodo}.
          </p>
        </div>

        {/* Filtros numa linha só, acima dos números. */}
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-40" aria-label="Mês">
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
            <SelectTrigger className="w-28" aria-label="Ano">
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
            onExport={() => exportReportToExcel(ano, mes)}
            emptyMessage="Nenhum show no período — a planilha saiu com os totais zerados."
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
          value={formatCurrency(somaMes)}
          hint={`${fechadosNoMes} show(s) fechado(s)`}
        />
        <StatTile
          label={`Fechado no ano de ${ano}`}
          value={formatCurrency(somaAno)}
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
                          {formatCurrency(valorPorStatus[status])}
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
    </div>
  );
}
