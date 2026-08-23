"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const waiters: Array<{ live: () => boolean; run: () => void }> = [];
let ticking = false;

function enqueue(live: () => boolean, run: () => void): void {
  waiters.push({ live, run });
  if (ticking) {
    return;
  }
  ticking = true;
  const tick = () => {
    while (waiters.length > 0 && !waiters[0].live()) {
      waiters.shift();
    }
    const next = waiters.shift();
    if (next) {
      next.run();
    }
    if (waiters.length > 0) {
      requestAnimationFrame(tick);
    } else {
      ticking = false;
    }
  };
  requestAnimationFrame(tick);
}

/** Mount children when the tile is near the viewport, one Recharts tree per frame. */
export function WhenVisible({
  children,
  rootMargin = "320px 0px",
}: {
  children: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    let live = true;
    const still = () => live;
    const reveal = () => {
      if (live) {
        setShow(true);
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) {
          return;
        }
        io.disconnect();
        enqueue(still, reveal);
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [show, rootMargin]);

  return (
    <div ref={ref} className="h-full" data-chart={show ? "on" : "off"}>
      {show ? children : null}
    </div>
  );
}

export function ChartSkeleton({ n, className = "grid gap-3 md:grid-cols-2" }: { n: number; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-40 rounded-lg border border-zinc-800 bg-zinc-900/50 max-sm:h-52" />
      ))}
    </div>
  );
}
