"use client";

import { useState } from "react";
import { BOTFATHER_URL, suggestBotIdentity } from "@/lib/yard/host/telegram";

export function BotFatherHint({ slug }: { slug: string }) {
  const ident = suggestBotIdentity(slug);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-xs text-dim">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void copy("command", "/newbot");
            window.open(BOTFATHER_URL, "_blank", "noopener,noreferrer");
          }}
          className="rounded border border-accent-line bg-accent-soft px-2 py-1 text-mark hover:border-accent"
        >
          Create with BotFather
        </button>
        <a className="text-dim underline hover:text-mark" href={BOTFATHER_URL} target="_blank" rel="noreferrer">
          @BotFather
        </a>
      </div>
      <p>
        Telegram still mints the token. The button copies
        {" "}
        <code className="text-muted">/newbot</code>
        {" "}
        and opens the
        chat. Name
        {" "}
        <button type="button" className="text-mark/90 hover:underline" onClick={() => void copy("name", ident.name)}>
          {ident.name}
        </button>
        , username
        {" "}
        <button
          type="button"
          className="text-mark/90 hover:underline"
          onClick={() => void copy("username", ident.username)}
        >
          @
          {ident.username}
        </button>
        . Paste the token here when BotFather replies.
        {copied === "command" ? " /newbot copied." : null}
        {copied === "name" ? " name copied." : null}
        {copied === "username" ? " username copied." : null}
      </p>
    </div>
  );
}
