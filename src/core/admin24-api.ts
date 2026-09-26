import {
  fetchResponsibleList,
  type ResponsiblePerson,
} from "../screens/ticket-detailed/vue-bridge.js";

export interface Admin24Person {
  id: number;
  name: string;
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

/** Fallback-источник: data-page="app" (только если bridge не ответил). */
function readResponsibleListFromDataPage(): Admin24Person[] {
  const list = readPageProps()?.responsibleList;
  if (!Array.isArray(list)) return [];
  const result: Admin24Person[] = [];
  for (const raw of list) {
    const person = normalizePerson(raw);
    if (person) result.push(person);
  }
  return result;
}

/** Преобразует запись из bridge в наш Admin24Person. */
function bridgeToPerson(p: ResponsiblePerson): Admin24Person {
  const person: Admin24Person = {
    id: p.id,
    name: p.name,
    fullName: p.fullName,
  };
  if (p.email) person.email = p.email;
  if (p.photoUrl) person.photoUrl = p.photoUrl;
  return person;
}

export function readViewerEmail(): string {
  const props = readPageProps();
  return props?.auth?.user?.email ?? props?.currentUser?.email ?? "";
}

let responsibleCache: Admin24Person[] = [];
let loadPromise: Promise<void> | null = null;

export function loadResponsibleList(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const fromDataPage = readResponsibleListFromDataPage();
    if (fromDataPage.length > 0) {
      responsibleCache = fromDataPage;
      return;
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const fromBridge = await fetchResponsibleList();
      if (fromBridge.length > 0) {
        responsibleCache = fromBridge.map(bridgeToPerson);
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    loadPromise = null;
  })();

  return loadPromise;
}

export function readResponsibleList(): Admin24Person[] {
  return responsibleCache;
}