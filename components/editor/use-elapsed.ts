"use client";

import { useEffect, useState } from "react";

/** Seconds since `startedAt` (updates twice a second). Returns 0 when not running. */
export function useElapsedSeconds(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.round((now - startedAt) / 1000));
}
