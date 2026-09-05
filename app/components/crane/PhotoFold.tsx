"use client";

import { CraneAvatar } from "../shared/CraneAvatar";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import type { AgentDash } from "./useAgentDashboard";

export function PhotoFold({ dash }: { dash: AgentDash }) {
  const { slug, gantry, mutate, busy, uploadPhoto } = dash;

  return (
    <DashFold
      title="Photo"
      persistKey={craneLayoutKey("photo")}
      shot="photo"
      hint="persona/avatar.jpg — Telegram and the pendant mouth use the same picture"
    >
      <p className="mb-3 text-xs text-faint">
        Saved as
        {" "}
        <code className="text-dim">persona/avatar.jpg</code>
        . Telegram bots and the pendant mouth get the same picture.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <CraneAvatar slug={slug} rev={gantry?.avatarRev ?? null} size="xl" />
        {mutate
          ? (
              <div className="flex flex-col gap-2">
                <label
                  className={`inline-flex w-fit rounded border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-mark hover:border-accent ${
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
                <p className="text-[11px] text-faint">JPEG, PNG, WebP, or GIF. PNG/WebP are converted on upload.</p>
              </div>
            )
          : null}
      </div>
    </DashFold>
  );
}
