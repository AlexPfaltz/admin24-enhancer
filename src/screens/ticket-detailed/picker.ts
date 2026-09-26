import type { Admin24Person } from "../../core/admin24-api.js";

export interface PickerHandle {
  mount(overlayContent: HTMLElement): void;
  unmount(): void;
  isMountedFor(overlayContent: HTMLElement): boolean;
  refresh(): void;
}

export interface PickerCallbacks {
  getPeople: () => Admin24Person[];
  getCurrentId: () => number | null;
  getViewerEmail: () => string;
  onPick: (person: Admin24Person) => void | Promise<void>;
  onNeedPeople?: () => void;
}

export const PICKER_MARKER = "data-a24-picker";
const MAX_VISIBLE = 40;

const STYLES = `
.a24-pk {
  display: grid;
  grid-template-rows: auto auto 1fr;
  height: 100%; max-height: inherit;
  overflow: hidden;
}
.a24-pk__search {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.a24-pk__search input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(0,0,0,.18);
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: transparent;
  box-sizing: border-box;
}
.a24-pk__search input:focus {
  outline: 2px solid var(--a24-accent, #1976d2);
  outline-offset: -1px;
  border-color: var(--a24-accent, #1976d2);
}
.a24-pk__count {
  padding: 4px 12px;
  color: inherit;
  opacity: .6;
  font-size: 11px;
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.a24-pk__list {
  overflow: auto;
  padding: 4px 0;
}
.a24-pk__item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.a24-pk__item:hover,
.a24-pk__item:focus-visible {
  background: rgba(0,0,0,.05);
  outline: none;
}
.a24-pk__item[data-current="1"] {
  color: var(--a24-accent, #1976d2);
  font-weight: 600;
}
.a24-pk__empty {
  padding: 16px;
  text-align: center;
  opacity: .6;
}
.a24-pk__more {
  padding: 6px 14px;
  opacity: .6;
  font-size: 11px;
}
.a24-pk {
  display: grid;
  grid-template-rows: auto auto 1fr;
  height: 100%;
  max-height: inherit;
  overflow: hidden;
  background: var(--a24-surface, Canvas);
  color: var(--a24-text, CanvasText);
}
.a24-pk__search {
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.a24-pk__search input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: var(--a24-field-bg, Field);
  box-sizing: border-box;
}
.a24-pk__search input:focus {
  outline: 2px solid var(--a24-accent, Highlight);
  outline-offset: -1px;
  border-color: var(--a24-accent, Highlight);
}
.a24-pk__count {
  padding: 4px 12px;
  color: inherit;
  opacity: .6;
  font-size: 11px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
}
.a24-pk__list {
  overflow: auto;
  padding: 4px 0;
}
.a24-pk__item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.a24-pk__item:hover,
.a24-pk__item:focus-visible {
  background: color-mix(in srgb, currentColor 8%, transparent);
  outline: none;
}
.a24-pk__item[data-current="1"] {
  color: var(--a24-accent, Highlight);
  font-weight: 600;
}
.a24-pk__empty {
  padding: 16px;
  text-align: center;
  opacity: .6;
}
.a24-pk__more {
  padding: 6px 14px;
  opacity: .6;
  font-size: 11px;
}
`;


function sortPeople(people: Admin24Person[], viewerEmail: string): Admin24Person[] {
  const viewer = viewerEmail.toLocaleLowerCase();
  return [...people].sort((a, b) => {
    const aSelf = a.email?.toLocaleLowerCase() === viewer ? 0 : 1;
    const bSelf = b.email?.toLocaleLowerCase() === viewer ? 0 : 1;
    if (aSelf !== bSelf) return aSelf - bSelf;
    return a.fullName.localeCompare(b.fullName, "ru");
  });
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
}

export function createPicker(cb: PickerCallbacks): PickerHandle {
  let overlayEl: HTMLElement | null = null;
  let nativeSheet: HTMLElement | null = null;
  let root: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  let list: HTMLElement | null = null;
  let countLine: HTMLElement | null = null;
  let query = "";
  let styleEl: HTMLStyleElement | null = null;

  function render(): void {
    if (!list || !countLine) return;

    const all = cb.getPeople();

    if (all.length === 0) {
      countLine.textContent = "Загрузка…";
      list.replaceChildren();
      const loading = document.createElement("div");
      loading.className = "a24-pk__empty";
      loading.textContent = "Загрузка списка…";
      list.append(loading);
      cb.onNeedPeople?.();
      return;
    }

    const currentId = cb.getCurrentId();
    const viewer = cb.getViewerEmail();
    const sorted = sortPeople(all, viewer);

    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const filtered =
      tokens.length === 0
        ? sorted
        : sorted.filter((p) => {
            const haystack = normalize(`${p.fullName} ${p.email ?? ""}`);
            return tokens.every((t) => haystack.includes(t));
          });

    countLine.textContent =
    tokens.length === 0
      ? `Всего: ${filtered.length}`
      : `Найдено: ${filtered.length}`;

  list.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "a24-pk__empty";
    empty.textContent = "Никого не найдено";
    list.append(empty);
    return;
  }

  const slice = filtered.slice(0, MAX_VISIBLE);
  for (const person of slice) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "a24-pk__item";
    item.setAttribute("role", "option");
    item.textContent = person.fullName;
    if (currentId != null && person.id === currentId) {
      item.setAttribute("data-current", "1");
      item.setAttribute("aria-selected", "true");
    } else {
      item.setAttribute("aria-selected", "false");
    }

    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void Promise.resolve(cb.onPick(person)).catch((err) => {
        console.error("[a24-enricher] picker onPick failed:", err);
      });
    });

    list.append(item);
  }

  if (filtered.length > MAX_VISIBLE) {
    const more = document.createElement("div");
    more.className = "a24-pk__more";
    more.textContent = `Показаны первые ${MAX_VISIBLE} из ${filtered.length}. Уточните запрос.`;
    list.append(more);
  }
}

  function onInputKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      input?.blur();
    }
    e.stopPropagation();
  }

  function mount(overlayContent: HTMLElement): void {
    if (overlayEl && overlayEl !== overlayContent) unmount();
    if (overlayEl === overlayContent && root?.isConnected) return;

    overlayEl = overlayContent;
    overlayContent.setAttribute(PICKER_MARKER, "1");

    nativeSheet = overlayContent.querySelector<HTMLElement>(":scope > .v-sheet");
    if (nativeSheet) nativeSheet.style.display = "none";

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-a24-picker-styles", "1");
      styleEl.textContent = STYLES;
      document.head.append(styleEl);
    }

    root = document.createElement("div");
    root.className = "a24-pk";
    root.setAttribute("data-a24-picker-root", "1");

    const searchBox = document.createElement("div");
    searchBox.className = "a24-pk__search";
    input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Имя, фамилия или email…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.addEventListener("input", () => {
      query = input?.value ?? "";
      render();
    });
    input.addEventListener("keydown", onInputKeydown);
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    searchBox.append(input);

    countLine = document.createElement("div");
    countLine.className = "a24-pk__count";

    list = document.createElement("div");
    list.className = "a24-pk__list";
    list.setAttribute("role", "listbox");

    root.append(searchBox, countLine, list);
    overlayContent.append(root);

    render();
    requestAnimationFrame(() => requestAnimationFrame(() => input?.focus()));
  }

  function unmount(): void {
    root?.remove();
    if (nativeSheet) nativeSheet.style.display = "";
    if (overlayEl) overlayEl.removeAttribute(PICKER_MARKER);
    root = null;
    input = null;
    list = null;
    countLine = null;
    nativeSheet = null;
    overlayEl = null;
    query = "";
  }

  return {
    mount,
    unmount,
    isMountedFor: (el: HTMLElement) =>
    overlayEl === el && !!root && root.isConnected,
    refresh: render,
  };
}