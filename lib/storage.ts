"use client";

import type { Data } from "@puckeditor/core";

/**
 * Browser storage using IndexedDB.
 *
 * Why IndexedDB and not localStorage?
 *  - localStorage only holds ~5 MB of text; one photo can be bigger than that.
 *  - IndexedDB can store real files (Blobs) and has a much larger quota.
 *
 * Limits (also documented in the README):
 *  - Data lives only in this browser profile. Another browser or device won't see it.
 *  - Clearing site data, or a private window, loses it.
 *  - One page per browser (key "current").
 */

const DB_NAME = "vyohm-studio";
const DB_VERSION = 1;
const PAGES = "pages";
const ASSETS = "assets";

export type StoredAsset = { id: string; blob: Blob; name: string; type: string };
export type StoredPage = { data: Data; savedAt: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PAGES)) db.createObjectStore(PAGES);
        if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("Could not open browser storage"));
      };
    });
  }
  return dbPromise;
}

/** Run one request inside a transaction and wait for the transaction to finish. */
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error("Storage transaction aborted"));
  });
}

// ---------------------------------------------------------------- Page

export async function savePage(data: Data): Promise<number> {
  const savedAt = Date.now();
  await run(PAGES, "readwrite", (s) => s.put({ data, savedAt } satisfies StoredPage, "current"));
  return savedAt;
}

export async function loadPage(): Promise<StoredPage | null> {
  const page = await run<StoredPage | undefined>(PAGES, "readonly", (s) => s.get("current"));
  if (!page || typeof page !== "object" || !page.data || typeof page.data !== "object") return null;
  return page;
}

export async function clearPage(): Promise<void> {
  await run(PAGES, "readwrite", (s) => s.delete("current"));
}

// ---------------------------------------------------------------- Assets (uploaded images)

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function saveAsset(file: File): Promise<StoredAsset> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please choose a PNG, JPG, WebP or GIF image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is larger than 8 MB. Please choose a smaller one.");
  }
  const asset: StoredAsset = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    blob: file,
    name: file.name,
    type: file.type,
  };
  await run(ASSETS, "readwrite", (s) => s.put(asset));
  return asset;
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  return run<StoredAsset[]>(ASSETS, "readonly", (s) => s.getAll());
}

// ---------------------------------------------------------------- Page info

/**
 * Small facts about the saved page, stored next to it.
 * `sampleChosen`: the user picked the sample page on purpose. Older versions saved the
 * sample automatically on the first visit; without this flag we treat such a page as
 * "no page chosen yet" and ask the user how to start (keeping it as an option).
 */
export type PageInfo = { sampleChosen?: boolean };

export async function loadPageInfo(): Promise<PageInfo> {
  const info = await run<PageInfo | undefined>(PAGES, "readonly", (s) => s.get("info"));
  return info && typeof info === "object" ? info : {};
}

export async function savePageInfo(info: PageInfo): Promise<void> {
  await run(PAGES, "readwrite", (s) => s.put(info, "info"));
}
