# Sistema Tato

CRM para **gestão de shows e eventos musicais**: cadastro de shows, acompanhamento por status (criado → em fechamento → fechado / cancelado), clientes, propostas e templates de mensagem.

## Stack

- **React + Vite + TypeScript**
- **Supabase** (Postgres + Auth)
- **Tailwind CSS + shadcn/ui**
- **React Router** para navegação
- **Cloudflare Workers/Pages** para deploy (via Wrangler)

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Conta no [Supabase](https://supabase.com) (projeto já criado)
- [Supabase CLI](https://supabase.com/docs/guides/cli) e [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (já vêm como devDependency, use via `npx`)

## Configuração local

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# edite .env e preencha com as chaves do painel do Supabase:
#   Settings → API → Project URL / anon public / service_role
```

### Variáveis de ambiente (`.env`)

| Variável | Onde usar | Descrição |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | frontend | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend | Chave pública (anon) — segura no cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente server-side** | Ignora RLS. **Nunca** use com prefixo `VITE_` nem no frontend |

> ⚠️ O `.env` está no `.gitignore` e **nunca** deve ser commitado.

## Rodando em desenvolvimento

```bash
npm run dev      # http://localhost:5173
```

## Banco de dados (Supabase)

As migrations ficam em [`supabase/migrations`](./supabase/migrations). Tabelas criadas:

- **clients** — `id, name, phone, email, created_at`
- **shows** — `id, artist_name, client_id, event_date, location, status, value_cents, notes, created_at, updated_at`
- **proposals** — `id, show_id, template_used, sent_at, whatsapp_message_id, status`
- **message_templates** — `id, name, content, variables (jsonb)`
- **show_activities** — timeline do show (criação, status, notas, contrato, assinaturas)
- **show_tasks** — tarefas do show
- **show_contracts** — contratos emitidos, com as duas assinaturas (ver abaixo)

O `status` do show é um enum: `criado`, `em_fechamento`, `fechado`, `cancelado`.
**RLS** está habilitado em todas as tabelas, com acesso liberado apenas para usuários **autenticados**.

### Aplicar as migrations no projeto remoto

```bash
# 1. Autenticar o CLI (abre o navegador)
npx supabase login

# 2. Vincular ao projeto remoto
npx supabase link --project-ref iwqshcdqgwhglqknuxhn

# 3. Enviar as migrations para o banco
npx supabase db push
```

> Valores monetários são armazenados em **centavos** (`value_cents`, inteiro) para evitar erros de ponto flutuante.

## Contratos com assinatura eletrônica

O contrato sai dos **PDFs-modelo** guardados no bucket privado `contratos` do
Storage — hoje "Contrato Base Carnellos" e "Contrato Base Produção". O PDF
original nunca é rediagramado: o app renderiza cada página como fundo e
sobrepõe os dados do show e, depois, as assinaturas (jsPDF + pdf.js), do mesmo
jeito que o projeto odonto-sign.

Fluxo, na ficha do show (`/shows/:id`), card **Contratos**:

1. **Criar contrato** → escolha do modelo e dos campos que o cadastro não tem
   (endereço do contratante, nome do evento, horário). Gera
   `preparado/<storage_key>.pdf` no bucket e a linha em `show_contracts`.
2. **Link do cliente** → `/assinar/<token>`, página pública, sem login. O
   cliente lê o documento e assina no campo sobre a linha do CONTRATANTE.
3. Só então o campo do **contratado** é liberado em `/contratos/:id`. Ao
   assinar, o PDF final com as duas assinaturas vai para
   `assinado/<storage_key>.pdf`.
4. Emissão e assinaturas entram na **timeline do show** por gatilho no banco.

A ordem é garantida pelo banco (trigger `enforce_contract_signature_order`),
não só pela interface.

### Status do show, automático

O status acompanha o contrato sozinho — as transições ficam registradas na
timeline com o selo "automático" e o motivo:

| De | Para | Quando |
| --- | --- | --- |
| Criado | Em fechamento | o contrato é gerado |
| Em fechamento | Fechado | as duas partes assinam |
| Em fechamento | Cancelado | o prazo de assinatura expira |

O prazo é `show_contracts.deadline_at`, **um dia** a partir da emissão (o
default da coluna; mudar o prazo é mudar esse default). Quem faz a checagem é
`expire_overdue_contracts()`, chamada de dois lugares:

- um agendamento do **pg_cron**, de hora em hora (`cron.job`
  `expirar-contratos-vencidos`), para valer com o sistema fechado;
- o próprio app, ao carregar (`src/lib/contract-expiry.ts`), para a tela não
  mostrar por até uma hora um contrato vencido como se ainda valesse.

A função é idempotente: se nada venceu, não escreve nada. Um show em fechamento
**sem contrato nenhum** não tem prazo correndo e não é cancelado, e um show com
outro contrato ainda dentro do prazo também não.

Mudanças manuais de status têm a palavra final: a automação só age quando o
show está no status que ela espera.

### Onde ficam os segredos

Cada contrato tem **dois** segredos distintos: `public_token` (o link de
assinatura) e `storage_key` (o nome dos PDFs no bucket). Eles são separados
porque nome de arquivo vaza com mais facilidade do que linha de tabela, e quem
tem o token consegue assinar em nome do cliente.

### Edge Function `contrato-pdf`

O papel `anon` **não tem acesso nenhum** ao bucket. Dar a ele permissão de
leitura sobre os PDFs também daria permissão de **listagem** — é a mesma
permissão de `select` — e qualquer um com a chave pública do projeto poderia
enumerar e baixar contratos alheios. Por isso o PDF do cliente é servido pela
Edge Function [`contrato-pdf`](./supabase/functions/contrato-pdf/index.ts), que
valida o token e devolve só aquele arquivo.

Ela **não** é publicada pelo Cloudflare; quando mudar, republique com:

```bash
npx supabase functions deploy contrato-pdf --project-ref iwqshcdqgwhglqknuxhn --no-verify-jwt
```

> `--no-verify-jwt` é proposital: quem chama é o cliente que vai assinar, sem
> sessão no sistema. A autorização é o token do contrato.

## Exportação para Excel

Todas as telas de listagem têm o botão **Exportar para Excel**, sempre com o
mesmo componente (`ExportExcelButton`) e a mesma lib (`write-excel-file` — o
pacote `xlsx` do npm tem CVEs):

| Tela | O que sai |
| --- | --- |
| Dashboard | todos os shows (é o que o Kanban mostra) |
| Fechados | só os shows fechados |
| Calendário | os shows do intervalo desenhado na grade |
| Clientes | cadastro + quantos shows cada cliente tem |
| Relatórios | indicadores, funil por status e conversão do período |

Cada exportação **consulta o banco no clique**, em vez de reaproveitar o que a
tela carregou, para o arquivo nunca sair desatualizado. Os números do relatório
saem de `src/lib/report.ts`, o mesmo módulo que a tela usa — planilha e tela não
podem divergir.

## Build

```bash
npm run build    # gera a pasta ./dist (Vite)
npm run preview  # serve o build localmente para conferência
```

## Deploy no Cloudflare

### Via painel (Cloudflare Pages)

Ao conectar o repositório no painel do Cloudflare Pages, use:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Adicione também as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas configurações do projeto no Cloudflare (Settings → Environment variables).

### Via CLI (Wrangler)

O [`wrangler.toml`](./wrangler.toml) já aponta a seção `assets` para `./dist` e trata o roteamento SPA:

```bash
npm run deploy   # roda "vite build" e "wrangler deploy"
```

## Estrutura do projeto

```
sistema-tato/
├── src/
│   ├── components/       # Layout, ProtectedRoute e componentes shadcn/ui
│   ├── context/          # AuthContext (Supabase Auth)
│   ├── lib/              # cliente Supabase, helpers, estilos de status
│   ├── pages/            # Login, Dashboard, ShowForm, ClosedShows
│   ├── types/            # tipos do banco de dados
│   ├── App.tsx           # rotas
│   └── main.tsx          # entrypoint
├── supabase/
│   ├── migrations/       # schema SQL
│   ├── functions/        # Edge Functions (contrato-pdf)
│   └── config.toml
├── wrangler.toml         # deploy Cloudflare
├── .env.example
└── vite.config.ts
```

## Telas

1. **Login** — autenticação via Supabase Auth (e-mail/senha).
2. **Dashboard** — shows agrupados por status, com cores distintas por status.
3. **Cadastro/edição de show** — formulário completo com cliente, data, valor e status.
4. **Shows fechados** — lista dos shows com status `fechado` e total faturado.
5. **Ficha do show** — dados, tarefas, timeline e contratos.
6. **Contrato** (`/contratos/:id`) — documento, status das assinaturas, link do
   cliente e assinatura do contratado.
7. **Assinatura do cliente** (`/assinar/:token`) — pública, sem login.
