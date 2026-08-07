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
