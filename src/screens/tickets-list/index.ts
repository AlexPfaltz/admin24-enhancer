import {
  findTicketsList,
  waitForAppRoot,
} from "../../core/dom.js";
import {
  setAvatarNamesStylesEnabled,
  setFullTitleStylesEnabled,
} from "../../core/styles.js";
import {
  isFullTitleEnabled,
  isSimplifyTitlesEnabled,
  isAvatarNamesEnabled,
  onFullTitleChanged,
  onSimplifyTitlesChanged,
  onAvatarNamesChanged,
} from "../../core/storage.js";
import { enrichTicketCards, refreshTicketLightCache } from "./enrich.js";
import { setAvatarNamesEnabledLocal } from "./enrich-avatars.js";
import { initTheme } from "../theme/index.js";
import { initTicketDetailed } from "../ticket-detailed/index.js";

let appRoot: HTMLElement | null = null;
let appObserver: MutationObserver | null = null;
let listObserver: MutationObserver | null = null;
let currentList: HTMLElement | null = null;
let mobileListObserver: MutationObserver | null = null;
let currentMobileList: HTMLElement | null = null;
let simplifyTitles = true;

function runEnrich(): void {
  if (document.visibilityState !== "visible") return;

  if (currentList && currentList.isConnected) {
    enrichTicketCards(currentList, { simplifyTitles });
  }
  if (currentMobileList && currentMobileList.isConnected) {
    enrichTicketCards(currentMobileList, { simplifyTitles });
  }
}

function attachToList(list: HTMLElement): void {
  if (listObserver) listObserver.disconnect();
  currentList = list;

  listObserver = new MutationObserver(() => runEnrich());
  listObserver.observe(list, { childList: true, subtree: true });

  runEnrich();
}

function detachFromList(): void {
  if (listObserver) {
    listObserver.disconnect();
    listObserver = null;
  }
  currentList = null;
}

function attachToMobileList(list: HTMLElement): void {
  if (mobileListObserver) mobileListObserver.disconnect();
  currentMobileList = list;

  mobileListObserver = new MutationObserver(() => runEnrich());
  mobileListObserver.observe(list, { childList: true, subtree: true });

  runEnrich();
}

function detachFromMobileList(): void {
  if (mobileListObserver) {
    mobileListObserver.disconnect();
    mobileListObserver = null;
  }
  currentMobileList = null;
}

function findMobileTicketsList(
  root: ParentNode = document
): HTMLElement | null {
  const m = root.querySelector<HTMLElement>(".tickets-mobile-template");
  if (!m) return null;
  return m.querySelector<HTMLElement>(".tickets-list");
}

function syncWithDom(): void {
  // Десктопный список.
  const list = findTicketsList(appRoot ?? document);
  if (
    list &&
    !list.closest(".tickets-mobile-template") &&
    list !== currentList
  ) {
    attachToList(list);
  } else if (!list && currentList) {
    detachFromList();
  }

  // Мобильный список.
  const mobile = findMobileTicketsList(appRoot ?? document);
  if (mobile && mobile !== currentMobileList) {
    attachToMobileList(mobile);
  } else if (!mobile && currentMobileList) {
    detachFromMobileList();
  }
}

async function activate(): Promise<void> {
  // Читаем флаги и сразу включаем/выключаем соответствующие CSS-блоки.
  const fullTitleOn = await isFullTitleEnabled();
  setFullTitleStylesEnabled(fullTitleOn);

  simplifyTitles = await isSimplifyTitlesEnabled();

  const avatarNamesOn = await isAvatarNamesEnabled();
  setAvatarNamesStylesEnabled(avatarNamesOn);

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
    appObserver = new MutationObserver(() => syncWithDom());
    appObserver.observe(appRoot, { childList: true, subtree: true });
  }

  syncWithDom();
  void refreshTicketLightCache().then(() => runEnrich());
}

onFullTitleChanged((value) => {
  setFullTitleStylesEnabled(value);
});

onSimplifyTitlesChanged((value) => {
  simplifyTitles = value;
  runEnrich();
});

onAvatarNamesChanged((value) => {
  setAvatarNamesEnabledLocal(value);
  setAvatarNamesStylesEnabled(value);
  runEnrich();
});

void activate();

void initTheme();
void initTicketDetailed();