"use client";

import { useRef, useState } from "react";
import { useGetPuck, type Data, type Plugin } from "@puckeditor/core";
import { findPageProblem } from "@/lib/page-schema";
import { EditPanel } from "./ai-edit-panel";
import { useElapsedSeconds } from "./use-elapsed";

/**
 * The "AI" tab in the editor's left rail.
 *
 * Generate flow:
 *  1. Remember the page as it is now.
 *  2. POST the brief to /api/generate (Claude runs on the server).
 *  3. Validate the returned page again here in the browser.
 *  4. If the user edited the page while Claude was working, ask before replacing.
 *  5. Apply with Puck's "setData" action, which is recorded in undo history.
 */

const EXAMPLE_BRIEF =
  "Create a landing page for a premium clothing brand called Loom & Line. Use a black-and-gold theme, highlight three product collections, and add a contact button.";

type GenerateState =
  | { kind: "idle" }
  | { kind: "loading"; startedAt: number }
  | { kind: "error"; message: string }
  | { kind: "conflict"; data: Data }
  | { kind: "done"; message: string };

const snapshot = (data: Data) => JSON.stringify(data);

function GeneratePanel() {
  const getPuck = useGetPuck();
  const [brief, setBrief] = useState("");
  const [state, setState] = useState<GenerateState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const loading = state.kind === "loading";

  function apply(data: Data) {
    const { dispatch } = getPuck();
    dispatch({ type: "setUi", ui: { itemSelector: null } }); // deselect (not an undo step)
    // Puck does NOT record setData in undo history by default, so we ask it to.
    // That makes "Undo" bring back the previous page.
    dispatch({ type: "setData", data, recordHistory: true });
    setState({ kind: "done", message: "New page generated. Use Undo (top right) to go back." });
  }

  async function generate() {
    const before = snapshot(getPuck().appState.data);
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "loading", startedAt: Date.now() });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: brief }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as { data?: Data; error?: string } | null;
      if (!response.ok || !result?.data) {
        throw new Error(result?.error ?? `The request failed (HTTP ${response.status}).`);
      }

      // Never trust the network blindly: validate again before touching the editor.
      const problem = findPageProblem(result.data);
      if (problem) throw new Error(`The AI result was rejected: ${problem}`);

      if (snapshot(getPuck().appState.data) !== before) {
        setState({ kind: "conflict", data: result.data });
        return;
      }
      apply(result.data);
    } catch (error) {
      if (controller.signal.aborted) {
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      abortRef.current = null;
    }
  }

  const tooShort = brief.trim().length < 10;

  return (
    <section className="ed-ai-card" aria-labelledby="ed-ai-generate-title">
      <h2 id="ed-ai-generate-title" className="ed-ai-title">
        Generate a page
      </h2>
      <p className="ed-ai-help">
        Describe your business, the style you like and what the page should show.
      </p>
      <label className="ed-visually-hidden" htmlFor="ed-ai-brief">
        Business description
      </label>
      <textarea
        id="ed-ai-brief"
        className="ed-input ed-ai-textarea"
        rows={4}
        placeholder={EXAMPLE_BRIEF}
        value={brief}
        disabled={loading}
        onChange={(e) => setBrief(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !tooShort && !loading) void generate();
        }}
      />
      <div className="ed-row ed-ai-actions">
        <button
          type="button"
          className="ed-mini-button ed-mini-button--primary ed-ai-go"
          disabled={tooShort || loading}
          onClick={() => void generate()}
        >
          {loading ? "Generating…" : "Generate page"}
        </button>
        {!brief && !loading ? (
          <button type="button" className="ed-mini-button" onClick={() => setBrief(EXAMPLE_BRIEF)}>
            Use example
          </button>
        ) : null}
      </div>
      <p className="ed-ai-help ed-ai-help--muted">Replaces the current page. You can undo it.</p>

      <GenerateStatus
        state={state}
        onCancel={() => abortRef.current?.abort()}
        onReplace={(data) => apply(data)}
        onKeep={() => setState({ kind: "idle" })}
      />
    </section>
  );
}

function GenerateStatus({
  state,
  onCancel,
  onReplace,
  onKeep,
}: {
  state: GenerateState;
  onCancel: () => void;
  onReplace: (data: Data) => void;
  onKeep: () => void;
}) {
  const seconds = useElapsedSeconds(state.kind === "loading" ? state.startedAt : null);

  if (state.kind === "loading") {
    return (
      <div className="ed-ai-status" role="status" aria-live="polite">
        <div className="ed-ai-progress" aria-hidden="true" />
        <p>
          Claude is designing your page… <strong>{seconds}s</strong>
          <br />
          <span className="ed-ai-help--muted">This usually takes 20–40 seconds. You can keep editing.</span>
        </p>
        <button type="button" className="ed-mini-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="ed-ai-status ed-ai-status--error" role="alert">
        <p>
          <strong>Generation failed.</strong> {state.message}
        </p>
        <p className="ed-ai-help--muted">Your current page was not changed.</p>
      </div>
    );
  }
  if (state.kind === "conflict") {
    return (
      <div className="ed-ai-status ed-ai-status--warn" role="alert">
        <p>
          <strong>You edited the page while Claude was working.</strong> Replace your page with the
          generated one? (You can still undo.)
        </p>
        <div className="ed-row">
          <button type="button" className="ed-mini-button ed-mini-button--primary" onClick={() => onReplace(state.data)}>
            Replace page
          </button>
          <button type="button" className="ed-mini-button" onClick={onKeep}>
            Keep my page
          </button>
        </div>
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="ed-ai-status ed-ai-status--ok" role="status">
        <p>{state.message}</p>
      </div>
    );
  }
  return null;
}

function AiPanel() {
  return (
    <div className="ed-ai-panel">
      <GeneratePanel />
      <hr className="ed-ai-divider" />
      <EditPanel />
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" strokeLinejoin="round" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" strokeLinejoin="round" />
    </svg>
  );
}

export const aiPlugin: Plugin = {
  name: "ai",
  label: "AI",
  icon: <SparkleIcon />,
  render: () => <AiPanel />,
};
