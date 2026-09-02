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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cepValido,
  documentoValido,
  formatEndereco,
  maskCEP,
  maskDocumento,
  maskTelefone,
  normalizarTexto,
  telefoneValido,
  titleCase,
  UFS,
} from "@/lib/format";
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

const empty = {
  name: "",
  full_name: "",
  phone: "",
  email: "",
  document: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  notes: "",
};

type FormState = typeof empty;
type Erros = Partial<Record<keyof FormState, string>>;

/** Campos de nome próprio: recebem capitalização automática ao sair do campo. */
const NOMES: (keyof FormState)[] = [
  "name",
  "full_name",
  "logradouro",
  "complemento",
  "bairro",
  "cidade",
];

/**
 * Formulário de cliente em diálogo. É o mesmo componente usado na seção
 * Clientes e no formulário de show (para cadastrar sem perder o preenchimento
 * do show em andamento).
 *
 * Todo campo que vai parar no contrato entra com máscara e sai daqui
 * normalizado: é o cadastro que padroniza o dado, não o documento.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: ClientFormDialogProps) {
  const isEditing = Boolean(client);
  const [form, setForm] = useState<FormState>(empty);
  const [erros, setErros] = useState<Erros>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega os campos sempre que o diálogo abre, para não vazar o
  // preenchimento de um cliente anterior.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setErros({});
    setForm(
      client
        ? {
            name: client.name,
            full_name: client.full_name ?? "",
            // Cadastros antigos podem ter vindo sem máscara; a formatação é
            // idempotente, então reaplicá-la aqui só padroniza o que já existe.
            phone: maskTelefone(client.phone ?? ""),
            email: client.email ?? "",
            document: maskDocumento(client.document ?? ""),
            logradouro: client.logradouro ?? "",
            numero: client.numero ?? "",
            complemento: client.complemento ?? "",
            bairro: client.bairro ?? "",
            cidade: client.cidade ?? "",
            uf: client.uf ?? "",
            cep: maskCEP(client.cep ?? ""),
            notes: client.notes ?? "",
          }
        : empty
    );
  }, [open, client]);

  function update(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // O erro some assim que o campo é editado; a validação inteira roda de
    // novo no envio.
    setErros((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  /** Capitalização no blur: durante a digitação atrapalharia o cursor. */
  function normalizarNome(key: keyof FormState) {
    setForm((prev) => ({ ...prev, [key]: titleCase(prev[key]) }));
  }

  /**
   * Confere UM campo assim que ele perde o foco.
   *
   * O erro aparece na hora, e não só depois de tentar salvar: quem digitou um
   * CPF errado descobre ali, com o dado ainda fresco.
   */
  function conferir(key: keyof FormState) {
    const encontrados = validar(form);
    setErros((prev) => ({ ...prev, [key]: encontrados[key] }));
  }

  /** Validação de tudo o que tem forma conhecida. */
  function validar(atual: FormState): Erros {
    const novos: Erros = {};
    if (!normalizarTexto(atual.name)) {
      novos.name = "Informe o nome da ficha.";
    }
    if (atual.document && !documentoValido(atual.document)) {
      novos.document = "CPF ou CNPJ inválido — confira os dígitos.";
    }
    if (atual.phone && !telefoneValido(atual.phone)) {
      novos.phone = "Telefone incompleto: use (00) 00000-0000.";
    }
    if (atual.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(atual.email)) {
      novos.email = "E-mail inválido.";
    }
    if (atual.cep && !cepValido(atual.cep)) {
      novos.cep = "CEP deve ter 8 dígitos.";
    }
    if (atual.numero && !atual.logradouro) {
      novos.logradouro = "Informe a rua para o número fazer sentido.";
    }
    return novos;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Normaliza antes de validar e de gravar: o que vai para o banco é o que o
    // contrato vai imprimir.
    const limpo: FormState = { ...form };
    for (const key of NOMES) limpo[key] = titleCase(limpo[key]);
    limpo.email = normalizarTexto(limpo.email).toLowerCase();
    limpo.numero = normalizarTexto(limpo.numero);
    limpo.uf = limpo.uf.toUpperCase();
    limpo.notes = limpo.notes.trim();

    const novosErros = validar(limpo);
    setForm(limpo);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSaving(true);
    setError(null);

    const ou = (valor: string) => valor.trim() || null;
    const payload = {
      name: limpo.name,
      full_name: ou(limpo.full_name),
      phone: ou(limpo.phone),
      email: ou(limpo.email),
      document: ou(limpo.document),
      logradouro: ou(limpo.logradouro),
      numero: ou(limpo.numero),
      complemento: ou(limpo.complemento),
      bairro: ou(limpo.bairro),
      cidade: ou(limpo.cidade),
      uf: ou(limpo.uf),
      cep: ou(limpo.cep),
      notes: ou(limpo.notes),
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

  /** Mensagem de erro (ou a dica do campo, quando não há erro). */
  function Ajuda({ campo, dica }: { campo: keyof FormState; dica?: string }) {
    if (erros[campo]) {
      return (
        <p className="text-xs font-medium text-destructive">{erros[campo]}</p>
      );
    }
    return dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null;
  }

  const enderecoMontado = formatEndereco(form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            Apenas o nome da ficha é obrigatório. O resto alimenta o contrato.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dois nomes: o da ficha é o que aparece nas telas; o completo
              é o único que entra no contrato. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nome da ficha *</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => normalizarNome("name")}
                placeholder="Como o cliente é chamado"
                aria-invalid={Boolean(erros.name)}
                required
                autoFocus
              />
              <Ajuda campo="name" dica="Usado nas listagens e na ficha do show." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-full-name">Nome completo</Label>
              <Input
                id="client-full-name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                onBlur={() => normalizarNome("full_name")}
                placeholder="Nome civil / razão social"
              />
              <Ajuda
                campo="full_name"
                dica="É este que sai no contrato. Em branco, usa o nome da ficha."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-phone">Telefone / WhatsApp</Label>
              <Input
                id="client-phone"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => update("phone", maskTelefone(e.target.value))}
                placeholder="(19) 99999-0000"
                onBlur={() => conferir("phone")}
              aria-invalid={Boolean(erros.phone)}
              />
              <Ajuda campo="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">E-mail</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="contato@exemplo.com"
                onBlur={() => conferir("email")}
              aria-invalid={Boolean(erros.email)}
              />
              <Ajuda campo="email" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-document">CPF / CNPJ</Label>
            <Input
              id="client-document"
              inputMode="numeric"
              value={form.document}
              onChange={(e) => update("document", maskDocumento(e.target.value))}
              placeholder="000.000.000-00"
              onBlur={() => conferir("document")}
              aria-invalid={Boolean(erros.document)}
            />
            <Ajuda
              campo="document"
              dica="Usado na qualificação das partes no contrato. A máscara vira CNPJ a partir do 12º dígito."
            />
          </div>

          {/* Endereço em partes: o contrato monta a linha sempre igual, em vez
              de imprimir o que cada um digitou à mão. */}
          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Endereço</legend>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="client-logradouro">Logradouro</Label>
                <Input
                  id="client-logradouro"
                  value={form.logradouro}
                  onChange={(e) => update("logradouro", e.target.value)}
                  onBlur={() => normalizarNome("logradouro")}
                  placeholder="Rua Nossa Senhora Auxiliadora"
                  aria-invalid={Boolean(erros.logradouro)}
                />
                <Ajuda campo="logradouro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-numero">Número</Label>
                <Input
                  id="client-numero"
                  value={form.numero}
                  onChange={(e) => update("numero", e.target.value)}
                  placeholder="235"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-complemento">Complemento</Label>
                <Input
                  id="client-complemento"
                  value={form.complemento}
                  onChange={(e) => update("complemento", e.target.value)}
                  onBlur={() => normalizarNome("complemento")}
                  placeholder="Sala 2 (opcional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-bairro">Bairro</Label>
                <Input
                  id="client-bairro"
                  value={form.bairro}
                  onChange={(e) => update("bairro", e.target.value)}
                  onBlur={() => normalizarNome("bairro")}
                  placeholder="Centro"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="client-cidade">Cidade</Label>
                <Input
                  id="client-cidade"
                  value={form.cidade}
                  onChange={(e) => update("cidade", e.target.value)}
                  onBlur={() => normalizarNome("cidade")}
                  placeholder="Paulínia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-uf">Estado</Label>
                <Select
                  value={form.uf}
                  onValueChange={(valor) => update("uf", valor)}
                >
                  <SelectTrigger id="client-uf">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-cep">CEP</Label>
                <Input
                  id="client-cep"
                  inputMode="numeric"
                  value={form.cep}
                  onChange={(e) => update("cep", maskCEP(e.target.value))}
                  placeholder="13140-000"
                  onBlur={() => conferir("cep")}
              aria-invalid={Boolean(erros.cep)}
                />
                <Ajuda campo="cep" />
              </div>
            </div>

            {/* Espelho do que vai sair no contrato — sem surpresa na hora de
                emitir o documento. */}
            {enderecoMontado && (
              <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                No contrato: {enderecoMontado}.
              </p>
            )}
          </fieldset>

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
