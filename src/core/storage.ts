import browser from "webextension-polyfill";
import {
  DEFAULT_USER_THEME_ID,
  isThemeMode,
  isUserThemeId,
  type ThemeMode,
} from "./theme-meta.js";

const KEY_FULL_TITLE = "fullTitleEnabled";
const KEY_SIMPLIFY = "simplifyTitlesEnabled";
const KEY_EXECUTOR_FIX = "executorSearchFixEnabled";
const KEY_THEME_MODE = "themeMode";
const KEY_THEME_ID = "themeId";


export async function isSimplifyTitlesEnabled(): Promise<boolean> {
  const data = await browser.storage.local.get(KEY_SIMPLIFY);
  const value = data[KEY_SIMPLIFY];
  return value === undefined ? true : value === true;
}

export async function setSimplifyTitlesEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [KEY_SIMPLIFY]: enabled });
}

export function onSimplifyTitlesChanged(
  handler: (enabled: boolean) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const change = changes[KEY_SIMPLIFY];
    if (!change) return;
    handler(change.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Включён ли фикс поиска в поле «Исполнитель» (по умолчанию — да). */
export async function isExecutorSearchFixEnabled(): Promise<boolean> {
  const data = await browser.storage.local.get(KEY_EXECUTOR_FIX);
  const value = data[KEY_EXECUTOR_FIX];
  return value === undefined ? true : value === true;
}

export async function setExecutorSearchFixEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [KEY_EXECUTOR_FIX]: enabled });
}

export function onExecutorSearchFixChanged(
  handler: (enabled: boolean) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const change = changes[KEY_EXECUTOR_FIX];
    if (!change) return;
    handler(change.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getThemeMode(): Promise<ThemeMode> {
  const data = await browser.storage.local.get([KEY_THEME_MODE, KEY_THEME_ID]);
  const mode = data[KEY_THEME_MODE];
  const id = data[KEY_THEME_ID];
  if (id === "native") return "native";
  return isThemeMode(mode) ? mode : "auto";
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await browser.storage.local.set({ [KEY_THEME_MODE]: mode });
}

export function onThemeModeChanged(
  handler: (mode: ThemeMode) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const modeChange = changes[KEY_THEME_MODE];
    const idChange = changes[KEY_THEME_ID];
    if (!modeChange && !idChange) return;
    void getThemeMode().then(handler);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getUserThemeId(): Promise<string> {
  const data = await browser.storage.local.get(KEY_THEME_ID);
  const value = data[KEY_THEME_ID];
  if (value === "native") return DEFAULT_USER_THEME_ID;
  return isUserThemeId(value) ? value : DEFAULT_USER_THEME_ID;
}

export async function setUserThemeId(id: string): Promise<void> {
  if (!isUserThemeId(id)) return;
  await browser.storage.local.set({ [KEY_THEME_ID]: id });
}

export function onUserThemeIdChanged(
  handler: (id: string) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const change = changes[KEY_THEME_ID];
    if (!change) return;
    const v = change.newValue;
    handler(isUserThemeId(v) ? v : DEFAULT_USER_THEME_ID);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

const KEY_AVATAR_NAMES = "avatarNamesEnabled";

export async function isAvatarNamesEnabled(): Promise<boolean> {
  const data = await browser.storage.local.get(KEY_AVATAR_NAMES);
  const value = data[KEY_AVATAR_NAMES];
  return value === undefined ? true : value === true;
}

export async function setAvatarNamesEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [KEY_AVATAR_NAMES]: enabled });
}

export function onAvatarNamesChanged(
  handler: (enabled: boolean) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const change = changes[KEY_AVATAR_NAMES];
    if (!change) return;
    handler(change.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}


export async function isFullTitleEnabled(): Promise<boolean> {
  const data = await browser.storage.local.get(KEY_FULL_TITLE);
  const value = data[KEY_FULL_TITLE];
  return value === undefined ? true : value === true;
}

export async function setFullTitleEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [KEY_FULL_TITLE]: enabled });
}

export function onFullTitleChanged(
  handler: (enabled: boolean) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local") return;
    const change = changes[KEY_FULL_TITLE];
    if (!change) return;
    handler(change.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}