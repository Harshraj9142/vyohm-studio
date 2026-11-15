"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Data } from "@puckeditor/core";
import b from "@/components/marketing/brand.module.css";
import { ArrowIcon, Logo } from "@/components/marketing/Logo";
import { findPageProblem } from "@/lib/page-schema";
import { loadPage, savePage } from "@/lib/storage";
import { BuildProgress } from "./BuildProgress";
import { PagePreview } from "./PagePreview";
import s from "./start.module.css";

/**
 * /start — "Create your landing page" chat.
 *
 *  compose  -> the user describes the business (plus an optional style chip)
 *  building -> POST /api/generate while the build animation plays
 *  finishing-> answer received; the animation completes its steps
 *  ready    -> the REAL page is previewed; "Open in editor" saves it and opens /editor
 *  error    -> readable message; nothing is saved
 */

const EXAMPLES = [
  "A premium clothing brand called Loom & Line. Black and gold theme, three product collections and a contact button.",
  "A family-run vegan bakery in Pune called Crumb & Co. Warm pastel colours, four signature bakes and an order button.",
  "A minimal architecture studio called Northline. White and charcoal with a terracotta accent, three services, book a consultation.",
  "A calm yoga studio called Still Point. Sage green and cream, three class types and a button to book a class.",
];
const CHIPS = [
  { label: "Clothing brand", text: EXAMPLES[0] },
  { label: "Bakery", text: EXAMPLES[1] },
  { label: "Architecture studio", text: EXAMPLES[2] },
  { label: "Yoga studio", text: EXAMPLES[3] },
];
const STYLES = ["Dark & premium", "Warm & friendly", "Minimal & clean", "Bold & colourful"];

type Phase =
  | { kind: "compose" }
  | { kind: "building"; brief: string; startedAt: number }
  | { kind: "finishing"; brief: string; startedAt: number; data: Data }
  | { kind: "ready"; brief: string; data: Data; seconds: number }
  | { kind: "error"; brief: string; message: string };

export function StartChat() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "compose" });
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [hasSavedPage, setHasSavedPage] = useState(false);
  const [placeholder, setPlaceholder] = useState(0);
  const [opening, setOpening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Is there already a page in the editor? (We say so before replacing it.)
  useEffect(() => {
    loadPage()
      .then((page) => setHasSavedPage(!!page))
      .catch(() => setHasSavedPage(false));
  }, []);

  // Rotate the example in the placeholder.
  useEffect(() => {
    const timer = setInterval(() => setPlaceholder((n) => (n + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [phase.kind]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [brief]);

  const canSend = brief.trim().length >= 10;

  async function build(text: string) {
    const fullBrief = style ? `${text.trim()} Style: ${style}.` : text.trim();
    const startedAt = Date.now();
    setPhase({ kind: "building", brief: fullBrief, startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: fullBrief }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as { data?: Data; error?: string } | null;
      if (!response.ok || !result?.data) {
        throw new Error(result?.error ?? `The request failed (HTTP ${response.status}).`);
      }
      // Never trust the network blindly: validate before showing or saving.
      const problem = findPageProblem(result.data);
      if (problem) throw new Error(`The AI result was rejected: ${problem}`);
      setPhase({ kind: "finishing", brief: fullBrief, startedAt, data: result.data });
    } catch (error) {
      if (controller.signal.aborted) {
        setBrief(text);
        setPhase({ kind: "compose" });
        return;
      }
      setPhase({ kind: "error", brief: fullBrief, message: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      abortRef.current = null;
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend || phase.kind === "building" || phase.kind === "finishing") return;
    const text = brief;
    setBrief("");
    void build(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  async function openInEditor(data: Data) {
    setOpening(true);
    try {
      await savePage(data); // the editor loads the saved page when it opens
      router.push("/editor");
    } catch {
      setOpening(false);
      setPhase({ kind: "error", brief: "", message: "Could not save the page in this browser (storage unavailable)." });
    }
  }

  const showComposer = phase.kind === "compose" || phase.kind === "error";
  const pageTitle = (data: Data) => String((data.root.props as { title?: unknown }).title ?? "Your landing page");
  const sectionCount = (data: Data) => ((data.root.props as { content?: unknown[] }).content ?? []).length;

  return (
    <div className={`${b.theme} ${s.page}`}>
      <header className={s.top}>
        <Link href="/" aria-label="Vyohm Studio home" className={s.home}>
          <Logo size={26} />
        </Link>
        <a href="/editor" className={`${b.btn} ${s.topBtn}`}>
          Open editor
        </a>
      </header>

      <main className={s.thread} aria-live="polite">
        {/* intro */}
        <div className={s.msgAi}>
          <span className={s.avatar} aria-hidden="true" />
          <div className={s.bubbleAi}>
            <p className={s.hello}>
              Let&apos;s create your <span className={b.gradientText}>landing page</span>.
            </p>
            <p>
              Tell me about your business: its name, what you offer, and the look you like. I&apos;ll design the page,
              write the copy and lay out every section. You can edit everything afterwards.
            </p>
            {phase.kind === "compose" ? (
              <div className={s.chips}>
                {CHIPS.map((chip) => (
                  <button key={chip.label} type="button" className={s.chip} onClick={() => setBrief(chip.text)}>
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* the user's brief */}
        {phase.kind !== "compose" && phase.brief ? (
          <div className={s.msgUser}>
            <div className={s.bubbleUser}>{phase.brief}</div>
          </div>
        ) : null}

        {/* building / finishing */}
        {phase.kind === "building" || phase.kind === "finishing" ? (
          <div className={s.msgAi}>
            <span className={s.avatar} aria-hidden="true" />
            <div className={`${s.bubbleAi} ${s.bubbleWide}`}>
              <BuildProgress
                startedAt={phase.startedAt}
                done={phase.kind === "finishing"}
                brief={phase.brief}
                onComplete={() => {
                  if (phase.kind === "finishing") {
                    setPhase({
                      kind: "ready",
                      brief: phase.brief,
                      data: phase.data,
                      seconds: Math.round((Date.now() - phase.startedAt) / 1000),
                    });
                  }
                }}
              />
              {phase.kind === "building" ? (
                <button type="button" className={s.cancel} onClick={() => abortRef.current?.abort()}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* result */}
        {phase.kind === "ready" ? (
          <div className={s.msgAi}>
            <span className={`${s.avatar} ${s.avatarDone}`} aria-hidden="true" />
            <div className={`${s.bubbleAi} ${s.bubbleWide} ${s.reveal}`}>
              <p className={s.readyTitle}>
                Your page is ready <span aria-hidden="true">✦</span>
              </p>
              <p className={s.readyMeta}>
                <strong>{pageTitle(phase.data)}</strong> · {sectionCount(phase.data)} sections · built in {phase.seconds}s
              </p>
              <PagePreview data={phase.data} title={pageTitle(phase.data)} />
              <div className={s.readyActions}>
                <button
                  type="button"
                  className={`${b.btn} ${b.btnPrimary} ${b.btnLarge}`}
                  onClick={() => void openInEditor(phase.data)}
                  disabled={opening}
                >
                  {opening ? "Opening…" : "Open in editor"} <ArrowIcon className={b.arrow} />
                </button>
                <button
                  type="button"
                  className={`${b.btn} ${b.btnLarge}`}
                  onClick={() => {
                    setBrief(phase.brief);
                    setPhase({ kind: "compose" });
                  }}
                >
                  Try another idea
                </button>
              </div>
              {hasSavedPage ? (
                <p className={s.note}>Opening this page in the editor replaces the page you were editing before. You can undo inside the editor.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* error */}
        {phase.kind === "error" ? (
          <div className={s.msgAi}>
            <span className={`${s.avatar} ${s.avatarError}`} aria-hidden="true" />
            <div className={`${s.bubbleAi} ${s.bubbleError}`} role="alert">
              <p>
                <strong>That didn&apos;t work.</strong> {phase.message}
              </p>
              <p className={s.note}>Nothing was saved. Edit your description below and try again.</p>
              {phase.brief ? (
                <button type="button" className={b.btn} onClick={() => void build(phase.brief)}>
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </main>

      {showComposer ? (
        <form className={s.composerWrap} onSubmit={submit}>
          <div className={s.composer}>
            <label htmlFor="vs-brief" className={s.srOnly}>
              Describe your business
            </label>
            <textarea
              id="vs-brief"
              ref={inputRef}
              rows={2}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={EXAMPLES[placeholder]}
              className={s.input}
              autoFocus
            />
            <div className={s.composerRow}>
              <div className={s.styles} role="group" aria-label="Style (optional)">
                {STYLES.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`${s.styleChip} ${style === label ? s.styleOn : ""}`}
                    aria-pressed={style === label}
                    onClick={() => setStyle(style === label ? null : label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="submit" className={s.send} disabled={!canSend} aria-label="Build my landing page">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
          <p className={s.hint}>
            <kbd>Enter</kbd> to build · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
            {!canSend && brief.trim().length > 0 ? " · a little more detail please" : ""}
          </p>
        </form>
      ) : null}
    </div>
  );
}
