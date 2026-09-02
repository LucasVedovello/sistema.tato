/**
 * Cálculo do relatório, fora da tela.
 *
 * A página e a exportação para Excel precisam dos MESMOS números; deixar a
 * conta num só lugar evita a planilha e a tela discordarem quando um dos dois
 * mudar.
 */

import { parseDateOnly } from "@/lib/format";
import type { ShowStatus } from "@/types/database";

/** Só o que o relatório usa de cada show. */
export type LinhaShow = {
  id: string;
  status: ShowStatus;
  value_cents: number | null;
  event_date: string | null;
  /** Nome da ficha do artista — é por ele que o filtro agrupa. */
  artist_name: string;
};

/**
 * Etapas do funil, na ordem da negociação.
 *
 * "cancelado" fica FORA de propósito: não é uma etapa que o show percorre, é
 * uma perda — e mostrá-lo como barra ao lado de "fechado" também juntava o
 * verde e o vermelho, o par que daltônicos (deuteranopia) menos distinguem.
 * Ele aparece à parte, com rótulo próprio.
 */
export const ETAPAS_FUNIL: ShowStatus[] = ["criado", "em_fechamento", "fechado"];

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const TODOS_OS_MESES = "todos";

/**
 * Valor do filtro de artista quando nenhum artista foi escolhido.
 *
 * Os sublinhados evitam a colisão com um artista que se chame "todos": o
 * seletor usaria o mesmo valor em duas opções e a escolha ficaria ambígua.
 */
export const TODOS_OS_ARTISTAS = "__todos__";

/** Períodos do painel "fechado por artista". */
export type PeriodoArtista = "mes" | "semestre" | "ano";

export const PERIODOS_ARTISTA: { key: PeriodoArtista; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "semestre", label: "Semestre" },
  { key: "ano", label: "Ano" },
];

/** Artistas que aparecem nos dados, em ordem alfabética. */
export function artistasDisponiveis(shows: LinhaShow[]): string[] {
  const nomes = new Set<string>();
  for (const show of shows) {
    const nome = show.artist_name?.trim();
    if (nome) nomes.add(nome);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Recorta a lista pelo artista escolhido. "todos" devolve tudo. */
export function filtrarPorArtista(
  shows: LinhaShow[],
  artista: string
): LinhaShow[] {
  if (artista === TODOS_OS_ARTISTAS) return shows;
  return shows.filter((s) => s.artist_name === artista);
}

const zeradoPorStatus = (): Record<ShowStatus, number> => ({
  criado: 0,
  em_fechamento: 0,
  fechado: 0,
  cancelado: 0,
});

export interface Relatorio {
  /** Shows do ano e do período (mês escolhido, ou o ano inteiro). */
  doAno: LinhaShow[];
  doMes: LinhaShow[];
  porStatus: Record<ShowStatus, number>;
  /** Soma dos valores de cada status, em centavos, dentro do período. */
  valorPorStatus: Record<ShowStatus, number>;
  totalPeriodo: number;
  fechadosNoMes: number;
  fechadosNoAno: number;
  somaMes: number;
  somaAno: number;
  /** Percentual de fechados sobre tudo que entrou no período; null se vazio. */
  conversao: number | null;
  /** Shows sem data não entram em período nenhum. */
  semData: number;
  rotuloPeriodo: string;
}

const somaFechados = (lista: LinhaShow[]) =>
  lista
    .filter((s) => s.status === "fechado")
    .reduce((total, s) => total + (s.value_cents ?? 0), 0);

/**
 * Recorta e resume os shows para o ano/mês escolhidos.
 *
 * O artista entra como recorte ANTES de qualquer conta: com um artista
 * selecionado, todos os números da tela (funil, conversão, totais) passam a
 * ser dele — um filtro que só mudasse um cartão confundiria mais do que
 * ajudaria.
 */
export function calcularRelatorio(
  shows: LinhaShow[],
  ano: string,
  mes: string,
  artista: string = TODOS_OS_ARTISTAS
): Relatorio {
  const anoNum = Number(ano);
  shows = filtrarPorArtista(shows, artista);

  const doAno = shows.filter(
    (s) => s.event_date && parseDateOnly(s.event_date).getFullYear() === anoNum
  );
  const doMes =
    mes === TODOS_OS_MESES
      ? doAno
      : doAno.filter(
          (s) => parseDateOnly(s.event_date!).getMonth() === Number(mes)
        );

  const porStatus = zeradoPorStatus();
  const valorPorStatus = zeradoPorStatus();
  for (const show of doMes) {
    porStatus[show.status] += 1;
    valorPorStatus[show.status] += show.value_cents ?? 0;
  }

  const totalPeriodo = doMes.length;

  return {
    doAno,
    doMes,
    porStatus,
    valorPorStatus,
    totalPeriodo,
    fechadosNoMes: porStatus.fechado,
    fechadosNoAno: doAno.filter((s) => s.status === "fechado").length,
    somaMes: somaFechados(doMes),
    somaAno: somaFechados(doAno),
    conversao:
      totalPeriodo === 0 ? null : (porStatus.fechado / totalPeriodo) * 100,
    semData: shows.filter((s) => !s.event_date).length,
    rotuloPeriodo:
      mes === TODOS_OS_MESES ? `${ano}` : `${MESES[Number(mes)]} de ${ano}`,
  };
}

/** Semestre (1 ou 2) a que pertence um mês 0..11. */
export const semestreDoMes = (mes: number): 1 | 2 => (mes < 6 ? 1 : 2);

/** Total fechado de um recorte, com o rótulo do período que ele representa. */
export interface TotalFechado {
  rotulo: string;
  /** Soma dos shows FECHADOS, em centavos. */
  totalCents: number;
  quantidade: number;
  /** Os shows fechados que entraram na soma, do mais recente ao mais antigo. */
  shows: LinhaShow[];
}

/** Os três recortes do painel por artista, sempre calculados juntos. */
export interface FechadoPorPeriodo {
  mes: TotalFechado;
  semestre: TotalFechado;
  ano: TotalFechado;
}

const totalFechado = (rotulo: string, lista: LinhaShow[]): TotalFechado => {
  const fechados = lista
    .filter((s) => s.status === "fechado")
    .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
  return {
    rotulo,
    totalCents: fechados.reduce((soma, s) => soma + (s.value_cents ?? 0), 0),
    quantidade: fechados.length,
    shows: fechados,
  };
};

/**
 * Valor FECHADO no mês, no semestre e no ano — opcionalmente de um artista só.
 *
 * `mesRef` é o mês de referência (0..11): dele saem tanto o recorte mensal
 * quanto o semestre correspondente. Só shows com status "fechado" entram; os
 * demais não são receita combinada.
 */
export function calcularFechadoPorPeriodo(
  shows: LinhaShow[],
  ano: string,
  mesRef: number,
  artista: string = TODOS_OS_ARTISTAS
): FechadoPorPeriodo {
  const anoNum = Number(ano);
  const doArtista = filtrarPorArtista(shows, artista);

  const doAno = doArtista.filter(
    (s) => s.event_date && parseDateOnly(s.event_date).getFullYear() === anoNum
  );
  const semestre = semestreDoMes(mesRef);
  const doSemestre = doAno.filter((s) => {
    const mes = parseDateOnly(s.event_date!).getMonth();
    return semestreDoMes(mes) === semestre;
  });
  const doMes = doAno.filter(
    (s) => parseDateOnly(s.event_date!).getMonth() === mesRef
  );

  return {
    mes: totalFechado(`${MESES[mesRef]} de ${ano}`, doMes),
    semestre: totalFechado(`${semestre}º semestre de ${ano}`, doSemestre),
    ano: totalFechado(`Ano de ${ano}`, doAno),
  };
}
