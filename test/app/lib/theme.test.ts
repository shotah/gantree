import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, THEME_BOOT, themeCss, themeOf, THEMES } from "@/app/lib/theme";

describe("theme", () => {
  it("falls back to boom", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("nope")).toBe("boom");
    expect(parseTheme("inlay")).toBe("inlay");
  });

  it("emits one css block per theme so the selector can swap them", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["boom", "inlay", "lamp"]);
    expect(THEMES.map((t) => t.label)).toEqual(["Boom", "Inlay", "Lamp"]);
    const css = themeCss();
    expect(css).toContain(':root,[data-theme="boom"]');
    expect(css).toContain("color-scheme:dark");
    expect(css).not.toContain("color-scheme:light");
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
      expect(t.tokens.scheme).toBe("dark");
      expect(Object.keys(t.tokens).sort()).toEqual(keys);
      expect(css).toContain(`[data-theme="${t.id}"]`);
      expect(css).toContain(`--canvas:${t.tokens.canvas}`);
      expect(css).toContain(`--accent:${t.tokens.accent}`);
      expect(css).toContain(`--warn:${t.tokens.warn}`);
      expect(css).toContain(`--warn-line:${t.tokens.warnLine}`);
      expect(css).toContain(`--warn-soft:${t.tokens.warnSoft}`);
    }
    expect(THEME_BOOT).toContain("gantree.theme");
    expect(THEME_BOOT).toContain("lamp");
  });

  it("keeps the three nights distinct and off each other's warn chips", () => {
    const boom = themeOf("boom").tokens;
    const inlay = themeOf("inlay").tokens;
    const lamp = themeOf("lamp").tokens;
    expect(boom.canvas).toBe("#0e1316");
    expect(boom.accent).toBe("#f07848");
    expect(inlay.accent).toBe("#e6d3b0");
    expect(lamp.accent).toBe("#c5d24a");
    expect(inlay.accent).not.toBe(boom.accent);
    expect(lamp.accent).not.toBe(boom.accent);
    expect(inlay.warn).not.toBe(boom.warn);
    expect(lamp.warn).not.toBe(boom.warn);
    expect(lamp.accent).not.toBe(lamp.warn);
    expect(boom.line).not.toBe(boom.panel);
    expect(inlay.line).not.toBe(inlay.panel);
  });

  it("paints tag hues per theme so each night can retune chips", () => {
    const boom = themeOf("boom").tokens;
    const inlay = themeOf("inlay").tokens;
    const lamp = themeOf("lamp").tokens;
    expect(boom.tagAmber).not.toBe(inlay.tagAmber);
    expect(boom.tagRedSoft).not.toBe(inlay.tagRedSoft);
    expect(boom.tagAmber).not.toBe(boom.warn);
    expect(inlay.tagAmber).not.toBe(inlay.warn);
    expect(lamp.tagAmber).not.toBe(lamp.warn);
    const css = themeCss();
    expect(css).toContain(`--tag-amber:${boom.tagAmber}`);
    expect(css).toContain(`--tag-amber-soft:${inlay.tagAmberSoft}`);
    expect(css).toContain(`--tag-green:${boom.tagGreen}`);
  });
});
