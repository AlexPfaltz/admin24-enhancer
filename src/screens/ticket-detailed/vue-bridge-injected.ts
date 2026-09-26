(() => {
  "use strict";

  const CHANNEL = "a24-enricher-vue-bridge";

  interface VueInstance {
    props?: Record<string, unknown>;
    subTree?: VueVNode | null;
    type?: { name?: string; __name?: string };
    emit?: (event: string, ...args: unknown[]) => void;
  }

  interface VueVNode {
    component?: VueInstance | null;
    children?: VueVNode[] | Record<string, unknown> | null;
    suspense?: { activeBranch?: VueVNode | null } | null;
  }

  interface AppRootElement extends HTMLElement {
    _vnode?: VueVNode;
    __vue_app__?: { _instance?: VueInstance | null };
  }

  interface VSelectMatch {
    label: string;
    modelValue: unknown;
    instance: VueInstance;
  }

  interface TicketLight {
    id: number;
    title: string | null;
    responsibleName: string | null;
    applicantName: string | null;
  }

  interface ResponsiblePerson {
    id: number;
    name: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  }

  interface BridgeRequest {
    source: "a24-enricher-client";
    channel: string;
    requestId: string;
    action:
      | "select"
      | "getCurrent"
      | "closeMenu"
      | "getTicketsLight"
      | "getResponsibleList";
    id?: number;
  }

  interface BridgeResponse {
    source: "a24-enricher-bridge";
    channel: string;
    requestId: string;
    ok: boolean;
    value: number | null;
    tickets?: TicketLight[];
    responsibleList?: ResponsiblePerson[];
  }

  function getRootInstance(): VueInstance | null {
    const el = document.getElementById("app") as AppRootElement | null;
    return el?._vnode?.component ?? null;
  }

   function collectBigSelects(root: VueInstance): VSelectMatch[] {
    const found: VSelectMatch[] = [];
    const seen = new Set<VueVNode>();

    const walk = (vn: VueVNode | null | undefined, depth: number): void => {
      if (!vn || depth > 40 || seen.has(vn)) return;
      seen.add(vn);

      if (vn.component) {
        const props = vn.component.props ?? {};
        const items = props["items"];
        const label = typeof props["label"] === "string" ? props["label"] : "";

        if (Array.isArray(items) && label === "Ответственный") {
          found.push({
            label,
            modelValue: props["modelValue"],
            instance: vn.component,
          });
        }

        walk(vn.component.subTree ?? null, depth + 1);
      }

      if (Array.isArray(vn.children)) {
        for (const child of vn.children) walk(child, depth + 1);
      } else if (vn.children && typeof vn.children === "object") {
        walk(vn.children as VueVNode, depth + 1);
      }

      if (vn.suspense?.activeBranch) {
        walk(vn.suspense.activeBranch, depth + 1);
      }
    };

    walk(root.subTree ?? null, 0);
    return found;
  }

  function findPerformerSelect(): VSelectMatch | null {
    const root = getRootInstance();
    if (!root) return null;

    const all = collectBigSelects(root);
    return (
      all.find((s) => s.label === "Ответственный" && !Array.isArray(s.modelValue)) ??
      all.find((s) => s.label === "Ответственный") ??
      null
    );
  }

  function selectPerformer(id: number): boolean {
    const target = findPerformerSelect();
    if (!target?.instance.emit) return false;
    try {
      target.instance.emit("update:modelValue", id);
      return true;
    } catch (err) {
      console.error("[a24-enricher/vue-bridge] emit failed:", err);
      return false;
    }
  }

  function closeMenu(): boolean {
    const target = findPerformerSelect();
    if (!target?.instance.emit) return false;
    try {
      target.instance.emit("update:menu", false);
      return true;
    } catch (err) {
      console.error("[a24-enricher/vue-bridge] closeMenu failed:", err);
      return false;
    }
  }

  function getCurrentPerformerId(): number | null {
    const target = findPerformerSelect();
    const value = target?.modelValue;
    return typeof value === "number" ? value : null;
  }


  function looksLikeTickets(arr: unknown): arr is Array<Record<string, unknown>> {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const first = arr[0];
    if (typeof first !== "object" || first === null) return false;
    const o = first as Record<string, unknown>;
    const hasId = typeof o["id"] === "number";
    const hasTitle = typeof o["title"] === "string";
    const hasBg =
      typeof o["backgroundColor"] === "string" ||
      typeof o["statusId"] === "number" ||
      typeof o["createdAt"] === "number";
    return hasId && hasTitle && hasBg;
  }

  function findTicketsListInstance(): Array<Record<string, unknown>> | null {
    const root = getRootInstance();
    if (!root) return null;

    const seen = new Set<VueVNode>();
    let found: Array<Record<string, unknown>> | null = null;

    const walk = (vn: VueVNode | null | undefined, depth: number): void => {
      if (found || !vn || depth > 40 || seen.has(vn)) return;
      seen.add(vn);

      if (vn.component) {
        const props = vn.component.props ?? {};
        const t = props["tickets"];
        if (looksLikeTickets(t)) {
          found = t;
          return;
        }
        walk(vn.component.subTree ?? null, depth + 1);
      }

      if (Array.isArray(vn.children)) {
        for (const child of vn.children) walk(child, depth + 1);
      } else if (vn.children && typeof vn.children === "object") {
        walk(vn.children as VueVNode, depth + 1);
      }

      if (vn.suspense?.activeBranch) {
        walk(vn.suspense.activeBranch, depth + 1);
      }
    };

    walk(root.subTree ?? null, 0);
    return found;
  }

  function getTicketsLight(): TicketLight[] {
    const list = findTicketsListInstance();
    if (!list) return [];

    const result: TicketLight[] = [];
    for (const t of list) {
      const id = t["id"];
      if (typeof id !== "number") continue;

      const title =
        typeof t["title"] === "string" && t["title"].trim()
          ? t["title"].trim()
          : null;
      const resp =
        typeof t["responsibleName"] === "string" && t["responsibleName"].trim()
          ? t["responsibleName"].trim()
          : null;
      const appl =
        typeof t["applicantName"] === "string" && t["applicantName"].trim()
          ? t["applicantName"].trim()
          : null;

      result.push({ id, title, responsibleName: resp, applicantName: appl });
    }
    return result;
  }

  function findResponsibleList(): ResponsiblePerson[] {
    const root = getRootInstance();
    if (!root) return [];

    const seen = new Set<VueVNode>();
    let found: unknown = null;

    const walk = (vn: VueVNode | null | undefined, depth: number): void => {
      if (found || !vn || depth > 40 || seen.has(vn)) return;
      seen.add(vn);

      if (vn.component) {
        const props = vn.component.props ?? {};
        const list = props["responsibleList"];
        if (Array.isArray(list) && list.length > 0) {
          found = list;
          return;
        }
        walk(vn.component.subTree ?? null, depth + 1);
      }

      if (Array.isArray(vn.children)) {
        for (const child of vn.children) walk(child, depth + 1);
      } else if (vn.children && typeof vn.children === "object") {
        walk(vn.children as VueVNode, depth + 1);
      }

      if (vn.suspense?.activeBranch) {
        walk(vn.suspense.activeBranch, depth + 1);
      }
    };

    walk(root.subTree ?? null, 0);

    if (!Array.isArray(found) || found.length === 0) return [];

    const result: ResponsiblePerson[] = [];
    for (const raw of found) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const id = typeof o["id"] === "number" ? o["id"] : null;
      if (id === null) continue;

      const name = typeof o["name"] === "string" ? o["name"] : "";
      const fullName =
        typeof o["fullName"] === "string" && o["fullName"].trim()
          ? o["fullName"].trim()
          : name || `ID ${id}`;
      const email = typeof o["email"] === "string" ? o["email"] : null;
      const photoUrl = typeof o["photoUrl"] === "string" ? o["photoUrl"] : null;

      result.push({ id, name, fullName, email, photoUrl });
    }
    return result;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as BridgeRequest | undefined;
    if (
      !data ||
      data.source !== "a24-enricher-client" ||
      data.channel !== CHANNEL
    ) {
      return;
    }

    let ok = false;
    let value: number | null = null;
    let tickets: TicketLight[] | undefined;
    let responsibleList: ResponsiblePerson[] | undefined;

    if (data.action === "select" && typeof data.id === "number") {
      ok = selectPerformer(data.id);
    } else if (data.action === "getCurrent") {
      value = getCurrentPerformerId();
      ok = true;
    } else if (data.action === "closeMenu") {
      ok = closeMenu();
    } else if (data.action === "getTicketsLight") {
      tickets = getTicketsLight();
      ok = true;
    } else if (data.action === "getResponsibleList") {
      responsibleList = findResponsibleList();
      ok = true;
    }

    const response: BridgeResponse = {
      source: "a24-enricher-bridge",
      channel: CHANNEL,
      requestId: data.requestId,
      ok,
      value,
      ...(tickets ? { tickets } : {}),
      ...(responsibleList ? { responsibleList } : {}),
    };

    window.postMessage(response, location.origin);
  });
})();