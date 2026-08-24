/** Color themes — the one place to add a scheme or change a color site-wide.
 *  Add a theme: one object in THEMES (id, label, tokens). Components use bg-canvas, text-fg, border-line, text-accent, …
 *  Tag chips: toml stores hue names (red, green, …); tagRed/tagAmber/… are the paint so light/dark can retune them.
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

type ThemeTokens = {
  scheme: "dark" | "light";
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
  reaction: string;
  warn: string;
  warnLine: string;
  warnSoft: string;
  chartTx: string;
  chartWrite: string;
  chartDisk: string;
} & TagChipTokens;

export const THEMES = [
  {
    id: "yard",
    label: "Dark",
    tokens: {
      scheme: "dark",
      canvas: "#09090b",
      panel: "#18181b",
      track: "#27272a",
      line: "#27272a",
      edge: "#3f3f46",
      fg: "#f5f5f4",
      body: "#e7e5e4",
      muted: "#a1a1aa",
      dim: "#71717a",
      faint: "#52525b",
      accent: "#f59e0b",
      accentHover: "#fbbf24",
      mark: "#fde68a",
      accentLine: "#92400e",
      accentSoft: "#2a1911",
      danger: "#fecaca",
      dangerLine: "#7f1d1d",
      dangerSoft: "#2a1414",
      ok: "#34d399",
      info: "#38bdf8",
      reaction: "#a78bfa",
      warn: "#fcd34d",
      warnLine: "#92400e",
      warnSoft: "#2a1911",
      chartTx: "#818cf8",
      chartWrite: "#fb923c",
      chartDisk: "#a3e635",
      ...tagChips(
        ["#fca5a5", "#7f1d1d", "#2a1418"],
        ["#6ee7b7", "#065f46", "#10241c"],
        ["#fcd34d", "#92400e", "#2a1c10"],
        ["#7dd3fc", "#075985", "#0c2030"],
        ["#c4b5fd", "#5b21b6", "#1c1530"],
        ["#fda4af", "#9f1239", "#2a1218"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "dock",
    label: "Dark · dock",
    tokens: {
      scheme: "dark",
      canvas: "#070b12",
      panel: "#101826",
      track: "#1a2436",
      line: "#243044",
      edge: "#3d4f66",
      fg: "#f1f5f9",
      body: "#e2e8f0",
      muted: "#94a3b8",
      dim: "#64748b",
      faint: "#475569",
      accent: "#fb923c",
      accentHover: "#fdba74",
      mark: "#fed7aa",
      accentLine: "#c2410c",
      accentSoft: "#2a1810",
      danger: "#fda4af",
      dangerLine: "#be123c",
      dangerSoft: "#3a1220",
      ok: "#2dd4bf",
      info: "#7dd3fc",
      reaction: "#c4b5fd",
      warn: "#fb7185",
      warnLine: "#e11d48",
      warnSoft: "#3a1218",
      chartTx: "#818cf8",
      chartWrite: "#fb923c",
      chartDisk: "#a3e635",
      ...tagChips(
        ["#fb7185", "#9f1239", "#2e1218"],
        ["#5eead4", "#0f766e", "#102824"],
        ["#fbbf24", "#b45309", "#2a1c0c"],
        ["#7dd3fc", "#0369a1", "#0c2438"],
        ["#ddd6fe", "#6d28d9", "#1c1830"],
        ["#fda4af", "#be123c", "#30141c"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "paper",
    label: "Light",
    tokens: {
      scheme: "light",
      canvas: "#f3e8e6",
      panel: "#faf3f1",
      track: "#ead5d1",
      line: "#c4a39c",
      edge: "#9a7a74",
      fg: "#1b1b19",
      body: "#2e2e2a",
      muted: "#5b5a55",
      dim: "#74736c",
      faint: "#9a8682",
      accent: "#3d5a6c",
      accentHover: "#2c4452",
      mark: "#2a4050",
      accentLine: "#4d7388",
      accentSoft: "#dce6ec",
      danger: "#8f2d3a",
      dangerLine: "#8f2d3a",
      dangerSoft: "#f3d0d6",
      ok: "#2f6a4a",
      info: "#2b5f8a",
      reaction: "#5c4d86",
      warn: "#be185d",
      warnLine: "#9d174d",
      warnSoft: "#f4c2d4",
      chartTx: "#3d5a6c",
      chartWrite: "#be185d",
      chartDisk: "#2f6a4a",
      ...tagChips(
        ["#b91c1c", "#b91c1c", "#fecaca"],
        ["#047857", "#047857", "#d1fae5"],
        ["#b45309", "#b45309", "#fde68a"],
        ["#0369a1", "#0369a1", "#bae6fd"],
        ["#6d28d9", "#6d28d9", "#ede9fe"],
        ["#be123c", "#be123c", "#fecdd3"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "mist",
    label: "Light · mist",
    tokens: {
      scheme: "light",
      canvas: "#d5e2ee",
      panel: "#e7eef5",
      track: "#c5d4e3",
      line: "#7b8ea3",
      edge: "#5c7086",
      fg: "#0f172a",
      body: "#1e293b",
      muted: "#334155",
      dim: "#526379",
      faint: "#6b7a8c",
      accent: "#0f766e",
      accentHover: "#115e59",
      mark: "#134e4a",
      accentLine: "#0f766e",
      accentSoft: "#c5e8e2",
      danger: "#9f1239",
      dangerLine: "#9f1239",
      dangerSoft: "#f0c8d4",
      ok: "#047857",
      info: "#0369a1",
      reaction: "#6d28d9",
      warn: "#be185d",
      warnLine: "#9d174d",
      warnSoft: "#f3c0d4",
      chartTx: "#4338ca",
      chartWrite: "#be185d",
      chartDisk: "#047857",
      ...tagChips(
        ["#9f1239", "#9f1239", "#fecdd3"],
        ["#0f766e", "#0f766e", "#ccfbf1"],
        ["#a16207", "#a16207", "#fef3c7"],
        ["#0369a1", "#0369a1", "#e0f2fe"],
        ["#5b21b6", "#5b21b6", "#ede9fe"],
        ["#9d174d", "#9d174d", "#fbcfe8"],
      ),
    } satisfies ThemeTokens,
  },
  {
    id: "contrast",
    label: "High contrast",
    tokens: {
      scheme: "dark",
      canvas: "#000000",
      panel: "#0c0c0c",
      track: "#1a1a1a",
      line: "#00ff41",
      edge: "#39ff14",
      fg: "#f2f2f2",
      body: "#e4e4e4",
      muted: "#b0b0b0",
      dim: "#8a8a8a",
      faint: "#6a6a6a",
      accent: "#00ff41",
      accentHover: "#9aff9a",
      mark: "#7cff7c",
      accentLine: "#00ff41",
      accentSoft: "#052010",
      danger: "#ff2d6a",
      dangerLine: "#ff2d6a",
      dangerSoft: "#3a0814",
      ok: "#00ff88",
      info: "#00f0ff",
      reaction: "#ff00c8",
      warn: "#ff4dff",
      warnLine: "#ff00c8",
      warnSoft: "#2a0820",
      chartTx: "#00f0ff",
      chartWrite: "#ffb000",
      chartDisk: "#39ff14",
      ...tagChips(
        ["#ff2d6a", "#ff2d6a", "#3a0814"],
        ["#00ff88", "#00ff88", "#052010"],
        ["#ffb000", "#ffb000", "#2a1800"],
        ["#00f0ff", "#00f0ff", "#002028"],
        ["#c084fc", "#c084fc", "#1a0828"],
        ["#ff6b9d", "#ff6b9d", "#2a0814"],
      ),
    } satisfies ThemeTokens,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "yard";

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
