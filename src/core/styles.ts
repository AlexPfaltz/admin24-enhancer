import { MARKERS } from "./selectors.js";

function setAttr(name: string, value: string, on: boolean): void {
  const html = document.documentElement;
  if (on) html.setAttribute(name, value);
  else html.removeAttribute(name);
}

/** Включает/выключает перенос длинного заголовка в мобильной вёрстке. */
export function setFullTitleStylesEnabled(enabled: boolean): void {
  setAttr(MARKERS.fullTitleOn, MARKERS.fullTitleOnValue, enabled);
}

/** Включает/выключает стили для имён вместо аватарок. */
export function setAvatarNamesStylesEnabled(enabled: boolean): void {
  setAttr(MARKERS.avatarNamesOn, MARKERS.avatarNamesOnValue, enabled);
}
