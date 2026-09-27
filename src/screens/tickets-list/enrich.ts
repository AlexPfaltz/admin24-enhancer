import { SELECTORS, MARKERS } from "../../core/selectors.js";
import { findTicketCards } from "../../core/dom.js";
import { simplifyTitle } from "./parse.js";
import {
  enrichAvatarNames,
  clearAvatarNames,
  readTicketIdFromCard,
} from "./enrich-avatars.js";

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
  const currentText = textNode.textContent?.trim();
  if (!currentText) continue;

  const currentId = readTicketIdFromCard(card);
  const storedId = card.getAttribute(MARKERS.cardId);

  if (currentId != null && storedId !== null && storedId !== String(currentId)) {
    card.removeAttribute(MARKERS.titleSource);
    card.removeAttribute(MARKERS.enriched);
    card.removeAttribute(MARKERS.cardId);
    clearAvatarNames(card);
  }

  if (currentId != null && !card.hasAttribute(MARKERS.cardId)) {
    card.setAttribute(MARKERS.cardId, String(currentId));
  }

  if (!card.hasAttribute(MARKERS.titleSource)) {
    card.setAttribute(MARKERS.titleSource, currentText);
  }
  const effectiveSource = card.getAttribute(MARKERS.titleSource) ?? currentText;

  if (options.simplifyTitles) {
    const simplified = simplifyTitle(effectiveSource);
    if (currentText !== simplified) {
      textNode.textContent = simplified;
    }
  } else {
    if (currentText !== effectiveSource) {
      textNode.textContent = effectiveSource;
    }
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