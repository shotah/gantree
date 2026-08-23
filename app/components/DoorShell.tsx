"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Door = {
  ready: boolean;
  operator: { id: string; name: string } | null;
};

export function DoorShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [door, setDoor] = useState<Door | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/door", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: Door) => {
        if (live) {
          setDoor(d);
        }
      })
      .catch(() => {
        if (live) {
          setDoor({ ready: false, operator: null });
        }
      });
    return () => {
      live = false;
    };
  }, [path]);

  const publicPage = path === "/login" || path === "/setup";
  let allow = false;
  let dest: string | null = null;
  if (door) {
    if (!door.ready) {
      if (path === "/setup") {
        allow = true;
      } else {
        dest = "/setup";
      }
    } else if (!door.operator) {
      if (path === "/login") {
        allow = true;
      } else {
        dest = "/login";
      }
    } else if (publicPage) {
      dest = "/";
    } else {
      allow = true;
    }
  }

  useEffect(() => {
    if (dest) {
      window.location.replace(dest);
    }
  }, [dest]);

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/login");
  }

  return (
    <>
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-amber-500">
            gantree
          </Link>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <p>shipping yard · not the chat</p>
            {door?.operator ? (
              <>
                <span className="text-zinc-400">{door.operator.name}</span>
                <button type="button" onClick={() => void logout()} className="text-amber-200/80 hover:text-amber-200">
                  log out
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      {allow ? children : <p className="px-6 py-10 text-sm text-zinc-500">opening the door…</p>}
    </>
  );
}
