import { DEFAULT_IMAGE, type ObservePrefs } from "../types";
import { loadGantreeToml, saveGantreeToml } from "../host/files";

export const DEFAULT_HOST_RETAIN_DAYS = 7;
export const DEFAULT_TURN_RETAIN_DAYS = 32;

export const DEFAULT_OBSERVE: ObservePrefs = {
  hostRetainDays: DEFAULT_HOST_RETAIN_DAYS,
  turnRetainDays: DEFAULT_TURN_RETAIN_DAYS,
  timezone: null,
  defaultImage: DEFAULT_IMAGE,
  promptUsdPerMillion: null,
  genUsdPerMillion: null,
};

export function timezoneOk(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function hostRetainMs(prefs = loadObservePrefs()): number {
  return prefs.hostRetainDays * 24 * 60 * 60 * 1000;
}

export function turnRetainMs(prefs = loadObservePrefs()): number {
  return prefs.turnRetainDays * 24 * 60 * 60 * 1000;
}

export function loadObservePrefs(): ObservePrefs {
  return parseObserve(loadGantreeToml()?.observe);
}

export function saveObservePrefs(input: unknown): { ok: true; prefs: ObservePrefs } | { ok: false; error: string } {
  const parsed = parseObserveInput(input, loadObservePrefs());
  if (!parsed.ok) {
    return parsed;
  }
  const doc = loadGantreeToml() ?? { yard: "home", gantry: [] };
  doc.observe = toToml(parsed.prefs);
  saveGantreeToml(doc);
  return parsed;
}

export function parseObserve(raw: unknown): ObservePrefs {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_OBSERVE };
  }
  const o = raw as Record<string, unknown>;
  return {
    hostRetainDays: intDays(o.host_retain_days ?? o.hostRetainDays, DEFAULT_HOST_RETAIN_DAYS, 1, 90),
    turnRetainDays: intDays(o.turn_retain_days ?? o.turnRetainDays, DEFAULT_TURN_RETAIN_DAYS, 1, 120),
    timezone: parseTimezone(o.timezone),
    defaultImage: parseImage(o.default_image ?? o.defaultImage),
    promptUsdPerMillion: parseRate(o.prompt_usd_per_million ?? o.promptUsdPerMillion),
    genUsdPerMillion: parseRate(o.gen_usd_per_million ?? o.genUsdPerMillion),
  };
}

function parseObserveInput(input: unknown, fallback: ObservePrefs): { ok: true; prefs: ObservePrefs } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "observe body required" };
  }
  const o = input as Record<string, unknown>;
  const merged = {
    host_retain_days: o.hostRetainDays ?? o.host_retain_days ?? fallback.hostRetainDays,
    turn_retain_days: o.turnRetainDays ?? o.turn_retain_days ?? fallback.turnRetainDays,
    timezone: o.timezone === undefined ? fallback.timezone : o.timezone,
    default_image: o.defaultImage ?? o.default_image ?? fallback.defaultImage,
    prompt_usd_per_million: o.promptUsdPerMillion ?? o.prompt_usd_per_million ?? fallback.promptUsdPerMillion,
    gen_usd_per_million: o.genUsdPerMillion ?? o.gen_usd_per_million ?? fallback.genUsdPerMillion,
  };
  if (typeof merged.timezone === "string" && merged.timezone.trim() && !timezoneOk(merged.timezone.trim())) {
    return { ok: false, error: "timezone must be an IANA name (or blank for local)" };
  }
  const image = String(merged.default_image ?? "").trim();
  if (!image) {
    return { ok: false, error: "default image pin is required" };
  }
  return { ok: true, prefs: parseObserve(merged) };
}

function toToml(prefs: ObservePrefs): Record<string, unknown> {
  const out: Record<string, unknown> = {
    host_retain_days: prefs.hostRetainDays,
    turn_retain_days: prefs.turnRetainDays,
    default_image: prefs.defaultImage,
  };
  if (prefs.timezone) {
    out.timezone = prefs.timezone;
  }
  if (prefs.promptUsdPerMillion != null) {
    out.prompt_usd_per_million = prefs.promptUsdPerMillion;
  }
  if (prefs.genUsdPerMillion != null) {
    out.gen_usd_per_million = prefs.genUsdPerMillion;
  }
  return out;
}

function intDays(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseTimezone(v: unknown): string | null {
  if (typeof v !== "string") {
    return null;
  }
  const tz = v.trim();
  if (!tz || !timezoneOk(tz)) {
    return null;
  }
  return tz;
}

function parseImage(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) {
    return DEFAULT_IMAGE;
  }
  return v.trim();
}

function parseRate(v: unknown): number | null {
  if (v == null || v === "") {
    return null;
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}
