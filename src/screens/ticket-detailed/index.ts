import {
  loadResponsibleList,
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
let appSyncTimer: number | null = null;

function scheduleAppSync(): void {
  if (appSyncTimer != null) return;
  appSyncTimer = window.setTimeout(() => {
    appSyncTimer = null;

    // Ответственного опрашиваем только если меню открыто (picker смонтирован).
    const anyMounted = !!picker && scanOverlayFindPerformerMenu() != null;
    if (anyMounted) {
      void getCurrentPerformerId().then((id) => {
        if (id != null) cachedCurrentId = id;
      });
    }

    if (readResponsibleList().length === 0) {
      void loadResponsibleList();
    }
  }, 150);
}

function scanOverlayFindPerformerMenu(): HTMLElement | null {
  const overlay = document.querySelector("body > .v-overlay-container");
  if (!overlay) return null;
  const menus = overlay.querySelectorAll<HTMLElement>(
    ".v-overlay__content.v-select__content"
  );
  for (const menu of menus) {
    if (isPerformerMenu(menu) && isVisible(menu)) return menu;
  }
  return null;
}

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
    onNeedPeople: () => {
      if (readResponsibleList().length === 0) {
        void loadResponsibleList().then(() => picker?.refresh());
      }
    },
  });
  return picker;
}

function scanOverlayContainer(): void {
  if (!fixEnabled) return;

  const overlay = document.querySelector("body > .v-overlay-container");
  if (!overlay) {
    picker?.unmount();
    return;
  }

  const labelId = findExecutorLabelId();
  if (!labelId) {
    if (picker) picker.unmount();
    return;
  }

  const menus = overlay.querySelectorAll<HTMLElement>(
    ".v-overlay__content.v-select__content"
  );

  let anyPerformerMenuVisible = false;

  for (const menu of menus) {
    if (!menu.classList.contains("v-select__content")) continue;
    const list = menu.querySelector<HTMLElement>(".v-list");
    if (list?.getAttribute("aria-labelledby") !== labelId) continue;

    const visible = isVisible(menu);
    if (!visible) {
      if (picker?.isMountedFor(menu)) picker.unmount();
      continue;
    }

    anyPerformerMenuVisible = true;

    if (readResponsibleList().length === 0) {
      void loadResponsibleList().then(() => picker?.refresh());
    }

    const p = ensurePicker();
    if (p.isMountedFor(menu)) continue;

    p.unmount();
    p.mount(menu);

    void getCurrentPerformerId().then((id) => {
      if (id != null) cachedCurrentId = id;
    });
    break;
  }

  if (!anyPerformerMenuVisible) {
    if (picker) picker.unmount();
  }
}

async function pickPerson(person: Admin24Person): Promise<void> {
  cachedCurrentId = person.id;

  const ok = await selectPerformer(person.id);
  if (!ok) {
    console.error("[a24-enricher] vue-bridge не подтвердил смену исполнителя");
  }

  await closePerformerMenu();

  const labelId = findExecutorLabelId();
  const overlay = document.querySelector("body > .v-overlay-container");
  if (overlay && labelId) {
    const menus = overlay.querySelectorAll<HTMLElement>(
      ".v-overlay__content.v-select__content"
    );
    for (const menu of menus) {
      const list = menu.querySelector<HTMLElement>(".v-list");
      if (list?.getAttribute("aria-labelledby") !== labelId) continue;
      menu.style.display = "none";
    }
  }
  picker?.unmount();
}

function ensureOverlayObserver(): void {
  if (overlayObserver) return;
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

  void loadResponsibleList();

  const appRoot = document.getElementById("app");
  if (!appRoot) {
    console.warn("[a24-enricher] #app not found; executor picker disabled");
    return;
  }

 appObserver = new MutationObserver(() => {
    scheduleAppSync();
  });
  appObserver.observe(appRoot, { childList: true, subtree: true });

  ensureOverlayObserver();
  sync();

  onExecutorSearchFixChanged((enabled) => {
    fixEnabled = enabled;
    sync();
  });
}