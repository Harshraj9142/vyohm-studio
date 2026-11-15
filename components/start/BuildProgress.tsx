"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import s from "./start.module.css";

/**
 * The "your page is being built" animation shown while /api/generate runs.
 *
 * The AI request is one call, so these steps are a visual timeline: they advance
 * on a timer and the last one ("Checking & polishing") waits for the real answer.
 * When the answer arrives (`done`), the remaining steps finish quickly and
 * `onComplete` is called. Inspired by 21st.dev "AI Loading State" / progress steppers.
 */

export const BUILD_STEPS = [
  { label: "Reading your brief", log: "› understanding the business, audience and tone" },
  { label: "Choosing colours & fonts", log: "› building a palette and type pairing for the brand" },
  { label: "Writing headlines & copy", log: "› hero, sections and call to action in your voice" },
  { label: "Designing your sections", log: "› cards, images and layout for 4–6 sections" },
  { label: "Tuning for phones", log: "› stacking columns and sizing text for mobile" },
  { label: "Checking & polishing", log: "› validating structure, unique ids and safe links" },
];

const STEP_MS = 5000;
const FINISH_STEP_MS = 280;

export function BuildProgress({
  startedAt,
  done,
  brief,
  onComplete,
}: {
  startedAt: number;
  done: boolean;
  brief: string;
  onComplete: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(0); // steps force-completed after the answer arrives
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete; // always call the latest callback
  }, [onComplete]);

  // Tick the clock while building.
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [done]);

  const timed = Math.min(Math.floor((now - startedAt) / STEP_MS), BUILD_STEPS.length - 1);

  // When the answer arrives, complete the remaining steps quickly, then hand over.
  useEffect(() => {
    if (!done) return;
    let step = timed;
    const timer = setInterval(() => {
      step += 1;
      setFinished(step);
      if (step >= BUILD_STEPS.length) {
        clearInterval(timer);
        setTimeout(() => completeRef.current(), 450);
      }
    }, FINISH_STEP_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const active = done ? Math.max(timed, finished) : timed; // index of the step in progress
  const allDone = done && finished >= BUILD_STEPS.length;
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000)); // clock stops when done

  return (
    <div className={s.build} role="status" aria-live="polite">
      <div className={s.buildHead}>
        <span className={`${s.orb} ${allDone ? s.orbDone : ""}`} aria-hidden="true" />
        <div>
          <p className={s.buildTitle}>{allDone ? "Your page is ready" : "Building your landing page…"}</p>
          <p className={s.buildSub}>
            {allDone ? "Opening the preview" : `${seconds}s · usually 30–45 seconds`}
          </p>
        </div>
      </div>

      <div className={s.buildGrid}>
        <div>
          <ol className={s.steps}>
            {BUILD_STEPS.map((step, index) => {
              const state = index < active || allDone ? "done" : index === active ? "active" : "todo";
              return (
                <li key={step.label} className={s[`step_${state}`]}>
                  <span className={s.stepMark} aria-hidden="true" />
                  <span>{step.label}</span>
                  <span className={s.srOnly}>{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
                </li>
              );
            })}
          </ol>
          <div className={s.log} aria-hidden="true">
            <span className={s.logLine}>› brief: “{brief.length > 64 ? `${brief.slice(0, 64)}…` : brief}”</span>
            {BUILD_STEPS.slice(0, Math.min(active + 1, BUILD_STEPS.length)).map((step) => (
              <span key={step.log} className={s.logLine}>
                {step.log}
              </span>
            ))}
          </div>
        </div>

        <SkeletonSite stage={allDone ? BUILD_STEPS.length : active} />
      </div>
    </div>
  );
}

/** A page outline that fills in as the steps progress. */
function SkeletonSite({ stage }: { stage: number }) {
  const show = (from: number) => (stage >= from ? s.skShow : "");
  const d = (n: number) => ({ "--d": `${n * 90}ms` }) as CSSProperties;
  return (
    <div className={s.skWindow} aria-hidden="true">
      <div className={s.skBar}>
        <i />
        <i />
        <i />
      </div>
      <div className={s.skPage}>
        <div className={`${s.skNav} ${show(1)}`} style={d(0)}>
          <span className={s.skLogo} />
          <span />
          <span />
        </div>
        <div className={`${s.skHero} ${show(1)}`} style={d(1)}>
          <div className={s.skCopy}>
            <span className={`${s.skBadge} ${show(2)}`} />
            <span className={`${s.skTitle} ${show(2)}`} style={d(1)} />
            <span className={`${s.skTitle} ${s.skShort} ${show(2)}`} style={d(2)} />
            <span className={`${s.skText} ${show(2)}`} style={d(3)} />
            <span className={`${s.skText} ${s.skShort} ${show(2)}`} style={d(4)} />
            <span className={`${s.skBtn} ${show(2)}`} style={d(5)} />
          </div>
          <span className={`${s.skImg} ${show(3)}`} />
        </div>
        <div className={s.skCards}>
          {[0, 1, 2].map((n) => (
            <div key={n} className={`${s.skCard} ${show(3)}`} style={d(n + 1)}>
              <span className={s.skCardImg} />
              <span className={s.skText} />
              <span className={`${s.skText} ${s.skShort}`} />
            </div>
          ))}
        </div>
        <div className={`${s.skBand} ${show(5)}`}>
          <span className={s.skTitle} />
          <span className={s.skBtn} />
        </div>
      </div>
      <span className={`${s.skPhone} ${show(4)}`}>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
