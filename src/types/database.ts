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
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Show com os dados do cliente relacionado (join). */
export type ShowWithClient = Show & {
  clients: Pick<Client, "id" | "name"> | null;
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

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Client, "id" | "created_at">>;
        Relationships: [];
      };
      shows: {
        Row: Show;
        Insert: Omit<Show, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Show, "id" | "created_at">>;
        Relationships: [];
      };
      proposals: {
        Row: Proposal;
        Insert: Omit<Proposal, "id"> & { id?: string };
        Update: Partial<Omit<Proposal, "id">>;
        Relationships: [];
      };
      message_templates: {
        Row: MessageTemplate;
        Insert: Omit<MessageTemplate, "id"> & { id?: string };
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
