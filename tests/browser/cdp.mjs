#!/usr/bin/env node
/**
 * Minimal headless-Chrome test runner (Chrome DevTools Protocol, no extra deps).
 *
 *   node tests/browser/cdp.mjs --url http://localhost:3211/ --script tests/browser/scenarios/demo-sequence.js
 *
 * Options:
 *   --url       page to open (required)
 *   --script    scenario file evaluated in the page after loading (returns a JSON-able result)
 *   --out       folder for the screenshot and any files the scenario returns (default: tests/browser/output)
 *   --width/--height   viewport size (default 1440x900)
 *   --wait      ms to wait after loading before running the scenario (default 7000)
 *   --profile   Chrome profile folder; reuse it between runs to test persistence (default: fresh temp profile)
 *   --fixture   JSON file exposed to the scenario as window.__fixture
 *   --full      capture the whole page, not just the viewport (pass any value, e.g. --full 1)
 *   --reduced-motion  emulate prefers-reduced-motion: reduce (pass any value)
 *
 * A scenario may return { __files: { "name.zip": base64 } } to save files into --out.
 * Requires Google Chrome. Editor scenarios need a build with test hooks (see docs/TESTING.md).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[i + 1]]] : pairs), []),
);
if (!args.url) {
  console.error("Usage: node tests/browser/cdp.mjs --url <url> [--script file] [--out dir] ...");
  process.exit(1);
}
const out = args.out ?? "tests/browser/output";
mkdirSync(out, { recursive: true });
const width = Number(args.width ?? 1440);
const height = Number(args.height ?? 900);

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
const chromePath = process.env.CHROME_PATH ?? CHROME_PATHS.find((p) => existsSync(p));
if (!chromePath) {
  console.error("Google Chrome not found. Set CHROME_PATH.");
  process.exit(1);
}

const port = 9300 + Math.floor(Math.random() * 500);
const profile = args.profile ?? mkdtempSync(join(tmpdir(), "vs-cdp-"));
const chrome = spawn(
  chromePath,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const finish = (code) => {
  chrome.kill();
  process.exit(code);
};

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) {
  console.error("Could not connect to Chrome.");
  finish(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    if (!/React DevTools|\[HMR\]|\[Fast Refresh\]|setData` is expensive/.test(text)) {
      console.log(`[console.${msg.params.type}]`, text.slice(0, 500));
    }
  } else if (msg.method === "Runtime.exceptionThrown") {
    console.log("[page exception]", msg.params.exceptionDetails.exception?.description?.slice(0, 800));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
if (args["reduced-motion"]) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
}
await send("Page.navigate", { url: args.url });
await sleep(Number(args.wait ?? 7000));

let exitCode = 0;
const name = args.script ? basename(args.script).replace(/\.js$/, "") : "page";
if (args.script) {
  // Shared helpers (window.T) are loaded first if helpers.js sits next to the scenario.
  const helpers = join(args.script, "..", "helpers.js");
  if (existsSync(helpers)) await send("Runtime.evaluate", { expression: readFileSync(helpers, "utf8") });
  // Inject the fixture right before the scenario (injecting on page creation proved unreliable).
  if (args.fixture) {
    await send("Runtime.evaluate", { expression: `window.__fixture = ${readFileSync(args.fixture, "utf8")};` });
  }
  const res = await send("Runtime.evaluate", {
    expression: readFileSync(args.script, "utf8"),
    awaitPromise: true,
    returnByValue: true,
  });
  const result = res.result;
  if (result?.exceptionDetails) {
    console.log("[scenario error]", result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    exitCode = 1;
  } else {
    const value = result?.result?.value;
    // Real mouse drags: { __drags: [{ from, to, during?: "js", after?: "js" }] } where from/to are
    // main-page {x,y} or JS expressions returning them. `during` runs while the button is still held.
    if (value?.__drags) {
      const mouse = (type, x, y, buttons) =>
        send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !buttons ? "none" : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
      const evaluate = async (expression) => {
        const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value;
      };
      for (const [n, spec] of value.__drags.entries()) {
        // `from` / `to` may be JS expressions, evaluated right before this drag (layout may have changed).
        const drag = { ...spec };
        if (typeof drag.from === "string") drag.from = await evaluate(drag.from);
        if (typeof drag.to === "string") drag.to = await evaluate(drag.to);
        await mouse("mouseMoved", drag.from.x, drag.from.y, 0);
        await mouse("mousePressed", drag.from.x, drag.from.y, 1);
        await sleep(150);
        const steps = drag.steps ?? 24;
        for (let s = 1; s <= steps; s++) {
          await mouse("mouseMoved", drag.from.x + ((drag.to.x - drag.from.x) * s) / steps, drag.from.y + ((drag.to.y - drag.from.y) * s) / steps, 1);
          await sleep(25);
        }
        await sleep(drag.hold ?? 700);
        if (drag.during) console.log(`[drag ${n + 1} during]`, JSON.stringify(await evaluate(drag.during), null, 2));
        if (drag.shot) {
          // Optional screenshot while the mouse button is still held.
          const mid = await send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(out, drag.shot), Buffer.from(mid.result.data, "base64"));
          console.log("[screenshot]", join(out, drag.shot));
        }
        await mouse("mouseReleased", drag.to.x, drag.to.y, 0);
        await sleep(drag.settle ?? 1200);
        if (drag.after) console.log(`[drag ${n + 1} after]`, JSON.stringify(await evaluate(drag.after), null, 2));
      }
      delete value.__drags;
    }
    if (value?.__files) {
      for (const [file, b64] of Object.entries(value.__files)) {
        writeFileSync(join(out, file), Buffer.from(b64, "base64"));
        console.log("[saved]", join(out, file));
      }
      delete value.__files;
    }
    console.log(JSON.stringify(value, null, 2));
  }
  await sleep(1000);
}

let shotParams = { format: "png" };
if (args.full) {
  const metrics = await send("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize ?? metrics.result.contentSize;
  shotParams = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(size.height), scale: 1 } };
}
const shot = await send("Page.captureScreenshot", shotParams);
const shotPath = join(out, `${name}-${width}.png`);
writeFileSync(shotPath, Buffer.from(shot.result.data, "base64"));
console.log("[screenshot]", shotPath);
ws.close();
finish(exitCode);
