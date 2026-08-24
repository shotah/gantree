"use client";

import { HINTS } from "@/lib/yard/hints";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import { HintField } from "../shared/HintField";
import type { AgentDash } from "./useAgentDashboard";

export function ToolsFold({ dash }: { dash: AgentDash }) {
  const {
    catalog,
    files,
    granted,
    mutate,
    busy,
    authFor,
    authDetail,
    authUrl,
    authCode,
    setAuthFor,
    setAuthDetail,
    setAuthUrl,
    setAuthCode,
    toggleGrant,
    authOp,
    fetchBins,
  } = dash;

  return (
    <DashFold
      title="Tools"
      persistKey={craneLayoutKey("tools")}
      summary={`${granted.size} granted`}
      hint="mcp.toml — recreate fetches bins"
    >
      <p className="mb-3 text-xs text-faint">
        Toggle writes mcp.toml. Recreate fetches bins into /data/bin and reloads MCP.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !mutate}
          onClick={() => void fetchBins()}
          className="rounded border border-edge px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50"
        >
          tools-fetch
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((c) => {
          const on = granted.has(c.name);
          const needsAuth = Boolean(c.auth_args?.length) && on;
          const open = authFor === c.name;
          return (
            <div key={c.name} className="flex flex-col gap-2 rounded border border-line px-3 py-2 text-sm">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={on} disabled={busy || !mutate || !files?.writable} onChange={() => toggleGrant(c.name, !on)} />
                <span className="flex-1">
                  <span className="font-medium text-fg">{c.name}</span>
                  <span className="block text-xs text-dim">{c.blurb}</span>
                  {c.envKeys?.length
                    ? (
                        <span className="block font-mono text-[11px] text-faint">{c.envKeys.join(", ")}</span>
                      )
                    : null}
                  {c.optionalEnvKeys?.length
                    ? (
                        <span className="block font-mono text-[11px] text-faint">
                          optional
                          {c.optionalEnvKeys.join(", ")}
                        </span>
                      )
                    : null}
                </span>
                {needsAuth && mutate
                  ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setAuthFor(open ? null : c.name);
                          setAuthDetail(null);
                          setAuthUrl(null);
                        }}
                        className="rounded border border-accent-line px-2 py-1 text-xs text-mark"
                      >
                        needs auth
                      </button>
                    )
                  : null}
              </div>
              {needsAuth && open
                ? (
                    <div className="ml-7 space-y-2 rounded border border-line bg-canvas/80 p-2 text-xs">
                      <p className="text-muted">
                        After
                        {" "}
                        <code className="text-mark">
                          /auth
                          {c.name}
                        </code>
                        {" "}
                        in Telegram, paste the code here. Or start a hop
                        from this console (catch page:
                        {" "}
                        <a className="text-mark underline" href="https://shotah.github.io/ai-gantry/oauth-catch/" target="_blank" rel="noreferrer">
                          oauth-catch
                        </a>
                        ).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => authOp(c.name, "start")}
                          className="rounded border border-edge px-2 py-1 hover:border-accent disabled:opacity-50"
                        >
                          start hop
                        </button>
                        {c.authFlow === "device"
                          ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => authOp(c.name, "wait")}
                                className="rounded border border-edge px-2 py-1 hover:border-accent disabled:opacity-50"
                              >
                                wait (device poll)
                              </button>
                            )
                          : null}
                      </div>
                      {authUrl
                        ? (
                            <p>
                              <a className="break-all text-mark underline" href={authUrl} target="_blank" rel="noreferrer">
                                {authUrl}
                              </a>
                            </p>
                          )
                        : null}
                      {authDetail ? <p className="whitespace-pre-wrap text-dim">{authDetail}</p> : null}
                      {c.authFlow === "device"
                        ? null
                        : (
                            <div className="flex flex-wrap items-end gap-2">
                              <HintField label="auth code" className="min-w-0 flex-1 sm:min-w-40" {...HINTS.authCode}>
                                <input
                                  className="w-full rounded border border-line bg-panel px-2 py-1"
                                  placeholder={c.authFlow === "mfa" ? "MFA code from email" : "paste code"}
                                  value={authCode}
                                  onChange={(e) => setAuthCode(e.target.value)}
                                />
                              </HintField>
                              <button
                                type="button"
                                disabled={busy || !authCode.trim()}
                                onClick={() => authOp(c.name, "exchange")}
                                className="rounded border border-accent-line px-2 py-1 text-mark disabled:opacity-50"
                              >
                                submit code
                              </button>
                            </div>
                          )}
                    </div>
                  )
                : null}
            </div>
          );
        })}
      </div>
    </DashFold>
  );
}
