import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Faixa de aviso quando o aparelho está sem conexão.
 *
 * Com o service worker, o app abre offline — mas nada que dependa do banco
 * carrega. Sem este aviso, a tela apenas pareceria travada ou vazia, e quem
 * usa o sistema numa estrada ou dentro de uma casa de show não teria como
 * saber que o problema é o sinal.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const online = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Sem conexão — os dados podem estar desatualizados.
    </div>
  );
}
