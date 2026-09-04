#!/usr/bin/env node
/**
 * Screenshot yard: 5 operators, 5 named cranes, host + token series, mock corkboard.
 *
 *   npm run seed
 *   GANTREE_SHOT=1 GANTREE_DEV=1 npm run dev
 */
import { seedYard, parseSeedArgs } from "@/lib/yard/shot/seed";

const args = parseSeedArgs(process.argv.slice(2));
if (args.help) {
  console.log(`npm run seed

Writes operators, gantries/<slug>/, gantree.toml, observe samples, and a
mock ./boards corkboard into this checkout (gantree.db is gitignored). Then:

  GANTREE_SHOT=1 GANTREE_DEV=1 GANTREE_DEV_OPERATOR=bob GANTREE_DEV_PASSPHRASE=bob-dev-ok npm run dev

GANTREE_SHOT paints toml cranes as running without Docker (loopback only).
On Arch/SteamOS, a real daemon is DOCKER_SOCKET=$XDG_RUNTIME_DIR/docker.sock
— unset GANTREE_SHOT to use it.
`);
  process.exit(0);
}

const report = seedYard();
console.log(`seeded ${report.cranes.join(", ")}`);
console.log(`operators ${report.operators.map((o) => o.name).join(", ")}`);
console.log(`root ${report.root}`);
console.log("next: GANTREE_SHOT=1 GANTREE_DEV=1 npm run dev");
