/**
 * Cálculo do relatório, fora da tela.
 *
 * A página e a exportação para Excel precisam dos MESMOS números; deixar a
 * conta num só lugar evita a planilha e a tela discordarem quando um dos dois
 * mudar.
 */

import { parseDateOnly } from "@/lib/format";
import type { ShowStatus } from "@/types/database";

/** Os dois nomes de um cadastro, como o relatório os lê. */
type NomesCadastro = { name: string; full_name: string | null };

/**
 * Só o que o relatório usa de cada show.
 *
 * Artista e cliente vêm por JOIN com o cadastro (`artista:clients!…`,
 * `clients!…`), e não pelas cópias de texto do show: shows anteriores a
 * 2026-09-11 ainda carregam em `artist_full_name` o nome do CLIENTE (era onde
 * o campo acabava sendo usado), e o relatório não pode agrupar por isso.
 */
export type LinhaShow = {
  id: string;
  status: ShowStatus;
  value_cents: number | null;
  event_date: string | null;
  /** Cópia do nome da ficha do artista — reserva para show sem cadastro. */
  artist_name: string;
  /** Cópia do nome completo do artista — idem. */
  artist_full_name: string | null;
  /** Cadastro do artista (null em show cujo artista foi apagado). */
  artista: NomesCadastro | null;
  /** Cadastro do contratante (null em show sem cliente). */
  clients: NomesCadastro | null;
};

/**
 * Colunas que o relatório lê — a tela e a planilha fazem a MESMA consulta.
 *
 * Os hints `!shows_artist_id_fkey` / `!shows_client_id_fkey` são
 * obrigatórios: `shows` tem duas chaves para `clients`, e sem dizer qual o
 * PostgREST recusa o embed por ambiguidade.
 */
export const SELECT_RELATORIO =
  "id, status, value_cents, event_date, artist_name, artist_full_name, " +
  "artista:clients!shows_artist_id_fkey(name, full_name), " +
  "clients!shows_client_id_fkey(name, full_name)";

/** "Sem cliente" no filtro e nas listas. */
export const SEM_CLIENTE = "Sem cliente";

/** Nome completo com o da ficha como reserva. */
const nomeCompleto = (cadastro: NomesCadastro): string =>
  cadastro.full_name?.trim() || cadastro.name;

/**
 * Nome do artista no relatório.
 *
 * Vale a mesma regra do contrato: relatório fala pelo nome completo; o nome da
 * ficha é apelido de trabalho e fica no dashboard. Sem nome completo
 * cadastrado, cai na ficha — melhor um nome curto do que uma linha vazia.
 *
 * Só quando o show não tem cadastro de artista (apagado, ou anterior ao
 * vínculo) é que as cópias de texto do próprio show entram.
 */
export const nomeDoArtista = (show: LinhaShow): string =>
  show.artista
    ? nomeCompleto(show.artista)
    : show.artist_full_name?.trim() || show.artist_name;

/** Nome do cliente no relatório, pela mesma regra. */
export const nomeDoCliente = (show: LinhaShow): string =>
  show.clients ? nomeCompleto(show.clients) : SEM_CLIENTE;

/**
 * Por quem o relatório é recortado: pelo artista que se apresenta ou pelo
 * cliente que contrata. As duas abas da tela são a mesma conta com esta
 * chave trocada.
 */
export type Dimensao = "artista" | "cliente";

export const DIMENSOES: { key: Dimensao; label: string; titulo: string }[] = [
  { key: "artista", label: "Artistas", titulo: "Fechado por artista" },
  { key: "cliente", label: "Clientes", titulo: "Fechado por cliente" },
];

/** O nome pelo qual um show entra na dimensão escolhida. */
export const nomeNaDimensao = (show: LinhaShow, por: Dimensao): string =>
  por === "artista" ? nomeDoArtista(show) : nomeDoCliente(show);

/** Recorte do relatório: dimensão + nome escolhido (ou TODOS). */
export interface Filtro {
  por: Dimensao;
  nome: string;
}

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
 * Valor do filtro quando nenhum nome foi escolhido ("todos os artistas" /
 * "todos os clientes").
 *
 * Os sublinhados evitam a colisão com um cadastro que se chame "todos": o
 * seletor usaria o mesmo valor em duas opções e a escolha ficaria ambígua.
 */
export const TODOS = "__todos__";

/** Filtro "todos" numa dimensão. */
export const todos = (por: Dimensao): Filtro => ({ por, nome: TODOS });

/** Períodos do painel "fechado por artista/cliente". */
export type PeriodoPainel = "mes" | "semestre" | "ano";

export const PERIODOS_PAINEL: { key: PeriodoPainel; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "semestre", label: "Semestre" },
  { key: "ano", label: "Ano" },
];

/** Nomes que aparecem nos dados numa dimensão, em ordem alfabética. */
export function nomesDisponiveis(shows: LinhaShow[], por: Dimensao): string[] {
  const nomes = new Set<string>();
  for (const show of shows) {
    const nome = nomeNaDimensao(show, por).trim();
    if (nome) nomes.add(nome);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Recorta a lista pelo filtro. TODOS devolve tudo. */
export function filtrar(shows: LinhaShow[], filtro: Filtro): LinhaShow[] {
  if (filtro.nome === TODOS) return shows;
  return shows.filter((s) => nomeNaDimensao(s, filtro.por) === filtro.nome);
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
 * O filtro (artista ou cliente) entra como recorte ANTES de qualquer conta:
 * com um nome selecionado, todos os números da tela (funil, conversão,
 * totais) passam a ser dele — um filtro que só mudasse um cartão confundiria
 * mais do que ajudaria.
 */
export function calcularRelatorio(
  shows: LinhaShow[],
  ano: string,
  mes: string,
  filtro: Filtro = todos("artista")
): Relatorio {
  const anoNum = Number(ano);
  shows = filtrar(shows, filtro);

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

/** Os três recortes do painel por artista/cliente, sempre calculados juntos. */
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
 * Valor FECHADO no mês, no semestre e no ano — opcionalmente de um artista ou
 * cliente só.
 *
 * `mesRef` é o mês de referência (0..11): dele saem tanto o recorte mensal
 * quanto o semestre correspondente. Só shows com status "fechado" entram; os
 * demais não são receita combinada.
 */
export function calcularFechadoPorPeriodo(
  shows: LinhaShow[],
  ano: string,
  mesRef: number,
  filtro: Filtro = todos("artista")
): FechadoPorPeriodo {
  const anoNum = Number(ano);
  const recorte = filtrar(shows, filtro);

  const doAno = recorte.filter(
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
