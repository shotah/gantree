import { accessForRole, canBuildCrane, canEditOperator, canManageOperators, canMutateCrane, canReadCrane, parseCraneSlug, parseCraneSlugs, parseStoredCranes, parseStoredRole, roleNeedsCrane, scopeYard, serializeCranes } from "@/lib/yard/door/access";
import type { YardInventory } from "@/lib/yard/types";
import { describe, expect, it } from "vitest";

const admin = { role: "admin" as const, cranes: [] as string[] };
const user = { role: "user" as const, cranes: ["kit"] };
const reader = { role: "readonly" as const, cranes: ["kit"] };
const pair = { role: "user" as const, cranes: ["kit", "tryout"] };

describe("access helpers", () => {
  it("parses roles and crane slugs", () => {
    expect(parseStoredRole("readonly")).toBe("readonly");
    expect(parseStoredRole("nope")).toBe("admin");
    expect(parseCraneSlug("Kit")).toEqual({ ok: true, crane: "kit" });
    expect(parseCraneSlug("")).toEqual({ ok: true, crane: null });
    expect(parseCraneSlug("1kit")).toMatchObject({ ok: false });
    expect(roleNeedsCrane("admin")).toBe(false);
    expect(roleNeedsCrane("user")).toBe(true);
    expect(roleNeedsCrane("readonly")).toBe(true);
    expect(parseCraneSlugs("kit, tryout")).toEqual({ ok: true, cranes: ["kit", "tryout"] });
    expect(parseCraneSlugs(["Kit", "kit", "tryout"])).toEqual({ ok: true, cranes: ["kit", "tryout"] });
    expect(parseStoredCranes("kit")).toEqual(["kit"]);
    expect(parseStoredCranes('["kit","tryout"]')).toEqual(["kit", "tryout"]);
    expect(serializeCranes(["kit", "tryout"])).toBe('["kit","tryout"]');
    expect(serializeCranes([])).toBeNull();
  });

  it("requires at least one crane for user and readonly", () => {
    expect(accessForRole("user", null)).toMatchObject({ ok: false });
    expect(accessForRole("readonly", [])).toMatchObject({ ok: false });
    expect(accessForRole("user", "kit")).toEqual({ ok: true, role: "user", cranes: ["kit"] });
    expect(accessForRole("readonly", ["kit"])).toEqual({ ok: true, role: "readonly", cranes: ["kit"] });
    expect(accessForRole("user", ["kit", "tryout"])).toEqual({ ok: true, role: "user", cranes: ["kit", "tryout"] });
    expect(accessForRole("admin", ["kit"])).toEqual({ ok: true, role: "admin", cranes: [] });
  });

  it("maps the three roles onto assigned cranes or the whole yard", () => {
    expect(canReadCrane(admin, "tryout")).toBe(true);
    expect(canMutateCrane(admin, "tryout")).toBe(true);
    expect(canBuildCrane(admin)).toBe(true);
    expect(canManageOperators(admin)).toBe(true);
    expect(canEditOperator({ ...admin, id: "1" }, "1")).toBe(true);
    expect(canEditOperator({ ...admin, id: "1" }, "2")).toBe(true);

    expect(canReadCrane(user, "kit")).toBe(true);
    expect(canMutateCrane(user, "kit")).toBe(true);
    expect(canReadCrane(user, "tryout")).toBe(false);
    expect(canMutateCrane(user, "tryout")).toBe(false);
    expect(canBuildCrane(user)).toBe(false);
    expect(canManageOperators(user)).toBe(false);
    expect(canEditOperator({ ...user, id: "2" }, "2")).toBe(true);
    expect(canEditOperator({ ...user, id: "2" }, "1")).toBe(false);

    expect(canReadCrane(pair, "kit")).toBe(true);
    expect(canReadCrane(pair, "tryout")).toBe(true);
    expect(canMutateCrane(pair, "tryout")).toBe(true);
    expect(canReadCrane(pair, "jules")).toBe(false);

    expect(canReadCrane(reader, "kit")).toBe(true);
    expect(canReadCrane(reader, "tryout")).toBe(false);
    expect(canMutateCrane(reader, "kit")).toBe(false);
    expect(canBuildCrane(reader)).toBe(false);
    expect(canReadCrane({ role: "readonly", cranes: [] }, "kit")).toBe(false);
  });

  it("scopes the board to assigned cranes; only admin sees every crane", () => {
    const yard = {
      source: "gantree.toml",
      yard: "home",
      dockerError: null,
      gantries: [{ slug: "kit" }, { slug: "tryout" }, { slug: "jules" }],
    } as unknown as YardInventory;
    expect(scopeYard(yard, admin).gantries.map((g) => g.slug)).toEqual(["kit", "tryout", "jules"]);
    expect(scopeYard(yard, user).gantries.map((g) => g.slug)).toEqual(["kit"]);
    expect(scopeYard(yard, pair).gantries.map((g) => g.slug)).toEqual(["kit", "tryout"]);
    expect(scopeYard(yard, reader).gantries.map((g) => g.slug)).toEqual(["kit"]);
    expect(scopeYard(yard, { role: "user", cranes: [] }).gantries).toEqual([]);
  });
});
