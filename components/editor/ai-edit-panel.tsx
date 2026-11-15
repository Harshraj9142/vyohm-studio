"use client";

import { useRef, useState } from "react";
import { createUsePuck, useGetPuck, type Data } from "@puckeditor/core";
import type { Operation } from "@/lib/ai/revise-schema";
import { applyOperations, describe, findConflicts, type Scope } from "@/lib/revise/apply";
import { useElapsedSeconds } from "./use-elapsed";

/**
 * "Edit with AI": change the selected element (or the whole page) with an instruction.
 *
 *  1. Take a copy of the page as it is now ("before") and note the scope.
 *  2. Send instruction + page + scope to /api/revise. Claude returns small operations.
 *  3. Conflict check: did the user change any element those operations touch while
 *     Claude was working? If yes, ask before applying (never silently overwrite).
 *  4. Apply the operations to the CURRENT page, so every other manual edit is kept.
 *  5. Validate, then save as one undo step.
 */

const usePuck = createUsePuck();

type Pending = { before: Data; operations: Operation[]; scope: Scope; summary: string };

type EditState =
  | { kind: "idle" }
  | { kind: "loading"; startedAt: number; target: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; pending: Pending; conflicts: string[] }
  | { kind: "done"; summary: string }
  | { kind: "nothing"; summary: string };

const SUGGESTIONS: Record<string, string> = {
  Button: "Change only this button's background to blue",
  Heading: "Make this heading shorter and punchier",
  Paragraph: "Rewrite this in a friendlier tone",
  Image: "Give this image rounded corners",
  Container: "Turn this into a card with a light background and padding",
  Section: "Give this section a slightly darker background",
  page: "Use a navy and white colour theme for the whole page",
};

export function EditPanel() {
  const getPuck = useGetPuck();
  const selected = usePuck((s) => s.selectedItem);
  const viewportWidth = usePuck((s) => s.appState.ui.viewports.current.width);
  const [instruction, setInstruction] = useState("");
  const [wholePage, setWholePage] = useState(false);
  const [state, setState] = useState<EditState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const loading = state.kind === "loading";
  const useElement = !!selected && !wholePage;
  const suggestion = SUGGESTIONS[useElement && selected ? selected.type : "page"];

  function commit(pending: Pending, force: boolean) {
    const { appState, dispatch } = getPuck();

    // Test-apply to the "before" page to learn which elements the edit relies on.
    const dryRun = applyOperations(pending.before, pending.operations, pending.scope);
    if (!dryRun.ok) return setState({ kind: "error", message: dryRun.error });

    if (!force) {
      const conflicts = findConflicts(pending.before, appState.data, dryRun.touched);
      if (conflicts.length > 0) return setState({ kind: "conflict", pending, conflicts });
    }

    // Apply to the CURRENT page so all other manual edits are preserved.
    const result = applyOperations(appState.data, pending.operations, pending.scope);
    if (!result.ok) return setState({ kind: "error", message: result.error });

    dispatch({ type: "setData", data: result.data, recordHistory: true }); // one undo step
    if (pending.scope.kind === "element") {
      // Keep the same element selected, even if its position changed.
      const selector = getPuck().getSelectorForId(pending.scope.id);
      dispatch({ type: "setUi", ui: { itemSelector: selector ?? null } });
    }
    setState({ kind: "done", summary: pending.summary });
  }

  async function submit() {
    const puck = getPuck();
    const before = puck.appState.data;
    const item = puck.selectedItem;
    const scope: Scope = item && !wholePage ? { kind: "element", id: item.props.id } : { kind: "page" };
    const width = puck.appState.ui.viewports.current.width;
    const viewport = typeof width === "number" && width < 768 ? "mobile" : "desktop";

    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      kind: "loading",
      startedAt: Date.now(),
      target: scope.kind === "element" && item ? describe(item) : "the whole page",
    });

    try {
      const response = await fetch("/api/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction, scope, page: before, viewport }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        | { summary?: string; operations?: Operation[]; error?: string }
        | null;
      if (!response.ok || !result || !Array.isArray(result.operations)) {
        throw new Error(result?.error ?? `The request failed (HTTP ${response.status}).`);
      }
      const summary = result.summary?.trim() || "Done.";
      if (result.operations.length === 0) return setState({ kind: "nothing", summary });
      commit({ before, operations: result.operations, scope, summary }, false);
    } catch (error) {
      if (controller.signal.aborted) return setState({ kind: "idle" });
      setState({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      abortRef.current = null;
    }
  }

  const canSubmit = instruction.trim().length >= 2 && !loading;

  return (
    <section className="ed-ai-card" aria-labelledby="ed-ai-edit-title">
      <h2 id="ed-ai-edit-title" className="ed-ai-title">
        Edit with AI
      </h2>

      <div className="ed-ai-target">
        {selected ? (
          <>
            <label className="ed-ai-choice">
              <input type="radio" name="ed-ai-scope" checked={!wholePage} onChange={() => setWholePage(false)} />
              <span>
                Selected: <strong>{describe(selected)}</strong>
              </span>
            </label>
            <label className="ed-ai-choice">
              <input type="radio" name="ed-ai-scope" checked={wholePage} onChange={() => setWholePage(true)} />
              <span>Whole page</span>
            </label>
          </>
        ) : (
          <p className="ed-ai-help">
            Editing the <strong>whole page</strong>. Click an element in the preview to edit just that element.
          </p>
        )}
        {typeof viewportWidth === "number" && viewportWidth < 768 ? (
          <p className="ed-ai-help ed-ai-help--muted">Mobile preview: size and spacing changes will apply to phones only.</p>
        ) : null}
      </div>

      <label className="ed-visually-hidden" htmlFor="ed-ai-instruction">
        Instruction
      </label>
      <textarea
        id="ed-ai-instruction"
        className="ed-input ed-ai-textarea ed-ai-textarea--short"
        rows={3}
        placeholder={suggestion}
        value={instruction}
        disabled={loading}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) void submit();
        }}
      />
      <div className="ed-row ed-ai-actions">
        <button
          type="button"
          className="ed-mini-button ed-mini-button--primary ed-ai-go"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {loading ? "Applying…" : "Apply with AI"}
        </button>
        {!instruction && !loading ? (
          <button type="button" className="ed-mini-button" onClick={() => setInstruction(suggestion)}>
            Use suggestion
          </button>
        ) : null}
      </div>

      <EditStatus
        state={state}
        onCancel={() => abortRef.current?.abort()}
        onApplyAnyway={(pending) => commit(pending, true)}
        onDiscard={() => setState({ kind: "idle" })}
      />
    </section>
  );
}

function EditStatus({
  state,
  onCancel,
  onApplyAnyway,
  onDiscard,
}: {
  state: EditState;
  onCancel: () => void;
  onApplyAnyway: (pending: Pending) => void;
  onDiscard: () => void;
}) {
  const seconds = useElapsedSeconds(state.kind === "loading" ? state.startedAt : null);

  switch (state.kind) {
    case "loading":
      return (
        <div className="ed-ai-status" role="status" aria-live="polite">
          <div className="ed-ai-progress" aria-hidden="true" />
          <p>
            Claude is editing {state.target}… <strong>{seconds}s</strong>
          </p>
          <button type="button" className="ed-mini-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      );
    case "error":
      return (
        <div className="ed-ai-status ed-ai-status--error" role="alert">
          <p>
            <strong>Edit failed.</strong> {state.message}
          </p>
          <p className="ed-ai-help--muted">Your page was not changed.</p>
        </div>
      );
    case "conflict":
      return (
        <div className="ed-ai-status ed-ai-status--warn" role="alert">
          <p>
            <strong>You changed {state.conflicts.join(", ")} while Claude was working.</strong> Apply
            Claude&apos;s edit on top of your change?
          </p>
          <p className="ed-ai-help--muted">Claude&apos;s edit: {state.pending.summary}</p>
          <div className="ed-row">
            <button
              type="button"
              className="ed-mini-button ed-mini-button--primary"
              onClick={() => onApplyAnyway(state.pending)}
            >
              Apply anyway
            </button>
            <button type="button" className="ed-mini-button" onClick={onDiscard}>
              Discard AI edit
            </button>
          </div>
        </div>
      );
    case "done":
      return (
        <div className="ed-ai-status ed-ai-status--ok" role="status">
          <p>{state.summary}</p>
          <p className="ed-ai-help--muted">Use Undo (top right) to revert.</p>
        </div>
      );
    case "nothing":
      return (
        <div className="ed-ai-status" role="status">
          <p>
            <strong>No changes made.</strong> {state.summary}
          </p>
        </div>
      );
    default:
      return null;
  }
}
