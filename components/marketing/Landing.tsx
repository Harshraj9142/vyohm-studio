import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import b from "./brand.module.css";
import s from "./landing.module.css";
import { ArrowIcon, Logo } from "./Logo";
import { SpotlightCard } from "./SpotlightCard";

/**
 * The Vyohm Studio landing page ("/").
 * Server-rendered; all animation is CSS (switched off for reduced motion).
 * Design references from 21st.dev: marketing hero with stats pill and colour glows,
 * spotlight feature cards, AI prompt composer, AI loading states.
 */

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export function Landing() {
  return (
    <div className={b.theme}>
      <header className={s.nav}>
        <Link href="/" className={s.brandLink} aria-label="Vyohm Studio home">
          <Logo />
        </Link>
        <nav className={s.navLinks} aria-label="Main">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#trust">Why trust it</a>
        </nav>
        <div className={s.navCtas}>
          <a href="/editor" className={`${b.btn} ${s.navGhost}`}>
            Open editor
          </a>
          <Link href="/start" className={`${b.btn} ${b.btnPrimary}`}>
            Get started
          </Link>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------ Hero */}
        <section className={s.hero}>
          <p className={s.pill}>
            <span className={s.pillDot} />
            6 building blocks <span className={s.pillSep} /> 1 sentence <span className={s.pillSep} /> real Next.js code
          </p>
          <h1 className={s.h1}>
            Describe your business.
            <br />
            <span className={b.gradientText}>Get a website</span> you can <span className={b.serif}>edit</span> and{" "}
            <span className={b.serif}>own</span>.
          </h1>
          <p className={s.lead}>
            Vyohm Studio turns one sentence into a polished landing page. Click anything to change it, ask the AI for
            precise tweaks, then download a real Next.js project you can host anywhere.
          </p>
          <div className={s.ctas}>
            <Link href="/start" className={`${b.btn} ${b.btnPrimary} ${b.btnLarge}`}>
              Get started <ArrowIcon className={b.arrow} />
            </Link>
            <a href="/editor" className={`${b.btn} ${b.btnLarge}`}>
              Open the editor
            </a>
          </div>
          <p className={s.stack}>
            Powered by <strong>Claude</strong> <span>·</span> <strong>Next.js</strong> <span>·</span> <strong>Puck</strong>
          </p>

          <HeroDemo />
        </section>

        {/* ------------------------------------------------ Features */}
        <section id="features" className={s.section}>
          <SectionHeader
            label="Features"
            title={
              <>
                Everything a landing page needs, <span className={b.serif}>nothing it doesn&apos;t</span>
              </>
            }
            text="Generate, edit, preview on phones and export — in one place, without writing code."
          />
          <div className={s.bento}>
            <Feature className={s.span2} icon={<IconSpark />} title="From one sentence to a full page" text="Describe your business and style. Claude writes the copy, picks colours and fonts, and lays out every section.">
              <GenerateArt />
            </Feature>
            <Feature icon={<IconCursor />} title="Click anything to edit" text="Type straight onto the page. Fonts, colours, spacing and images live in a simple side panel.">
              <EditArt />
            </Feature>
            <Feature icon={<IconWand />} title="AI edits only what you ask" text="Select an element and say what to change. Everything else — including your own edits — stays exactly as it was.">
              <AiEditArt />
            </Feature>
            <Feature icon={<IconPhone />} title="Looks right on phones" text="Preview mobile and set phone-only sizes and layouts without touching desktop.">
              <PhoneArt />
            </Feature>
            <Feature icon={<IconHistory />} title="Undo, autosave, your photos" text="Every change is undoable and saved automatically — including the images you upload.">
              <HistoryArt />
            </Feature>
            <Feature className={s.span3} icon={<IconCode />} title="Export real code you own" text="Download website.zip — a standalone Next.js project with your content, images and responsive styles. No lock-in, no API key needed.">
              <TerminalArt />
            </Feature>
          </div>
        </section>

        {/* ------------------------------------------------ How it works */}
        <section id="how" className={s.section}>
          <SectionHeader label="How it works" title="Three steps. About a minute." text="No templates to fight with — the page is designed for your business." />
          <ol className={s.steps}>
            {[
              { n: "01", t: "Describe", d: "Tell Vyohm Studio what you do and the feel you want — “black and gold”, “warm and friendly”, “minimal”." },
              { n: "02", t: "Refine", d: "Click to edit text and images, drag sections around, or ask the AI: “make this button blue”." },
              { n: "03", t: "Export", d: "Download a Next.js project that installs, builds and runs on its own. Host it anywhere." },
            ].map((step) => (
              <li key={step.n} className={s.step}>
                <span className={s.stepNum}>{step.n}</span>
                <h3>{step.t}</h3>
                <p>{step.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------ Trust */}
        <section id="trust" className={s.section}>
          <SectionHeader label="Why trust it" title="Built carefully, not just quickly" text="The parts you don’t see matter as much as the ones you do." />
          <ul className={s.trust}>
            {[
              { t: "Your key stays on the server", d: "The AI is called from the server. Keys never reach the browser or an export." },
              { t: "Every AI change is checked", d: "Answers are validated before they touch your page. A bad answer changes nothing." },
              { t: "Your edits are never overwritten", d: "Edited something while the AI was working? You’re asked before anything is applied." },
              { t: "Clean, portable export", d: "Only your content, components and images. No secrets, no editor code." },
            ].map((item) => (
              <li key={item.t} className={s.trustItem}>
                <IconCheck />
                <div>
                  <h3>{item.t}</h3>
                  <p>{item.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ Final CTA */}
        <section className={s.section}>
          <div className={s.ctaBand}>
            <p className={s.eyebrow}>Ready when you are</p>
            <h2 className={s.ctaTitle}>
              Your landing page is less than <span className={b.gradientText}>a minute</span> away.
            </h2>
            <div className={s.ctas}>
              <Link href="/start" className={`${b.btn} ${b.btnPrimary} ${b.btnLarge}`}>
                Get started <ArrowIcon className={b.arrow} />
              </Link>
              <a href="/editor" className={`${b.btn} ${b.btnLarge}`}>
                Open the editor
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <Logo size={22} />
        <p>Built for the Vyohm AI FDE challenge · Next.js · Puck · Claude</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function SectionHeader({ label, title, text }: { label: string; title: ReactNode; text: string }) {
  return (
    <div className={s.sectionHeader}>
      <p className={s.eyebrow}>{label}</p>
      <h2 className={s.h2}>{title}</h2>
      <p className={s.sectionText}>{text}</p>
    </div>
  );
}

function Feature({ className, icon, title, text, children }: { className?: string; icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <SpotlightCard className={`${s.card} ${className ?? ""}`}>
      <div className={s.cardArt} aria-hidden="true">
        {children}
      </div>
      <div className={s.cardBody}>
        <span className={s.cardIcon}>{icon}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </SpotlightCard>
  );
}

/** The animated "chat builds a page" window in the hero (decorative). */
function HeroDemo() {
  return (
    <div className={s.demo} aria-hidden="true">
      <div className={s.window}>
        <div className={s.windowBar}>
          <i />
          <i />
          <i />
          <span className={s.url}>vyohm.studio/start</span>
        </div>
        <div className={s.windowBody}>
          <div className={s.chat}>
            <div className={s.bubbleUser}>
              <span className={s.typed}>A cosy bakery in Pune — pastel colours, four signature bakes, an order button.</span>
            </div>
            <div className={s.bubbleAi}>
              <span className={s.orb} /> Building your page
              <span className={s.dots}>
                <i />
                <i />
                <i />
              </span>
            </div>
            <ul className={s.checks}>
              {["Colours & fonts", "Headlines & copy", "Sections & layout", "Mobile tuning"].map((label, n) => (
                <li key={label} style={i(n)}>
                  <span className={s.tick} /> {label}
                </li>
              ))}
            </ul>
          </div>
          <div className={s.canvas}>
            <div className={s.miniNav} style={i(0)}>
              <b>Crumb &amp; Co.</b>
              <span />
              <span />
              <span />
            </div>
            <div className={s.miniHero} style={i(1)}>
              <div>
                <span className={s.miniBadge}>FAMILY BAKERY · PUNE</span>
                <span className={s.miniTitle}>Baked with love,</span>
                <span className={s.miniTitle}>made from plants.</span>
                <span className={s.miniLine} />
                <span className={`${s.miniLine} ${s.short}`} />
                <span className={s.miniBtn}>Order now →</span>
              </div>
              <div className={s.miniImg} />
            </div>
            <div className={s.miniCards}>
              {[2, 3, 4].map((n) => (
                <div key={n} className={s.miniCard} style={i(n)}>
                  <div className={s.miniCardImg} />
                  <span className={s.miniLine} />
                  <span className={`${s.miniLine} ${s.short}`} />
                </div>
              ))}
            </div>
            <div className={s.miniBand} style={i(5)}>
              <span className={s.miniTitle}>Visit the bakery</span>
              <span className={s.miniBtn}>Get in touch →</span>
            </div>
          </div>
        </div>
      </div>
      <div className={`${s.float} ${s.float1}`}>
        <IconCheck /> Page generated in 32s
      </div>
      <div className={`${s.float} ${s.float2}`}>
        <span className={s.swatch} /> “Make this button blue” · done
      </div>
      <div className={`${s.float} ${s.float3}`}>
        <IconPhone /> Mobile ready
      </div>
    </div>
  );
}

function GenerateArt() {
  return (
    <div className={s.genArt}>
      <div className={s.prompt}>
        <IconSpark /> “A specialty coffee roastery, espresso brown and cream…”
      </div>
      <ArrowIcon className={s.genArrow} />
      <div className={s.genStack}>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} style={i(n)} />
        ))}
      </div>
    </div>
  );
}

function EditArt() {
  return (
    <div className={s.editArt}>
      <span className={s.editLabel}>Heading</span>
      <span className={s.editText}>
        Roasted slowly<span className={s.caret} />
      </span>
      <div className={s.slider}>
        <span>Size</span>
        <i />
      </div>
    </div>
  );
}

function AiEditArt() {
  return (
    <div className={s.aiArt}>
      <span className={s.aiAsk}>Change only this button&apos;s background to blue</span>
      <span className={s.aiBtn}>Visit the café →</span>
      <span className={s.aiDone}>
        <IconCheck /> 1 change · everything else kept
      </span>
    </div>
  );
}

function PhoneArt() {
  return (
    <div className={s.phoneArt}>
      <div className={s.phone}>
        <span className={s.phoneTitle} />
        <span />
        <span />
        <span className={s.phoneImg} />
        <span className={s.phoneBtn} />
      </div>
    </div>
  );
}

function HistoryArt() {
  return (
    <div className={s.historyArt}>
      <div className={s.historyRow}>
        <span className={s.historyBtn}>↶</span>
        <span className={s.historyBtn}>↷</span>
        <span className={s.saved}>Saved 12:13</span>
      </div>
      <div className={s.historyTrack}>
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} style={i(n)} />
        ))}
      </div>
    </div>
  );
}

function TerminalArt() {
  const lines = [
    { c: "$ unzip website.zip && npm ci", k: s.cmd },
    { c: "added 30 packages in 4s", k: s.out },
    { c: "$ npm run build", k: s.cmd },
    { c: "✓ Compiled successfully · / prerendered as static", k: s.ok },
    { c: "$ npm run start", k: s.cmd },
    { c: "▲ Ready on http://localhost:3000", k: s.ok },
  ];
  return (
    <div className={s.terminal}>
      <div className={s.terminalBar}>
        <i />
        <i />
        <i />
        <span>website — zsh</span>
      </div>
      <div className={s.terminalBody}>
        {lines.map((line, n) => (
          <span key={n} className={line.k} style={i(n)}>
            {line.c}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- icons

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconSpark() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}
function IconCursor() {
  return (
    <svg {...iconProps}>
      <path d="M5 3l14 7-6 2-2 6L5 3z" />
    </svg>
  );
}
function IconWand() {
  return (
    <svg {...iconProps}>
      <path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20l10-10M13 11l-2-2" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg {...iconProps}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg {...iconProps}>
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...iconProps} className={s.checkIcon}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
