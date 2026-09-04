#!/usr/bin/env node
/**
 * Headless Chrome shots via CDP (no puppeteer).
 *
 *   node scripts/shot.mjs http://127.0.0.1:3070 login-phone setup-phone
 *   node scripts/shot.mjs http://127.0.0.1:3070 yard boards boards-page host crane crane-metrics metrics profile settings
 *   node scripts/shot.mjs http://127.0.0.1:3070 yard-phone crane-phone phone-preview
 *
 * Unset GANTREE_DEV to photograph /login and /setup.
 * Seed a photographable yard first: `npm run seed` then GANTREE_SHOT=1.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:3000";
const names = process.argv.slice(3);
const outDir = resolve("assets/docs");
const chrome =
  process.env.CHROME ||
  "/var/lib/flatpak/app/com.google.Chrome/current/active/files/extra/chrome";
const port = Number(process.env.CDP_PORT || 9244);
const profile = `/tmp/gantree-chrome-shot-${port}`;

const SHOTS = {
  login: { path: "/login", sel: "[data-shot=login]", text: "Log in", crop: true },
  setup: { path: "/setup", sel: "[data-shot=setup]", text: "First operator", crop: true },
  "login-phone": { path: "/login", sel: "[data-shot=login]", text: "Log in", phone: true },
  "setup-phone": { path: "/setup", sel: "[data-shot=setup]", text: "First operator", phone: true },
  "yard-phone": { path: "/", sel: "[data-shot=yard]", text: "Shipping yard", phone: true, waitMs: 2500 },
  "crane-phone": {
    path: "/gantries/jules",
    sel: "h1",
    text: "jules",
    phone: true,
    waitMs: 2000,
    collapse: true,
  },
  "phone-preview": {
    path: "/?phone=1",
    sel: "[data-shot=phone-preview]",
    text: "390×844",
    waitIframe: "[data-shot=yard]",
    waitMs: 2500,
  },
  yard: { path: "/", sel: "[data-shot=yard]", text: "Shipping yard", waitMs: 2500 },
  boards: { path: "/", sel: "[data-shot=boards]", text: "100k steps", crop: true, waitMs: 2500 },
  "boards-page": { path: "/boards", sel: "[data-shot=boards-page]", text: "100k steps", crop: true, waitMs: 2000 },
  host: { path: "/host", sel: "[data-shot=host-metrics]", text: "cores", waitMs: 2200 },
  crane: { path: "/gantries/ada", sel: "h1", text: "ada", waitMs: 2500, collapse: "keep-metrics" },
  "crane-metrics": { path: "/gantries/ada", sel: "[data-shot=metrics]", text: "CPU", waitMs: 2500, collapse: "keep-metrics" },
  metrics: { path: "/gantries/ada", sel: "[data-shot=metrics]", text: "CPU", crop: true, waitMs: 2200 },
  profile: { path: "/profile", sel: "[data-shot=profile]", text: "Bob Kit", waitMs: 800 },
  settings: { path: "/settings", sel: "[data-shot=settings]", text: "Who is on this yard", waitMs: 1200 },
};

const wanted = names.length ? names : Object.keys(SHOTS);
for (const n of wanted) {
  if (!SHOTS[n]) {
    throw new Error(`unknown shot ${n}`);
  }
}

mkdirSync(profile, { recursive: true });
mkdirSync(outDir, { recursive: true });

const child = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitCdp() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error("chrome CDP did not start");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(msg.error.message));
        } else {
          p.resolve(msg.result);
        }
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolveP, reject) => {
      this.pending.set(id, { resolve: resolveP, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function evalJson(cdp, expression) {
  const { result } = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.value;
}

try {
  await waitCdp();
  const listed = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  let pageTarget = Array.isArray(listed)
    ? listed.find((t) => t.type === "page" && t.webSocketDebuggerUrl && !String(t.url ?? "").includes("background"))
    : null;
  if (!pageTarget) {
    const created = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    pageTarget = await created.json();
  }
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("no page target: " + JSON.stringify(listed));
  }
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolveP, reject) => {
    ws.addEventListener("open", resolveP);
    ws.addEventListener("error", () => reject(new Error("cdp ws")));
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  async function metrics(phone) {
    if (phone) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
    } else {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
      });
    }
  }

  async function goto(url) {
    await cdp.send("Page.navigate", { url });
    for (let i = 0; i < 40; i++) {
      const ready = await evalJson(cdp, "document.readyState");
      if (ready === "complete") {
        break;
      }
      await sleep(250);
    }
    await sleep(400);
  }

  async function waitSel(sel, text, ms = 25000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const ok = await evalJson(
        cdp,
        `Boolean(document.querySelector(${JSON.stringify(sel)})) && ${
          text ? `document.body.innerText.includes(${JSON.stringify(text)})` : "true"
        }`,
      );
      if (ok) {
        return;
      }
      await sleep(250);
    }
    const body = await evalJson(cdp, "document.body?.innerText?.slice(0, 800)");
    throw new Error("timeout waiting for " + sel + " body=" + body);
  }

  async function waitIframe(sel, ms = 20000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const ok = await evalJson(
        cdp,
        `Boolean(document.querySelector("iframe")?.contentDocument?.querySelector(${JSON.stringify(sel)}))`,
      );
      if (ok) {
        return;
      }
      await sleep(250);
    }
    throw new Error("timeout waiting for iframe " + sel);
  }

  async function shotCrop(sel, file) {
    await evalJson(cdp, "window.scrollTo(0,0)");
    await sleep(200);
    const box = await evalJson(
      cdp,
      `(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        const pad = 16;
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, r.left - pad + window.scrollX),
          y: Math.max(0, r.top - pad + window.scrollY),
          width: Math.max(8, r.width + pad * 2),
          height: Math.max(8, r.height + pad * 2),
        };
      })()`,
    );
    if (!box) {
      throw new Error("bad box for " + sel);
    }
    const png = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
    });
    writeFileSync(resolve(outDir, file), Buffer.from(png.data, "base64"));
    console.log("wrote", file, Math.round(box.width), "x", Math.round(box.height), "css");
  }

  async function shotView(file) {
    const png = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(resolve(outDir, file), Buffer.from(png.data, "base64"));
    console.log("wrote", file);
  }

  for (const name of wanted) {
    const spec = SHOTS[name];
    await metrics(Boolean(spec.phone));
    await goto(base + spec.path);
    await waitSel(spec.sel, spec.text);
    if (spec.waitIframe) {
      await waitIframe(spec.waitIframe);
    }
    if (spec.crop) {
      await evalJson(
        cdp,
        `document.querySelector(${JSON.stringify(spec.sel)})?.scrollIntoView({ block: "start" })`,
      );
      await sleep(400);
    }
    if (spec.collapse) {
      const keepMetrics = spec.collapse === "keep-metrics";
      await evalJson(
        cdp,
        `document.querySelectorAll('button[aria-expanded="true"]').forEach((b) => {
          if (${keepMetrics ? "true" : "false"} && b.closest("section")?.querySelector("[data-shot=metrics]")) return;
          b.click();
        })`,
      );
      await sleep(300);
    }
    if (spec.waitMs) {
      await sleep(spec.waitMs);
    }
    if (spec.crop) {
      await evalJson(
        cdp,
        `(async () => {
          const root = document.querySelector(${JSON.stringify(spec.sel)});
          root?.scrollIntoView({ block: "start" });
          for (const n of root?.querySelectorAll("[data-chart]") ?? []) {
            n.scrollIntoView({ block: "center" });
            await new Promise((r) => setTimeout(r, 90));
          }
          return document.querySelectorAll("[data-chart=on]").length;
        })()`,
      );
      await sleep(700);
    } else {
      await evalJson(cdp, "window.scrollTo(0,0)");
      await sleep(200);
    }
    const file = `${name}.png`;
    if (spec.crop) {
      await shotCrop(spec.sel, file);
    } else {
      await shotView(file);
    }
  }

  ws.close();
} finally {
  child.kill("SIGTERM");
}
