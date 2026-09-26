export const SELECTORS = {
  list: ".tickets-list",
  card: ".ticket",
  title: "a.ticket-title",
  titleText: "span",
  headerTop: ".ticket-header-top"
} as const;

export const MARKERS = {
  fullTitleOn: "data-a24-full-title",
  fullTitleOnValue: "on",
  avatarNamesOn: "data-a24-avatar-names",
  avatarNamesOnValue: "on",
  enriched: "data-a24-enriched",
  titleSource: "data-a24-title-source",
} as const;