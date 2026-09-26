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
    loadingPromise = null;
  })();

  return loadingPromise;
}

export function setAvatarNamesEnabledLocal(value: boolean): void {
  enabled = value;
  if (!value) {
    removeAllNames();
  }
}

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

function readTicketIdFromCard(card: HTMLElement): number | null {
  const raw = card.getAttribute("data-ticket-id");
  if (raw && /^\d+$/.test(raw)) return Number(raw);

  const idEl = card.querySelector<HTMLElement>("[data-id]");
  const dataId = idEl?.getAttribute("data-id");
  if (dataId && /^\d+$/.test(dataId)) return Number(dataId);

  return null;
}

export function enrichAvatarNames(list: HTMLElement): number {
  if (!enabled) return 0;
  if (!cacheLoaded) return 0;

  const ordered = Array.from(cache.values());
  const cards = list.querySelectorAll<HTMLElement>(".ticket");
  let touched = 0;

  cards.forEach((card, i) => {
    if (!card.closest(".tickets-mobile-template")) return;

    const id = readTicketIdFromCard(card);
    const ticket = id != null ? cache.get(String(id)) ?? ordered[i] : ordered[i];
    if (!ticket) return;

    const before = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;
    attachNames(card, ticket);
    const after = card.querySelectorAll(`[${AVATAR_NAME_MARKER}]`).length;

    if (after > before) touched++;
  });

  return touched;
}