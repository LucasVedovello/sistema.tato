/**
 * Registro do service worker.
 *
 * Fica fora do bundle principal do React de propósito: é uma chamada única, no
 * carregamento, e não deve competir com a primeira renderização.
 *
 * Em desenvolvimento o registro é pulado — um service worker servindo assets do
 * cache atrapalha o hot reload do Vite.
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Uma versão nova assume assim que estiver pronta: como o HTML é
        // buscado na rede primeiro, o app não fica preso a um build antigo.
        registration.addEventListener("updatefound", () => {
          const novo = registration.installing;
          novo?.addEventListener("statechange", () => {
            if (novo.state === "installed" && navigator.serviceWorker.controller) {
              novo.postMessage("skip-waiting");
            }
          });
        });
      })
      .catch((erro) => {
        // Sem service worker o app funciona igual, só perde o cache offline.
        console.warn("[pwa] service worker não registrado", erro);
      });
  });
}
