import type { Data } from "@puckeditor/core";
import { DEFAULT_ROOT, LIMITS, type ElementNode } from "@/components/site/model";
import { safeColor, safeHref, slugify } from "@/components/site/style";
import { makeElement, makePage } from "@/lib/page-tree";
import type { GeneratedElement, GeneratedPage } from "./generate-schema";

/**
 * Turns Claude's generated JSON into a real page.
 *
 *  - gives every element a fresh, unique id
 *  - fills in defaults (e.g. mobile overrides start empty)
 *  - clamps numbers into the allowed ranges (LIMITS)
 *  - drops unsafe colours and links
 *  - limits how many elements we accept
 *
 * The result is then checked again with the strict page validator.
 */

function clamp(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "") // control characters (keep \n)
    .trim()
    .slice(0, maxLength);
}

const color = (value: unknown) => safeColor(value) ?? "";
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const ALIGN = ["left", "center", "right"] as const;

function toContentElement(el: GeneratedElement): ElementNode | null {
  switch (el.type) {
    case "Heading":
      return makeElement("Heading", {
        text: cleanText(el.text, 300) || "Heading",
        level: pick(el.level, ["h1", "h2", "h3"] as const, "h2"),
        fontSize: clamp(el.fontSize, LIMITS.Heading.fontSize, 40),
        fontWeight: pick(el.fontWeight, ["400", "500", "600", "700", "800"] as const, "700"),
        color: color(el.color),
        align: pick(el.align, ALIGN, "left"),
      });
    case "Paragraph":
      return makeElement("Paragraph", {
        text: cleanText(el.text, 1200),
        fontSize: clamp(el.fontSize, LIMITS.Paragraph.fontSize, 17),
        color: color(el.color),
        align: pick(el.align, ALIGN, "left"),
      });
    case "Image": {
      const label = cleanText(el.placeholderLabel, 120).replace(/\n/g, " ") || "Image";
      return makeElement("Image", {
        src: `placeholder:${label}`,
        alt: cleanText(el.alt, 300) || label,
        height: clamp(el.height, LIMITS.Image.height, 0),
        radius: clamp(el.radius, LIMITS.Image.radius, 0),
      });
    }
    case "Button":
      return makeElement("Button", {
        label: cleanText(el.label, 60) || "Learn more",
        href: safeHref(el.href),
        variant: pick(el.variant, ["solid", "outline"] as const, "solid"),
        bgColor: color(el.bgColor),
        textColor: color(el.textColor),
        size: pick(el.size, ["sm", "md", "lg"] as const, "md"),
        radius: clamp(el.radius, LIMITS.Button.radius, 8),
        align: pick(el.align, ALIGN, "left"),
      });
    default:
      return null;
  }
}

function toSectionChild(el: GeneratedElement): ElementNode | null {
  if (el.type !== "Container") return toContentElement(el);
  const column = (items: GeneratedElement[]) =>
    items
      .filter((item) => item.type !== "Container") // no containers inside containers
      .slice(0, 12)
      .map(toContentElement)
      .filter((node): node is ElementNode => node !== null);

  const columns = pick(el.columns, ["1", "2"] as const, "2");
  return makeElement("Container", {
    columns,
    ratio: pick(el.ratio, ["1:1", "2:1", "1:2"] as const, "1:1"),
    valign: pick(el.valign, ["start", "center", "end"] as const, "center"),
    gap: clamp(el.gap, LIMITS.Container.gap, 32),
    padding: clamp(el.padding, LIMITS.Container.padding, 0),
    bgColor: color(el.bgColor),
    radius: clamp(el.radius, LIMITS.Container.radius, 0),
    left: column(el.left),
    right: column(el.right),
  });
}

export function generatedToPage(generated: GeneratedPage): Data {
  const usedAnchors = new Set<string>();
  const uniqueAnchor = (value: unknown, index: number) => {
    const base = slugify(value) || `section-${index + 1}`;
    let anchor = base;
    for (let n = 2; usedAnchors.has(anchor); n++) anchor = `${base}-${n}`;
    usedAnchors.add(anchor);
    return anchor;
  };

  const sections = generated.sections.slice(0, 10).map((section, index) =>
    makeElement("Section", {
      anchor: uniqueAnchor(section.anchor, index),
      bgColor: color(section.bgColor),
      textColor: color(section.textColor),
      paddingY: clamp(section.paddingY, LIMITS.Section.paddingY, 80),
      gap: clamp(section.gap, LIMITS.Section.gap, 24),
      content: section.children
        .slice(0, 20)
        .map(toSectionChild)
        .filter((node): node is ElementNode => node !== null),
    }),
  );

  return makePage(
    {
      title: cleanText(generated.title, 120) || DEFAULT_ROOT.title,
      description: cleanText(generated.description, 300),
      headingFont: pick(generated.headingFont, ["sans", "serif", "rounded", "mono"] as const, "sans"),
      bodyFont: pick(generated.bodyFont, ["sans", "serif", "rounded", "mono"] as const, "sans"),
      background: safeColor(generated.background) ?? DEFAULT_ROOT.background,
      textColor: safeColor(generated.textColor) ?? DEFAULT_ROOT.textColor,
    },
    sections,
  );
}
