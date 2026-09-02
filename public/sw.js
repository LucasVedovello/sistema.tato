/*
 * Service worker do CV Produções Artísticas.
 *
 * O que ele faz: guarda os arquivos estáticos do app (HTML, JS, CSS, ícones)
 * para a abertura no celular ser imediata e para o app ainda subir sem rede —
 * mostrando a última versão da interface e o aviso de que está offline.
 *
 * O que ele NÃO faz, de propósito: cachear as chamadas ao Supabase. Contrato,
 * status de show e assinatura são dados que não podem chegar velhos; requisição
 * para outra origem passa direto, sem interceptação.
 *
 * Estratégias
 * -----------
 * - Navegação (o HTML): rede primeiro, cache como reserva. Ao contrário, um
 *   deploy novo só apareceria depois de o usuário limpar o cache — o clássico
 *   "o site atualizou mas ninguém vê".
 * - Assets com hash no nome (/assets/*): cache primeiro. O nome muda a cada
 *   build, então nunca serve conteúdo velho.
 * - Demais arquivos da própria origem (ícones, manifest): cache com revalidação
 *   em segundo plano.
 */

const VERSAO = "v2";
const PREFIXO = "cv-producoes-";
const CACHE_SHELL = `${PREFIXO}shell-${VERSAO}`;
const CACHE_ASSETS = `${PREFIXO}assets-${VERSAO}`;
/** Prefixo usado antes da renomeação do sistema; ainda há caches com ele. */
const PREFIXO_ANTIGO = "backstage-";

/** O mínimo para a aplicação subir offline. */
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // addAll falha inteiro se um item falhar; aqui um ícone ausente não pode
      // impedir a instalação.
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter(
            (n) =>
              (n.startsWith(PREFIXO) || n.startsWith(PREFIXO_ANTIGO)) &&
              !n.endsWith(VERSAO)
          )
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/** Permite que a página peça a ativação imediata de uma versão nova. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

const ehAsset = (url) =>
  url.pathname.startsWith("/assets/") ||
  /\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname);

async function cachePrimeiro(request, cacheName) {
  const cache = await caches.open(cacheName);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const resposta = await fetch(request);
  if (resposta.ok) cache.put(request, resposta.clone());
  return resposta;
}

async function redePrimeiro(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardado = (await cache.match(request)) || (await cache.match("/index.html"));
    if (guardado) return guardado;
    throw erro;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET, e só a própria origem: o Supabase (auth, dados, Storage e a Edge
  // Function do contrato) nunca passa por aqui.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request, CACHE_SHELL));
    return;
  }

  if (ehAsset(url)) {
    event.respondWith(cachePrimeiro(request, CACHE_ASSETS));
  }
});
