/**
 * Funções de produção que podem ser contratadas para um show.
 *
 * O show guarda as CHAVES (`production_roles` no banco); os rótulos abaixo são
 * o que aparece na tela e na planilha. Separar os dois permite reescrever um
 * rótulo sem migrar dado — e é por isso que a chave nunca deve mudar depois de
 * gravada.
 *
 * A ordem daqui é a ordem em que as opções aparecem no formulário.
 */
export const PRODUCTION_ROLES = [
  { key: "videomaker", label: "Videomaker" },
  { key: "motorista", label: "Motorista" },
  { key: "roadie", label: "Roadie" },
  { key: "produtor", label: "Produtor" },
  { key: "banda_completa", label: "Banda completa" },
  { key: "voz_e_violao", label: "Voz e violão" },
  { key: "banda_reduzida", label: "Banda reduzida" },
] as const;

export type ProductionRoleKey = (typeof PRODUCTION_ROLES)[number]["key"];

const LABELS = new Map<string, string>(
  PRODUCTION_ROLES.map((role) => [role.key, role.label])
);

/**
 * Rótulo de uma chave. Uma chave desconhecida (gravada por uma versão futura,
 * ou à mão no banco) volta como está — some da tela seria pior.
 */
export const productionRoleLabel = (key: string): string =>
  LABELS.get(key) ?? key;

/**
 * Rótulos na ordem canônica, independente da ordem em que foram marcados.
 * Chaves desconhecidas vão para o fim, para não sumirem.
 */
export function productionRoleLabels(keys: string[] | null | undefined): string[] {
  if (!keys?.length) return [];
  const conhecidas = PRODUCTION_ROLES.filter((role) => keys.includes(role.key)).map(
    (role) => role.label
  );
  const resto = keys.filter((key) => !LABELS.has(key));
  return [...conhecidas, ...resto];
}

/** Lista pronta para leitura: "Videomaker, Motorista". Vazio vira "". */
export const productionSummary = (keys: string[] | null | undefined): string =>
  productionRoleLabels(keys).join(", ");
