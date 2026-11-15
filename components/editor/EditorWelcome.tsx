"use client";

import Link from "next/link";
import b from "@/components/marketing/brand.module.css";
import { ArrowIcon, Logo } from "@/components/marketing/Logo";
import s from "./welcome.module.css";

/**
 * Shown when the editor opens and there is no page yet.
 * We never load a page the user didn't ask for; they choose how to start.
 */
export function EditorWelcome({
  notice,
  onBlank,
  onSample,
  existing,
}: {
  notice?: string;
  onBlank: () => void;
  onSample: () => void;
  /** A page already in this browser that the user never chose (e.g. an old auto-saved sample). */
  existing?: { title: string; onContinue: () => void };
}) {
  return (
    <div className={`${b.theme} ${s.page}`}>
      <header className={s.top}>
        <Link href="/" aria-label="Vyohm Studio home" className={s.home}>
          <Logo size={26} />
        </Link>
      </header>

      <main className={s.main}>
        {notice ? (
          <p className={s.notice} role="alert">
            {notice}
          </p>
        ) : null}
        <p className={s.eyebrow}>The editor</p>
        <h1 className={s.title}>
          Let&apos;s start your <span className={b.gradientText}>page</span>.
        </h1>
        <p className={s.lead}>You don&apos;t have a page yet. How would you like to begin?</p>
        {existing ? (
          <p className={s.existing}>
            This browser still has <strong>{existing.title}</strong> from before.{" "}
            <button type="button" className={s.continue} onClick={existing.onContinue}>
              Continue with this page →
            </button>
          </p>
        ) : null}

        <div className={s.choices}>
          <Link href="/start" className={`${s.choice} ${s.primary}`}>
            <span className={s.icon} aria-hidden="true">
              ✦
            </span>
            <span className={s.choiceTitle}>Generate with AI</span>
            <span className={s.choiceText}>Describe your business and get a full page in under a minute.</span>
            <span className={s.go}>
              Describe my business <ArrowIcon className={b.arrow} />
            </span>
          </Link>

          <button type="button" className={s.choice} onClick={onBlank}>
            <span className={s.icon} aria-hidden="true">
              ＋
            </span>
            <span className={s.choiceTitle}>Start from a blank page</span>
            <span className={s.choiceText}>Drag in sections, headings, images and buttons yourself.</span>
            <span className={s.go}>
              Open a blank page <ArrowIcon className={b.arrow} />
            </span>
          </button>

          <button type="button" className={s.choice} onClick={onSample}>
            <span className={s.icon} aria-hidden="true">
              ◎
            </span>
            <span className={s.choiceTitle}>Explore the sample page</span>
            <span className={s.choiceText}>A ready-made example (Loom &amp; Line) to try the editor.</span>
            <span className={s.go}>
              Open the sample <ArrowIcon className={b.arrow} />
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
