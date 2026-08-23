import { describe, expect, it } from "vitest";
import {
  applyBotProfile,
  botLink,
  emptySnapshot,
  formatAllowlist,
  formatCommandLines,
  getBotProfile,
  getMe,
  parseAllowlist,
  parseCommandLines,
  redactToken,
  seenUsers,
  shouldPushTelegram,
  telegramMethod,
  type TelegramPoster,
} from "@/lib/yard/host/telegram";

function poster(map: Record<string, unknown>, fail: Record<string, string> = {}): TelegramPoster {
  return async (url, init) => {
    const method = url.split("/").pop() ?? "";
    if (fail[method]) {
      return { status: 400, body: JSON.stringify({ ok: false, description: fail[method] }) };
    }
    if (!(method in map)) {
      return { status: 404, body: JSON.stringify({ ok: false, description: `no ${method}` }) };
    }
    if (init.body && typeof init.body === "string") {
      JSON.parse(init.body);
    }
    return { status: 200, body: JSON.stringify({ ok: true, result: map[method] }) };
  };
}

const me = { id: 99, is_bot: true, first_name: "Kit", username: "kit_bot" };

describe("parseAllowlist", () => {
  it("splits commas and spaces, drops dupes and @usernames", () => {
    expect(parseAllowlist("1, 2 2 @alice 3\n4")).toEqual(["1", "2", "3", "4"]);
    expect(parseAllowlist([" 5 ", "x", "5", "-100"])).toEqual(["5", "-100"]);
    expect(formatAllowlist(["2", "1", "2"])).toBe("2,1");
  });
});

describe("parseCommandLines", () => {
  it("reads BotFather-style lines and skips junk", () => {
    const cmds = parseCommandLines("/Tools - list granted MCP\nnew: distill\n\nBAD CMD\nauth");
    expect(cmds).toEqual([
      { command: "tools", description: "list granted MCP" },
      { command: "new", description: "distill" },
      { command: "auth", description: "auth" },
    ]);
    expect(formatCommandLines(cmds[0] ? [cmds[0]] : [])).toBe("tools - list granted MCP");
  });
});

describe("seenUsers", () => {
  it("rolls numeric user ids and ignores names", () => {
    expect(
      seenUsers([
        { userId: "7", at: 10 },
        { userId: "alice", at: 20 },
        { userId: "7", at: 30 },
        { userId: "8", at: 5 },
        { userId: null, at: 40 },
      ]),
    ).toEqual([
      { id: "7", turns: 2, lastAt: 30 },
      { id: "8", turns: 1, lastAt: 5 },
    ]);
  });
});

describe("shouldPushTelegram / botLink", () => {
  it("is only telegram and builds t.me links", () => {
    expect(shouldPushTelegram("Telegram")).toBe(true);
    expect(shouldPushTelegram("discord")).toBe(false);
    expect(botLink("@kit_bot")).toBe("https://t.me/kit_bot");
    expect(botLink("")).toBeNull();
    expect(emptySnapshot({ enabled: true }).tokenSet).toBe(false);
  });
});

describe("getMe / getBotProfile", () => {
  it("maps getMe and never echoes the token", async () => {
    const token = "123:secret-token";
    const r = await getMe(token, poster({ getMe: me }));
    expect(r.ok).toBe(true);
    expect(r.bot).toEqual({ id: 99, username: "kit_bot", firstName: "Kit" });
    expect(r.link).toBe("https://t.me/kit_bot");
    expect(r.detail).not.toContain(token);
  });

  it("redacts the token from Telegram errors", async () => {
    const token = "123:secret-token";
    const r = await getMe(token, poster({}, { getMe: `Unauthorized ${token}` }));
    expect(r.ok).toBe(false);
    expect(r.bot).toBeNull();
    expect(r.detail).toContain("***");
    expect(r.detail).not.toContain(token);
  });

  it("fills name, about, commands from the family of getMy* calls", async () => {
    const r = await getBotProfile(
      "t",
      poster({
        getMe: me,
        getMyName: { name: "Kit the crane" },
        getMyDescription: { description: "empty chat blurb" },
        getMyShortDescription: { short_description: "about line" },
        getMyCommands: [{ command: "tools", description: "list tools" }, { nope: true }, { command: "bad cmd", description: "x" }],
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.name).toBe("Kit the crane");
    expect(r.description).toBe("empty chat blurb");
    expect(r.shortDescription).toBe("about line");
    expect(r.commands).toEqual([{ command: "tools", description: "list tools" }]);
  });

  it("keeps getMe when a getMy* call fails", async () => {
    const r = await getBotProfile("t", poster({ getMe: me }, { getMyName: "boom" }));
    expect(r.bot?.username).toBe("kit_bot");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("name:");
  });
});

describe("applyBotProfile", () => {
  it("posts setMyName / description / about / commands", async () => {
    const methods: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    const post: TelegramPoster = async (url, init) => {
      methods.push(url.split("/").pop() ?? "");
      bodies.push(typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {});
      return { status: 200, body: JSON.stringify({ ok: true, result: true }) };
    };
    const r = await applyBotProfile(
      "t",
      {
        name: "Kit",
        description: "hi",
        shortDescription: "about",
        commands: [{ command: "tools", description: "list granted MCP" }],
      },
      post,
    );
    expect(r.ok).toBe(true);
    expect(methods).toEqual(["setMyName", "setMyDescription", "setMyShortDescription", "setMyCommands"]);
    expect(bodies[0]).toEqual({ name: "Kit" });
    expect(bodies[3]?.commands).toEqual([{ command: "tools", description: "list granted MCP" }]);
    expect(r.detail).toContain("updated");
  });

  it("clears commands with deleteMyCommands", async () => {
    const methods: string[] = [];
    const post: TelegramPoster = async (url) => {
      methods.push(url.split("/").pop() ?? "");
      return { status: 200, body: JSON.stringify({ ok: true, result: true }) };
    };
    const r = await applyBotProfile("t", { commands: [] }, post);
    expect(r.ok).toBe(true);
    expect(methods).toEqual(["deleteMyCommands"]);
  });

  it("rejects an overlong name before calling Telegram", async () => {
    let called = 0;
    const post: TelegramPoster = async () => {
      called += 1;
      return { status: 200, body: "{}" };
    };
    const r = await applyBotProfile("t", { name: "x".repeat(65) }, post);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("64");
    expect(called).toBe(0);
    expect((await applyBotProfile("t", { description: "d".repeat(513) }, post)).detail).toContain("512");
    expect((await applyBotProfile("t", { shortDescription: "a".repeat(121) }, post)).detail).toContain("120");
    expect((await applyBotProfile("t", {}, post)).detail).toBe("nothing to push");
    expect(called).toBe(0);
  });
});

describe("telegramMethod", () => {
  it("redacts a token that appears in a thrown message", async () => {
    const token = "123:secret-token";
    const r = await telegramMethod(token, "getMe", {}, async () => {
      throw new Error(`fetch failed bot${token}`);
    });
    expect(r.ok).toBe(false);
    expect(r.detail).not.toContain(token);
    expect(redactToken(token, `x${token}y`)).toBe("x***y");
  });
});
