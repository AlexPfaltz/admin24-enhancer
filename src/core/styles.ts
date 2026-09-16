import { MARKERS } from "./selectors.js";

/**
 * Включает/выключает стили расширения одним переключателем на <html>.
 * Сами правила лежат в tickets-list.css и подключаются манифестом —
 * здесь только флаг, чтобы не вставлять <style> вручную и не бороться
 * с CSP страницы.
 */
export function setStylesEnabled(enabled: boolean): void {
  const html = document.documentElement;
  if (enabled) {
    html.setAttribute(MARKERS.stylesOn, MARKERS.stylesOnValue);
  } else {
    html.removeAttribute(MARKERS.stylesOn);
  }
}

export function areStylesEnabled(): boolean {
  return (
    document.documentElement.getAttribute(MARKERS.stylesOn) ===
    MARKERS.stylesOnValue
  );
}