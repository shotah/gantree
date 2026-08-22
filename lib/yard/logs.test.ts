import { describe, expect, it } from "vitest";
import { createLogDemuxer, decodeDockerLogs, groupLogsByTurn, parseLogLine, parseLogText, redact, splitLogLines, turnFromLog } from "./logs";

describe("redact", () => {
  it("hides token-shaped assignments", () => {
    expect(redact("TELEGRAM_BOT_TOKEN=12345 still here")).toBe("TELEGRAM_BOT_TOKEN=*** still here");
  });
});

describe("parseLogLine", () => {
  it("parses JSON slog", () => {
    const line = parseLogLine('{"time":"2026-08-22T18:00:00Z","level":"INFO","msg":"turn done","est_tokens":120,"rounds":3,"turn_id":"t-9"}');
    expect(line.level).toBe("INFO");
    expect(line.msg).toBe("turn done");
    expect(line.kind).toBe("turn");
    expect(line.turnId).toBe("t-9");
    expect(turnFromLog(line)?.estTokens).toBe(120);
    expect(turnFromLog(line)?.rounds).toBe(3);
  });

  it("surfaces slog err on the message", () => {
    const line = parseLogLine('{"level":"ERROR","msg":"session store open failed","err":"session: mkdir data dir: permission denied"}');
    expect(line.msg).toContain("permission denied");
  });

  it("reads ai-gantry turn perf prompt+gen tokens", () => {
    const line = parseLogLine(
      '{"time":"2026-08-22T18:00:00.000Z","level":"INFO","msg":"turn perf","source":"user","user_id":"42","session_id":"s-1","iterations":2,"recoveries":0,"prompt_est_tokens":8000,"gen_est_tokens":400,"outcome":"ok"}',
    );
    expect(line.kind).toBe("turn");
    const t = turnFromLog(line);
    expect(t?.estTokens).toBe(8400);
    expect(t?.promptEstTokens).toBe(8000);
    expect(t?.genEstTokens).toBe(400);
    expect(t?.rounds).toBe(2);
    expect(t?.recoveries).toBe(0);
    expect(t?.source).toBe("user");
    expect(t?.userId).toBe("42");
    expect(t?.sessionId).toBe("s-1");
  });

  it("ignores boot schema est_tokens", () => {
    const line = parseLogLine('{"time":"2026-08-22T18:00:00Z","msg":"tools_published","est_tokens":16000}');
    expect(turnFromLog(line)).toBeNull();
  });

  it("keeps plaintext and flags skips", () => {
    const line = parseLogLine("mcp server google skipped: no binary");
    expect(line.kind).toBe("skip");
    expect(line.json).toBeNull();
  });

  it("strips docker timestamps", () => {
    const line = parseLogLine("2026-08-22T18:00:00.123456789Z hello");
    expect(line.msg).toBe("hello");
  });
});

describe("decodeDockerLogs", () => {
  it("demuxes a stdout frame", () => {
    const payload = Buffer.from("hi\n");
    const header = Buffer.alloc(8);
    header[0] = 1;
    header.writeUInt32BE(payload.length, 4);
    expect(decodeDockerLogs(Buffer.concat([header, payload]))).toBe("hi\n");
  });

  it("passes through raw text", () => {
    expect(decodeDockerLogs(Buffer.from("plain\n"))).toBe("plain\n");
  });
});

describe("parseLogText", () => {
  it("drops empty lines", () => {
    expect(parseLogText("a\n\nb\n").map((l) => l.msg)).toEqual(["a", "b"]);
  });
});

describe("groupLogsByTurn", () => {
  it("groups consecutive lines that share a turn id", () => {
    const lines = [
      parseLogLine('{"msg":"a","turn_id":"1"}'),
      parseLogLine('{"msg":"b","turn_id":"1"}'),
      parseLogLine('{"msg":"c","turn_id":"2"}'),
      parseLogLine("plain"),
    ];
    const groups = groupLogsByTurn(lines);
    expect(groups.map((g) => [g.turnId, g.lines.length])).toEqual([
      ["1", 2],
      ["2", 1],
      [null, 1],
    ]);
  });
});

describe("createLogDemuxer", () => {
  it("reassembles mux frames across chunks", () => {
    const payload = Buffer.from("hello\n");
    const header = Buffer.alloc(8);
    header[0] = 1;
    header.writeUInt32BE(payload.length, 4);
    const frame = Buffer.concat([header, payload]);
    const d = createLogDemuxer();
    expect(d.push(frame.subarray(0, 4))).toBe("");
    expect(d.push(frame.subarray(4))).toBe("hello\n");
  });
});

describe("splitLogLines", () => {
  it("holds a partial line", () => {
    expect(splitLogLines("", "ab\ncd")).toEqual({ lines: ["ab"], rest: "cd" });
  });
});
