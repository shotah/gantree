"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jpegFromFile } from "@/app/lib/jpegFromFile";
import { yardFetch } from "@/app/lib/yardFetch";
import { shouldPushTelegram } from "@/lib/yard/host/telegram";
import {
  bucketsForWindow,
  filterSamples,
  windowStart,
  DEFAULT_SPEND_WINDOW,
  type SpendBucket,
  type SpendWindow,
} from "@/lib/yard/observe/spend";
import { optionalKeysForGrant, secretKeysForGrant } from "@/lib/yard/tools/packages";
import { DEFAULT_IMAGE, type CatalogEntry, type DoctorReport, type GantryCard, type McpSample, type McpServer, type ObservePrefs, type StatSample, type TurnSample, type UptimeSample } from "@/lib/yard/types";
import { useDoor } from "../shared/DoorShell";
import { envRow, SECRET_NAME, type EnvRow } from "./agentEnv";

export type CraneFiles = {
  persona: string | null;
  self: string | null;
  mcp: string | null;
  servers: McpServer[];
  env?: Record<string, EnvRow>;
  writable: boolean;
};

export function useAgentDashboard(slug: string) {
  const [gantry, setGantry] = useState<GantryCard | null>(null);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [denied, setDenied] = useState(false);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [host, setHost] = useState<StatSample[]>([]);
  const [turns, setTurns] = useState<TurnSample[]>([]);
  const [mcp, setMcp] = useState<McpSample[]>([]);
  const [uptime, setUptime] = useState<UptimeSample[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [observe, setObserve] = useState<ObservePrefs | null>(null);
  const [files, setFiles] = useState<CraneFiles | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [persona, setPersona] = useState("");
  const [self, setSelf] = useState("");
  const [personaFromTemplate, setPersonaFromTemplate] = useState(false);
  const [selfFromTemplate, setSelfFromTemplate] = useState(false);
  const [confirmPersonaReplace, setConfirmPersonaReplace] = useState(false);
  const [confirmSelfReplace, setConfirmSelfReplace] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState(DEFAULT_IMAGE);
  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({});
  const [confirmToken, setConfirmToken] = useState(false);
  const [envRecreateOpen, setEnvRecreateOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [destroyFiles, setDestroyFiles] = useState(false);
  const [authFor, setAuthFor] = useState<string | null>(null);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [spendWindow, setSpendWindow] = useState<SpendWindow>(DEFAULT_SPEND_WINDOW);
  const [spendBucket, setSpendBucket] = useState<SpendBucket>("cumulative");
  const [now, setNow] = useState(() => Date.now());
  const filesHydratedFor = useRef<string | null>(null);

  const refresh = useCallback(() => {
    yardFetch(`/api/gantries/${slug}`)
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) {
          setDenied(true);
          return;
        }
        const g = (await r.json()) as GantryCard & { error?: string; tagColors?: Record<string, string> };
        if (!g.error) {
          setDenied(false);
          setGantry(g);
          setTagColors(g.tagColors ?? {});
          if (g.image) {
            setPin(g.image);
          }
        }
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/doctor`)
      .then((r) => r.json())
      .then((d: DoctorReport) => setDoctor(d))
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/stats`)
      .then((r) => r.json())
      .then((s: { host: StatSample[]; turns: TurnSample[]; mcp: McpSample[]; uptime: UptimeSample[]; userNames?: Record<string, string>; observe?: ObservePrefs }) => {
        setHost(s.host ?? []);
        setTurns(s.turns ?? []);
        setMcp(s.mcp ?? []);
        setUptime(s.uptime ?? []);
        setUserNames(s.userNames ?? {});
        setObserve(s.observe ?? null);
        setNow(Date.now());
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/files`)
      .then((r) => r.json())
      .then((f: CraneFiles) => {
        setFiles(f);
        if (filesHydratedFor.current !== slug) {
          filesHydratedFor.current = slug;
          setPersona(f.persona ?? "");
          setSelf(f.self ?? "");
        }
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/grant`)
      .then((r) => r.json())
      .then((c: { catalog: CatalogEntry[] }) => setCatalog(c.catalog ?? []))
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    setNow(Date.now());
  }, [spendWindow]);

  async function destroy() {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeFiles: destroyFiles }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string; error?: string };
    if (!res.ok) {
      setNotice(data.detail || data.error || "could not destroy");
      setBusy(false);
      return;
    }
    window.location.replace("/");
  }

  async function cloneTo(choice: { slug: string; settings: boolean; persona: boolean; database: boolean }): Promise<string | null> {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(choice),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string; error?: string; slug?: string };
    if (!res.ok) {
      setBusy(false);
      return data.detail || data.error || "could not clone";
    }
    window.location.assign(`/gantries/${data.slug || choice.slug}`);
    return null;
  }

  async function act(action: string) {
    setBusy(true);
    setNotice(action === "recreate" || action === "pin" ? "recreating — waiting for doctor…" : null);
    const res = await yardFetch(`/api/gantries/${slug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, image: action === "pin" ? pin : undefined }),
    });
    const data = (await res.json()) as { detail?: string; error?: string };
    setNotice(data.detail || data.error || res.statusText);
    setBusy(false);
    refresh();
  }

  async function authOp(server: string, op: "start" | "exchange" | "wait") {
    setBusy(true);
    setAuthFor(server);
    const res = await yardFetch(`/api/gantries/${slug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server, op, code: op === "exchange" ? authCode : undefined }),
    });
    const data = (await res.json()) as { detail?: string; url?: string | null; error?: string };
    setAuthDetail(data.detail || data.error || res.statusText);
    setAuthUrl(data.url ?? null);
    setNotice(data.detail || data.error || "auth");
    if (op === "exchange" && res.ok) {
      setAuthCode("");
    }
    setBusy(false);
    refresh();
  }

  async function toggleGrant(name: string, on: boolean) {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, op: on ? "grant" : "revoke" }),
    });
    const data = (await res.json()) as { detail?: string; error?: string };
    setNotice(data.detail || data.error || res.statusText);
    setBusy(false);
    refresh();
  }

  async function fetchBins() {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "fetch" }),
    });
    const data = (await res.json()) as { detail?: string };
    setNotice(data.detail || res.statusText);
    setBusy(false);
    refresh();
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    setNotice(null);
    try {
      const jpeg = await jpegFromFile(file);
      const body = new FormData();
      body.append("file", jpeg, "avatar.jpg");
      const res = await yardFetch(`/api/gantries/${slug}/avatar`, { method: "POST", body });
      const data = (await res.json()) as { detail?: string; error?: string };
      setNotice(data.detail || data.error || res.statusText);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
    refresh();
  }

  async function loadTemplate(which: "persona" | "self") {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/files?templates=1`);
    const data = (await res.json().catch(() => ({}))) as {
      personaTemplate?: string;
      selfTemplate?: string;
      error?: string;
    };
    if (!res.ok) {
      setNotice(data.error || "could not load template");
      setBusy(false);
      return;
    }
    if (which === "persona") {
      setPersona(data.personaTemplate ?? "");
      setPersonaFromTemplate(true);
      setConfirmPersonaReplace(false);
      setNotice("PERSONA.md template loaded in the editor — not written until you confirm and Save");
    } else {
      setSelf(data.selfTemplate ?? "");
      setSelfFromTemplate(true);
      setConfirmSelfReplace(false);
      setNotice("SELF.md template loaded in the editor — not written until you confirm and Save");
    }
    setBusy(false);
  }

  async function saveMarkdown(which: "persona" | "self") {
    if (which === "persona" && personaFromTemplate && !confirmPersonaReplace) {
      return;
    }
    if (which === "self" && selfFromTemplate && !confirmSelfReplace) {
      return;
    }
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(which === "persona" ? { persona } : { self }),
    });
    const name = which === "persona" ? "PERSONA.md" : "SELF.md";
    setNotice(res.ok ? `${name} written — recreate to reload` : `could not write ${name}`);
    if (res.ok && which === "persona") {
      setPersonaFromTemplate(false);
      setConfirmPersonaReplace(false);
    }
    if (res.ok && which === "self") {
      setSelfFromTemplate(false);
      setConfirmSelfReplace(false);
    }
    setBusy(false);
    refresh();
  }

  async function saveEnv() {
    setBusy(true);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(secretDraft)) {
      if (SECRET_NAME.test(k) && v === "") {
        continue;
      }
      env[k] = v;
    }
    const res = await yardFetch(`/api/gantries/${slug}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env, confirmToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; saved?: string[] };
    if (res.ok) {
      setNotice("env written — recreate (do not just restart)");
      setSecretDraft({});
      setConfirmToken(false);
      setEnvRecreateOpen(true);
    } else if (data.saved?.length) {
      setNotice(`${data.saved.join(", ")} saved — check overwrite to write keys and tokens`);
    } else {
      setNotice(data.error || "env write refused");
    }
    setBusy(false);
    refresh();
  }

  async function saveTags(tags: string[], colors?: Record<string, string>) {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, tagColors: colors }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; tags?: string[]; tagColors?: Record<string, string> };
    setNotice(res.ok ? "tags saved" : data.error || "could not save tags");
    if (res.ok && gantry) {
      setGantry({ ...gantry, tags: data.tags ?? tags });
      if (data.tagColors) {
        setTagColors(data.tagColors);
      }
    }
    setBusy(false);
    refresh();
  }

  const granted = new Set((files?.servers ?? []).map((s) => s.name));
  const secretKeys = secretKeysForGrant([...granted], catalog, files?.servers ?? []);
  const optionalSecretKeys = new Set(optionalKeysForGrant([...granted], catalog));
  const missingSecrets = files
    ? secretKeys.filter((k) => {
      if (optionalSecretKeys.has(k)) {
        return false;
      }
      const row = envRow(k, files.env);
      return row.secret && !row.set;
    }).length
    : 0;
  const { operator } = useDoor();
  const admin = operator?.role === "admin";
  const mutate = Boolean(gantry?.canMutate || files?.writable);
  const canBuild = Boolean(gantry?.canBuild);
  const telegramOn
    = shouldPushTelegram(gantry?.channel ?? null)
      || shouldPushTelegram(files?.env?.CHANNEL?.value ?? null)
      || Boolean(files?.env?.TELEGRAM_BOT_TOKEN?.set);
  const since = windowStart(spendWindow, now);
  const allowedBuckets = bucketsForWindow(spendWindow);
  const bucket = allowedBuckets.includes(spendBucket) ? spendBucket : "cumulative";
  const turnsInWindow = filterSamples(turns, since, now);

  return {
    slug,
    gantry,
    tagColors,
    denied,
    doctor,
    host,
    turns,
    mcp,
    uptime,
    userNames,
    observe,
    files,
    catalog,
    persona,
    setPersona,
    self,
    setSelf,
    personaFromTemplate,
    selfFromTemplate,
    confirmPersonaReplace,
    setConfirmPersonaReplace,
    confirmSelfReplace,
    setConfirmSelfReplace,
    injectOpen,
    setInjectOpen,
    notice,
    setNotice,
    busy,
    setBusy,
    pin,
    setPin,
    secretDraft,
    setSecretDraft,
    confirmToken,
    setConfirmToken,
    envRecreateOpen,
    setEnvRecreateOpen,
    destroyOpen,
    setDestroyOpen,
    destroyFiles,
    setDestroyFiles,
    authFor,
    setAuthFor,
    authDetail,
    setAuthDetail,
    authUrl,
    setAuthUrl,
    authCode,
    setAuthCode,
    spendWindow,
    setSpendWindow,
    spendBucket,
    setSpendBucket,
    now,
    refresh,
    destroy,
    cloneTo,
    act,
    authOp,
    toggleGrant,
    fetchBins,
    uploadPhoto,
    loadTemplate,
    saveMarkdown,
    saveEnv,
    saveTags,
    granted,
    secretKeys,
    optionalSecretKeys,
    missingSecrets,
    admin,
    canBuild,
    mutate,
    telegramOn,
    since,
    allowedBuckets,
    bucket,
    turnsInWindow,
  };
}

export type AgentDash = ReturnType<typeof useAgentDashboard>;
