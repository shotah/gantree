/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloneModal } from "@/app/components/crane/CloneModal";
import { suggestCloneSlug } from "@/lib/yard/crane/slug";

afterEach(() => {
  cleanup();
});

describe("CloneModal", () => {
  it("defaults settings on and persona/database off, with a -copy slug", async () => {
    const onClone = vi.fn().mockResolvedValue(null);
    render(<CloneModal sourceSlug="jules" busy={false} onClose={vi.fn()} onClone={onClone} />);
    expect(screen.getByRole("dialog", { name: "Clone jules" })).toBeTruthy();
    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe(suggestCloneSlug("jules"));
    expect(screen.getByRole("checkbox", { name: /settings/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: /persona files/ })).toHaveProperty("checked", false);
    expect(screen.getByRole("checkbox", { name: /database/ })).toHaveProperty("checked", false);
    expect(screen.getByText(/board tags/)).toBeTruthy();
    expect(screen.getByText(/gantry\.db/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clone" }));
    await waitFor(() =>
      expect(onClone).toHaveBeenCalledWith({
        slug: "jules-copy",
        settings: true,
        persona: false,
        database: false,
      }),
    );
  });

  it("lets troubleshooting copy persona and database without settings", async () => {
    const onClone = vi.fn().mockResolvedValue(null);
    render(<CloneModal sourceSlug="jules" busy={false} onClose={vi.fn()} onClone={onClone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /settings/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /persona files/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /database/ }));
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "jules-try" } });
    fireEvent.click(screen.getByRole("button", { name: "Clone" }));
    await waitFor(() =>
      expect(onClone).toHaveBeenCalledWith({
        slug: "jules-try",
        settings: false,
        persona: true,
        database: true,
      }),
    );
  });

  it("disables Clone when every part is unchecked and shows a returned error", async () => {
    const onClone = vi.fn().mockResolvedValue("crane taken already exists");
    render(<CloneModal sourceSlug="kit" busy={false} onClose={vi.fn()} onClone={onClone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /settings/ }));
    expect(screen.getByRole("button", { name: "Clone" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox", { name: /persona files/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clone" }));
    await waitFor(() => expect(screen.getByText("crane taken already exists")).toBeTruthy());
  });
});
