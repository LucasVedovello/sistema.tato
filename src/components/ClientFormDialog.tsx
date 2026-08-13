import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/database";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cliente a editar. Ausente/null = novo cadastro. */
  client?: Client | null;
  /** Recebe o cliente já gravado (com id), para a tela chamadora atualizar. */
  onSaved: (client: Client) => void;
}

const empty = { name: "", phone: "", email: "", notes: "" };

/**
 * Formulário de cliente em diálogo. É o mesmo componente usado na seção
 * Clientes e no formulário de show (para cadastrar sem perder o preenchimento
 * do show em andamento).
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: ClientFormDialogProps) {
  const isEditing = Boolean(client);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega os campos sempre que o diálogo abre, para não vazar o
  // preenchimento de um cliente anterior.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      client
        ? {
            name: client.name,
            phone: client.phone ?? "",
            email: client.email ?? "",
            notes: client.notes ?? "",
          }
        : empty
    );
  }, [open, client]);

  function update(key: keyof typeof empty, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = isEditing
      ? await supabase
          .from("clients")
          .update(payload)
          .eq("id", client!.id)
          .select()
          .single()
      : await supabase.from("clients").insert(payload).select().single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSaved(data as Client);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            Apenas o nome é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nome *</Label>
            <Input
              id="client-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Nome do contratante"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-phone">Telefone</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(16) 99999-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">E-mail</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="contato@exemplo.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-notes">Observações</Label>
            <Textarea
              id="client-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Contato preferencial, histórico, condições combinadas…"
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
