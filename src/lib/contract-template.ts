/**
 * =============================================================================
 * TEMPLATE DE CONTRATO
 * =============================================================================
 *
 * Este arquivo é o único lugar a mexer para trocar o contrato de teste pelo
 * contrato real. O restante do sistema (preview na tela e geração do PDF) lê
 * daqui e não precisa de alteração.
 *
 * Como editar:
 *   - `title`      : título que aparece no topo do documento.
 *   - `preamble`   : parágrafo de qualificação das partes.
 *   - `clauses`    : lista de cláusulas, cada uma com `heading` e `body`.
 *                    Adicione, remova ou reordene à vontade.
 *   - `closing`    : parágrafo de fecho.
 *   - `signatures` : blocos de assinatura (um por parte).
 *
 * Dentro de qualquer texto, use os marcadores abaixo — eles são substituídos
 * pelos dados do show na hora de renderizar:
 *
 *   {{artista}}          nome do artista/banda
 *   {{contratante}}      nome do cliente vinculado ao show
 *   {{contratanteDoc}}   CPF/CNPJ do contratante (em branco se não informado)
 *   {{contratanteEmail}} e-mail do contratante
 *   {{contratanteTel}}   telefone do contratante
 *   {{dataEvento}}       data do evento (dd/mm/aaaa)
 *   {{local}}            local do evento
 *   {{valor}}            valor em reais já formatado (ex.: R$ 18.500,00)
 *   {{formaPagamento}}   forma/condições de pagamento
 *   {{cidade}}           cidade de assinatura
 *   {{dataAssinatura}}   data de hoje, por extenso
 *
 * Marcador sem valor correspondente vira "—", para o campo faltante ficar
 * visível no documento em vez de sumir silenciosamente.
 */

export interface ContractTemplate {
  title: string;
  preamble: string;
  clauses: { heading: string; body: string }[];
  closing: string;
  /** Linha de local e data, logo antes das assinaturas. */
  placeAndDate: string;
  signatures: { name: string; role: string }[];
}

export const CONTRACT_TEMPLATE: ContractTemplate = {
  title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ARTÍSTICOS",

  preamble:
    "Pelo presente instrumento particular, de um lado {{contratante}}, doravante " +
    "denominado(a) CONTRATANTE, inscrito(a) sob o nº {{contratanteDoc}}, com " +
    "contato pelo telefone {{contratanteTel}} e e-mail {{contratanteEmail}}; e de " +
    "outro lado o(a) artista {{artista}}, doravante denominado(a) CONTRATADO(A), " +
    "têm entre si justo e contratado o seguinte:",

  clauses: [
    {
      heading: "CLÁUSULA 1ª — DO OBJETO",
      body:
        "O presente contrato tem por objeto a apresentação artística de " +
        "{{artista}}, a ser realizada em {{dataEvento}}, no local {{local}}.",
    },
    {
      heading: "CLÁUSULA 2ª — DO VALOR E DA FORMA DE PAGAMENTO",
      body:
        "Pela apresentação descrita na cláusula anterior, a CONTRATANTE pagará " +
        "ao CONTRATADO o valor de {{valor}}. Forma de pagamento: " +
        "{{formaPagamento}}.",
    },
    {
      heading: "CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATANTE",
      body:
        "Cabe à CONTRATANTE providenciar o local do evento em condições " +
        "adequadas de segurança, energia elétrica, palco e som, salvo acordo " +
        "diverso registrado por escrito entre as partes.",
    },
    {
      heading: "CLÁUSULA 4ª — DAS OBRIGAÇÕES DO CONTRATADO",
      body:
        "Cabe ao CONTRATADO comparecer ao local com a antecedência combinada e " +
        "realizar a apresentação conforme o repertório e a duração ajustados.",
    },
    {
      heading: "CLÁUSULA 5ª — DO CANCELAMENTO",
      body:
        "O cancelamento por qualquer das partes deverá ser comunicado por " +
        "escrito com a maior antecedência possível, sujeitando a parte " +
        "desistente às penalidades que vierem a ser acordadas.",
    },
  ],

  closing:
    "E, por estarem assim justas e contratadas, as partes assinam o presente " +
    "instrumento em duas vias de igual teor e forma.",

  placeAndDate: "{{cidade}}, {{dataAssinatura}}.",

  signatures: [
    { name: "{{contratante}}", role: "CONTRATANTE" },
    { name: "{{artista}}", role: "CONTRATADO(A)" },
  ],
};

/** Valores que preenchem os marcadores do template. */
export type ContractVars = Record<string, string>;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Substitui os {{marcadores}} de um texto. Ausente/vazio vira "—". */
export function fillPlaceholders(text: string, vars: ContractVars): string {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const value = vars[key];
    return value && value.trim() ? value : "—";
  });
}

/** Aplica os dados ao template inteiro, devolvendo textos já resolvidos. */
export function renderContract(
  vars: ContractVars,
  template: ContractTemplate = CONTRACT_TEMPLATE
): ContractTemplate {
  return {
    title: fillPlaceholders(template.title, vars),
    preamble: fillPlaceholders(template.preamble, vars),
    clauses: template.clauses.map((clause) => ({
      heading: fillPlaceholders(clause.heading, vars),
      body: fillPlaceholders(clause.body, vars),
    })),
    closing: fillPlaceholders(template.closing, vars),
    placeAndDate: fillPlaceholders(template.placeAndDate, vars),
    signatures: template.signatures.map((signature) => ({
      name: fillPlaceholders(signature.name, vars),
      role: fillPlaceholders(signature.role, vars),
    })),
  };
}
