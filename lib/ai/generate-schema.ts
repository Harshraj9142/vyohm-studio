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

const Heading = z.object({
  type: z.literal("Heading"),
  text: z.string(),
  level: z.enum(["h1", "h2", "h3"]).describe("Exactly one h1 per page (in the hero)."),
  fontSize: z.number().describe("px. h1: 48-76, h2: 32-46, h3: 20-30."),
  fontWeight: z.enum(["400", "500", "600", "700", "800"]),
  color,
  align,
});

const Paragraph = z.object({
  type: z.literal("Paragraph"),
  text: z.string().describe("1-3 sentences. Use \\n for a line break."),
  fontSize: z.number().describe("px, 14-21. Small labels/eyebrows may use 12-14."),
  color,
  align,
});

const Image = z.object({
  type: z.literal("Image"),
  placeholderLabel: z
    .string()
    .describe("Short description of the photo that should go here, e.g. 'Close-up of gold silk scarf'."),
  alt: z.string().describe("Accessible alt text describing the intended image."),
  height: z.number().describe("px, 0 = automatic 4:3 box. Hero images 420-560, cards 240-360."),
  radius: z.number().describe("Corner radius px, 0-32."),
});

const Button = z.object({
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
});

const ContentElement = z.union([Heading, Paragraph, Image, Button]);

const Container = z.object({
  type: z.literal("Container"),
  columns: z.enum(["1", "2"]),
  ratio: z.enum(["1:1", "2:1", "1:2"]).describe("Column widths when columns is 2."),
  valign: z.enum(["start", "center", "end"]),
  gap: z.number().describe("px between columns, 16-80."),
  padding: z.number().describe("Inner padding px, 0-64. Use with bgColor to make a card."),
  bgColor: color,
  radius: z.number().describe("Corner radius px, 0-32."),
  left: z.array(ContentElement).describe("Elements in the first column."),
  right: z.array(ContentElement).describe("Elements in the second column (empty if columns is 1)."),
});

const Section = z.object({
  anchor: z
    .string()
    .describe('Short id for links, e.g. "about", "collections", "contact". Unique per page.'),
  bgColor: color,
  textColor: color,
  paddingY: z.number().describe("Vertical padding px, 56-140."),
  gap: z.number().describe("px between the section's direct children, 16-64."),
  children: z.array(z.union([Container, Heading, Paragraph, Image, Button])),
});

export const GeneratedPageSchema = z.object({
  title: z.string().describe("Browser tab title, e.g. 'Loom & Line — Premium Clothing'."),
  description: z.string().describe("One-sentence meta description."),
  headingFont: z.enum(["sans", "serif", "rounded", "mono"]),
  bodyFont: z.enum(["sans", "serif", "rounded", "mono"]),
  background: z.string().describe("Page background hex colour."),
  textColor: z.string().describe("Main text hex colour with strong contrast against the background."),
  sections: z.array(Section).describe("4 to 6 sections, top to bottom."),
});

export type GeneratedPage = z.infer<typeof GeneratedPageSchema>;
export type GeneratedSection = GeneratedPage["sections"][number];
export type GeneratedElement = GeneratedSection["children"][number];
