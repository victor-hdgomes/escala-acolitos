"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyHtmlClass(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] =
    React.useState<"light" | "dark">("dark");

  // On mount: read the saved preference and apply it. localStorage does not
  // exist on the server, so this read cannot happen during rendering.
  React.useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? defaultTheme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is an external system
    setThemeState(stored);
    const resolved = stored === "system" ? getSystemTheme() : stored;
    setResolvedTheme(resolved);
    applyHtmlClass(resolved);
  }, [defaultTheme]);

  // sync with system changes when theme === "system"
  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyHtmlClass(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const resolved = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyHtmlClass(resolved);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Inline script that prevents the flash of the wrong theme: it runs before
 * React mounts and puts the right class on <html>. Rendered into <head> with
 * dangerouslySetInnerHTML so it stays outside the React tree, which is what
 * keeps React 19 from warning about it.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = stored || 'dark';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    var root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`;
