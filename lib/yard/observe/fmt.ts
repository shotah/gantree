import type { SpendBucket, SpendWindow } from "./windows";

export function estSpendUsd(
  promptEst: number,
  genEst: number,
  rates?: { promptUsdPerMillion: number | null; genUsdPerMillion: number | null } | null,
): number | null {
  if (!rates || (rates.promptUsdPerMillion == null && rates.genUsdPerMillion == null)) {
    return null;
  }
  const p = rates.promptUsdPerMillion ?? 0;
  const g = rates.genUsdPerMillion ?? 0;
  return (promptEst / 1e6) * p + (genEst / 1e6) * g;
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "$0";
  }
  if (n < 0.01) {
    return `$${n.toFixed(4)}`;
  }
  return `$${n.toFixed(2)}`;
}

export function fmtEstTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0";
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(2)}k`;
  }
  return String(Math.round(n));
}

export function fmtSpendWindow(window: SpendWindow): string {
  if (window === "all") {
    return "all sampled";
  }
  if (window === "month") {
    return "this month";
  }
  return `last ${window}`;
}

export function fmtAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) {
    return `${s}s ago`;
  }
  const m = Math.round(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.round(m / 60);
  if (h < 48) {
    return `${h}h ago`;
  }
  return `${Math.round(h / 24)}d ago`;
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0";
  }
  if (n >= 1024 ** 3) {
    return `${(n / 1024 ** 3).toFixed(1)} GiB`;
  }
  if (n >= 1024 ** 2) {
    return `${Math.round(n / 1024 ** 2)} MiB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} KiB`;
  }
  return `${Math.round(n)} B`;
}

/** Show data-dir size on a card once it is no longer tiny. */
export const FAT_DATA_DIR_BYTES = 256 * 1024 * 1024;

export function lastDiskBytes(samples: { diskBytes?: number | null }[] | undefined): number | null {
  if (!samples?.length) {
    return null;
  }
  for (let i = samples.length - 1; i >= 0; i--) {
    const n = samples[i]?.diskBytes;
    if (typeof n === "number" && n > 0) {
      return n;
    }
  }
  return null;
}

export function fmtBps(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0 B/s";
  }
  return `${fmtBytes(n)}/s`;
}

/** Docker CPU % is 100 = one full core. */
export function fmtCores(cpuPercent: number): string {
  if (!Number.isFinite(cpuPercent) || cpuPercent <= 0) {
    return "0";
  }
  return (cpuPercent / 100).toFixed(cpuPercent >= 100 ? 1 : 2);
}

export function hostShare(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, used / total));
}

export function fmtSpendBucketTitle(bucket: SpendBucket): string {
  switch (bucket) {
    case "cumulative":
      return "est. tokens (cumulative)";
    case "hour":
      return "est. tokens / hour";
    case "6h":
      return "est. tokens / 6h";
    case "12h":
      return "est. tokens / 12h";
    case "day":
      return "est. tokens / day";
  }
}
