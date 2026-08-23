import type { LogLine, LogTurnGroup } from "../types";

const SECRET = /(TOKEN|KEY|SECRET|PASSWORD|PASSWD)=([^\s]+)/gi;

export function redact(text: string): string {
  return text.replace(SECRET, (_, name: string) => `${name}=***`);
}

/** Docker multiplexed attach header: 1 byte stream + 3 pad + 4 byte BE size. */
export function decodeDockerLogs(buf: Uint8Array): string {
  if (buf.length < 8) {
    return new TextDecoder().decode(buf);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const firstType = buf[0];
  if (firstType > 2) {
    return new TextDecoder().decode(buf);
  }
  const chunks: string[] = [];
  const dec = new TextDecoder();
  let i = 0;
  while (i + 8 <= buf.length) {
    const streamType = buf[i];
    if (streamType > 2) {
      return new TextDecoder().decode(buf);
    }
    const size = view.getUint32(i + 4);
    if (size > buf.length || i + 8 + size > buf.length) {
      return new TextDecoder().decode(buf);
    }
    chunks.push(dec.decode(buf.subarray(i + 8, i + 8 + size)));
    i += 8 + size;
  }
  return chunks.join("") || new TextDecoder().decode(buf);
}

export function kindOf(line: LogLine): LogLine["kind"] {
  const blob = `${line.level ?? ""} ${line.msg}`.toLowerCase();
  if (line.level === "ERROR" || line.level === "error" || /\berror\b/.test(blob)) {
    return "error";
  }
  if (/\bskip(ped)?\b/.test(blob) || blob.includes("not granted")) {
    return "skip";
  }
  if (/\btool\b/.test(blob) || blob.includes("__")) {
    return "tool";
  }
  if (/\bturn\b/.test(blob) || blob.includes("completer") || blob.includes("est_tokens")) {
    return "turn";
  }
  return "info";
}

const DOCKER_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\S*\s+/;

export function parseLogLine(raw: string): LogLine {
  const trimmed = redact(raw.replace(/\r$/, "").replace(DOCKER_TS, ""));
  let json: Record<string, unknown> | null = null;
  if (trimmed.startsWith("{")) {
    try {
      const v = JSON.parse(trimmed) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        json = v as Record<string, unknown>;
      }
    } catch {
      json = null;
    }
  }
  const ts =
    (typeof json?.time === "string" && json.time) ||
    (typeof json?.ts === "string" && json.ts) ||
    null;
  const level = typeof json?.level === "string" ? json.level : null;
  const base =
    (typeof json?.msg === "string" && json.msg) ||
    (typeof json?.message === "string" && json.message) ||
    trimmed;
  const err =
    typeof json?.err === "string"
      ? json.err
      : json?.err instanceof Error
        ? json.err.message
        : null;
  const msg = err && !base.includes(err) ? `${base}: ${err}` : base;
  const line: LogLine = { ts, level, msg, raw: trimmed, json, kind: "info", turnId: turnIdOf(json) };
  line.kind = kindOf(line);
  return line;
}

/** Stable enough ids from slog — missing fields stay null, never invented. */
export function turnIdOf(json: Record<string, unknown> | null): string | null {
  if (!json) {
    return null;
  }
  for (const key of ["turn_id", "turnId", "request_id", "req_id"]) {
    const v = json[key];
    if (typeof v === "string" && v.trim() && v.length < 96) {
      return v.trim();
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
  }
  const turn = json.turn;
  if (typeof turn === "string" && turn.trim() && turn.length < 96 && !/\s/.test(turn)) {
    return turn.trim();
  }
  if (typeof turn === "number" && Number.isFinite(turn)) {
    return String(turn);
  }
  return null;
}

/** Consecutive lines with the same turn id (or a run of untagged lines). */
export function groupLogsByTurn(lines: LogLine[]): LogTurnGroup[] {
  const groups: LogTurnGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.turnId === line.turnId) {
      last.lines.push(line);
    } else {
      groups.push({ turnId: line.turnId, lines: [line] });
    }
  }
  return groups;
}

/** Incremental Docker log demux (mux header vs TTY/raw). */
export function createLogDemuxer(): { push: (chunk: Uint8Array) => string } {
  let buf = Buffer.alloc(0);
  let mode: "unknown" | "mux" | "raw" = "unknown";
  return {
    push(chunk: Uint8Array): string {
      buf = Buffer.concat([buf, Buffer.from(chunk)]);
      if (mode === "unknown") {
        if (buf.length < 8) {
          return "";
        }
        mode = buf[0] <= 2 ? "mux" : "raw";
      }
      if (mode === "raw") {
        const text = buf.toString("utf8");
        buf = Buffer.alloc(0);
        return text;
      }
      const parts: string[] = [];
      while (buf.length >= 8) {
        const size = buf.readUInt32BE(4);
        if (size > 16 * 1024 * 1024 || buf.length < 8 + size) {
          break;
        }
        parts.push(buf.subarray(8, 8 + size).toString("utf8"));
        buf = buf.subarray(8 + size);
      }
      return parts.join("");
    },
  };
}

export function splitLogLines(carry: string, chunk: string): { lines: string[]; rest: string } {
  const merged = carry + chunk;
  const parts = merged.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((l) => l.replace(/\r$/, "")).filter((l) => l.length > 0), rest };
}

export function parseLogText(text: string): LogLine[] {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .map(parseLogLine);
}

export function turnFromLog(line: LogLine): {
  rounds: number | null;
  recoveries: number | null;
  estTokens: number | null;
  promptEstTokens: number | null;
  genEstTokens: number | null;
  source: string | null;
  userId: string | null;
  sessionId: string | null;
  outcome: string | null;
} | null {
  if (!line.json) {
    return null;
  }
  const msg = (typeof line.json.msg === "string" ? line.json.msg : line.msg).trim();
  const isTurnPerf = /^turn perf$/i.test(msg) || /^turn done$/i.test(msg);
  const promptEstTokens = num(line.json.prompt_est_tokens);
  const genEstTokens = num(line.json.gen_est_tokens);
  const rounds = num(line.json.iterations ?? line.json.rounds ?? line.json.invocations ?? line.json.completer_rounds);
  const recoveries = num(line.json.recoveries ?? line.json.recovery);
  const legacyTokens = num(line.json.est_tokens ?? line.json.estTokens ?? line.json.tokens);
  let estTokens: number | null = null;
  if (promptEstTokens != null || genEstTokens != null) {
    estTokens = (promptEstTokens ?? 0) + (genEstTokens ?? 0);
  } else if (legacyTokens != null && (isTurnPerf || rounds != null || recoveries != null || line.turnId != null)) {
    estTokens = legacyTokens;
  }
  if (!isTurnPerf && promptEstTokens == null && genEstTokens == null && estTokens == null) {
    return null;
  }
  return {
    rounds,
    recoveries,
    estTokens,
    promptEstTokens,
    genEstTokens,
    source: str(line.json.source),
    userId: str(line.json.user_id ?? line.json.userId),
    sessionId: str(line.json.session_id ?? line.json.sessionId),
    outcome: str(line.json.outcome),
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) {
    return v.trim();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  return null;
}
