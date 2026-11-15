"use client";

// Puck (0.22+) loads its own CSS automatically, so we only import our styles.
import "@/components/site/site.css";
import "./editor.css";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { blocksPlugin, outlinePlugin, Puck, type Data, type Viewports } from "@puckeditor/core";
import { registerAssetUrl } from "@/components/site/assets";
import { getAllAssets, loadPage, savePage } from "@/lib/storage";
import { aiPlugin } from "./ai-panel";
import { puckConfig } from "./puck-config";
import { createStarterPage } from "./starter-page";
import { setSaveStatus, useSaveStatus } from "./save-status";

/** Preview widths. Mobile (390px) is below the 768px breakpoint, so mobile styles apply. */
const viewports: Viewports = [
  { width: 390, height: "auto", label: "Mobile", icon: "Smartphone" },
  { width: 820, height: "auto", label: "Tablet", icon: "Tablet" },
  { width: 1280, height: "auto", label: "Desktop", icon: "Monitor" },
];

const AUTOSAVE_DELAY_MS = 800;

/**
 * Left rail tabs. Puck always adds Blocks and Outline first; listing them again
 * after our AI tab moves AI to the top.
 */
const plugins = [aiPlugin, blocksPlugin(), outlinePlugin()];

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: Data; storageOk: boolean; notice?: string };

export function Editor() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  // 1. On first open: load uploaded images and the saved page from the browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assets = await getAllAssets();
        for (const asset of assets) registerAssetUrl(asset.id, URL.createObjectURL(asset.blob));
        const saved = await loadPage();
        // First visit: save the starter page right away so a reload shows the same page.
        const data = saved?.data ?? createStarterPage();
        const savedAt = saved?.savedAt ?? (await savePage(data));
        if (cancelled) return;
        setSaveStatus({ kind: "saved", at: savedAt });
        setLoad({ kind: "ready", data, storageOk: true });
      } catch (error) {
        console.error("Could not open browser storage", error);
        if (cancelled) return;
        setSaveStatus({ kind: "unavailable" });
        setLoad({
          kind: "ready",
          data: createStarterPage(),
          storageOk: false,
          notice: "Browser storage is unavailable (private window?). Changes will not be saved.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Save: called by the Save button, and automatically shortly after each change.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageOk = load.kind === "ready" && load.storageOk;

  const save = useCallback(
    async (data: Data) => {
      if (!storageOk) return;
      if (timer.current) clearTimeout(timer.current);
      setSaveStatus({ kind: "saving" });
      try {
        const at = await savePage(data);
        setSaveStatus({ kind: "saved", at });
      } catch (error) {
        console.error("Save failed", error);
        setSaveStatus({ kind: "error", message: "Save failed — storage may be full." });
      }
    },
    [storageOk],
  );

  const scheduleSave = useCallback(
    (data: Data) => {
      if (!storageOk) return;
      setSaveStatus({ kind: "pending" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(data), AUTOSAVE_DELAY_MS);
    },
    [save, storageOk],
  );

  if (load.kind === "loading") {
    return (
      <div className="ed-loading" role="status">
        Loading your page…
      </div>
    );
  }

  return (
    <>
      {load.notice ? <div className="ed-banner ed-banner--warn">{load.notice}</div> : null}
      <Puck
        config={puckConfig}
        data={load.data}
        onChange={scheduleSave}
        onPublish={save}
        plugins={plugins}
        ui={{ plugin: { current: "ai" } }}
        viewports={viewports}
        iframe={{ enabled: true }}
        headerTitle="Vyohm Studio"
        dictionary={{ "header-publish": "Save" }}
        overrides={{
          headerActions: ({ children }: { children: ReactNode }) => (
            <>
              <SaveIndicator />
              {children}
            </>
          ),
        }}
      />
    </>
  );
}

function SaveIndicator() {
  const status = useSaveStatus();
  const text =
    status.kind === "saved"
      ? `Saved ${new Date(status.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : status.kind === "saving"
        ? "Saving…"
        : status.kind === "pending"
          ? "Unsaved changes"
          : status.kind === "unavailable"
            ? "Not saving (no storage)"
            : status.message;
  return (
    <span className={`ed-save ed-save--${status.kind}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}
