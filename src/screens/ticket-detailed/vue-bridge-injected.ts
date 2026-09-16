/**
 * Этот файл инжектится в page world (в window страницы Admin24),
 * поэтому имеет доступ к #app._vnode.component, __vue_app__ и т.п.
 * Общается с content script через window.postMessage.
 */

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
      // Vuetify v-select слушает update:menu для управления открытием.
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

  interface BridgeRequest {
    source: "a24-enricher-client";
    channel: string;
    requestId: string;
    action: "select" | "getCurrent" | "closeMenu";
    id?: number;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as BridgeRequest | undefined;
    if (!data || data.source !== "a24-enricher-client" || data.channel !== CHANNEL) return;

    let ok = false;
    let value: number | null = null;

    if (data.action === "select" && typeof data.id === "number") {
      ok = selectPerformer(data.id);
    } else if (data.action === "getCurrent") {
      value = getCurrentPerformerId();
      ok = true;
    } else if (data.action === "closeMenu") {
      ok = closeMenu();
    }

    window.postMessage(
      {
        source: "a24-enricher-bridge",
        channel: CHANNEL,
        requestId: data.requestId,
        ok,
        value,
      },
      location.origin
    );
  });
})();