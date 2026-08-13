import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Preferência escolhida pelo usuário. "system" segue o SO. */
export type Theme = "light" | "dark" | "system";

/** Tema efetivamente aplicado (o que vira classe no <html>). */
export type ResolvedTheme = "light" | "dark";

/**
 * ATENÇÃO: esta chave é repetida no script inline do index.html, que aplica o
 * tema antes do React montar (evita o flash de tela clara). Se mudar aqui,
 * mude lá também.
 */
export const THEME_STORAGE_KEY = "sistema-tato-theme";

interface ThemeContextValue {
  /** A preferência salva ("system" enquanto o usuário não escolher). */
  theme: Theme;
  /** O tema realmente em uso, já resolvido quando a preferência é "system". */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Alterna entre claro e escuro a partir do tema resolvido. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolve(readStoredTheme())
  );

  // Aplica a classe no <html> e mantém o color-scheme nativo em sincronia
  // (isso é o que deixa scrollbars e inputs de data com a aparência correta).
  useEffect(() => {
    const next = resolve(theme);
    setResolvedTheme(next);

    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
  }, [theme]);

  // Só quando a preferência é "system": reage à troca de tema do SO.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = prefersDark() ? "dark" : "light";
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolve(readStoredTheme()) === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  }
  return ctx;
}
