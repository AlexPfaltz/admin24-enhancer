import { fetchTicketsLight, type TicketLight } from "../ticket-detailed/vue-bridge.js";

const AVATAR_NAME_CLASS = "a24e-avatar-name";
const AVATAR_NAME_MARKER = "data-a24e-avatar-name";

/**
 * Кэш тикетов по id. Заполняется один раз при первом вызове
 * refreshTicketLightCache() и переиспользуется.
 */
let cache: Map<string, TicketLight> = new Map();
let cacheLoaded = false;
let loadingPromise: Promise<void> | null = null;

/** "000 012 155" → "12155". */
function normalizeNumber(s: string): string {
  const digits = s.replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

/**
 * Обновляет кэш через bridge. Идемпотентно: параллельные вызовы
 * ждут один промис. До 10 попыток с паузой 200мс, если Vue ещё
 * не отрендерил props.tickets.
 */
export function refreshTicketLightCache(): Promise<void> {
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
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

function lookupTicket(card: HTMLElement): TicketLight | null {
  if (!cacheLoaded) return null;

  // 1) По номеру заявки.
  const numEl = card.querySelector<HTMLElement>("a.ticket-number");
  if (numEl) {
    const num = normalizeNumber((numEl.textContent ?? "").trim());
    if (num) {
      const hit = cache.get(num);
      if (hit) return hit;
    }
  }

  // 2) Fallback — по заголовку.
  const titleEl = card.querySelector<HTMLElement>("a.ticket-title");
  const title = (titleEl?.textContent ?? "").trim().replace(/\s+/g, " ");
  if (!title) return null;

  for (const t of cache.values()) {
    if (!t.title) continue;
    if (t.title.includes(title)) return t;
  }
  return null;
}

function attachNames(card: HTMLElement, ticket: TicketLight): void {
  const blocks = card.querySelectorAll<HTMLElement>(
    ".ticket-property-with-avatar"
  );
  if (blocks.length === 0) return;

  // [label, value] в порядке следования блоков в .left-content:
  //   [0] — Ответственный
  //   [1] — Клиент
  // (проверено на живом Admin24).
  const entries: Array<{ label: string; name: string | null }> = [
    { label: "Ответственный", name: ticket.responsibleName },
    { label: "Клиент", name: ticket.applicantName },
  ];

  for (let i = 0; i < blocks.length && i < entries.length; i++) {
    const entry = entries[i]!;
    if (!entry.name) continue;

    const block = blocks[i]!;
    if (block.querySelector(`[${AVATAR_NAME_MARKER}]`)) continue;

    // Скрываем сам аватар — внутренний d-flex с иконкой.
    const avatar = block.querySelector<HTMLElement>(":scope > .d-flex");
    if (avatar) avatar.classList.add("a24e-avatar-hidden");

    // Внешний span — единая строка «Label: value».
    const span = document.createElement("span");
    span.className = AVATAR_NAME_CLASS;
    span.setAttribute(AVATAR_NAME_MARKER, "1");

    const label = document.createElement("span");
    label.className = `${AVATAR_NAME_CLASS}__label`;
    label.textContent = entry.label + ": ";

    const value = document.createElement("span");
    value.className = `${AVATAR_NAME_CLASS}__value`;
    value.textContent = entry.name;

    span.append(label, value);
    block.append(span);
  }
}

/**
 * Обходит все карточки мобильной вёрстки и подписывает аватары именами.
 * Работает только если кэш загружен; иначе — no-op.
 *
 * Возвращает число карточек, в которых что-то изменилось.
 */
export function enrichAvatarNames(list: HTMLElement): number {
  if (!cacheLoaded) return 0;

  const cards = list.querySelectorAll<HTMLElement>(".ticket");
  let touched = 0;

  for (const card of cards) {
    // Только карточки мобильной вёрстки. На десктопе Admin24 сам
    // показывает имя рядом с аватаром — туда лезть не надо.
    if (!card.closest(".tickets-mobile-template")) continue;

    const ticket = lookupTicket(card);
    if (!ticket) continue;

    const before = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;
    attachNames(card, ticket);
    const after = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;

    if (after > before) touched++;
  }

  return touched;
}