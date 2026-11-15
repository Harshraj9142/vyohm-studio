import { z } from "zod";

/**
 * The JSON shape Claude must return when generating a NEW page.
 *
 * We send this schema to the Claude API as a "structured output" format, so the
 * reply is guaranteed to be JSON in exactly this shape. It is simpler than the
 * saved page format: no ids, no mobile overrides, images are placeholder labels.
 * lib/ai/convert.ts turns it into the real page (adding ids, defaults, clamping).
 *
 * Note: the structured-output API does not support min/max on numbers, so the
 * ranges are written in the descriptions and enforced later in convert.ts.
 */

const color = z
  .string()
  .describe('Hex colour such as "#1f2937". Use "" (empty) to inherit from the section/page.');
const align = z.enum(["left", "center", "right"]);

export const HeadingGen = z.object({
  type: z.literal("Heading"),
  text: z.string(),
  level: z.enum(["h1", "h2", "h3"]).describe("Exactly one h1 per page (in the hero)."),
  fontSize: z.number().describe("px. h1: 48-80 (keep the h1 to 2-8 words), h2: 30-56, h3: 20-30."),
  fontWeight: z.enum(["400", "500", "600", "700", "800"]),
  color,
  align,
});

export const ParagraphGen = z.object({
  type: z.literal("Paragraph"),
  text: z.string().describe("1-3 sentences. Use \\n for a line break."),
  fontSize: z.number().describe("px, 14-21. Small labels/eyebrows may use 12-14."),
  color,
  align,
  variant: z
    .enum(["body", "lead", "eyebrow", "badge"])
    .describe('"lead" = muted intro under a heading; "eyebrow" = small caps label; "badge" = pill label above a heading.'),
});

export const ImageGen = z.object({
  type: z.literal("Image"),
  placeholderLabel: z
    .string()
    .describe("Short description of the photo that should go here, e.g. 'Close-up of gold silk scarf'."),
  alt: z.string().describe("Accessible alt text describing the intended image."),
  height: z.number().describe("px, 0 = automatic 4:3 box. Hero images 380-560, wide bands 320-520, cards 220-360."),
  radius: z.number().describe("Corner radius px, 0-32."),
});

export const ButtonGen = z.object({
  type: z.literal("Button"),
  label: z.string(),
  href: z
    .string()
    .describe('A section link like "#contact", or "mailto:hello@example.com". Never invent real URLs.'),
  variant: z.enum(["solid", "outline"]),
  bgColor: color,
  textColor: color,
  size: z.enum(["sm", "md", "lg"]),
  radius: z.number().describe("Corner radius px, 0-32."),
  align,
  icon: z.enum(["none", "arrow"]).describe('"arrow" adds a → icon; use on primary call-to-action buttons.'),
});

export const ContentElementGen = z.union([HeadingGen, ParagraphGen, ImageGen, ButtonGen]);

export const ContainerGen = z.object({
  type: z.literal("Container"),
  columns: z.enum(["1", "2"]),
  ratio: z.enum(["1:1", "2:1", "1:2"]).describe("Column widths when columns is 2."),
  valign: z.enum(["start", "center", "end"]),
  gap: z.number().describe("px between columns, 16-80."),
  padding: z.number().describe("Inner padding px, 0-64. Use with bgColor to make a card."),
  bgColor: color,
  radius: z.number().describe("Corner radius px, 0-32."),
  surface: z
    .enum(["none", "card", "glow", "outline"])
    .describe('Card look for product/service items: "card" soft shadow, "glow" top light (great on dark), "outline" hairline with corner marks (minimal/editorial). "none" for plain layout rows.'),
  left: z.array(ContentElementGen).describe("Elements in the first column."),
  right: z.array(ContentElementGen).describe("Elements in the second column (empty if columns is 1)."),
});

export const SectionGen = z.object({
  anchor: z
    .string()
    .describe('Short id for links, e.g. "about", "collections", "contact". Unique per page.'),
  bgColor: color,
  textColor: color,
  paddingY: z.number().describe("Vertical padding px, 56-140."),
  gap: z.number().describe("px between the section's direct children, 16-64."),
  bgStyle: z
    .enum(["solid", "gradient", "spotlight"])
    .describe('"spotlight" = glow at the top (hero on dark themes), "gradient" = soft wash, "solid" = plain.'),
  children: z.array(z.union([ContainerGen, HeadingGen, ParagraphGen, ImageGen, ButtonGen])),
});

const font = z.enum(["sans", "serif", "rounded", "mono"]);

/** How many design directions Claude proposes before building one of them. */
export const DIRECTION_COUNT = 4;

/**
 * Claude writes DIRECTION_COUNT design directions BEFORE the sections (JSON is generated
 * in order, so this works as a "think first" step), then builds the one the server picked
 * at random. This is what makes pages differ.
 *
 * Both planning fields are single plain strings on purpose. This schema sits right at the
 * API's size limit for structured outputs: an object per direction, or two arrays plus a
 * string, fails with 400 "The compiled grammar is too large". Test any new field with a
 * real request before relying on it.
 */
export const GeneratedPageSchema = z.object({
  designDirections: z
    .string()
    .describe(
      `Exactly ${DIRECTION_COUNT} clearly different visual directions for THIS brief, written before the page, ` +
        `one per line: "1. Name | feeling and signature idea | background #hex, accent #hex | heading font | hero layout".`,
    ),
  sectionPlan: z
    .string()
    .describe('The chosen direction\'s sections, top to bottom, one per line as "purpose: pattern", e.g. "collections: alternating rows".'),
  title: z.string().describe("Browser tab title, e.g. 'Loom & Line — Premium Clothing'."),
  description: z.string().describe("One-sentence meta description."),
  headingFont: font,
  bodyFont: font,
  background: z.string().describe("Page background hex colour."),
  textColor: z.string().describe("Main text hex colour with strong contrast against the background."),
  sections: z.array(SectionGen).describe("4 to 7 sections, top to bottom, following sectionPlan."),
});

export type GeneratedPage = z.infer<typeof GeneratedPageSchema>;
export type GeneratedSection = GeneratedPage["sections"][number];
export type GeneratedElement = GeneratedSection["children"][number];
