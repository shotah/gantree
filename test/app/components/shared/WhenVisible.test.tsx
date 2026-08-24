/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhenVisible } from "@/app/components/shared/WhenVisible";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WhenVisible", () => {
  it("mounts children when IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <WhenVisible>
        <p>plot</p>
      </WhenVisible>,
    );
    expect(screen.getByText("plot")).toBeTruthy();
    expect(screen.getByText("plot").parentElement?.className).toMatch(/w-full/);
    expect(screen.getByText("plot").parentElement?.className).toMatch(/min-w-0/);
  });

  it("holds children until the tile intersects", async () => {
    const io = {
      fire: (_on: boolean) => {
        /* assigned in mock */
      },
    };
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          io.fire = (on: boolean) => {
            const entry = { isIntersecting: on, target: document.body } as unknown as IntersectionObserverEntry;
            cb([entry], this as unknown as IntersectionObserver);
          };
        }

        observe() {
          io.fire(false);
        }

        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );

    render(
      <WhenVisible>
        <p>plot</p>
      </WhenVisible>,
    );
    expect(screen.queryByText("plot")).toBeNull();
    io.fire(true);
    await waitFor(() => expect(screen.getByText("plot")).toBeTruthy());
  });
});
