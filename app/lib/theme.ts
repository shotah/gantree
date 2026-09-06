/** Color themes — Boom, Inlay, Lamp. Same ids and shared surface/accent hex as gantry-pendant.
 *  Add a theme: one object in THEMES (id, label, tokens). Components use bg-canvas, text-fg, border-line, text-accent, …
 *  Tag chips: toml stores hue names (red, green, …); tagRed/tagAmber/… are the paint so each night can retune them.
 */

export const THEME_KEY = "gantree.theme";

/** Ink, border, fill for one board-tag hue. */
type TagHue = readonly [ink: string, line: string, soft: string];

type TagChipTokens = {
  tagRed: string;
  tagRedLine: string;
  tagRedSoft: string;
  tagGreen: string;
  tagGreenLine: string;
  tagGreenSoft: string;
  tagAmber: string;
  tagAmberLine: string;
  tagAmberSoft: string;
  tagSky: string;
  tagSkyLine: string;
  tagSkySoft: string;
  tagViolet: string;
  tagVioletLine: string;
  tagVioletSoft: string;
  tagRose: string;
  tagRoseLine: string;
  tagRoseSoft: string;
};

function tagChips(red: TagHue, green: TagHue, amber: TagHue, sky: TagHue, violet: TagHue, rose: TagHue): TagChipTokens {
  return {
    tagRed: red[0],
    tagRedLine: red[1],
    tagRedSoft: red[2],
    tagGreen: green[0],
    tagGreenLine: green[1],
    tagGreenSoft: green[2],
    tagAmber: amber[0],
    tagAmberLine: amber[1],
    tagAmberSoft: amber[2],
    tagSky: sky[0],
    tagSkyLine: sky[1],
    tagSkySoft: sky[2],
    tagViolet: violet[0],
    tagVioletLine: violet[1],
    tagVioletSoft: violet[2],
    tagRose: rose[0],
    tagRoseLine: rose[1],
    tagRoseSoft: rose[2],
  };
}

type NightCore = {
  scheme: "dark";
  canvas: string;
  panel: string;
  track: string;
  line: string;
  edge: string;
  fg: string;
  body: string;
  muted: string;
  dim: string;
  faint: string;
  accent: string;
  accentHover: string;
  mark: string;
  accentLine: string;
  accentSoft: string;
  danger: string;
  dangerLine: string;
  dangerSoft: string;
  ok: string;
  info: string;
};

type ThemeTokens = NightCore & {
  reaction: string;
  warn: string;
  warnLine: string;
  warnSoft: string;
  chartTx: string;
  chartWrite: string;
  chartDisk: string;
} & TagChipTokens;

/** Shared with gantry-pendant — do not drift these hex values. */
const BOOM = {
  scheme: "dark",
  canvas: "#0e1316",
  panel: "#171d22",
  track: "#232b32",
  line: "#3a4550",
  edge: "#5c6772",
  fg: "#f4f0ea",
  body: "#dcd6ce",
  muted: "#9aa3ab",
  dim: "#84909a",
  faint: "#5a6570",
  accent: "#f07848",
  accentHover: "#f89068",
  mark: "#f3b199",
  accentLine: "#c24a28",
  accentSoft: "#2a1612",
  danger: "#e070a0",
  dangerLine: "#a03860",
  dangerSoft: "#2a121c",
  ok: "#3db8a0",
  info: "#6ba8c9",
} as const satisfies NightCore;

const INLAY = {
  scheme: "dark",
  canvas: "#0c110f",
  panel: "#151c19",
  track: "#1e2823",
  line: "#33423b",
  edge: "#5a6e64",
  fg: "#f2ebe0",
  body: "#d9d0c4",
  muted: "#a3ada6",
  dim: "#8a948c",
  faint: "#5a6560",
  accent: "#e6d3b0",
  accentHover: "#f0e0c4",
  mark: "#f7ebd4",
  accentLine: "#a89068",
  accentSoft: "#243028",
  danger: "#d4787a",
  dangerLine: "#8a4042",
  dangerSoft: "#2a1818",
  ok: "#6baf9a",
  info: "#7aa8b8",
} as const satisfies NightCore;

const LAMP = {
  scheme: "dark",
  canvas: "#0c0c16",
  panel: "#151522",
  track: "#1e1e2e",
  line: "#32324a",
  edge: "#5a5a78",
  fg: "#eef0e6",
  body: "#d5d8c8",
  muted: "#9aa090",
  dim: "#8a9088",
  faint: "#5a6058",
  accent: "#c5d24a",
  accentHover: "#d4e05a",
  mark: "#e4eec8",
  accentLine: "#8a9430",
  accentSoft: "#222418",
  danger: "#e07090",
  dangerLine: "#a03850",
  dangerSoft: "#2a1218",
  ok: "#5ec8b0",
  info: "#8aa0e0",
} as const satisfies NightCore;

export const THEMES = [
  {
    id: "boom",
    label: "Boom",
    tokens: {
      ...BOOM,
      reaction: "#b8a0e0",
      warn: "#e8c84a",
      warnLine: "#8a7018",
      warnSoft: "#241c08",
      chartTx: "#8aa0d0",
      chartWrite: "#e8a060",
      chartDisk: "#3db8a0",
      ...tagChips(
        ["#f09898", "#8a3838", "#2a1418"],
        ["#5dcaa0", "#1a5c48", "#10241c"],
        ["#d4b44a", "#6a5410", "#241c08"],
        ["#6ba8c9", "#1a4a62", "#0c2030"],
        ["#b8a0e0", "#4a3870", "#1c1530"],
        ["#e070a0", "#7a2848", "#2a1218"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "inlay",
    label: "Inlay",
    tokens: {
      ...INLAY,
      reaction: "#a898c0",
      warn: "#e0a060",
      warnLine: "#8a6030",
      warnSoft: "#241c10",
      chartTx: "#7aa8b8",
      chartWrite: "#e0a060",
      chartDisk: "#6baf9a",
      ...tagChips(
        ["#d4787a", "#8a4042", "#2a1818"],
        ["#6baf9a", "#2a5c4c", "#10241c"],
        ["#c4a050", "#6a5420", "#241c10"],
        ["#7aa8b8", "#2a4a58", "#102028"],
        ["#a898c0", "#4a4060", "#1c1828"],
        ["#d49090", "#7a4040", "#2a1818"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "lamp",
    label: "Lamp",
    tokens: {
      ...LAMP,
      reaction: "#c0a0e0",
      warn: "#e09060",
      warnLine: "#8a4830",
      warnSoft: "#241810",
      chartTx: "#8aa0e0",
      chartWrite: "#e09060",
      chartDisk: "#5ec8b0",
      ...tagChips(
        ["#e07090", "#a03850", "#2a1218"],
        ["#5ec8b0", "#2a6a5c", "#102420"],
        ["#d4b060", "#6a5420", "#241c10"],
        ["#8aa0e0", "#3a4878", "#141428"],
        ["#c0a0e0", "#584878", "#1c1830"],
        ["#e090a8", "#8a3850", "#2a1218"],
      ),
    } satisfies ThemeTokens,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "boom";

export function themeOf(id: ThemeId = DEFAULT_THEME) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const THEME_IDS: readonly string[] = THEMES.map((t) => t.id);

export function parseTheme(v: unknown): ThemeId {
  return typeof v === "string" && THEME_IDS.includes(v) ? (v as ThemeId) : DEFAULT_THEME;
}

export function themeCss(): string {
  return THEMES.map((t) => {
    const sel = t.id === DEFAULT_THEME ? `:root,[data-theme="${t.id}"]` : `[data-theme="${t.id}"]`;
    return `${sel}{${tokenCss(t.tokens)}}`;
  }).join("");
}

export function applyTheme(id: ThemeId): void {
  if (document.documentElement.getAttribute("data-theme") === id && localStorage.getItem(THEME_KEY) === id) {
    return;
  }
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(THEME_KEY, id);
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
  if (canvas) {
    document.querySelector("meta[name=theme-color]")?.setAttribute("content", canvas);
  }
  window.dispatchEvent(new Event("gantree-theme"));
}

export const THEME_BOOT
  = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var a=${JSON.stringify(THEME_IDS)};if(a.indexOf(t)!==-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

function tokenCss(tokens: ThemeTokens): string {
  const parts = [`color-scheme:${tokens.scheme}`];
  for (const [k, v] of Object.entries(tokens)) {
    if (k === "scheme") {
      continue;
    }
    const cssKey = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    parts.push(`--${cssKey}:${v}`);
  }
  return parts.join(";");
}
