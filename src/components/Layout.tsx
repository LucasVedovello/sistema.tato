import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, LogOut, Music4, Plus } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: CalendarDays, end: true },
  { to: "/shows/fechados", label: "Fechados", icon: CheckCircle2, end: false },
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
      <header className="border-b bg-background dark:bg-card">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Music4 className="h-5 w-5 text-primary" />
            <span>Sistema Tato</span>
          </div>

          <nav className="flex items-center gap-1">
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
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => navigate("/shows/novo")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo show</span>
            </Button>
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              title={user?.email ?? "Sair"}
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
