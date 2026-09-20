import { SELECTORS, MARKERS } from "../../core/selectors.js";
import { findTicketCards } from "../../core/dom.js";
import { simplifyTitle } from "./parse.js";
import { enrichAvatarNames, refreshTicketLightCache } from "./enrich-avatars.js";

interface EnrichOptions {
  simplifyTitles: boolean;
}

/**
 * Помечает каждую карточку заявки и (опционально) упрощает заголовок —
 * убирает служебный префикс «Заявка с формы [ Форма ]».
 *
 * Дополнительно: подписывает аватары «Ответственный» и «Клиент»
 * именами в мобильной вёрстке (если кэш уже загружен).
 *
 * DOM не пересобираем: меняем textContent у существующего <span>,
 * чтобы не задеть обработчики кликов на <a>.
 */
export function enrichTicketCards(
  list: HTMLElement,
  options: EnrichOptions
): number {
  const cards = findTicketCards(list);
  let touched = 0;

  for (const card of cards) {
    const title = card.querySelector<HTMLAnchorElement>(SELECTORS.title);
    if (!title) continue;

    const textNode = title.querySelector<HTMLElement>(SELECTORS.titleText) ?? title;
    const text = textNode.textContent?.trim();
    if (!text) continue;

    if (options.simplifyTitles && !card.hasAttribute(MARKERS.titleCleaned)) {
      const simplified = simplifyTitle(text);
      if (simplified !== text) {
        textNode.textContent = simplified;
      }
      card.setAttribute(MARKERS.titleCleaned, "1");
    }

    if (!card.hasAttribute(MARKERS.enriched)) {
      card.setAttribute(MARKERS.enriched, "1");
      touched++;
    }
  }

  // Подписи под аватарами — только если кэш уже загружен.
  // Если нет — просто пропуск; следующий вызов runEnrich подхватит.
  enrichAvatarNames(list);

  return touched;
}

/**
 * Инициализация кэша тикетов для подписей под аватарами.
 * Асинхронная, вызывается один раз при активации.
 */
export { refreshTicketLightCache };