import { describe, expect, it } from "vitest";
import { tagChipClass } from "@/app/components/shared/TagChips";

describe("tagChipClass", () => {
  it("uses dedicated tag tokens, not danger/ok/warn", () => {
    expect(tagChipClass("red")).toContain("tag-red");
    expect(tagChipClass("red")).not.toContain("danger");
    expect(tagChipClass("amber")).toContain("tag-amber");
    expect(tagChipClass("amber")).not.toContain("warn");
    expect(tagChipClass("green")).toContain("tag-green");
    expect(tagChipClass(undefined)).toContain("border-edge");
  });

  it("washes the chip with the same hue as the text, not a separate line token", () => {
    expect(tagChipClass("red")).toContain("border-tag-red");
    expect(tagChipClass("red")).toContain("bg-tag-red/20");
    expect(tagChipClass("red")).toContain("text-tag-red");
    expect(tagChipClass("red")).not.toContain("tag-red-line");
    expect(tagChipClass("red")).not.toContain("tag-red-soft");
  });
});
