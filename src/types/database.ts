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
export type ActivityKind = "created" | "status" | "note" | "message";

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
        Relationships: [];
      };
      show_activities: {
        Row: ShowActivity;
        Insert: OptionalNullable<Omit<ShowActivity, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ShowActivity, "id" | "created_at">>;
        Relationships: [];
      };
      proposals: {
        Row: Proposal;
        Insert: OptionalNullable<Omit<Proposal, "id">> & { id?: string };
        Update: Partial<Omit<Proposal, "id">>;
        Relationships: [];
      };
      message_templates: {
        Row: MessageTemplate;
        Insert: OptionalNullable<Omit<MessageTemplate, "id">> & { id?: string };
        Update: Partial<Omit<MessageTemplate, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      show_status: ShowStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
