import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Music4,
  Plus,
  Users,
} from "lucide-react";

import { OfflineBanner } from "@/components/OfflineBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calendario", label: "Calendário", icon: CalendarDays, end: false },
  { to: "/shows/fechados", label: "Fechados", icon: CheckCircle2, end: false },
  { to: "/clientes", label: "Clientes", icon: Users, end: false },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, end: false },
];

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    // No claro a página é cinza e o header branco; no escuro invertemos a
    // elevação (página no tom mais escuro, header no tom de card).
    <div className="min-h-screen bg-muted/30 dark:bg-background">
      <OfflineBanner />
      <header className="border-b bg-background dark:bg-card">
        <div className="container flex h-16 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 font-semibold">
            <Music4 className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">CV Produções Artísticas</span>
          </div>

          {/* No celular a navegação desce para a barra fixa no rodapé: cinco
              itens com rótulo não cabem aqui, e viravam ícones sem legenda. */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              size="icon"
              className="sm:hidden"
              aria-label="Novo show"
              onClick={() => navigate("/shows/novo")}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate("/shows/novo")}
            >
              <Plus className="h-4 w-4" />
              Novo show
            </Button>
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              title={user?.email ?? "Sair"}
              aria-label="Sair"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* O padding de baixo no celular reserva o espaço da barra fixa. */}
      <main className="container py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Barra inferior: o alcance do polegar no celular. Cada item é um alvo
          de 56px de altura, com ícone e rótulo. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] dark:bg-card md:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-tight transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="w-full truncate text-center">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
