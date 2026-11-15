"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import { NESTING } from "@/components/site/model";

/**
 * Clear feedback for invalid nesting while dragging.
 *
 * Puck already refuses drops that break our slot `allow` lists, but silently.
 * This component explains why:
 *  - while dragging over a drop area that does not accept the dragged element,
 *    the area gets a red dashed outline and a message appears
 *    ("Can't drop a Section here: Sections go directly on the page.");
 *  - if the user lets go there anyway, a short "Not moved" message explains it.
 *
 * How it knows what is dragged: Blocks-panel items carry data-testid="drawer-item:<Type>",
 * page elements carry data-puck-component="<id>". Drop areas carry
 * data-puck-dropzone="<parentId>:<slot>" ("root:content" for the page itself).
 */

const usePuck = createUsePuck();

type Feedback = { title: string; message: string; tone: "error" | "info" };

/** null if `child` may go inside `parentType`, otherwise a short explanation. */
export function nestingProblem(child: string, parentType: string): string | null {
  const allowed = (NESTING as Record<string, readonly string[]>)[parentType] ?? [];
  if (allowed.includes(child)) return null;
  if (child === "Section") return "Sections go directly on the page. Drop it between other sections.";
  if (child === "Container" && parentType === "Container") {
    return "A container can't go inside another container. Drop it into a section.";
  }
  if (parentType === "page") {
    return `A ${child.toLowerCase()} needs a section. Drop it inside a section or a container column.`;
  }
  return `A ${child.toLowerCase()} can't go inside a ${parentType.toLowerCase()}.`;
}

export function DragFeedback() {
  const getPuck = useGetPuck();
  const isDragging = usePuck((s) => s.appState.ui.isDragging);
  const dragged = useRef<{ type: string; id?: string } | null>(null);
  const before = useRef<string>(""); // the page when the drag started, to see what the drop did
  const lastProblem = useRef<{ child: string; message: string } | null>(null);
  const marked = useRef<Element | null>(null);
  const [during, setDuring] = useState<Feedback | null>(null);
  const [afterDrop, setAfterDrop] = useState<Feedback | null>(null);

  // 1. Remember what the user starts dragging (from the Blocks panel or the page).
  useEffect(() => {
    const fromPanel = (e: PointerEvent) => {
      const item = (e.target as Element | null)?.closest?.('[data-testid^="drawer-item:"]');
      if (!item) return;
      dragged.current = { type: item.getAttribute("data-testid")!.slice("drawer-item:".length) };
      before.current = JSON.stringify(getPuck().appState.data);
      setDuring(null);
    };
    const fromPage = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-puck-component]");
      const id = el?.getAttribute("data-puck-component") ?? undefined;
      const type = id ? getPuck().getItemById(id)?.type : undefined;
      dragged.current = type ? { type: String(type), id } : null;
      before.current = JSON.stringify(getPuck().appState.data);
      setDuring(null);
    };
    document.addEventListener("pointerdown", fromPanel, true);
    // The preview iframe can be re-created (e.g. when switching viewports), so re-attach.
    let frameDoc: Document | null = null;
    const attach = () => {
      const doc = document.querySelector("iframe")?.contentDocument ?? null;
      if (doc && doc !== frameDoc) {
        frameDoc?.removeEventListener("pointerdown", fromPage, true);
        frameDoc = doc;
        doc.addEventListener("pointerdown", fromPage, true);
      }
    };
    attach();
    const timer = setInterval(attach, 1000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("pointerdown", fromPanel, true);
      frameDoc?.removeEventListener("pointerdown", fromPage, true);
    };
  }, [getPuck]);

  // 2. While dragging, check the drop area under the pointer.
  useEffect(() => {
    const unmark = () => {
      marked.current?.removeAttribute("data-vs-blocked");
      marked.current = null;
    };

    if (!isDragging) {
      // Drag ended: if it ended over a refused area, say so for a few seconds.
      unmark();
      const problem = lastProblem.current;
      lastProblem.current = null;
      dragged.current = null;
      if (!problem) return;
      // Puck sometimes places the element in the nearest allowed spot instead of refusing
      // (e.g. a Section dropped on a column goes onto the page). Report what really happened.
      const show = setTimeout(() => {
        const changed = JSON.stringify(getPuck().appState.data) !== before.current;
        setAfterDrop(
          changed
            ? { title: `Placed on the page instead`, message: `A ${problem.child.toLowerCase()} can't go there, so it was put in the nearest allowed spot. Use Undo to take it back.`, tone: "info" }
            : { title: `Not moved: a ${problem.child} can't go there`, message: problem.message, tone: "error" },
        );
      }, 120);
      const hide = setTimeout(() => setAfterDrop(null), 4000);
      return () => {
        clearTimeout(show);
        clearTimeout(hide);
      };
    }

    const iframe = document.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const check = (x: number, y: number) => {
      const current = dragged.current;
      if (!current) return;
      // Ignore drop areas inside the element being dragged (its own original place).
      const draggedEl = current.id ? doc.querySelector(`[data-puck-component="${CSS.escape(current.id)}"]`) : null;
      // The dragged element follows the pointer, so look *through* it to the area underneath.
      const under = doc.elementsFromPoint(x, y).find((el) => !(draggedEl && draggedEl.contains(el)));
      const zone = under?.closest("[data-puck-dropzone]") ?? null;

      if (!zone) {
        unmark();
        setDuring(null);
        lastProblem.current = null;
        return;
      }
      const compound = zone.getAttribute("data-puck-dropzone") ?? "";
      const parentId = compound.slice(0, compound.lastIndexOf(":"));
      const parentType = parentId === "root" ? "page" : getPuck().getItemById(parentId)?.type;
      if (!parentType) return;

      const message = nestingProblem(current.type, String(parentType));
      if (!message) {
        unmark();
        setDuring(null);
        lastProblem.current = null;
        return;
      }
      if (marked.current !== zone) {
        unmark();
        zone.setAttribute("data-vs-blocked", "true");
        marked.current = zone;
      }
      lastProblem.current = { child: current.type, message };
      setDuring({ title: `Can't drop a ${current.type} here`, message, tone: "error" });
    };

    // Events inside the iframe use iframe coordinates already.
    const onFrameMove = (e: PointerEvent) => check(e.clientX, e.clientY);
    // Events in the main page (e.g. a drag that started in the Blocks panel) must be
    // converted into the iframe's coordinates; the preview may be scaled down.
    const onMainMove = (e: PointerEvent) => {
      const rect = iframe.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        unmark();
        setDuring(null);
        lastProblem.current = null;
        return;
      }
      const scale = iframe.clientWidth / rect.width;
      check((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale);
    };

    doc.addEventListener("pointermove", onFrameMove);
    document.addEventListener("pointermove", onMainMove);
    return () => {
      doc.removeEventListener("pointermove", onFrameMove);
      document.removeEventListener("pointermove", onMainMove);
    };
  }, [isDragging, getPuck]);

  // While dragging show the live message; afterwards the "Not moved" note (if any).
  const feedback = isDragging ? during : afterDrop;
  if (!feedback || typeof document === "undefined") return null;
  return createPortal(
    <div className={`ed-drop-toast ed-drop-toast--${feedback.tone}`} role="status" aria-live="polite">
      <strong>{feedback.title}</strong>
      <span>{feedback.message}</span>
    </div>,
    document.body,
  );
}
