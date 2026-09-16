import { SELECTORS } from "./selectors.js";

/** Типизированный querySelectorAll → массив. */
export function queryAll<T extends Element = Element>(
  root: ParentNode,
  selector: string
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Найти контейнер списка заявок на текущей странице. */
export function findTicketsList(
  root: ParentNode = document
): HTMLElement | null {
  return root.querySelector<HTMLElement>(SELECTORS.list);
}

/** Найти все карточки внутри контейнера. */
export function findTicketCards(list: ParentNode): HTMLElement[] {
  return queryAll<HTMLElement>(list, SELECTORS.card);
}

/**
 * Корневой узел SPA (#app). Не пересоздаётся при навигации —
 * Vue перерисовывает только своё поддерево внутри.
 */
export function findAppRoot(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>("#app");
}

/**
 * Дождаться появления #app (один раз при старте).
 */
export function waitForAppRoot(
  timeoutMs = 15000
): Promise<HTMLElement | null> {
  const existing = findAppRoot();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;
    const finish = (el: HTMLElement | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };

    const observer = new MutationObserver(() => {
      const el = findAppRoot();
      if (el) finish(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Дождаться, пока в DOM появится контейнер списка заявок.
 */
export function waitForTicketsList(
  root: ParentNode = document.body,
  timeoutMs = 15000
): Promise<HTMLElement | null> {
  const existing = findTicketsList(root);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;
    const finish = (el: HTMLElement | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };

    const observer = new MutationObserver(() => {
      const el = findTicketsList(root);
      if (el) finish(el);
    });
    observer.observe(root as Node, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}