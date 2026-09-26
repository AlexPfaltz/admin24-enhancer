import browser from "webextension-polyfill";

export type ThemeKind = "light" | "dark";

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  bgSunken: string;
  surface: string;
  surface2: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  accentOnSoft: string;
  accentOn: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
}

export interface ThemeStatuses {
  new: string;
  warning: string;
  ok: string;
  own: string;
  neutral: string;
}

export interface Theme {
  id: string;
  label: string;
  kind: ThemeKind;
  colors: ThemeColors;
  statuses: ThemeStatuses;
}

interface ThemesConfig {
  version: number;
  themes: Record<string, Omit<Theme, "id">>;
}

let cachedConfig: ThemesConfig | null = null;
let loadPromise: Promise<ThemesConfig | null> | null = null;

/** Список тем после загрузки. До загрузки — пустой. */
let themesCache: readonly Theme[] = [];

function parseConfig(raw: unknown): ThemesConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const themes = obj["themes"];
  if (typeof themes !== "object" || themes === null) return null;
  return raw as ThemesConfig;
}

export function loadThemes(): Promise<ThemesConfig | null> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const url = browser.runtime.getURL("themes.json");
      const res = await fetch(url);
      if (!res.ok) {
        console.error(
          `[a24-enricher] themes.json: HTTP ${res.status} ${res.statusText}`
        );
        return null;
      }
      const raw: unknown = await res.json();
      const parsed = parseConfig(raw);
      if (!parsed) {
        console.error("[a24-enricher] themes.json: invalid structure");
        return null;
      }
      cachedConfig = parsed;
      themesCache = Object.entries(parsed.themes).map(([id, t]) => ({
        id,
        label: t.label,
        kind: t.kind,
        colors: t.colors,
        statuses: t.statuses,
      }));
      return parsed;
    } catch (err) {
      console.error("[a24-enricher] themes.json load failed:", err);
      return null;
    }
  })();

  return loadPromise;
}

export function getThemes(): readonly Theme[] {
  return themesCache;
}

export function isThemesLoaded(): boolean {
  return cachedConfig !== null;
}

export const NATIVE_THEME_ID = "native";

export const NATIVE_THEME_OPTION = {
  id: NATIVE_THEME_ID,
  label: "Оригинальная (Admin24)",
} as const;

export const DEFAULT_USER_THEME_ID = "dark";
export const DEFAULT_LIGHT_THEME_ID = "light";

export type ThemeMode = "auto" | "fixed" | "native";

export const THEME_MODES: readonly ThemeMode[] = ["auto", "fixed", "native"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "fixed" || value === "native";
}

export function isUserThemeId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!cachedConfig) return false;
  return value in cachedConfig.themes;
}

export function getTheme(id: string): Theme | undefined {
  if (id === NATIVE_THEME_ID) return undefined;
  return themesCache.find((t) => t.id === id);
}