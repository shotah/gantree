"use client";

import { CraneAvatar } from "../shared/CraneAvatar";
import { craneFoldKey, DashFold } from "../shared/DashFold";
import type { AgentDash } from "./useAgentDashboard";

export function PhotoFold({ dash }: { dash: AgentDash }) {
  const { slug, gantry, mutate, busy, uploadPhoto } = dash;

  return (
    <DashFold
      title="Photo"
      persistKey={craneFoldKey(slug, "photo")}
      shot="photo"
      hint="persona/avatar.jpg — Telegram uses the same picture"
    >
      <p className="mb-3 text-xs text-zinc-600">
        Saved as
        {" "}
        <code className="text-zinc-500">persona/avatar.jpg</code>
        . Telegram bots get the same picture.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <CraneAvatar slug={slug} rev={gantry?.avatarRev ?? null} size="xl" />
        {mutate
          ? (
              <div className="flex flex-col gap-2">
                <label
                  className={`inline-flex w-fit rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 ${
                    busy || !gantry?.personaDir ? "opacity-50" : "cursor-pointer"
                  }`}
                >
                  Choose photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={busy || !gantry?.personaDir}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) {
                        void uploadPhoto(f);
                      }
                    }}
                  />
                </label>
                <p className="text-[11px] text-zinc-600">JPEG, PNG, WebP, or GIF. PNG/WebP are converted on upload.</p>
              </div>
            )
          : null}
      </div>
    </DashFold>
  );
}
