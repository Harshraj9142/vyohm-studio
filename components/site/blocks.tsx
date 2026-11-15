import type { CSSProperties, ReactNode } from "react";
import type {
  ButtonData,
  ContainerData,
  HeadingData,
  ImageData,
  PageRootData,
  ParagraphData,
  SectionData,
} from "./model";
import { resolveImage } from "./assets";
import {
  cssVars,
  FONT_STACKS,
  JUSTIFY,
  pct,
  px,
  safeColor,
  safeHref,
  slugify,
} from "./style";

/**
 * The six building blocks of a page.
 *
 * These are plain React components. The editor (Puck) renders them in the
 * live preview, and the exported Next.js project renders the very same
 * components, so the export looks exactly like the editor.
 */

/** A slot is a list of child elements. Puck gives us one in the editor; the export gives its own. */
export type SlotComponent = (props: {
  className?: string;
  style?: CSSProperties;
  minEmptyHeight?: number;
}) => ReactNode;

/** Puck passes `puck.isEditing`; the export passes nothing. */
type EditorFlag = { puck?: { isEditing?: boolean } };

/** In the editor, inline-editable text arrives as a React element instead of a string. */
type Editable<T, K extends keyof T> = Omit<T, K> & { [P in K]: ReactNode };

/** Join class names, skipping empty ones. */
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** Pick a known option, or fall back (older pages may not have newer settings). */
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

// ---------------------------------------------------------------- Page

export function PageShell({
  headingFont,
  bodyFont,
  background,
  textColor,
  children,
}: Partial<PageRootData> & { children?: ReactNode }) {
  return (
    <div
      className="vs-page"
      style={cssVars({
        "--vs-font": FONT_STACKS[bodyFont ?? "sans"] ?? FONT_STACKS.sans,
        "--vs-heading-font": FONT_STACKS[headingFont ?? "sans"] ?? FONT_STACKS.sans,
        "--vs-bg": safeColor(background),
        "--vs-text": safeColor(textColor),
      })}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Section

export function Section({
  anchor,
  bgColor,
  textColor,
  paddingY,
  maxWidth,
  gap,
  bgStyle,
  mobile,
  content: Content,
  puck,
}: SectionData & { content: SlotComponent } & EditorFlag) {
  const background = oneOf(bgStyle, ["solid", "gradient", "spotlight"] as const, "solid");
  return (
    <section
      id={slugify(anchor) || undefined}
      // "--live" turns on the scroll fade-in on the real site (never inside the editor).
      className={cx("vs-section", `vs-section--${background}`, !puck?.isEditing && "vs-section--live")}
      style={cssVars({
        "--s-bg": safeColor(bgColor),
        "--s-color": safeColor(textColor),
        "--s-py": px(paddingY),
        "--s-py-m": px(mobile?.paddingY),
        "--s-maxw": px(maxWidth),
        "--s-gap": px(gap),
        "--s-gap-m": px(mobile?.gap),
      })}
    >
      <Content className="vs-section__inner" minEmptyHeight={120} />
    </section>
  );
}

// ---------------------------------------------------------------- Container

const COLUMN_TEMPLATES: Record<ContainerData["ratio"], string> = {
  "1:1": "minmax(0, 1fr) minmax(0, 1fr)",
  "2:1": "minmax(0, 2fr) minmax(0, 1fr)",
  "1:2": "minmax(0, 1fr) minmax(0, 2fr)",
};
const ONE_COLUMN = "minmax(0, 1fr)";

export function Container({
  columns,
  ratio,
  gap,
  padding,
  valign,
  bgColor,
  radius,
  surface,
  mobile,
  left: Left,
  right: Right,
  puck,
}: ContainerData & { left: SlotComponent; right: SlotComponent } & EditorFlag) {
  const look = oneOf(surface, ["none", "card", "glow", "outline"] as const, "none");
  const desktopColumns = columns === "2" ? COLUMN_TEMPLATES[ratio] ?? COLUMN_TEMPLATES["1:1"] : ONE_COLUMN;
  // Phones stack columns unless the user picks "side by side" for mobile.
  const mobileColumns = mobile?.columns === "2" ? desktopColumns : ONE_COLUMN;
  // On the live site, hide an empty column so it doesn't leave a gap.
  const columnClass = puck?.isEditing ? "vs-col" : "vs-col vs-col--live";

  return (
    <div
      // Hover effects only on the real site, so they don't fight the editor's selection outline.
      className={cx(
        "vs-container",
        look !== "none" && `vs-container--surface vs-container--${look}`,
        !puck?.isEditing && "vs-container--live",
      )}
      style={cssVars({
        "--c-cols": desktopColumns,
        "--c-cols-m": mobileColumns,
        "--c-gap": px(gap),
        "--c-gap-m": px(mobile?.gap),
        "--c-pad": px(padding),
        "--c-pad-m": px(mobile?.padding),
        "--c-valign": valign,
        "--c-bg": safeColor(bgColor),
        "--c-radius": px(radius),
      })}
    >
      <Left className={columnClass} minEmptyHeight={80} />
      <Right className={columnClass} minEmptyHeight={80} />
    </div>
  );
}

// ---------------------------------------------------------------- Heading

export function Heading({
  text,
  level,
  fontSize,
  fontWeight,
  color,
  align,
  mobile,
}: Editable<HeadingData, "text">) {
  const Tag = level === "h1" || level === "h3" ? level : "h2";
  return (
    <Tag
      className="vs-heading"
      style={cssVars({
        "--h-size": px(fontSize),
        "--h-size-m": px(mobile?.fontSize),
        "--h-weight": fontWeight,
        "--h-color": safeColor(color),
        "--h-align": align,
        "--h-align-m": mobile?.align,
      })}
    >
      {text}
    </Tag>
  );
}

// ---------------------------------------------------------------- Paragraph

/** Left/right margins that line a narrower box up with the chosen alignment. */
const MARGINS = {
  left: ["0", "auto"],
  center: ["auto", "auto"],
  right: ["auto", "0"],
} as const;

export function Paragraph({
  text,
  fontSize,
  color,
  align,
  variant,
  mobile,
}: Editable<ParagraphData, "text">) {
  const style = oneOf(variant, ["body", "lead", "eyebrow", "badge"] as const, "body");
  // Lead text and badges are narrower than the column, so they need margins to align.
  const [ml, mr] = MARGINS[align] ?? MARGINS.left;
  const [mlMobile, mrMobile] = mobile?.align ? MARGINS[mobile.align] : [undefined, undefined];
  return (
    <p
      className={cx("vs-paragraph", style !== "body" && `vs-paragraph--${style}`)}
      style={cssVars({
        "--p-size": px(fontSize),
        "--p-size-m": px(mobile?.fontSize),
        "--p-color": safeColor(color),
        "--p-align": align,
        "--p-align-m": mobile?.align,
        "--p-ml": ml,
        "--p-mr": mr,
        "--p-ml-m": mlMobile,
        "--p-mr-m": mrMobile,
      })}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------- Image


export function Image({ src, alt, width, height, fit, radius, align, mobile }: ImageData) {
  const image = resolveImage(src);
  const [marginLeft, marginRight] = MARGINS[align] ?? MARGINS.left;
  const style = cssVars({
    "--i-width": pct(width),
    "--i-width-m": pct(mobile?.width),
    "--i-height": height ? px(height) : undefined,
    "--i-height-m": mobile?.height ? px(mobile.height) : undefined,
    "--i-fit": fit,
    "--i-radius": px(radius),
    "--i-ml": marginLeft,
    "--i-mr": marginRight,
  });

  return (
    <figure className="vs-image" style={style}>
      {image.kind === "image" ? (
        // A plain <img> keeps the export simple (no next/image config needed).
        // eslint-disable-next-line @next/next/no-img-element
        <img className="vs-image__media" src={image.url} alt={alt ?? ""} />
      ) : (
        <div
          className="vs-image__media vs-image__placeholder"
          role="img"
          aria-label={alt || image.label}
        >
          <svg className="vs-image__icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="M4 18l5.5-5.5 3.5 3.5 2.5-2.5L20 18" />
          </svg>
          <span>{image.label}</span>
          <small>Placeholder image</small>
        </div>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------- Button

export function Button({
  label,
  href,
  newTab,
  variant,
  bgColor,
  textColor,
  size,
  radius,
  align,
  icon,
  mobile,
  puck,
}: Editable<ButtonData, "label"> & EditorFlag) {
  const editing = puck?.isEditing;
  const classes = [
    "vs-button",
    `vs-button--${size === "sm" || size === "lg" ? size : "md"}`,
    variant === "outline" ? "vs-button--outline" : "",
    mobile?.fullWidth === "yes" ? "vs-button--full-m" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="vs-button-row"
      style={cssVars({
        "--b-justify": JUSTIFY[align],
        "--b-justify-m": mobile?.align ? JUSTIFY[mobile.align] : undefined,
      })}
    >
      <a
        className={classes}
        // In the editor, clicking a button should select it, not open the link.
        href={editing ? undefined : safeHref(href)}
        target={newTab && !editing ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        style={cssVars({
          "--b-bg": safeColor(bgColor),
          "--b-color": safeColor(textColor),
          "--b-radius": px(radius),
        })}
      >
        <span>{label}</span>
        {icon === "arrow" ? (
          <svg className="vs-button__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        ) : null}
      </a>
    </div>
  );
}
