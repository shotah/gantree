/** Loopback-only screenshot yard. Compose sets HOST=0.0.0.0 — that never paints. */

function envFlag(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function bindIsOpen(): boolean {
  const host = process.env.HOST || "127.0.0.1";
  return host === "0.0.0.0" || host === "::" || host === "[::]";
}

let warnedShotBind = false;
let warnedShotOn = false;

/** Paint toml cranes as running without a Docker daemon. Ignored on an open bind. */
export function shotDockerEnabled(): boolean {
  if (!envFlag(process.env.GANTREE_SHOT)) {
    return false;
  }
  if (bindIsOpen()) {
    if (!warnedShotBind) {
      warnedShotBind = true;
      console.warn("gantree: GANTREE_SHOT ignored — HOST is not loopback.");
    }
    return false;
  }
  if (!warnedShotOn) {
    warnedShotOn = true;
    console.warn("gantree: GANTREE_SHOT is on (loopback). Board paints toml cranes as running without Docker.");
  }
  return true;
}

/** Test helper. */
export function resetShotModeWarnings(): void {
  warnedShotBind = false;
  warnedShotOn = false;
}
