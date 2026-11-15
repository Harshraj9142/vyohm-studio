"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny shared store for the save indicator in the header.
 * (The header is rendered by Puck, so we can't pass props to it directly.)
 */

export type SaveStatus =
  | { kind: "saved"; at: number }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "unavailable" };

let status: SaveStatus = { kind: "pending" };
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}
