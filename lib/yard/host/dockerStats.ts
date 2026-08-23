export type CpuMem = {
  cpuPercent: number | null;
  memBytes: number | null;
  memLimitBytes: number | null;
  netRxBytes: number | null;
  netTxBytes: number | null;
  blkReadBytes: number | null;
  blkWriteBytes: number | null;
};

type BlkioRow = { op?: string; value?: number };

function sumNet(networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>): {
  rx: number | null;
  tx: number | null;
} {
  if (!networks) {
    return { rx: null, tx: null };
  }
  let rx = 0;
  let tx = 0;
  let hit = false;
  for (const n of Object.values(networks)) {
    if (typeof n?.rx_bytes === "number" && Number.isFinite(n.rx_bytes)) {
      rx += n.rx_bytes;
      hit = true;
    }
    if (typeof n?.tx_bytes === "number" && Number.isFinite(n.tx_bytes)) {
      tx += n.tx_bytes;
      hit = true;
    }
  }
  return hit ? { rx, tx } : { rx: null, tx: null };
}

function sumBlkio(rows?: BlkioRow[] | null): { read: number | null; write: number | null } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { read: null, write: null };
  }
  let read = 0;
  let write = 0;
  let hit = false;
  for (const row of rows) {
    const op = (row.op ?? "").toLowerCase();
    const v = row.value;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      continue;
    }
    if (op === "read") {
      read += v;
      hit = true;
    } else if (op === "write") {
      write += v;
      hit = true;
    }
  }
  return hit ? { read, write } : { read: null, write: null };
}

export function cpuMemFromStats(stats: {
  cpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number; online_cpus?: number };
  precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number };
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
  blkio_stats?: { io_service_bytes_recursive?: BlkioRow[] | null };
}): CpuMem {
  const memBytes = stats.memory_stats?.usage ?? null;
  const memLimitBytes = stats.memory_stats?.limit ?? null;
  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const sysDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const ncpu = stats.cpu_stats?.online_cpus ?? 1;
  let cpuPercent: number | null = null;
  if (sysDelta > 0 && cpuDelta >= 0) {
    cpuPercent = (cpuDelta / sysDelta) * ncpu * 100;
  }
  const net = sumNet(stats.networks);
  const blk = sumBlkio(stats.blkio_stats?.io_service_bytes_recursive);
  return {
    cpuPercent,
    memBytes,
    memLimitBytes,
    netRxBytes: net.rx,
    netTxBytes: net.tx,
    blkReadBytes: blk.read,
    blkWriteBytes: blk.write,
  };
}
