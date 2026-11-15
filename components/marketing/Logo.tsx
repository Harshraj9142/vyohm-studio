import type { CSSProperties } from "react";

/** Vyohm Studio mark: a sky orb with an orbit line, plus the wordmark. */
export function Logo({ size = 28, withText = true, style }: { size?: number; withText?: boolean; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 700, letterSpacing: "-0.01em", ...style }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="vs-logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b3a4ff" />
            <stop offset="55%" stopColor="#7c6cff" />
            <stop offset="100%" stopColor="#45d6e8" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="10" fill="url(#vs-logo-g)" />
        <ellipse cx="16" cy="16" rx="15" ry="5.5" fill="none" stroke="url(#vs-logo-g)" strokeWidth="1.6" transform="rotate(-24 16 16)" opacity="0.9" />
        <circle cx="25.5" cy="9.5" r="1.6" fill="#e8fffb" />
      </svg>
      {withText ? (
        <span style={{ fontSize: size * 0.62 }}>
          Vyohm <span style={{ fontWeight: 500, opacity: 0.7 }}>Studio</span>
        </span>
      ) : null}
    </span>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
