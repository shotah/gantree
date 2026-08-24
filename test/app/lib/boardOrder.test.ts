/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import {
  applyBoardOrder,
  BOARD_ORDER_KEY,
  HOST_CARD_ID,
  moveBoardId,
  moveVisibleBoardId,
  parseBoardOrder,
  readBoardOrder,
  writeBoardOrder,
} from "@/app/lib/boardOrder";

afterEach(() => {
  localStorage.clear();
});

describe("parseBoardOrder", () => {
  it("reads a string list and drops junk", () => {
    expect(parseBoardOrder(null)).toEqual([]);
    expect(parseBoardOrder("")).toEqual([]);
    expect(parseBoardOrder("{")).toEqual([]);
    expect(parseBoardOrder("{\"a\":1}")).toEqual([]);
    expect(parseBoardOrder("[\"host\",\"kit\",0,\"\"]")).toEqual(["host", "kit"]);
  });
});

describe("applyBoardOrder", () => {
  it("follows saved order and appends ids the save has not seen", () => {
    expect(applyBoardOrder(["host", "kit", "tryout"], ["tryout", "host"])).toEqual([
      "tryout",
      "host",
      "kit",
    ]);
  });

  it("drops ids that are no longer on the board", () => {
    expect(applyBoardOrder(["host", "kit"], ["gone", "kit", "host"])).toEqual(["kit", "host"]);
  });
});

describe("moveBoardId", () => {
  it("moves an earlier card onto a later one", () => {
    expect(moveBoardId(["a", "b", "c"], "a", "b")).toEqual(["b", "a", "c"]);
    expect(moveBoardId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("moves a later card onto an earlier one", () => {
    expect(moveBoardId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveBoardId(["a", "b", "c"], "c", "b")).toEqual(["a", "c", "b"]);
  });

  it("no-ops when an id is missing or the same", () => {
    const ids = ["a", "b"];
    expect(moveBoardId(ids, "a", "a")).toBe(ids);
    expect(moveBoardId(ids, "z", "a")).toBe(ids);
    expect(moveBoardId(ids, "a", "z")).toBe(ids);
  });
});

describe("moveVisibleBoardId", () => {
  it("reorders only the visible cards", () => {
    expect(moveVisibleBoardId(
      ["host", "kit", "tryout", "noodles"],
      ["host", "kit", "noodles"],
      "noodles",
      "host",
    )).toEqual(["noodles", "host", "tryout", "kit"]);
  });
});

describe("readBoardOrder / writeBoardOrder", () => {
  it("round-trips through localStorage", () => {
    expect(readBoardOrder()).toEqual([]);
    writeBoardOrder([HOST_CARD_ID, "kit"]);
    expect(localStorage.getItem(BOARD_ORDER_KEY)).toBe("[\"host\",\"kit\"]");
    expect(readBoardOrder()).toEqual(["host", "kit"]);
  });
});
