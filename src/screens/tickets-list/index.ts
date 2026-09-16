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
import { enrichTicketCards } from "./enrich.js";
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

  const list = findTicketsList(appRoot ?? document);

  if (list && list !== currentList) {
    attachToList(list);
    setStylesEnabled(true);
  } else if (!list && currentList) {
    detachFromList();
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
}

function deactivate(): void {
  setStylesEnabled(false);
  if (listObserver) {
    listObserver.disconnect();
    listObserver = null;
  }
  currentList = null;
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