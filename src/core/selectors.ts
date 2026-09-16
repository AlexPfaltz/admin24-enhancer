/**
 * Селекторы Admin24. Проверены на /tickets/tickets-list-page.
 * При изменении вёрстки на стороне Admin24 — править только здесь.
 */
export const SELECTORS = {
  /** Контейнер списка заявок */
  list: ".tickets-list",
  /** Карточка заявки */
  card: ".ticket",
  /** Ссылка-заголовок с номером и наименованием */
  title: "a.ticket-title",
  /** Внутренний span с текстом (может отсутствовать — тогда текст прямо в <a>) */
  titleText: "span",
  /** Flex-родитель <a>, ограничивающий ширину */
  headerTop: ".ticket-header-top",
} as const;

/**
 * data-атрибуты, которые ставит расширение, чтобы отличать
 * уже обработанные узлы и не конфликтовать с Vue.
 */
export const MARKERS = {
  /** На <html>: включает стили расширения */
  stylesOn: "data-a24-styles",
  /** Значение для stylesOn, когда стили включены */
  stylesOnValue: "on",
  /** На карточке: помечает, что карточка обработана */
  enriched: "data-a24-enriched",
  /** Заголовок карточки уже упрощён (убран префикс «Заявка с формы [...]») */
  titleCleaned: "data-a24-title-cleaned",
} as const;