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
export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** CPF/CNPJ — usado na qualificação das partes no contrato. */
  document: string | null;
  notes: string | null;
  created_at: string;
};

export type Show = {
  id: string;
  artist_name: string;
  client_id: string | null;
  event_date: string | null;
  location: string | null;
  status: ShowStatus;
  value_cents: number | null;
  payment_terms: string | null;
  /** Se o show terá produção contratada. */
  has_production: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Show com os dados do cliente relacionado (join). */
export type ShowWithClient = Show & {
  clients: Pick<Client, "id" | "name"> | null;
};

/**
 * Cliente com a contagem de shows vinculados.
 * O PostgREST devolve agregações de relação como array de um elemento
 * (`shows: [{ count: 3 }]`), inclusive quando o total é zero.
 */
export type ClientWithShowCount = Client & {
  shows: { count: number }[];
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
        Insert: OptionalNullable<Omit<Client, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
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
        Relationships: [
          {
            foreignKeyName: "shows_client_id_fkey";
            columns: ["client_id"];
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
