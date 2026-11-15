"use client";

// Puck (0.22+) loads its own CSS automatically, so we only import our styles.
import "@/components/site/site.css";
import "./editor.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  blocksPlugin,
  Button as PuckButton,
  outlinePlugin,
  Puck,
  useGetPuck,
  type Data,
  type Viewports,
} from "@puckeditor/core";
import { registerAssetUrl } from "@/components/site/assets";
import { getAllAssets, loadPage, loadPageInfo, savePage, savePageInfo } from "@/lib/storage";
import { aiPlugin } from "./ai-panel";
import { DragFeedback } from "./drag-feedback";
import { ExportButton } from "./export-button";
import { puckConfig } from "./puck-config";
import { makePage } from "@/lib/page-tree";
import { EditorWelcome } from "./EditorWelcome";
import { createStarterPage, SAMPLE_TITLE } from "./starter-page";
import { setSaveStatus, useSaveStatus } from "./save-status";

/** Preview widths. Mobile (390px) is below the 768px breakpoint, so mobile styles apply. */
const viewports: Viewports = [
  { width: 390, height: "auto", label: "Mobile", icon: "Smartphone" },
  { width: 820, height: "auto", label: "Tablet", icon: "Tablet" },
  { width: 1280, height: "auto", label: "Desktop", icon: "Monitor" },
];

const AUTOSAVE_DELAY_MS = 800;

/** Test hook for automated browser tests: on in development, or when built with NEXT_PUBLIC_TEST_HOOKS=1. */
const TEST_HOOKS =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_TEST_HOOKS === "1";

/**
 * Left rail tabs. Puck always adds Blocks and Outline first; listing them again
 * after our AI tab moves AI to the top.
 */
const plugins = [aiPlugin, blocksPlugin(), outlinePlugin()];

type LoadState =
  | { kind: "loading" }
  // No page chosen yet: let the user choose. `existing` = a sample saved automatically by an older version.
  | { kind: "welcome"; storageOk: boolean; notice?: string; existing?: { data: Data; savedAt: number } }
  | { kind: "ready"; data: Data; storageOk: boolean; notice?: string; firstTab?: string };

const STORAGE_NOTICE = "Browser storage is unavailable (private window?). Changes will not be saved.";

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
        const info = await loadPageInfo();
        const wantsSample = new URLSearchParams(window.location.search).has("sample"); // used by tests
        if (cancelled) return;

        // A sample page the user never chose (saved automatically by an older version)
        // counts as "no page yet": ask, but keep it available as "Continue with this page".
        const title = (saved?.data.root.props as { title?: unknown } | undefined)?.title;
        const autoSavedSample = !!saved && title === SAMPLE_TITLE && !info.sampleChosen && !wantsSample;

        if (saved && !autoSavedSample) {
          setSaveStatus({ kind: "saved", at: saved.savedAt });
          setLoad({ kind: "ready", data: saved.data, storageOk: true });
          return;
        }
        // No page yet. Never show a page the user didn't ask for: offer a choice instead.
        // (/editor?sample=1 opens the sample directly, used by the automated tests.)
        if (wantsSample) {
          const data = createStarterPage();
          const savedAt = await savePage(data);
          await savePageInfo({ sampleChosen: true });
          if (cancelled) return;
          setSaveStatus({ kind: "saved", at: savedAt });
          setLoad({ kind: "ready", data, storageOk: true });
          return;
        }
        setLoad({ kind: "welcome", storageOk: true, existing: saved ?? undefined });
      } catch (error) {
        console.error("Could not open browser storage", error);
        if (cancelled) return;
        setSaveStatus({ kind: "unavailable" });
        setLoad({ kind: "welcome", storageOk: false, notice: STORAGE_NOTICE });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Welcome screen choices: a blank page, the sample page, or continue with an older sample.
  async function begin(data: Data, firstTab: string, sampleChosen: boolean, alreadySavedAt?: number) {
    if (load.kind !== "welcome") return;
    const ok = load.storageOk;
    if (ok) {
      try {
        const at = alreadySavedAt ?? (await savePage(data));
        await savePageInfo({ sampleChosen });
        setSaveStatus({ kind: "saved", at });
      } catch {
        setSaveStatus({ kind: "error", message: "Save failed — storage may be full." });
      }
    }
    setLoad({ kind: "ready", data, storageOk: ok, notice: load.notice, firstTab });
  }

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

  if (load.kind === "welcome") {
    return (
      <EditorWelcome
        notice={load.notice}
        onBlank={() => void begin(makePage({ title: "My landing page" }, []), "blocks", false)}
        onSample={() => void begin(createStarterPage(), "ai", true)}
        existing={
          load.existing
            ? {
                title: String((load.existing.data.root.props as { title?: unknown }).title ?? "your page"),
                onContinue: () => void begin(load.existing!.data, "ai", true, load.existing!.savedAt),
              }
            : undefined
        }
      />
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
        ui={{ plugin: { current: load.firstTab ?? "ai" } }}
        viewports={viewports}
        iframe={{ enabled: true }}
        // Headings, paragraphs and button labels are editable text: pressing on them places the
        // cursor instead of starting a drag. The handle (⠿) in the action bar drags any element.
        dnd={{ enableDragHandle: true }}
        headerTitle="Vyohm Studio"
        dictionary={{ "header-publish": "Save", "action-drag": "Drag to move" }}
        overrides={{
          // Puck's own "Publish" button (with a globe icon) is replaced by our Save button.
          headerActions: () => (
            <>
              {TEST_HOOKS ? <DevTestHook /> : null}
              <DragFeedback />
              <SaveIndicator />
              {/* Back to the chat to generate a new page from a description. */}
              <PuckButton href="/start" variant="secondary" icon={<SparkleIcon />}>
                New page
              </PuckButton>
              <ExportButton />
              <SaveButton onSave={save} />
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
      <i className="ed-save__dot" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Saves right away (the page also saves itself shortly after every change). */
function SaveButton({ onSave }: { onSave: (data: Data) => void }) {
  const getPuck = useGetPuck();
  return (
    <PuckButton type="button" icon={<SaveIcon />} onClick={() => onSave(getPuck().appState.data)}>
      Save
    </PuckButton>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </svg>
  );
}

/**
 * Test hook: exposes Puck's API as window.__vsPuck so automated browser tests can
 * dispatch the same actions the UI does (e.g. "move" after a drag).
 * Off in normal production builds (see TEST_HOOKS).
 */
function DevTestHook() {
  const getPuck = useGetPuck();
  useEffect(() => {
    (window as unknown as { __vsPuck?: typeof getPuck }).__vsPuck = getPuck;
  }, [getPuck]);
  return null;
}
