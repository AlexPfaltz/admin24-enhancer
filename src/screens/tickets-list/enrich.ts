import { SELECTORS, MARKERS } from "../../core/selectors.js";
import { findTicketCards } from "../../core/dom.js";
import { simplifyTitle } from "./parse.js";
import { enrichAvatarNames } from "./enrich-avatars.js";

interface EnrichOptions {
  simplifyTitles: boolean;
}

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

    const lastSimplified = card.getAttribute(MARKERS.titleOriginal);

    if (options.simplifyTitles) {
      // Упрощение включено.
      if (text !== lastSimplified) {
        const simplified = simplifyTitle(text);
        if (simplified !== text) {
          textNode.textContent = simplified;
        }
        card.setAttribute(MARKERS.titleOriginal, simplified);
      }
    } else {
    }

    if (!card.hasAttribute(MARKERS.enriched)) {
      card.setAttribute(MARKERS.enriched, "1");
      touched++;
    }
  }

  enrichAvatarNames(list);

  return touched;
}

export { refreshTicketLightCache } from "./enrich-avatars.js";