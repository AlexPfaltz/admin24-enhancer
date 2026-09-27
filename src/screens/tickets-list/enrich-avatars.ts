import {
  fetchTicketsLight,
  type TicketLight,
} from "../ticket-detailed/vue-bridge.js";
import { isAvatarNamesEnabled } from "../../core/storage.js";

const AVATAR_NAME_CLASS = "a24e-avatar-name";
const AVATAR_NAME_MARKER = "data-a24e-avatar-name";
const AVATAR_HIDDEN_CLASS = "a24e-avatar-hidden";

let cache: Map<string, TicketLight> = new Map();
let cacheLoaded = false;
let loadingPromise: Promise<void> | null = null;

let enabled = true;
let initialised = false;
let lastTicketIdsSignature = "";

async function ensureInitialised(): Promise<void> {
  if (initialised) return;
  initialised = true;
  enabled = await isAvatarNamesEnabled();
}

export function refreshTicketLightCache(): Promise<void> {
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureInitialised();
    for (let attempt = 0; attempt < 10; attempt++) {
      const list = await fetchTicketsLight();
      if (list.length > 0) {
        const sig = list.map((t) => t.id).sort((a, b) => a - b).join(",");

        if (sig === lastTicketIdsSignature && cacheLoaded) {
          loadingPromise = null;
          return;
        }
        lastTicketIdsSignature = sig;

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
    cache = new Map();
    cacheLoaded = false;
    lastTicketIdsSignature = "";
    loadingPromise = null;
  })();

  return loadingPromise;
}

export function invalidateTicketLightCache(): void {
  cache = new Map();
  cacheLoaded = false;
  lastTicketIdsSignature = "";
  loadingPromise = null;
}

export function setAvatarNamesEnabledLocal(value: boolean): void {
  enabled = value;
  if (!value) {
    removeAllNames();
  }
}

function removeAllNames(): void {
  document.querySelectorAll<HTMLElement>(".ticket").forEach(clearAvatarNames);
}

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

export function readTicketIdFromCard(card: HTMLElement): number | null {
  // 1. ПК-вёрстка — .ticket-number.
  const num = card.querySelector<HTMLElement>(".ticket-number");
  if (num) {
    const digits = (num.textContent ?? "").replace(/\D/g, "");
    if (digits) {
      const id = Number(digits);
      if (Number.isFinite(id)) return id;
    }
  }

  // 2. Мобильная вёрстка — id в начале текста заголовка.
  const title = card.querySelector<HTMLAnchorElement>("a.ticket-title");
  if (title) {
    const text = title.textContent?.trim() ?? "";
    const m = /^(\d+)\s*:/.exec(text);
    if (m) {
      const id = Number(m[1]);
      if (Number.isFinite(id)) return id;
    }
  }

  return null;
}

export function enrichAvatarNames(list: HTMLElement): number {
  if (!enabled) return 0;
  if (!cacheLoaded) return 0;

  const cards = list.querySelectorAll<HTMLElement>(".ticket");
  let touched = 0;

  cards.forEach((card) => {
  if (!card.closest(".tickets-mobile-template")) return;
  const id = readTicketIdFromCard(card);
  if (id == null) return;
  const ticket = cache.get(String(id));
  if (!ticket) {
    return;
  }

    const before = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;
    attachNames(card, ticket);
    const after = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;

    if (after > before) touched++;
  });

  return touched;
}

export function clearAvatarNames(card: HTMLElement): void {
  card.querySelectorAll<HTMLElement>(`[${AVATAR_NAME_MARKER}]`).forEach((span) => {
    const block = span.parentElement;
    span.remove();
    const avatar = block?.querySelector<HTMLElement>(`.${AVATAR_HIDDEN_CLASS}`);
    if (avatar) avatar.classList.remove(AVATAR_HIDDEN_CLASS);
  });
}
