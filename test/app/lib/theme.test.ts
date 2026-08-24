import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, THEME_BOOT, themeCss, themeOf, THEMES } from "@/app/lib/theme";

describe("theme", () => {
  it("falls back to yard", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("nope")).toBe("yard");
    expect(parseTheme("paper")).toBe("paper");
  });

  it("emits one css block per theme so the selector can swap them", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["yard", "dock", "paper", "mist", "contrast"]);
    expect(THEMES.map((t) => t.label)).toEqual(["Dark", "Dark · dock", "Light", "Light · mist", "High contrast"]);
    const css = themeCss();
    expect(css).toContain(':root,[data-theme="yard"]');
    expect(css).toContain("color-scheme:light");
    expect(css).toContain("color-scheme:dark");
    const keys = Object.keys(THEMES[0].tokens).sort();
    expect(keys).toEqual(expect.arrayContaining([
      "warn",
      "warnLine",
      "warnSoft",
      "accent",
      "canvas",
      "tagAmber",
      "tagAmberLine",
      "tagAmberSoft",
    ]));
    for (const t of THEMES) {
      expect(Object.keys(t.tokens).sort()).toEqual(keys);
      expect(css).toContain(`[data-theme="${t.id}"]`);
      expect(css).toContain(`--canvas:${t.tokens.canvas}`);
      expect(css).toContain(`--accent:${t.tokens.accent}`);
      expect(css).toContain(`--warn:${t.tokens.warn}`);
      expect(css).toContain(`--warn-line:${t.tokens.warnLine}`);
      expect(css).toContain(`--warn-soft:${t.tokens.warnSoft}`);
    }
    expect(THEME_BOOT).toContain("gantree.theme");
    expect(THEME_BOOT).toContain("paper");
  });

  it("keeps light card edges visible and contrast neon", () => {
    const yard = themeOf("yard").tokens;
    const dock = themeOf("dock").tokens;
    const paper = themeOf("paper").tokens;
    const mist = themeOf("mist").tokens;
    const contrast = themeOf("contrast").tokens;
    expect(paper.warn).toBe("#be185d");
    expect(mist.warn).toBe("#be185d");
    expect(mist.line).not.toBe(mist.panel);
    expect(dock.warn).not.toBe(yard.warn);
    expect(dock.accent).not.toBe(yard.accent);
    expect(contrast.accent).toBe("#00ff41");
    expect(contrast.canvas).toBe("#000000");
    expect(contrast.fg).toBe("#f2f2f2");
  });

  it("paints tag hues per theme so light and dark can retune chips", () => {
    const yard = themeOf("yard").tokens;
    const dock = themeOf("dock").tokens;
    const paper = themeOf("paper").tokens;
    expect(yard.tagAmber).not.toBe(paper.tagAmber);
    expect(yard.tagRedSoft).not.toBe(paper.tagRedSoft);
    expect(dock.tagAmber).not.toBe(dock.warn);
    expect(paper.tagAmber).not.toBe(paper.warn);
    const css = themeCss();
    expect(css).toContain(`--tag-amber:${yard.tagAmber}`);
    expect(css).toContain(`--tag-amber-soft:${paper.tagAmberSoft}`);
    expect(css).toContain(`--tag-green:${yard.tagGreen}`);
  });
});
