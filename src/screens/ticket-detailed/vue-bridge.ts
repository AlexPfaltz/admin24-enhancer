import browser from "webextension-polyfill";

const CHANNEL = "a24-enricher-vue-bridge";
const INJECTED_PATH = "vue-bridge-injected.js";
const SCRIPT_MARKER = "data-a24-vue-bridge";

interface BridgeResponse {
  source: "a24-enricher-bridge";
  channel: string;
  requestId: string;
  ok: boolean;
  value: number | null;
}

let scriptInjected = false;
let requestCounter = 0;

function injectScriptOnce(): void {
  if (scriptInjected) return;
  if (document.querySelector(`script[${SCRIPT_MARKER}]`)) {
    scriptInjected = true;
    return;
  }

  const url = browser.runtime.getURL(INJECTED_PATH);
  const script = document.createElement("script");
  script.src = url;
  script.setAttribute(SCRIPT_MARKER, "1");
  script.async = false;
  document.documentElement.append(script);
  scriptInjected = true;
}

function callBridge(
  action: "select" | "getCurrent" | "closeMenu",
  id?: number,
  timeoutMs = 2000
): Promise<{ ok: boolean; value: number | null }> {
  injectScriptOnce();
  return new Promise((resolve) => {
    const requestId = `a24v-${Date.now()}-${++requestCounter}`;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as BridgeResponse | undefined;
      if (
        !data ||
        data.source !== "a24-enricher-bridge" ||
        data.channel !== CHANNEL ||
        data.requestId !== requestId
      ) {
        return;
      }
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve({ ok: data.ok, value: data.value });
    };

    window.addEventListener("message", onMessage);

    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, value: null });
    }, timeoutMs);

    window.postMessage(
      {
        source: "a24-enricher-client",
        channel: CHANNEL,
        requestId,
        action,
        ...(typeof id === "number" ? { id } : {}),
      },
      location.origin
    );
  });
}

export async function selectPerformer(id: number): Promise<boolean> {
  const result = await callBridge("select", id);
  return result.ok;
}

export async function getCurrentPerformerId(): Promise<number | null> {
  const result = await callBridge("getCurrent");
  return result.value;
}

export async function closePerformerMenu(): Promise<boolean> {
  const result = await callBridge("closeMenu");
  return result.ok;
}

export interface TicketLight {
  id: number;
  title: string | null;
  responsibleName: string | null;
  applicantName: string | null;
}

interface TicketsLightResponse {
  source: "a24-enricher-bridge";
  channel: string;
  requestId: string;
  ok: boolean;
  tickets?: TicketLight[];
}

export async function fetchTicketsLight(
  timeoutMs = 3000
): Promise<TicketLight[]> {
  injectScriptOnce();

  return new Promise((resolve) => {
    const requestId = `a24v-${Date.now()}-${++requestCounter}`;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as TicketsLightResponse | undefined;
      if (
        !data ||
        data.source !== "a24-enricher-bridge" ||
        data.channel !== CHANNEL ||
        data.requestId !== requestId
      ) {
        return;
      }
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(data.tickets ?? []);
    };

    window.addEventListener("message", onMessage);

    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve([]);
    }, timeoutMs);

    window.postMessage(
      {
        source: "a24-enricher-client",
        channel: CHANNEL,
        requestId,
        action: "getTicketsLight",
      },
      location.origin
    );
  });
}

export interface ResponsiblePerson {
  id: number;
  name: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
}

interface ResponsibleListResponse {
  source: "a24-enricher-bridge";
  channel: string;
  requestId: string;
  ok: boolean;
  responsibleList?: ResponsiblePerson[];
}

export async function fetchResponsibleList(
  timeoutMs = 3000
): Promise<ResponsiblePerson[]> {
  injectScriptOnce();

  return new Promise((resolve) => {
    const requestId = `a24v-${Date.now()}-${++requestCounter}`;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as ResponsibleListResponse | undefined;
      if (
        !data ||
        data.source !== "a24-enricher-bridge" ||
        data.channel !== CHANNEL ||
        data.requestId !== requestId
      ) {
        return;
      }
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(data.responsibleList ?? []);
    };

    window.addEventListener("message", onMessage);

    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve([]);
    }, timeoutMs);

    window.postMessage(
      {
        source: "a24-enricher-client",
        channel: CHANNEL,
        requestId,
        action: "getResponsibleList",
      },
      location.origin
    );
  });
}