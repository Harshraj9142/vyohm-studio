import type { CSSProperties } from "react";
import type { Align, FontKey } from "./model";

/**
 * Each element passes its settings to CSS as custom properties (CSS variables),
 * for example style="--h-size: 48px; --h-size-m: 32px".
 * site.css then uses them, and a media query swaps in the "-m" (mobile) values.
 * This is how a mobile override changes phones without touching desktop.
 */
export function cssVars(
  entries: Record<string, string | undefined | null | false>,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    style[name] = value;
  }
  return style as CSSProperties;
}

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export const px = (value: unknown) => (isNum(value) ? `${value}px` : undefined);
export const pct = (value: unknown) => (isNum(value) ? `${value}%` : undefined);

export const FONT_STACKS: Record<FontKey, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

export const JUSTIFY: Record<Align, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/** Only allow safe colour values (#rgb or #rrggbb). Anything else falls back to the default. */
export function safeColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : undefined;
}

/** Block dangerous links such as "javascript:..." (from users or from the AI). */
export function safeHref(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "#";
  const href = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith("#") || href.startsWith("/")) {
    return href;
  }
  return "#";
}

/** Turn any text into a safe HTML id, e.g. "Our Story!" -> "our-story" */
export function slugify(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
