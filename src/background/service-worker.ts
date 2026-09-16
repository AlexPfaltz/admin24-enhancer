import browser from "webextension-polyfill";

/**
 * Заглушка. В следующих итерациях сюда переедет:
 *  - периодическая подсветка счётчика просроченных (через badge)
 *  - обработка клика по action (если понадобится открывать панель)
 *
 * Сейчас — только инициализация дефолтного состояния хранилища.
 */
browser.runtime.onInstalled.addListener(async () => {
  const data = await browser.storage.local.get("enrichTicketsListEnabled");
  if (data["enrichTicketsListEnabled"] === undefined) {
    await browser.storage.local.set({ enrichTicketsListEnabled: true });
  }
});
