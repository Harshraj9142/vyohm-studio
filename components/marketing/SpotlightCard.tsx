"use client";

import type { PointerEvent, ReactNode } from "react";

/**
 * A card with a soft light that follows the pointer (idea from 21st.dev
 * "Feature Grid Spotlight Cards"). The CSS reads --mx / --my.
 */
export function SpotlightCard({ className, children }: { className?: string; children: ReactNode }) {
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }
  return (
    <div className={className} onPointerMove={onPointerMove}>
      {children}
    </div>
  );
}
