/**
 * Tipos do banco de dados (espelham as migrations em supabase/migrations).
 * Gerados manualmente. Para regenerar a partir do banco remoto:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type ShowStatus = "criado" | "em_fechamento" | "fechado" | "cancelado";

export const SHOW_STATUSES: ShowStatus[] = [
  "criado",
  "em_fechamento",
  "fechado",
  "cancelado",
];

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  criado: "Criado",
  em_fechamento: "Em fechamento",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

// NOTE: estes tipos de linha (Row) são declarados como `type` (e não `interface`)
// de propósito: o supabase-js exige que cada tabela satisfaça
// `Record<string, unknown>`, e interfaces (por serem "abertas") não são
// atribuíveis a esse tipo — o que degradaria toda a inferência para `never`.
/**
 * Uma PESSOA do cadastro — a tabela continua se chamando `clients` por
 * história, mas desde 2026-09-11 ela guarda quem contrata E quem se
 * apresenta. Os dois papéis não se excluem: o mesmo cadastro pode ser artista
 * num show e cliente noutro.
 */
export type Client = {
  id: string;
  /** Nome da ficha: curto, como o escritório chama a pessoa. Só uso interno. */
  name: string;
  /**
   * Nome completo — o único que vai para o contrato. Vazio cai no `name`:
   * melhor o contrato sair com o nome curto do que com a lacuna.
   */
  full_name: string | null;
  phone: string | null;
  email: string | null;
  /** CPF/CNPJ com máscara — usado na qualificação das partes no contrato. */
  document: string | null;
  /**
   * Endereço em partes. A linha do contrato é montada por `formatEndereco`
   * (src/lib/format.ts), nunca escrita à mão — é o que garante o mesmo
   * formato em todo documento.
   */
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  /** Sigla do estado, duas letras maiúsculas. */
  uf: string | null;
  cep: string | null;
  notes: string | null;
  /**
   * Cliente inativo some das listagens e do seletor do show, mas continua
   * vinculado aos shows e contratos antigos.
   */
  active: boolean;
  /** Pode ser escolhido como CONTRATANTE de um show. */
  is_client: boolean;
  /** Pode ser escolhido como ARTISTA de um show. */
  is_artist: boolean;
  created_at: string;
};

/** Papel de uma pessoa do cadastro, para filtros e rótulos. */
export type Papel = "cliente" | "artista";

export type Show = {
  id: string;
  /**
   * Cadastro do artista (`clients.is_artist`). Anulável no banco por causa de
   * `on delete set null`; o formulário sempre exige um.
   */
  artist_id: string | null;
  /**
   * CÓPIA do nome da ficha do artista, sincronizada por gatilho a partir do
   * cadastro. Continua aqui porque é o que Kanban, calendário, planilhas e a
   * RPC pública leem — sem precisar de join.
   */
  artist_name: string;
  /**
   * CÓPIA do nome completo do artista. Shows anteriores a 2026-09-11 podem
   * carregar o valor antigo (que na prática era o nome do cliente) até serem
   * salvos de novo — por isso o relatório prefere o join com o cadastro.
   */
  artist_full_name: string | null;
  client_id: string | null;
  event_date: string | null;
  /** Horário de INÍCIO, "HH:MM:SS" (coluna `time`, sem fuso). */
  event_time: string | null;
  /** Horário de TÉRMINO. Pode ser menor que o de início (vira a madrugada). */
  event_end_time: string | null;
  location: string | null;
  status: ShowStatus;
  value_cents: number | null;
  payment_terms: string | null;
  /**
   * Funções de produção contratadas (chaves de `PRODUCTION_ROLES`).
   *
   * Substituiu o antigo `has_production` (sim/não), que continua no banco só
   * como histórico e por isso NÃO aparece aqui: mantê-lo no tipo obrigaria
   * todo insert a respondê-lo de novo.
   */
  production_roles: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Show com os dados do cliente relacionado (join). */
export type ShowWithClient = Show & {
  clients: Pick<Client, "id" | "name"> | null;
};

/**
 * Pessoa com a contagem de shows vinculados em cada papel.
 *
 * O PostgREST devolve agregações de relação como array de um elemento
 * (`shows: [{ count: 3 }]`), inclusive quando o total é zero. Como `shows`
 * tem DUAS chaves para `clients`, cada contagem precisa dizer qual usa:
 * `shows!shows_client_id_fkey(count)` e `shows_artista:shows!shows_artist_id_fkey(count)`.
 */
export type ClientWithShowCount = Client & {
  /** Shows em que a pessoa é o contratante. */
  shows: { count: number }[];
  /** Shows em que a pessoa é o artista. */
  shows_artista: { count: number }[];
};

/** Tipo de evento na timeline do show. */
export type ActivityKind =
  | "created"
  | "status"
  | "note"
  | "message"
  /** Contrato emitido a partir de um dos modelos do Storage. */
  | "contract"
  /** Uma das partes assinou o contrato. */
  | "signature";

export type ShowActivity = {
  id: string;
  show_id: string;
  kind: ActivityKind;
  content: string | null;
  from_status: ShowStatus | null;
  to_status: ShowStatus | null;
  author_email: string | null;
  created_at: string;
};

export type ShowTask = {
  id: string;
  show_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
};

/** Tarefa acompanhada do show a que pertence (para o resumo do Dashboard). */
export type ShowTaskWithShow = ShowTask & {
  shows: Pick<Show, "id" | "artist_name"> | null;
};

export type Proposal = {
  id: string;
  show_id: string;
  template_used: string | null;
  sent_at: string | null;
  whatsapp_message_id: string | null;
  status: string | null;
};

export type MessageTemplate = {
  id: string;
  name: string;
  content: string;
  variables: Record<string, unknown> | null;
};

/**
 * Ordem de assinatura de um contrato. O cliente assina primeiro, pelo link
 * público; só então o campo do contratado é liberado dentro do app.
 */
export type ContractStatus =
  | "aguardando_cliente"
  | "aguardando_contratado"
  | "assinado"
  | "cancelado";

export type ShowContract = {
  id: string;
  show_id: string;
  template_key: "carnellos" | "producao";
  template_label: string;
  template_path: string;
  /**
   * Snapshot dos textos sobrepostos ao modelo na emissão — o que foi assinado
   * não muda se o cadastro do show mudar depois.
   */
  overlay: unknown;
  status: ContractStatus;
  /** Segredo do link público de assinatura. */
  public_token: string;
  /**
   * Segredo de leitura dos PDFs no Storage — separado do token de assinatura
   * de propósito: o nome do arquivo aparece para quem lista o bucket, e o
   * token de assinatura não pode vazar por aí.
   */
  storage_key: string;
  client_name: string;
  office_name: string;
  /** PNG transparente em data URL. */
  client_signature: string | null;
  client_signed_at: string | null;
  office_signature: string | null;
  office_signed_at: string | null;
  prepared_pdf_path: string;
  signed_pdf_path: string | null;
  /**
   * Limite para as duas assinaturas, contado da emissão. Vencido sem ambas, o
   * contrato é cancelado e o show vai para "cancelado".
   */
  deadline_at: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Recorte do contrato devolvido para quem abre o link público: só o suficiente
 * para desenhar e assinar o documento, sem o show nem o cadastro do cliente.
 */
export type PublicContract = Pick<
  ShowContract,
  | "id"
  | "status"
  | "template_key"
  | "template_label"
  | "client_name"
  | "office_name"
  | "client_signature"
  | "client_signed_at"
  | "office_signature"
  | "office_signed_at"
  | "deadline_at"
> & {
  artist_name: string;
  event_date: string | null;
  location: string | null;
};

/** Chaves de T cujo tipo aceita null. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Torna opcionais as colunas que aceitam null.
 *
 * No Postgres uma coluna anulável pode simplesmente ser omitida no INSERT
 * (entra como NULL). Sem isso, cada coluna nova anulável quebrava a
 * compilação de todo insert existente — e a "correção" natural (mandar o
 * campo como null em toda gravação) apagaria dados em updates parciais.
 */
type OptionalNullable<T> = Omit<T, NullableKeys<T>> &
  Partial<Pick<T, NullableKeys<T>>>;

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: Client;
        // `active` e os papéis saem do Insert obrigatório: têm default no
        // banco (ativo, cliente, não artista).
        Insert: OptionalNullable<
          Omit<Client, "id" | "created_at" | "active" | "is_client" | "is_artist">
        > & {
          id?: string;
          created_at?: string;
          active?: boolean;
          is_client?: boolean;
          is_artist?: boolean;
        };
        Update: Partial<Omit<Client, "id" | "created_at">>;
        Relationships: [];
      };
      shows: {
        Row: Show;
        Insert: OptionalNullable<Omit<Show, "id" | "created_at" | "updated_at">> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Show, "id" | "created_at">>;
        // Duas chaves para a mesma tabela: todo embed de `clients` a partir
        // de `shows` (e vice-versa) precisa do hint `!shows_client_id_fkey`
        // ou `!shows_artist_id_fkey`, senão o PostgREST recusa por ambiguidade.
        Relationships: [
          {
            foreignKeyName: "shows_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shows_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      show_activities: {
        Row: ShowActivity;
        Insert: OptionalNullable<Omit<ShowActivity, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ShowActivity, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "show_activities_show_id_fkey";
            columns: ["show_id"];
            isOneToOne: false;
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      show_contracts: {
        Row: ShowContract;
        Insert: OptionalNullable<
          Omit<
            ShowContract,
            | "id"
            | "created_at"
            | "updated_at"
            | "overlay"
            | "status"
            | "public_token"
            | "storage_key"
            | "deadline_at"
          >
        > & {
          id?: string;
          deadline_at?: string;
          overlay?: unknown;
          status?: ContractStatus;
          public_token?: string;
          storage_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ShowContract, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "show_contracts_show_id_fkey";
            columns: ["show_id"];
            isOneToOne: false;
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      show_tasks: {
        Row: ShowTask;
        Insert: OptionalNullable<Omit<ShowTask, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ShowTask, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "show_tasks_show_id_fkey";
            columns: ["show_id"];
            isOneToOne: false;
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: Proposal;
        Insert: OptionalNullable<Omit<Proposal, "id">> & { id?: string };
        Update: Partial<Omit<Proposal, "id">>;
        Relationships: [
          {
            foreignKeyName: "proposals_show_id_fkey";
            columns: ["show_id"];
            isOneToOne: false;
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: MessageTemplate;
        Insert: OptionalNullable<Omit<MessageTemplate, "id">> & { id?: string };
        Update: Partial<Omit<MessageTemplate, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** Leitura pública do contrato pelo token do link (security definer). */
      public_get_contract: {
        Args: { p_token: string };
        Returns: PublicContract | null;
      };
      /**
       * Cancela contratos com prazo vencido (e os shows que ficaram sem
       * contrato vivo). Idempotente; devolve quantos venceram agora.
       */
      expire_overdue_contracts: {
        Args: Record<string, never>;
        Returns: number;
      };
      /** Grava a assinatura do cliente e libera o campo do contratado. */
      public_sign_contract: {
        Args: { p_token: string; p_signature: string };
        Returns: {
          id: string;
          status: ContractStatus;
          client_signed_at: string;
        } | null;
      };
    };
    Enums: {
      show_status: ShowStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
