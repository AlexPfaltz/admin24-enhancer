/**
 * Чтение данных Admin24 из Inertia-props (<div data-page="app">).
 * Смена исполнителя идёт через Vue-инстанс — см. vue-bridge.ts.
 */

export interface Admin24Person {
  id: number;
  name: string;
  /** Admin24 кладёт в props поле `name`, не `fullName`. */
  fullName: string;
  email?: string;
  photoUrl?: string;
}

interface RawResponsible {
  id: number;
  name?: string;
  secondName?: string;
  lastName?: string;
  firstName?: string;
  fullName?: string;
  email?: string;
  photoUrl?: string;
}

interface DataPagePayload {
  version?: string;
  props?: {
    responsibleList?: RawResponsible[];
    ticket?: { uuid?: string };
    auth?: { user?: { email?: string; fullName?: string } };
    currentUser?: { email?: string; fullName?: string };
  };
}

export function readPageProps(): DataPagePayload["props"] | null {
  const el = document.querySelector('[data-page="app"]');
  if (!el || !el.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent) as DataPagePayload;
    return parsed.props ?? null;
  } catch (err) {
    console.warn("[a24-enricher] failed to parse data-page:", err);
    return null;
  }
}

/**
 * Приводим «сырой» элемент списка к нашему типу. Admin24 кладёт
 * разные наборы полей: где-то `name` = полное имя, где-то разбито
 * на `secondName`/`firstName`/`lastName`. Собираем `fullName` из того,
 * что есть.
 */
function normalizePerson(raw: RawResponsible): Admin24Person | null {
  if (typeof raw.id !== "number") return null;

  const name = typeof raw.name === "string" ? raw.name : "";
  const second = typeof raw.secondName === "string" ? raw.secondName : "";
  const first = typeof raw.firstName === "string" ? raw.firstName : "";
  const last = typeof raw.lastName === "string" ? raw.lastName : "";

  const fullName =
    (typeof raw.fullName === "string" && raw.fullName) ||
    [last, first, second].filter(Boolean).join(" ").trim() ||
    name ||
    `ID ${raw.id}`;

  const person: Admin24Person = { id: raw.id, name, fullName };
  if (typeof raw.email === "string") person.email = raw.email;
  if (typeof raw.photoUrl === "string") person.photoUrl = raw.photoUrl;
  return person;
}

export function readResponsibleList(): Admin24Person[] {
  const list = readPageProps()?.responsibleList;
  if (!Array.isArray(list)) return [];
  const result: Admin24Person[] = [];
  for (const raw of list) {
    const person = normalizePerson(raw);
    if (person) result.push(person);
  }
  return result;
}

export function readCurrentTicketUuid(): string | null {
  const uuid = readPageProps()?.ticket?.uuid;
  return typeof uuid === "string" && uuid.length > 0 ? uuid : null;
}

export function readViewerEmail(): string {
  const props = readPageProps();
  return props?.auth?.user?.email ?? props?.currentUser?.email ?? "";
}