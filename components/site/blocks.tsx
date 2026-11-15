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
  mobile,
  content: Content,
}: SectionData & { content: SlotComponent }) {
  return (
    <section
      id={slugify(anchor) || undefined}
      className="vs-section"
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
  mobile,
  left: Left,
  right: Right,
  puck,
}: ContainerData & { left: SlotComponent; right: SlotComponent } & EditorFlag) {
  const desktopColumns = columns === "2" ? COLUMN_TEMPLATES[ratio] ?? COLUMN_TEMPLATES["1:1"] : ONE_COLUMN;
  // Phones stack columns unless the user picks "side by side" for mobile.
  const mobileColumns = mobile?.columns === "2" ? desktopColumns : ONE_COLUMN;
  // On the live site, hide an empty column so it doesn't leave a gap.
  const columnClass = puck?.isEditing ? "vs-col" : "vs-col vs-col--live";

  return (
    <div
      className="vs-container"
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

export function Paragraph({
  text,
  fontSize,
  color,
  align,
  mobile,
}: Editable<ParagraphData, "text">) {
  return (
    <p
      className="vs-paragraph"
      style={cssVars({
        "--p-size": px(fontSize),
        "--p-size-m": px(mobile?.fontSize),
        "--p-color": safeColor(color),
        "--p-align": align,
        "--p-align-m": mobile?.align,
      })}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------- Image

const MARGINS = {
  left: ["0", "auto"],
  center: ["auto", "auto"],
  right: ["auto", "0"],
} as const;

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
        {label}
      </a>
    </div>
  );
}
