"use client";

import "@/components/site/site.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Data } from "@puckeditor/core";
import { SitePage } from "@/components/site/render";
import s from "./start.module.css";

/**
 * Shows the REAL generated page, scaled down inside a browser frame, using the
 * same renderer as the exported site. It slowly scrolls itself so you can see
 * the whole page; any wheel/touch/click stops the auto-scroll.
 */

const PAGE_WIDTH = 1280;

export function PagePreview({ data, title }: { data: Data; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // Fit the 1280px-wide page into the frame (CSS zoom keeps scrolling natural).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Gentle auto-scroll "tour" of the page (skipped for reduced motion).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    const step = () => {
      if (stopped) return;
      if (frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1) return;
      frame.scrollTop += 0.8;
      raf = requestAnimationFrame(step);
    };
    const start = setTimeout(() => (raf = requestAnimationFrame(step)), 1400);
    frame.addEventListener("wheel", stop, { passive: true });
    frame.addEventListener("touchstart", stop, { passive: true });
    frame.addEventListener("pointerdown", stop);
    return () => {
      clearTimeout(start);
      stop();
      frame.removeEventListener("wheel", stop);
      frame.removeEventListener("touchstart", stop);
      frame.removeEventListener("pointerdown", stop);
    };
  }, []);

  return (
    <div className={s.preview}>
      <div className={s.previewBar}>
        <i />
        <i />
        <i />
        <span className={s.previewUrl}>{title}</span>
      </div>
      <div ref={frameRef} className={s.previewFrame} tabIndex={0} aria-label={`Preview of ${title}`}>
        <div style={{ width: PAGE_WIDTH, zoom: scale }}>
          <SitePage data={data} />
        </div>
      </div>
    </div>
  );
}
