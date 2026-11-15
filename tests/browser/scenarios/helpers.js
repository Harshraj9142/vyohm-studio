// Shared helpers for browser scenarios (loaded before each scenario as window.T).
window.T = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  /** Puck's API (only in builds with test hooks). */
  puck: () => window.__vsPuck(),
  data: () => window.__vsPuck().appState.data,
  doc: () => document.querySelector("iframe").contentDocument,
  /** Type into a React-controlled input/textarea like a user. */
  type(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
  inputWithValue: (value) => [...document.querySelectorAll("input")].find((i) => i.value === value),
  button: (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text),
  /** Poll until fn() returns something truthy; throw a named error on timeout (no fixed sleeps). */
  async waitFor(fn, what, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = fn();
      if (value) return value;
      await window.T.sleep(50);
    }
    throw new Error(`Timed out waiting for ${what}`);
  },
  /** Click an enabled button by its text, waiting for it to appear. */
  async click(text, root = document) {
    const el = await window.T.waitFor(
      () => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text && !b.disabled),
      `button "${text}"`,
    );
    el.click();
  },
  viewport: (label) => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").includes(label)),
  /** First element in the page tree matching pred, with its parent id/slot/index. */
  find(pred) {
    let hit = null;
    const walk = (list, parent, slot) =>
      list.forEach((node, index) => {
        if (!hit && pred(node)) hit = { node, parent, slot, index };
        for (const key of ["content", "left", "right"]) if (Array.isArray(node.props[key])) walk(node.props[key], node.props.id, key);
      });
    walk(window.T.data().root.props.content, "root", "content");
    return hit;
  },
  /** Paths of every value that differs between two JSON values. */
  diff(a, b, path = "page", out = []) {
    if (JSON.stringify(a) === JSON.stringify(b)) return out;
    const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (isObj(a) && isObj(b)) for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) window.T.diff(a[k], b[k], `${path}.${k}`, out);
    else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) a.forEach((x, i) => window.T.diff(x, b[i], `${path}[${i}]`, out));
    else out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    return out;
  },
  /** Upload a generated PNG through the selected Image's file input. */
  async uploadPng(label = "UPLOADED PHOTO") {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const g = canvas.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, "#c9a44c");
    grad.addColorStop(1, "#3b2f12");
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, 600);
    g.fillStyle = "#fff";
    g.font = "bold 52px sans-serif";
    g.textAlign = "center";
    g.fillText(label, 400, 318);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    const input = document.querySelector("input[type=file]");
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "photo.jpg", { type: "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await window.T.sleep(1500);
  },
  /** Wait for a final status box in the AI tab ("generate" or "edit" card). */
  async aiStatus(card, timeoutMs = 120000) {
    const title = card === "generate" ? "#ed-ai-generate-title" : "#ed-ai-edit-title";
    const start = Date.now();
    // First wait (briefly) for the loading bar, so a status box left over from the
    // previous request is not mistaken for this request's result.
    while (Date.now() - start < 1500) {
      if (document.querySelector(title).parentElement.querySelector(".ed-ai-progress")) break;
      await window.T.sleep(30);
    }
    while (Date.now() - start < timeoutMs) {
      const box = document.querySelector(title).parentElement.querySelector(".ed-ai-status--ok, .ed-ai-status--error, .ed-ai-status--warn");
      if (box) return { kind: box.className.replace("ed-ai-status ", ""), text: box.textContent.trim().slice(0, 200), seconds: Math.round((Date.now() - start) / 1000), el: box };
      await window.T.sleep(250);
    }
    return { kind: "timeout" };
  },
  /** Replace fetch with a fake response (for failure tests that must not call Claude). */
  mockFetch(makeBody, { delay = 0, status = 200 } = {}) {
    window.__realFetch = window.__realFetch || window.fetch;
    window.fetch = async (url, init) => {
      await window.T.sleep(delay);
      const body = init?.body ? JSON.parse(init.body) : null;
      return new Response(JSON.stringify(makeBody(body, url)), { status, headers: { "content-type": "application/json" } });
    };
  },
  restoreFetch() {
    if (window.__realFetch) window.fetch = window.__realFetch;
  },
};
