import {
  readResponsibleList,
  readViewerEmail,
  type Admin24Person,
} from "../../core/admin24-api.js";
import {
  isExecutorSearchFixEnabled,
  onExecutorSearchFixChanged,
} from "../../core/storage.js";
import { createPicker, type PickerHandle } from "./picker.js";
import {
  closePerformerMenu,
  getCurrentPerformerId,
  selectPerformer,
} from "./vue-bridge.js";

let fixEnabled = true;
let picker: PickerHandle | null = null;
let appObserver: MutationObserver | null = null;
let overlayObserver: MutationObserver | null = null;
let cachedCurrentId: number | null = null;

function findExecutorLabelId(): string | null {
  const labels = document.querySelectorAll<HTMLLabelElement>(".v-label");
  for (const label of labels) {
    if ((label.textContent ?? "").trim() !== "Ответственный") continue;
    if (label.id) return label.id;
  }
  return null;
}

function isPerformerMenu(el: Element): boolean {
  if (!el.classList.contains("v-select__content")) return false;
  const id = findExecutorLabelId();
  if (!id) return false;
  const list = el.querySelector<HTMLElement>(".v-list");
  return list?.getAttribute("aria-labelledby") === id;
}

function isVisible(el: HTMLElement): boolean {
  if (el.style.display === "none") return false;
  if (!el.isConnected) return false;
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

function ensurePicker(): PickerHandle {
  if (picker) return picker;
  picker = createPicker({
    getPeople: () => readResponsibleList(),
    getCurrentId: () => cachedCurrentId,
    getViewerEmail: () => readViewerEmail(),
    onPick: pickPerson,
  });
  return picker;
}

/**
 * Проход по всем .v-select__content в overlay-container.
 * - Видимое меню «Ответственного» без живого root → mount.
 * - Скрытое/удалённое → unmount.
 */
function scanOverlayContainer(): void {
  if (!fixEnabled) return;

  const overlay = document.querySelector("body > .v-overlay-container");
  if (!overlay) {
    // Контейнер исчез — снимаем UI.
    picker?.unmount();
    return;
  }

  const menus = overlay.querySelectorAll<HTMLElement>(
    ".v-overlay__content.v-select__content"
  );

  let anyPerformerMenuVisible = false;

  for (const menu of menus) {
    if (!isPerformerMenu(menu)) continue;

    const visible = isVisible(menu);
    if (!visible) {
      // Скрытое меню «Ответственного» — снимаем UI, если он там висел.
      if (picker?.isMountedFor(menu)) picker.unmount();
      continue;
    }

    anyPerformerMenuVisible = true;
    const p = ensurePicker();

    // Если UI уже живой в этом узле — ничего не делаем.
    if (p.isMountedFor(menu)) continue;

    // Либо UI нет вообще, либо Vuetify перерисовал контейнер и наш root выпал.
    p.unmount();
    p.mount(menu);

    // Обновляем currentId на случай свежей карточки.
    void getCurrentPerformerId().then((id) => {
      if (id != null) cachedCurrentId = id;
    });
    break;
  }

  if (!anyPerformerMenuVisible) {
    // Ни одного видимого меню «Ответственного» — страхуемся.
    if (picker) picker.unmount();
  }
}

async function pickPerson(person: Admin24Person): Promise<void> {
  cachedCurrentId = person.id;

  const ok = await selectPerformer(person.id);
  if (!ok) {
    console.error("[a24-enricher] vue-bridge не подтвердил смену исполнителя");
  }

  // Закрываем меню через Vue.
  await closePerformerMenu();

  // Гарантированно скрываем нативное меню и снимаем наш UI:
  // после смены ответственного Admin24 через Inertia перезагружает
  // карточку, Vue-инстанс v-select уничтожается, и emit может не дойти.
  // Поэтому вручную скрываем .v-overlay__content и очищаем наш DOM.
  const overlay = document.querySelector("body > .v-overlay-container");
  if (overlay) {
    const menus = overlay.querySelectorAll<HTMLElement>(
      ".v-overlay__content.v-select__content"
    );
    for (const menu of menus) {
      if (!isPerformerMenu(menu)) continue;
      menu.style.display = "none";
    }
  }
  picker?.unmount();
}

function ensureOverlayObserver(): void {
  if (overlayObserver) return;
  // Следим за body целиком — сам .v-overlay-container может появиться позже.
  overlayObserver = new MutationObserver(() => {
    scanOverlayContainer();
  });
  overlayObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}

function sync(): void {
  if (!fixEnabled) {
    picker?.unmount();
    return;
  }
  scanOverlayContainer();
}

let initialized = false;

export async function initTicketDetailed(): Promise<void> {
  if (initialized) return;
  initialized = true;

  fixEnabled = await isExecutorSearchFixEnabled();
  if (!fixEnabled) return;

  const appRoot = document.getElementById("app");
  if (!appRoot) {
    console.warn("[a24-enricher] #app not found; executor picker disabled");
    return;
  }

  appObserver = new MutationObserver(() => {
    void getCurrentPerformerId().then((id) => {
      if (id != null) cachedCurrentId = id;
    });
  });
  appObserver.observe(appRoot, { childList: true, subtree: true });

  ensureOverlayObserver();
  sync();

  onExecutorSearchFixChanged((enabled) => {
    fixEnabled = enabled;
    sync();
  });
}