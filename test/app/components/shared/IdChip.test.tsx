/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdChip } from "@/app/components/shared/IdChip";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  cleanup();
});

describe("IdChip", () => {
  it("copies the full id and does not remove on copy", async () => {
    const onRemove = vi.fn();
    render(<IdChip id="103068657459963188974" extra="139t" onRemove={onRemove} />);
    expect(screen.getByText("103068657459963188974")).toBeTruthy();
    expect(screen.getByText("139t")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "copy 103068657459963188974" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("103068657459963188974"));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "remove 103068657459963188974" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
