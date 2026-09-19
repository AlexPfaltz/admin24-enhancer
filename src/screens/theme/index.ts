import {
  getThemeMode,
  getUserThemeId,
  onThemeModeChanged,
  onUserThemeIdChanged,
} from "../../core/storage.js";
import {
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_USER_THEME_ID,
  getTheme,
  loadThemes,
  type Theme,
  type ThemeMode,
} from "../../core/theme-meta.js";

const HTML_THEME_ATTR = "data-a24-theme";
const HTML_KIND_ATTR = "data-a24-theme-kind";

const STATUS_VAR_NAMES: Record<string, string> = {
  new: "--a24-status-new",
  warning: "--a24-status-warning",
  ok: "--a24-status-ok",
  own: "--a24-status-own",
  neutral: "--a24-status-neutral",
};

/**
 * Преобразует "#1e2226" или "#1e2226ff" в "30, 34, 38".
 * Возвращает как есть, если значение уже не hex (например,
 * готовое "30, 34, 38" или rgba-выражение).
 */
function hexToRgb(value: string): string {
  const hex = value.trim();
  if (!hex.startsWith("#")) {
    return hex.replace(/^rgba?\(|\)$/g, "");
  }

  let r = 0;
  let g = 0;
  let b = 0;

  if (hex.length === 4) {
    r = parseInt(hex[1]! + hex[1], 16);
    g = parseInt(hex[2]! + hex[2], 16);
    b = parseInt(hex[3]! + hex[3], 16);
  } else if (hex.length === 7 || hex.length === 9) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return "0, 0, 0";
  }
  return `${r}, ${g}, ${b}`;
}

/** CSS-имя переменной роли: accentOnSoft → --p-accent-on-soft. */
function cssVarName(role: string): string {
  return "--p-" + role.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

/** То же, но для rgb-компонентов: --rgb-accent-on-soft. */
function rgbVarName(role: string): string {
  return "--rgb-" + role.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

function resolveTheme(mode: ThemeMode, userThemeId: string): Theme | null {
  if (mode === "native") return null;

  const selected = getTheme(userThemeId) ?? getTheme(DEFAULT_USER_THEME_ID);
  if (!selected) return null;

  if (mode === "fixed") return selected;

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const systemKind: "light" | "dark" = systemDark ? "dark" : "light";
  if (selected.kind === systemKind) return selected;

  const fallbackId =
    systemKind === "dark" ? DEFAULT_USER_THEME_ID : DEFAULT_LIGHT_THEME_ID;
  return getTheme(fallbackId) ?? selected;
}

function applyPalette(theme: Theme): void {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.colors)) {
    if (!value) continue;

    const cssVar = cssVarName(key);
    if (root.style.getPropertyValue(cssVar) !== value) {
      root.style.setProperty(cssVar, value);
    }

    const rgbVar = rgbVarName(key);
    const rgb = hexToRgb(value);
    if (root.style.getPropertyValue(rgbVar) !== rgb) {
      root.style.setProperty(rgbVar, rgb);
    }
  }

  for (const [key, value] of Object.entries(theme.statuses)) {
    const cssVar = STATUS_VAR_NAMES[key];
    if (!cssVar) continue;
    if (root.style.getPropertyValue(cssVar) !== value) {
      root.style.setProperty(cssVar, value);
    }
  }

  if (root.getAttribute(HTML_THEME_ATTR) !== theme.id) {
    root.setAttribute(HTML_THEME_ATTR, theme.id);
  }
  if (root.getAttribute(HTML_KIND_ATTR) !== theme.kind) {
    root.setAttribute(HTML_KIND_ATTR, theme.kind);
  }
}

function clearPalette(): void {
  const root = document.documentElement;
  root.removeAttribute(HTML_THEME_ATTR);
  root.removeAttribute(HTML_KIND_ATTR);

  const style = root.style;
  const toRemove: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    if (
      prop &&
      (prop.startsWith("--p-") ||
        prop.startsWith("--rgb-") ||
        prop.startsWith("--a24-status-"))
    ) {
      toRemove.push(prop);
    }
  }
  for (const prop of toRemove) {
    style.removeProperty(prop);
  }
}

let currentMode: ThemeMode = "auto";
let currentUserId: string = DEFAULT_USER_THEME_ID;
let systemMedia: MediaQueryList | null = null;
let lastAppliedKey: string | null = null;

function appliedKeyOf(theme: Theme | null): string {
  if (!theme) return "native";
  return `${theme.id}:${theme.kind}`;
}

function refresh(): void {
  const theme = resolveTheme(currentMode, currentUserId);
  const key = appliedKeyOf(theme);
  if (lastAppliedKey === key) return;

  if (theme) applyPalette(theme);
  else clearPalette();
  lastAppliedKey = key;
}

function ensureSystemListener(active: boolean): void {
  if (active && !systemMedia) {
    systemMedia = window.matchMedia("(prefers-color-scheme: dark)");
    systemMedia.addEventListener("change", refresh);
  } else if (!active && systemMedia) {
    systemMedia.removeEventListener("change", refresh);
    systemMedia = null;
  }
}

function syncListenerState(): void {
  ensureSystemListener(currentMode === "auto");
}

let initialized = false;

export async function initTheme(): Promise<void> {
  const loaded = await loadThemes();
  if (!loaded) {
    console.warn(
      "[a24-enricher] theme init skipped: themes.json unavailable"
    );
    return;
  }

  currentMode = await getThemeMode();
  currentUserId = await getUserThemeId();

  refresh();
  syncListenerState();

  if (initialized) return;
  initialized = true;

  onThemeModeChanged((mode) => {
    if (mode === currentMode) return;
    currentMode = mode;
    refresh();
    syncListenerState();
  });

  onUserThemeIdChanged((id) => {
    if (id === currentUserId) return;
    currentUserId = id;
    refresh();
  });
}