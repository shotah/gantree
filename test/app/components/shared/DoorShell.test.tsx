/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { usePathname, useSearchParams } from "next/navigation";
import { DoorShell } from "@/app/components/shared/DoorShell";

function search(query = ""): ReturnType<typeof useSearchParams> {
  return new URLSearchParams(query) as ReturnType<typeof useSearchParams>;
}

const you = {
  id: "1",
  name: "kit",
  displayName: "Kit",
  role: "admin" as const,
  cranes: [] as string[],
  avatarRev: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(usePathname).mockReturnValue("/");
  vi.mocked(useSearchParams).mockReturnValue(search());
});

function stubDoor(dev: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({ ready: true, operator: you, bindOpen: false, dev }),
    })),
  );
}

describe("DoorShell phone preview", () => {
  it("hides the phone mark when auth is not in GANTREE_DEV", async () => {
    stubDoor(false);
    render(
      <DoorShell>
        <p>board</p>
      </DoorShell>,
    );
    await waitFor(() => expect(screen.getByText("Kit")).toBeTruthy());
    expect(document.querySelector('a[href="/?phone=1"]')).toBeNull();
  });

  it("shows the phone mark on loopback GANTREE_DEV", async () => {
    stubDoor(true);
    render(
      <DoorShell>
        <p>board</p>
      </DoorShell>,
    );
    await waitFor(() => expect(screen.getByText("Kit")).toBeTruthy());
    expect(document.querySelector('a[href="/?phone=1"]')).toBeTruthy();
  });

  it("ignores ?phone=1 when auth is not in GANTREE_DEV", async () => {
    stubDoor(false);
    vi.mocked(useSearchParams).mockReturnValue(search("phone=1"));
    render(
      <DoorShell>
        <p>board</p>
      </DoorShell>,
    );
    await waitFor(() => expect(screen.getByText("Kit")).toBeTruthy());
    expect(document.querySelector("[data-shot=phone-preview]")).toBeNull();
    expect(screen.getByText("board")).toBeTruthy();
  });

  it("frames ?phone=1 when auth is in GANTREE_DEV", async () => {
    stubDoor(true);
    vi.mocked(useSearchParams).mockReturnValue(search("phone=1"));
    render(
      <DoorShell>
        <p>board</p>
      </DoorShell>,
    );
    await waitFor(() => expect(document.querySelector("[data-shot=phone-preview]")).toBeTruthy());
    expect(screen.queryByText("board")).toBeNull();
    expect(screen.getByTitle("phone preview")).toBeTruthy();
    expect(screen.getByLabelText("phone size")).toBeTruthy();
    expect(screen.getByText("390×844")).toBeTruthy();
    expect(screen.getByTitle("phone preview").getAttribute("style")).toMatch(/width: 390px/);
  });

  it("sizes the frame from ?phone=iphone-max", async () => {
    stubDoor(true);
    vi.mocked(useSearchParams).mockReturnValue(search("phone=iphone-max"));
    render(
      <DoorShell>
        <p>board</p>
      </DoorShell>,
    );
    await waitFor(() => expect(document.querySelector("[data-shot=phone-preview]")).toBeTruthy());
    expect(screen.getByDisplayValue("iPhone Max")).toBeTruthy();
    expect(screen.getByText("430×932")).toBeTruthy();
    expect(screen.getByTitle("phone preview").getAttribute("style")).toMatch(/width: 430px/);
  });
});
