import { afterEach, describe, expect, it } from "vitest";
import { consoleRuntime } from "@/lib/yard/host/runtime";

afterEach(() => {
  delete process.env.GANTREE_DEV_PASSPHRASE;
  delete process.env.HOST;
});

describe("consoleRuntime", () => {
  it("exposes bind and omits passphrases", () => {
    process.env.HOST = "127.0.0.1";
    process.env.GANTREE_DEV_PASSPHRASE = "secret-passphrase-ok";
    const snap = consoleRuntime("paddleboy");
    expect(snap.hostname).toBe("paddleboy");
    expect(snap.bind).toMatch(/127\.0\.0\.1:/);
    expect(snap.env.GANTREE_DEV_PASSPHRASE).toBeUndefined();
    expect(snap.env.HOST?.value).toBe("127.0.0.1");
  });
});
