import {
  findTicketsList,
  waitForAppRoot,
} from "../../core/dom.js";
import { setStylesEnabled } from "../../core/styles.js";
import {
  isEnabled,
  isSimplifyTitlesEnabled,
  onEnabledChanged,
  onSimplifyTitlesChanged,
} from "../../core/storage.js";
import { enrichTicketCards, refreshTicketLightCache } from "./enrich.js";
import { initTheme } from "../theme/index.js";
import { initTicketDetailed } from "../ticket-detailed/index.js";


let appRoot: HTMLElement | null = null;
let appObserver: MutationObserver | null = null;
let listObserver: MutationObserver | null = null;
let currentList: HTMLElement | null = null;

let enabled = true;
let simplifyTitles = true;

function runEnrich(): void {
  if (!enabled) return;
  if (!currentList || !currentList.isConnected) return;
  if (document.visibilityState !== "visible") return;
  enrichTicketCards(currentList, { simplifyTitles });
}

function attachToList(list: HTMLElement): void {
  if (listObserver) {
    listObserver.disconnect();
  }
  currentList = list;

  listObserver = new MutationObserver(() => {
    runEnrich();
  });
  listObserver.observe(list, { childList: true, subtree: true });

  runEnrich();
}

function detachFromList(): void {
  if (listObserver) {
    listObserver.disconnect();
    listObserver = null;
  }
  currentList = null;
  setStylesEnabled(false);
}

function syncWithDom(): void {
  if (!enabled) return;

  // Десктопный список.
  const list = findTicketsList(appRoot ?? document);
  if (list && !list.closest(".tickets-mobile-template") && list !== currentList) {
    attachToList(list);
    setStylesEnabled(true);
  } else if (!list && currentList) {
    detachFromList();
  }

  // Мобильный список.
  const mobile = findMobileTicketsList(appRoot ?? document);
  if (mobile && mobile !== currentMobileList) {
    attachToMobileList(mobile);
    setStylesEnabled(true);
  } else if (!mobile && currentMobileList) {
    detachFromMobileList();
  }
}

async function activate(): Promise<void> {
  enabled = await isEnabled();

  if (!enabled) {
    deactivate();
    return;
  }

  simplifyTitles = await isSimplifyTitlesEnabled();

  if (!appRoot) {
    appRoot = await waitForAppRoot();
    if (!appRoot) {
      console.warn(
        "[a24-enricher] app root not found; enrichment disabled"
      );
      return;
    }
  }

  if (!appObserver) {
    appObserver = new MutationObserver(() => {
      syncWithDom();
    });
    appObserver.observe(appRoot, { childList: true, subtree: true });
  }

  syncWithDom();

  // Загружаем кэш тикетов для подписей под аватарами.
  void refreshTicketLightCache().then(() => {
    runEnrich();
  });
}

function deactivate(): void {
  setStylesEnabled(false);
  if (listObserver) { listObserver.disconnect(); listObserver = null; }
  if (mobileListObserver) { mobileListObserver.disconnect(); mobileListObserver = null; }
  currentList = null;
  currentMobileList = null;
}

function findMobileTicketsList(
  root: ParentNode = document
): HTMLElement | null {
  const m = root.querySelector<HTMLElement>(".tickets-mobile-template");
  if (!m) return null;
  return m.querySelector<HTMLElement>(".tickets-list");
}

let currentMobileList: HTMLElement | null = null;
let mobileListObserver: MutationObserver | null = null;

function runMobileEnrich(): void {
  if (!enabled) return;
  if (!currentMobileList || !currentMobileList.isConnected) return;
  if (document.visibilityState !== "visible") return;
  // Только подписи под аватарами — заголовки в мобильной вёрстке
  // мы уже трогаем через CSS, JS для них не нужен.
  enrichTicketCards(currentMobileList, { simplifyTitles });
}

function attachToMobileList(list: HTMLElement): void {
  if (mobileListObserver) mobileListObserver.disconnect();
  currentMobileList = list;

  mobileListObserver = new MutationObserver(() => {
    runMobileEnrich();
  });
  mobileListObserver.observe(list, { childList: true, subtree: true });

  runMobileEnrich();
}

function detachFromMobileList(): void {
  if (mobileListObserver) {
    mobileListObserver.disconnect();
    mobileListObserver = null;
  }
  currentMobileList = null;
}

onEnabledChanged((value) => {
  enabled = value;
  if (value) {
    void activate();
  } else {
    deactivate();
  }
});

onSimplifyTitlesChanged((value) => {
  simplifyTitles = value;
  if (value) runEnrich();
});

void activate();

// Тема и фикс «Исполнителя» не зависят от обогащения списка —
// инициализируются параллельно.
void initTheme();
void initTicketDetailed();