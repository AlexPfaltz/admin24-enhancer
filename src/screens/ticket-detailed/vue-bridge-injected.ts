(() => {
  "use strict";

  const CHANNEL = "a24-enricher-vue-bridge";
  const MIN_ITEMS = 500;

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

  /* ==================== поиск Vue-корня ==================== */

  function getRootInstance(): VueInstance | null {
    const el = document.getElementById("app") as AppRootElement | null;
    return el?._vnode?.component ?? null;
  }

  /* ==================== «Ответственный» v-select ==================== */

  function collectBigSelects(root: VueInstance): VSelectMatch[] {
    const found: VSelectMatch[] = [];
    const seen = new Set<VueVNode>();

    const walk = (vn: VueVNode | null | undefined, depth: number): void => {
      if (!vn || depth > 40 || seen.has(vn)) return;
      seen.add(vn);

      if (vn.component) {
        const props = vn.component.props ?? {};
        const items = props["items"];
        if (Array.isArray(items) && items.length > MIN_ITEMS) {
          const label = typeof props["label"] === "string" ? props["label"] : "";
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

  /* ==================== список тикетов (минимальный) ==================== */

  /**
   * Запись тикета, которую отдаём в content script.
   * Только id + имена — минимально достаточно для подписей под аватарами.
   */
  interface TicketLight {
    id: number;
    title: string | null;
    responsibleName: string | null;
    applicantName: string | null;
  }

  function looksLikeTickets(arr: unknown): arr is Array<Record<string, unknown>> {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const first = arr[0];
    if (typeof first !== "object" || first === null) return false;
    const o = first as Record<string, unknown>;

    // Признак тикета: id + (title | number) + (backgroundColor | createdAt | statusId).
    // Это отсекает справочники (у них id+title без backgroundColor).
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

  /* ==================== канал ==================== */

  interface BridgeRequest {
    source: "a24-enricher-client";
    channel: string;
    requestId: string;
    action: "select" | "getCurrent" | "closeMenu" | "getTicketsLight";
    id?: number;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as BridgeRequest | undefined;
    if (!data || data.source !== "a24-enricher-client" || data.channel !== CHANNEL) {
      return;
    }

    let ok = false;
    let value: number | null = null;
    let tickets: TicketLight[] | undefined;

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
    }

    window.postMessage(
      {
        source: "a24-enricher-bridge",
        channel: CHANNEL,
        requestId: data.requestId,
        ok,
        value,
        ...(tickets ? { tickets } : {}),
      },
      location.origin
    );
  });
})();