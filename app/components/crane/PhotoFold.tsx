"use client";

import { CraneAvatar } from "../shared/CraneAvatar";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import type { AgentDash } from "./useAgentDashboard";

function photoCopy(telegramOn: boolean, pendantOn: boolean): { hint: string; extra: string } {
  if (pendantOn) {
    return {
      hint: "persona/avatar.jpg — the pendant mouth uses this picture",
      extra: "Upload or Push to pendant sends it to the Worker face the phone shows.",
    };
  }
  if (telegramOn) {
    return {
      hint: "persona/avatar.jpg — Telegram uses this as the bot profile photo",
      extra: "Telegram bots get this picture as the profile photo.",
    };
  }
  return {
    hint: "persona/avatar.jpg — stored with the persona",
    extra: "The chat mouth gets it when you switch CHANNEL to telegram or pendant.",
  };
}

export function PhotoFold({ dash }: { dash: AgentDash }) {
  const { slug, gantry, mutate, busy, uploadPhoto, pushPhoto, telegramOn, pendantOn } = dash;
  const copy = photoCopy(telegramOn, pendantOn);
  const canPush = Boolean(gantry?.avatarRev) && (telegramOn || pendantOn);

  return (
    <DashFold
      title="Photo"
      persistKey={craneLayoutKey("photo")}
      shot="photo"
      hint={copy.hint}
    >
      <p className="mb-3 text-xs text-faint">
        Saved as
        {" "}
        <code className="text-dim">persona/avatar.jpg</code>
        .
        {" "}
        {copy.extra}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <CraneAvatar slug={slug} rev={gantry?.avatarRev ?? null} size="xl" />
        {mutate
          ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
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
                  {canPush
                    ? (
                        <button
                          type="button"
                          disabled={busy || !gantry?.personaDir}
                          onClick={() => void pushPhoto()}
                          className="rounded border border-edge px-3 py-1.5 text-xs text-body hover:border-accent disabled:opacity-50"
                        >
                          {pendantOn ? "Push to pendant" : "Push to Telegram"}
                        </button>
                      )
                    : null}
                </div>
                <p className="text-[11px] text-faint">JPEG, PNG, WebP, or GIF. PNG/WebP are converted on upload.</p>
              </div>
            )
          : null}
      </div>
    </DashFold>
  );
}
