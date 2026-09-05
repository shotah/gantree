import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptJpeg,
  applyAvatar,
  AVATAR_MAX_BYTES,
  copyAvatarTo,
  findAvatar,
  mailboxToAvatarUrl,
  saveAvatar,
  setPendantProfilePhoto,
  setTelegramProfilePhoto,
  shouldPushPendant,
  shouldPushTelegram,
  resolveChannelAndToken,
  type TelegramPoster,
} from "@/lib/yard/host/avatar";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(d);
  return d;
}

function fakeJpeg(n = 128): Uint8Array {
  const b = new Uint8Array(n);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[n - 1] = 0xd9;
  return b;
}

describe("acceptJpeg", () => {
  it("rejects tiny, huge, and non-jpeg", () => {
    expect(acceptJpeg(fakeJpeg(8)).ok).toBe(false);
    expect(acceptJpeg(new Uint8Array(AVATAR_MAX_BYTES + 1)).ok).toBe(false);
    const png = new Uint8Array(64);
    png[0] = 0x89;
    png[1] = 0x50;
    expect(acceptJpeg(png).ok).toBe(false);
    expect(acceptJpeg(fakeJpeg()).ok).toBe(true);
  });
});

describe("findAvatar / saveAvatar", () => {
  it("prefers avatar.jpg and records mtime", () => {
    const persona = join(tmp(), "persona");
    mkdirSync(persona);
    writeFileSync(join(persona, "avatar.png"), "png");
    writeFileSync(join(persona, "avatar.jpg"), fakeJpeg());
    const hit = findAvatar(persona);
    expect(hit?.name).toBe("avatar.jpg");
    expect(hit?.type).toBe("image/jpeg");
    expect(hit?.rev).toBeGreaterThan(0);
  });

  it("writes jpeg bytes", () => {
    const persona = join(tmp(), "persona");
    const bytes = fakeJpeg();
    const hit = saveAvatar(persona, bytes);
    expect(hit.name).toBe("avatar.jpg");
    expect(readFileSync(hit.path)).toEqual(Buffer.from(bytes));
  });
});

describe("shouldPushTelegram", () => {
  it("is only telegram", () => {
    expect(shouldPushTelegram("telegram")).toBe(true);
    expect(shouldPushTelegram("Telegram")).toBe(true);
    expect(shouldPushTelegram("discord")).toBe(false);
    expect(shouldPushTelegram(null)).toBe(false);
  });
});

describe("resolveChannelAndToken", () => {
  it("prefers .env token over inspect", () => {
    const r = resolveChannelAndToken({
      cardChannel: null,
      file: { CHANNEL: "telegram", TELEGRAM_BOT_TOKEN: "from-file" },
      inspectEnv: ["CHANNEL=telegram", "TELEGRAM_BOT_TOKEN=from-docker"],
    });
    expect(r).toEqual({ channel: "telegram", token: "from-file" });
  });

  it("fills token and channel from inspect when .env omits them", () => {
    const r = resolveChannelAndToken({
      cardChannel: null,
      file: {},
      inspectEnv: ["CHANNEL=telegram", "TELEGRAM_BOT_TOKEN=from-docker"],
    });
    expect(r).toEqual({ channel: "telegram", token: "from-docker" });
  });

  it("treats a bot token as telegram when CHANNEL is unset", () => {
    const r = resolveChannelAndToken({
      cardChannel: null,
      file: { TELEGRAM_BOT_TOKEN: "abc" },
    });
    expect(r).toEqual({ channel: "telegram", token: "abc" });
  });
});

describe("setTelegramProfilePhoto", () => {
  it("posts attach:// multipart and never echoes the token", async () => {
    const token = "123:secret-token";
    let url = "";
    let photo = "";
    let hasFile = false;
    const post: TelegramPoster = async (u, init) => {
      url = u;
      if (init.body instanceof FormData) {
        photo = String(init.body.get("photo"));
        hasFile = init.body.get("avatar") instanceof Blob;
      }
      return { status: 200, body: JSON.stringify({ ok: true, result: true }) };
    };
    const r = await setTelegramProfilePhoto(token, fakeJpeg(), post);
    expect(r.ok).toBe(true);
    expect(url).toContain(token);
    expect(url).toContain("setMyProfilePhoto");
    expect(photo).toBe(JSON.stringify({ type: "static", photo: "attach://avatar" }));
    expect(hasFile).toBe(true);
    expect(r.detail).not.toContain(token);
  });

  it("redacts the token from Telegram errors", async () => {
    const token = "123:secret-token";
    const post: TelegramPoster = async () => ({
      status: 400,
      body: JSON.stringify({ ok: false, description: `bad ${token} photo` }),
    });
    const r = await setTelegramProfilePhoto(token, fakeJpeg(), post);
    expect(r.ok).toBe(false);
    expect(r.detail).not.toContain(token);
    expect(r.detail).toContain("***");
  });
});

describe("applyAvatar", () => {
  it("saves without calling Telegram when the channel is not telegram", async () => {
    const persona = join(tmp(), "persona");
    let called = 0;
    const post: TelegramPoster = async () => {
      called += 1;
      return { status: 200, body: "{}" };
    };
    const r = await applyAvatar({
      personaDir: persona,
      channel: "discord",
      token: "123:abc",
      bytes: fakeJpeg(),
      post,
    });
    expect(r.telegram).toBe("skipped");
    expect(r.detail).toBe("saved avatar.jpg");
    expect(called).toBe(0);
    expect(existsSync(join(persona, "avatar.jpg"))).toBe(true);
  });

  it("saves and skips when telegram has no token", async () => {
    const persona = join(tmp(), "persona");
    const r = await applyAvatar({
      personaDir: persona,
      channel: "telegram",
      token: "  ",
      bytes: fakeJpeg(),
    });
    expect(r.telegram).toBe("skipped");
    expect(r.detail).toContain("no TELEGRAM_BOT_TOKEN");
    expect(existsSync(join(persona, "avatar.jpg"))).toBe(true);
  });

  it("keeps the file when Telegram rejects the photo", async () => {
    const persona = join(tmp(), "persona");
    const post: TelegramPoster = async () => ({
      status: 400,
      body: JSON.stringify({ ok: false, description: "PHOTO_INVALID_DIMENSIONS" }),
    });
    const r = await applyAvatar({
      personaDir: persona,
      channel: "telegram",
      token: "123:abc",
      bytes: fakeJpeg(),
      post,
    });
    expect(r.telegram).toBe("failed");
    expect(r.detail).toContain("PHOTO_INVALID_DIMENSIONS");
    expect(existsSync(join(persona, "avatar.jpg"))).toBe(true);
  });

  it("reports updated after a successful push", async () => {
    const persona = join(tmp(), "persona");
    const post: TelegramPoster = async () => ({ status: 200, body: JSON.stringify({ ok: true, result: true }) });
    const r = await applyAvatar({
      personaDir: persona,
      channel: "telegram",
      token: "123:abc",
      bytes: fakeJpeg(),
      post,
    });
    expect(r.telegram).toBe("updated");
    expect(r.detail).toContain("Telegram profile photo updated");
  });
});

describe("shouldPushPendant / mailboxToAvatarUrl", () => {
  it("is only pendant and maps the wss mailbox", () => {
    expect(shouldPushPendant("pendant")).toBe(true);
    expect(shouldPushPendant("telegram")).toBe(false);
    expect(mailboxToAvatarUrl("wss://gantry-pendant.example.workers.dev/ws/kit")).toBe(
      "https://gantry-pendant.example.workers.dev/api/avatar?slug=kit",
    );
    expect(mailboxToAvatarUrl("ftp://x/ws/kit")).toBeNull();
  });
});

describe("setPendantProfilePhoto", () => {
  it("posts multipart file with the crane bearer and redacts it", async () => {
    const bearer = "crane-secret-token";
    let url = "";
    let auth = "";
    let hasFile = false;
    const post: TelegramPoster = async (u, init) => {
      url = u;
      auth = init.headers?.Authorization ?? "";
      if (init.body instanceof FormData) {
        hasFile = init.body.get("file") instanceof Blob;
      }
      return { status: 200, body: JSON.stringify({ ok: true, rev: 1 }) };
    };
    const r = await setPendantProfilePhoto(
      "wss://example.workers.dev/ws/kit",
      bearer,
      fakeJpeg(),
      post,
    );
    expect(r.ok).toBe(true);
    expect(url).toBe("https://example.workers.dev/api/avatar?slug=kit");
    expect(auth).toBe(`Bearer ${bearer}`);
    expect(hasFile).toBe(true);
    expect(r.detail).not.toContain(bearer);
  });
});

describe("applyAvatar pendant", () => {
  it("saves and pushes the Worker face when the channel is pendant", async () => {
    const persona = join(tmp(), "persona");
    let url = "";
    const post: TelegramPoster = async (u) => {
      url = u;
      return { status: 200, body: JSON.stringify({ ok: true, rev: 2 }) };
    };
    const r = await applyAvatar({
      personaDir: persona,
      channel: "pendant",
      token: null,
      mailboxUrl: "wss://example.workers.dev/ws/kit",
      bearer: "tok",
      bytes: fakeJpeg(),
      post,
    });
    expect(r.telegram).toBe("skipped");
    expect(r.pendant).toBe("updated");
    expect(r.detail).toContain("pendant face updated");
    expect(url).toContain("/api/avatar?slug=kit");
    expect(existsSync(join(persona, "avatar.jpg"))).toBe(true);
  });

  it("skips pendant without a mailbox", async () => {
    const persona = join(tmp(), "persona");
    const r = await applyAvatar({
      personaDir: persona,
      channel: "pendant",
      token: null,
      bytes: fakeJpeg(),
    });
    expect(r.pendant).toBe("skipped");
    expect(r.detail).toContain("no mailbox");
  });
});

describe("copyAvatarTo", () => {
  it("copies the found file into dest", () => {
    const root = tmp();
    const persona = join(root, "persona");
    const dest = join(root, "dest");
    mkdirSync(persona);
    mkdirSync(dest);
    writeFileSync(join(persona, "avatar.jpg"), fakeJpeg());
    copyAvatarTo(persona, dest);
    expect(existsSync(join(dest, "avatar.jpg"))).toBe(true);
  });
});
