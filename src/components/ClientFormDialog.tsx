import { useEffect, useState, type FormEvent } from "react";
import { Mic2, Users } from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { Client, Papel } from "@/types/database";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cadastro a editar. Ausente/null = novo cadastro. */
  client?: Client | null;
  /**
   * Papel que vem marcado num cadastro NOVO ("Novo artista" abre com
   * "Artista" marcado; "Novo cliente", com "Cliente"). Ignorado ao editar —
   * aí valem os papéis gravados.
   */
  papel?: Papel;
  /** Recebe o cadastro já gravado (com id), para a tela chamadora atualizar. */
  onSaved: (client: Client) => void;
}

const emptyTexto = {
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

/** Campos de texto do formulário — os únicos que passam por máscara/blur. */
type CampoTexto = keyof typeof emptyTexto;

type FormState = typeof emptyTexto & {
  is_client: boolean;
  is_artist: boolean;
};

type Erros = Partial<Record<keyof FormState | "papel", string>>;

/** Formulário vazio já com o papel pedido marcado. */
const vazio = (papel: Papel): FormState => ({
  ...emptyTexto,
  is_client: papel === "cliente",
  is_artist: papel === "artista",
});

/** Campos de nome próprio: recebem capitalização automática ao sair do campo. */
const NOMES: CampoTexto[] = [
  "name",
  "full_name",
  "logradouro",
  "complemento",
  "bairro",
  "cidade",
];

/**
 * Os dois papéis de um cadastro. Não se excluem: a mesma pessoa pode ser o
 * artista de um show e o contratante de outro.
 */
const PAPEIS: {
  key: "is_client" | "is_artist";
  label: string;
  hint: string;
  icon: typeof Users;
}[] = [
  {
    key: "is_client",
    label: "Cliente",
    hint: "Contrata shows — é o CONTRATANTE do contrato.",
    icon: Users,
  },
  {
    key: "is_artist",
    label: "Artista",
    hint: "Se apresenta — aparece no seletor de artista do show.",
    icon: Mic2,
  },
];

/**
 * Formulário de cadastro (cliente e/ou artista) em diálogo. É o mesmo
 * componente usado na seção Clientes e no formulário de show (para cadastrar
 * sem perder o preenchimento do show em andamento).
 *
 * Todo campo que vai parar no contrato entra com máscara e sai daqui
 * normalizado: é o cadastro que padroniza o dado, não o documento.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  papel = "cliente",
  onSaved,
}: ClientFormDialogProps) {
  const isEditing = Boolean(client);
  const [form, setForm] = useState<FormState>(() => vazio(papel));
  const [erros, setErros] = useState<Erros>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega os campos sempre que o diálogo abre, para não vazar o
  // preenchimento de um cadastro anterior.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setErros({});
    setForm(
      client
        ? {
            is_client: client.is_client,
            is_artist: client.is_artist,
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
        : vazio(papel)
    );
  }, [open, client, papel]);

  function update(key: CampoTexto, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // O erro some assim que o campo é editado; a validação inteira roda de
    // novo no envio.
    setErros((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  /** Liga/desliga um papel. */
  function togglePapel(key: "is_client" | "is_artist") {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    setErros((prev) => (prev.papel ? { ...prev, papel: undefined } : prev));
  }

  /** Capitalização no blur: durante a digitação atrapalharia o cursor. */
  function normalizarNome(key: CampoTexto) {
    setForm((prev) => ({ ...prev, [key]: titleCase(prev[key]) }));
  }

  /**
   * Confere UM campo assim que ele perde o foco.
   *
   * O erro aparece na hora, e não só depois de tentar salvar: quem digitou um
   * CPF errado descobre ali, com o dado ainda fresco.
   */
  function conferir(key: CampoTexto) {
    const encontrados = validar(form);
    setErros((prev) => ({ ...prev, [key]: encontrados[key] }));
  }

  /** Validação de tudo o que tem forma conhecida. */
  function validar(atual: FormState): Erros {
    const novos: Erros = {};
    if (!normalizarTexto(atual.name)) {
      novos.name = "Informe o nome da ficha.";
    }
    // O banco também recusa (clients_papel_check); aqui a mensagem é legível.
    if (!atual.is_client && !atual.is_artist) {
      novos.papel = "Marque pelo menos um papel: cliente ou artista.";
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
      is_client: limpo.is_client,
      is_artist: limpo.is_artist,
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
  function Ajuda({ campo, dica }: { campo: keyof Erros; dica?: string }) {
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
            {isEditing
              ? "Editar cadastro"
              : papel === "artista"
                ? "Novo artista"
                : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            Apenas o nome da ficha é obrigatório. Um cadastro pode ser cliente
            e artista ao mesmo tempo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Papéis primeiro: é o que decide em qual seletor do show o
              cadastro aparece. Mesmo desenho das funções de produção da
              ficha do show. */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Papel *</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAPEIS.map(({ key, label, hint, icon: Icon }) => {
                const marcado = form[key];
                return (
                  <label
                    key={key}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
                      marcado
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={marcado}
                      onChange={() => togglePapel(key)}
                    />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block">{label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <Ajuda campo="papel" />
          </fieldset>

          {/* Dois nomes: o da ficha é o que aparece nas telas; o completo
              é o que entra no contrato como contratante. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nome da ficha *</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => normalizarNome("name")}
                placeholder={
                  form.is_artist && !form.is_client
                    ? "Nome artístico / da banda"
                    : "Como é chamado no dia a dia"
                }
                aria-invalid={Boolean(erros.name)}
                required
                autoFocus
              />
              <Ajuda
                campo="name"
                dica="Usado nas listagens, no Kanban e na ficha do show."
              />
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
                dica={
                  form.is_client
                    ? "É este que sai no contrato como contratante. Em branco, usa o nome da ficha."
                    : "Nome civil / razão social. É o que o relatório mostra; em branco, usa o nome da ficha."
                }
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
