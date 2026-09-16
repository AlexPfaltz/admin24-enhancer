/**
 * Палитра темы. Ключи совпадают с CSS-переменными --a24-*
 * (без префикса). Значения — цвета в любом CSS-формате.
 */
export interface ThemePalette {
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
  danger: string;
  success: string;
  warning: string;
  info: string;
}

export const DARK_PALETTE: ThemePalette = {
  bg: "#121417",
  bgElevated: "#1a1d21",
  bgSunken: "#0e1013",
  surface: "#1e2226",
  surface2: "#242a30",
  surfaceHover: "#2a3138",
  border: "#2c3238",
  borderStrong: "#3a4149",
  text: "#e6e8eb",
  textMuted: "#9aa1a9",
  textDim: "#6c727a",
  accent: "#6aa9ff",
  danger: "#ff6b6b",
  success: "#57c98a",
  warning: "#f0a742",
  info: "#6aa9ff",
};