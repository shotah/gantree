/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentDashboard } from "./AgentDashboard";
import { card } from "../../test/yard/card";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

vi.mock("./LogViewer", () => ({ LogViewer: () => null }));
vi.mock("./EventStrip", () => ({ EventStrip: () => null }));
vi.mock("./TelegramBot", () => ({ TelegramBot: () => null }));
vi.mock("./DoctorPanel", () => ({ DoctorPanel: () => null }));
vi.mock("./MetricCharts", () => ({ MetricCharts: () => null }));

import { yardFetch } from "../lib/yardFetch";

function json(data: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => data,
  } as Response);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function mockCrane(
  files: {
    persona: string | null;
    self: string | null;
    writable: boolean;
    env?: Record<string, { set: boolean; secret: boolean; value: string }>;
  },
  canMutate = true,
) {
  const puts: unknown[] = [];
  const disk = { ...files };
  vi.mocked(yardFetch).mockImplementation((input, init) => {
    const u = String(input);
    if (u.includes("/files") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as {
        persona?: string;
        self?: string;
        env?: Record<string, string>;
        confirmToken?: boolean;
      };
      puts.push(body);
      if (typeof body.persona === "string") {
        disk.persona = body.persona;
      }
      if (typeof body.self === "string") {
        disk.self = body.self;
      }
      if (body.env) {
        const secret = (k: string) => /TOKEN|KEY|SECRET|PASSWORD/i.test(k);
        const touching = Object.entries(body.env).some(([k, v]) => secret(k) && v);
        const applied = touching && !body.confirmToken
          ? Object.fromEntries(Object.entries(body.env).filter(([k, v]) => !(secret(k) && v)))
          : body.env;
        disk.env = disk.env ?? {};
        for (const [k, v] of Object.entries(applied)) {
          if (secret(k) && v === "") {
            continue;
          }
          disk.env[k] = { set: v.trim().length > 0, secret: secret(k), value: secret(k) ? "" : v };
        }
        if (touching && !body.confirmToken) {
          return json(
            { error: "confirmToken required to write secrets", saved: Object.keys(applied).filter((k) => !secret(k)) },
            400,
          );
        }
      }
      return json({ ok: true });
    }
    if (u.includes("/files") && u.includes("templates=1")) {
      return json({
        personaTemplate: "# PERSONA.md\n\n- **Name:** Noodles\n",
        selfTemplate: "# SELF.md — Who You Are Becoming\n",
      });
    }
    if (u.includes("/files")) {
      return json({
        persona: disk.persona,
        self: disk.self,
        mcp: "",
        servers: [],
        env: disk.env ?? {},
        writable: disk.writable,
      });
    }
    if (u.includes("/doctor")) {
      return json({ slug: "noodles", ok: true, checks: [] });
    }
    if (u.includes("/stats")) {
      return json({ host: [], turns: [], mcp: [], uptime: [] });
    }
    if (u.includes("/grant")) {
      return json({ catalog: [] });
    }
    if (u === "/api/gantries/noodles") {
      return json(card({ slug: "noodles", channel: "stdio", canMutate, personaDir: "/tmp/persona" }));
    }
    return json({});
  });
  return puts;
}

describe("AgentDashboard persona files", () => {
  it("loads PERSONA.md and SELF.md into separate saveable editors", async () => {
    const puts = mockCrane({
      persona: "# who you are\n",
      self: "# who I am\n",
      writable: true,
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Persona/ }));
    await waitFor(() => expect(screen.getByLabelText("PERSONA.md")).toBeTruthy());
    expect((screen.getByLabelText("PERSONA.md") as HTMLTextAreaElement).value).toBe("# who you are\n");
    expect((screen.getByLabelText("SELF.md") as HTMLTextAreaElement).value).toBe("# who I am\n");

    fireEvent.change(screen.getByLabelText("PERSONA.md"), { target: { value: "# Ada's agent\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save PERSONA.md" }));
    await waitFor(() => expect(puts).toContainEqual({ persona: "# Ada's agent\n" }));
    await waitFor(() => expect(screen.getByText("PERSONA.md written — recreate to reload")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("SELF.md"), { target: { value: "# distilled voice\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save SELF.md" }));
    await waitFor(() => expect(puts).toContainEqual({ self: "# distilled voice\n" }));
    await waitFor(() => expect(screen.getByText("SELF.md written — recreate to reload")).toBeTruthy());
  });

  it("lets SELF.md be saved even when the crane was created without one", async () => {
    const puts = mockCrane({
      persona: "# noodles\n\nA long-horizon personal agent.\n",
      self: null,
      writable: true,
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Persona/ }));
    await waitFor(() => expect(screen.getByLabelText("SELF.md")).toBeTruthy());
    expect((screen.getByLabelText("SELF.md") as HTMLTextAreaElement).value).toBe("");

    fireEvent.change(screen.getByLabelText("SELF.md"), { target: { value: "# first self\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save SELF.md" }));
    await waitFor(() => expect(puts).toContainEqual({ self: "# first self\n" }));
  });

  it("keeps both editors read-only when the files API is not writable", async () => {
    mockCrane(
      {
        persona: "# you\n",
        self: "# me\n",
        writable: false,
      },
      false,
    );
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Persona/ }));
    await waitFor(() => expect(screen.getByLabelText("PERSONA.md")).toBeTruthy());
    expect(screen.getByLabelText("PERSONA.md")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("SELF.md")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Save PERSONA.md" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Save SELF.md" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Replace PERSONA.md from template" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Replace SELF.md from template" })).toHaveProperty("disabled", true);
  });

  it("loads the template into the editor and does not write until confirm and save", async () => {
    const puts = mockCrane({
      persona: "# who you are\n",
      self: "# who I am\n",
      writable: true,
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Persona/ }));
    await waitFor(() => expect(screen.getByLabelText("PERSONA.md")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Replace PERSONA.md from template" }));
    await waitFor(() =>
      expect((screen.getByLabelText("PERSONA.md") as HTMLTextAreaElement).value).toContain("**Name:** Noodles"),
    );
    expect(puts).toEqual([]);
    expect((screen.getByLabelText("SELF.md") as HTMLTextAreaElement).value).toBe("# who I am\n");
    expect(screen.getByRole("button", { name: "Save PERSONA.md" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox", { name: /overwrite PERSONA.md when I save/ }));
    expect(screen.getByRole("button", { name: "Save PERSONA.md" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Save PERSONA.md" }));
    await waitFor(() =>
      expect(puts).toContainEqual({ persona: "# PERSONA.md\n\n- **Name:** Noodles\n" }),
    );
  });
});

describe("AgentDashboard secrets", () => {
  it("calls out blank bot token and LLM key instead of looking pre-filled", async () => {
    mockCrane({ persona: "# you\n", self: "# me\n", writable: true });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Secrets/ }));
    await waitFor(() => expect(screen.getByLabelText("LLM_API_KEY")).toBeTruthy());

    const llm = screen.getByLabelText("LLM_API_KEY") as HTMLInputElement;
    const token = screen.getByLabelText("TELEGRAM_BOT_TOKEN") as HTMLInputElement;
    expect(llm.type).toBe("text");
    expect(llm.placeholder).toBe("needs a key");
    expect(token.type).toBe("text");
    expect(token.placeholder).toBe("needs a token");
    expect(screen.getByText("needs a key")).toBeTruthy();
    expect(screen.getByText("needs a token")).toBeTruthy();
    expect(screen.getByRole("button", { name: /2 need a key/ })).toBeTruthy();
  });

  it("keeps dots for an existing secret and still flags a missing one", async () => {
    mockCrane({
      persona: "# you\n",
      self: "# me\n",
      writable: true,
      env: {
        LLM_API_KEY: { set: true, secret: true, value: "" },
        TELEGRAM_BOT_TOKEN: { set: false, secret: true, value: "" },
      },
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Secrets/ }));
    await waitFor(() => expect(screen.getByLabelText("LLM_API_KEY")).toBeTruthy());

    const llm = screen.getByLabelText("LLM_API_KEY") as HTMLInputElement;
    const token = screen.getByLabelText("TELEGRAM_BOT_TOKEN") as HTMLInputElement;
    expect(llm.type).toBe("password");
    expect(llm.placeholder).toBe("••••••••");
    expect(token.type).toBe("text");
    expect(token.placeholder).toBe("needs a token");
    expect(screen.getByRole("button", { name: /needs a key/ })).toBeTruthy();

    fireEvent.change(token, { target: { value: "123:abc" } });
    expect((screen.getByLabelText("TELEGRAM_BOT_TOKEN") as HTMLInputElement).type).toBe("password");
  });

  it("shows the stored LLM_BASE_URL in the field and flags a non-URL", async () => {
    mockCrane({
      persona: "# you\n",
      self: "# me\n",
      writable: true,
      env: {
        LLM_BASE_URL: { set: true, secret: false, value: "nura-assaf" },
      },
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Secrets/ }));
    await waitFor(() => expect(screen.getByLabelText("LLM_BASE_URL")).toBeTruthy());
    const url = screen.getByLabelText("LLM_BASE_URL") as HTMLInputElement;
    expect(url.value).toBe("nura-assaf");
    expect(url.type).toBe("text");
    expect(screen.getByText("not a URL")).toBeTruthy();
  });

  it("saves a typed URL even when a token write is refused without confirm", async () => {
    const puts = mockCrane({
      persona: "# you\n",
      self: "# me\n",
      writable: true,
      env: {
        LLM_BASE_URL: { set: true, secret: false, value: "nura-assaf" },
        LLM_API_KEY: { set: false, secret: true, value: "" },
      },
    });
    render(<AgentDashboard slug="noodles" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "noodles" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Secrets/ }));
    await waitFor(() => expect(screen.getByLabelText("LLM_BASE_URL")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("LLM_BASE_URL"), {
      target: { value: "https://generativelanguage.googleapis.com/v1beta/openai/" },
    });
    fireEvent.change(screen.getByLabelText("LLM_API_KEY"), { target: { value: "AIzaSy-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save .env" }));

    await waitFor(() =>
      expect(puts).toContainEqual({
        env: {
          LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
          LLM_API_KEY: "AIzaSy-test",
        },
        confirmToken: false,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("LLM_BASE_URL saved — check overwrite to write keys and tokens")).toBeTruthy(),
    );
    expect((screen.getByLabelText("LLM_BASE_URL") as HTMLInputElement).value).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
    expect((screen.getByLabelText("LLM_API_KEY") as HTMLInputElement).value).toBe("AIzaSy-test");
  });
});
