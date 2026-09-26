import {
  fetchTicketsLight,
  type TicketLight,
} from "../ticket-detailed/vue-bridge.js";
import { isAvatarNamesEnabled } from "../../core/storage.js";

const AVATAR_NAME_CLASS = "a24e-avatar-name";
const AVATAR_NAME_MARKER = "data-a24e-avatar-name";
const AVATAR_HIDDEN_CLASS = "a24e-avatar-hidden";

/**
 * Кэш тикетов. Заполняется через refreshTicketLightCache() и
 * переиспользуется. Порядок вставки сохраняется (Map), поэтому
 * Array.from(cache.values())[i] соответствует cards[i] в DOM.
 */
let cache: Map<string, TicketLight> = new Map();
let cacheLoaded = false;
let loadingPromise: Promise<void> | null = null;

/** Включена ли функция в popup. Обновляется через setAvatarNamesEnabled(). */
let enabled = true;
let initialised = false;

/** Инициализация подписки на флаг (один раз). */
async function ensureInitialised(): Promise<void> {
  if (initialised) return;
  initialised = true;
  enabled = await isAvatarNamesEnabled();
}

/**
 * Обновляет кэш через bridge. Идемпотентно: параллельные вызовы
 * ждут один промис. До 10 попыток с паузой 200мс, если Vue ещё
 * не отрендерил props.tickets.
 */
export function refreshTicketLightCache(): Promise<void> {
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureInitialised();
    for (let attempt = 0; attempt < 10; attempt++) {
      const list = await fetchTicketsLight();
      if (list.length > 0) {
        const next = new Map<string, TicketLight>();
        for (const t of list) {
          if (typeof t.id === "number") next.set(String(t.id), t);
        }
        cache = next;
        cacheLoaded = true;
        loadingPromise = null;
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    loadingPromise = null;
  })();

  return loadingPromise;
}

/** Синхронизирует флаг с хранилищем. Вызывается из index.ts. */
export function setAvatarNamesEnabledLocal(value: boolean): void {
  enabled = value;
  if (!value) {
    removeAllNames();
  }
}

/**
 * Убирает все наши подписи и возвращает аватарки на место.
 * Используется при выключении фичи в popup.
 */
function removeAllNames(): void {
  document
    .querySelectorAll<HTMLElement>(`[${AVATAR_NAME_MARKER}]`)
    .forEach((span) => {
      const block = span.parentElement;
      span.remove();
      const avatar = block?.querySelector<HTMLElement>(
        `.${AVATAR_HIDDEN_CLASS}`
      );
      if (avatar) avatar.classList.remove(AVATAR_HIDDEN_CLASS);
    });
}

/**
 * Строит строку «Label: value».
 * label сокращаем: «Ответственный» → «Отв.».
 */
function buildNameRow(label: string, name: string): HTMLElement {
  const span = document.createElement("span");
  span.className = AVATAR_NAME_CLASS;
  span.setAttribute(AVATAR_NAME_MARKER, "1");

  const labelEl = document.createElement("span");
  labelEl.className = `${AVATAR_NAME_CLASS}__label`;
  labelEl.textContent = label + ": ";

  const valueEl = document.createElement("span");
  valueEl.className = `${AVATAR_NAME_CLASS}__value`;
  valueEl.textContent = name;

  span.append(labelEl, valueEl);
  return span;
}

/**
 * Подставляет имена в блоки .ticket-property-with-avatar карточки.
 * Порядок блоков в .left-content:
 *   [0] — Ответственный
 *   [1] — Клиент
 * (проверено на живом Admin24).
 *
 * Идемпотентно: если уже подписано — не дублирует.
 */
function attachNames(card: HTMLElement, ticket: TicketLight): void {
  const blocks = card.querySelectorAll<HTMLElement>(
    ".ticket-property-with-avatar"
  );
  if (blocks.length === 0) return;

  const entries: Array<{ label: string; name: string | null }> = [
    { label: "Отв.", name: ticket.responsibleName },
    { label: "Клиент", name: ticket.applicantName },
  ];

  for (let i = 0; i < blocks.length && i < entries.length; i++) {
    const entry = entries[i]!;
    if (!entry.name) continue;

    const block = blocks[i]!;
    if (block.querySelector(`[${AVATAR_NAME_MARKER}]`)) continue;

    const avatar = block.querySelector<HTMLElement>(":scope > .d-flex");
    if (avatar) avatar.classList.add(AVATAR_HIDDEN_CLASS);

    block.append(buildNameRow(entry.label, entry.name));
  }
}

/**
 * Подписывает аватары именами в мобильной вёрстке списка заявок.
 * Сопоставление карточки с тикетом — по позиции: cards[i] ↔ tickets[i],
 * потому что Admin24 рендерит список в том же порядке, что и props.tickets.
 *
 * Идемпотентно — повторный проход не дублирует подписи.
 * Работает только если кэш загружен и функция включена; иначе — no-op.
 */
export function enrichAvatarNames(list: HTMLElement): number {
  if (!enabled) return 0;
  if (!cacheLoaded) return 0;

  const ordered = Array.from(cache.values());
  const cards = list.querySelectorAll<HTMLElement>(".ticket");
  let touched = 0;

  cards.forEach((card, i) => {
    if (!card.closest(".tickets-mobile-template")) return;

    const ticket = ordered[i];
    if (!ticket) return;

    const before = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;
    attachNames(card, ticket);
    const after = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;

    if (after > before) touched++;
  });

  return touched;
}