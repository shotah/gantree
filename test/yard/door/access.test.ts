import { accessForRole, canBuildCrane, canManageOperators, canMutateCrane, canReadCrane, parseCraneSlug, parseStoredRole, scopeYard } from "@/lib/yard/door/access";
import type { YardInventory } from "@/lib/yard/types";
import { describe, expect, it } from "vitest";

const admin = { role: "admin" as const, crane: null };
const user = { role: "user" as const, crane: "kit" };
const reader = { role: "readonly" as const, crane: null };

describe("access helpers", () => {
  it("parses roles and crane slugs", () => {
    expect(parseStoredRole("readonly")).toBe("readonly");
    expect(parseStoredRole("nope")).toBe("admin");
    expect(parseCraneSlug("Kit")).toEqual({ ok: true, crane: "kit" });
    expect(parseCraneSlug("")).toEqual({ ok: true, crane: null });
    expect(parseCraneSlug("1kit")).toMatchObject({ ok: false });
  });

  it("requires a crane only for user", () => {
    expect(accessForRole("user", null)).toMatchObject({ ok: false });
    expect(accessForRole("user", "kit")).toEqual({ ok: true, role: "user", crane: "kit" });
    expect(accessForRole("admin", "kit")).toEqual({ ok: true, role: "admin", crane: null });
    expect(accessForRole("readonly", "kit")).toEqual({ ok: true, role: "readonly", crane: null });
  });

  it("maps the three roles onto one crane or the whole yard", () => {
    expect(canReadCrane(admin, "tryout")).toBe(true);
    expect(canMutateCrane(admin, "tryout")).toBe(true);
    expect(canBuildCrane(admin)).toBe(true);
    expect(canManageOperators(admin)).toBe(true);

    expect(canReadCrane(user, "kit")).toBe(true);
    expect(canMutateCrane(user, "kit")).toBe(true);
    expect(canReadCrane(user, "tryout")).toBe(false);
    expect(canMutateCrane(user, "tryout")).toBe(false);
    expect(canBuildCrane(user)).toBe(false);
    expect(canManageOperators(user)).toBe(false);

    expect(canReadCrane(reader, "kit")).toBe(true);
    expect(canMutateCrane(reader, "kit")).toBe(false);
    expect(canBuildCrane(reader)).toBe(false);
  });

  it("scopes the board to the user's crane", () => {
    const yard = {
      source: "gantree.toml",
      yard: "home",
      dockerError: null,
      gantries: [{ slug: "kit" }, { slug: "tryout" }],
    } as unknown as YardInventory;
    expect(scopeYard(yard, admin).gantries.map((g) => g.slug)).toEqual(["kit", "tryout"]);
    expect(scopeYard(yard, user).gantries.map((g) => g.slug)).toEqual(["kit"]);
    expect(scopeYard(yard, reader).gantries.map((g) => g.slug)).toEqual(["kit", "tryout"]);
  });
});
