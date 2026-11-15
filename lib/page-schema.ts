import { z } from "zod";
import { LIMITS } from "@/components/site/model";

/**
 * Strict validation of a whole page (Puck data).
 *
 * Every AI result is checked with this BEFORE it is applied to the editor.
 * If it fails, the AI result is thrown away and the current page is untouched.
 *
 * It checks: allowed element types, allowed nesting, colours, number ranges,
 * image sources, links, and that every id is unique.
 * Newer design settings (variant, surface, bgStyle, icon) are optional so pages
 * saved before they existed still validate.
 */

const num = ([min, max]: readonly [number, number]) => z.number().finite().min(min).max(max);
const optNum = (range: readonly [number, number]) => num(range).nullable().optional();

const id = z.string().min(1).max(80);
const text = z.string().max(4000);
const color = z.string().regex(/^(#([0-9a-f]{3}|[0-9a-f]{6}))?$/i, "Colours must be #hex or empty");
const align = z.enum(["left", "center", "right"]);
const mobileAlign = z.enum(["", "left", "center", "right"]).optional();
const font = z.enum(["sans", "serif", "rounded", "mono"]);

const imageSrc = z
  .string()
  .max(2048)
  .regex(
    /^(asset:[a-z0-9]{6,40}|placeholder:[^\n]{0,200}|https?:\/\/\S+|\/\S*)$/i,
    "Unsupported image source",
  );
// Any text is allowed here because users may type links like "www.example.com".
// Unsafe links are neutralised when the button is drawn (safeHref in style.ts),
// and AI-written links are cleaned with safeHref before they are stored.
const href = z.string().max(2048);

// ---------------------------------------------------------------- elements

const Heading = z.object({
  type: z.literal("Heading"),
  props: z.object({
    id,
    text,
    level: z.enum(["h1", "h2", "h3"]),
    fontSize: num(LIMITS.Heading.fontSize),
    fontWeight: z.enum(["400", "500", "600", "700", "800"]),
    color,
    align,
    mobile: z.object({ fontSize: optNum(LIMITS.Heading.fontSize), align: mobileAlign }),
  }),
});

const Paragraph = z.object({
  type: z.literal("Paragraph"),
  props: z.object({
    id,
    text,
    fontSize: num(LIMITS.Paragraph.fontSize),
    color,
    align,
    variant: z.enum(["body", "lead", "eyebrow", "badge"]).optional(),
    mobile: z.object({ fontSize: optNum(LIMITS.Paragraph.fontSize), align: mobileAlign }),
  }),
});

const Image = z.object({
  type: z.literal("Image"),
  props: z.object({
    id,
    src: imageSrc,
    alt: z.string().max(500),
    width: num(LIMITS.Image.width),
    height: num(LIMITS.Image.height),
    fit: z.enum(["cover", "contain"]),
    radius: num(LIMITS.Image.radius),
    align,
    mobile: z.object({ width: optNum(LIMITS.Image.width), height: optNum(LIMITS.Image.height) }),
  }),
});

const Button = z.object({
  type: z.literal("Button"),
  props: z.object({
    id,
    label: z.string().max(200),
    href,
    newTab: z.boolean(),
    variant: z.enum(["solid", "outline"]),
    bgColor: color,
    textColor: color,
    size: z.enum(["sm", "md", "lg"]),
    radius: num(LIMITS.Button.radius),
    align,
    icon: z.enum(["none", "arrow"]).optional(),
    mobile: z.object({ fullWidth: z.enum(["", "yes"]).optional(), align: mobileAlign }),
  }),
});

/** Elements allowed inside a container column. */
const ContentElement = z.discriminatedUnion("type", [Heading, Paragraph, Image, Button]);

const Container = z.object({
  type: z.literal("Container"),
  props: z.object({
    id,
    columns: z.enum(["1", "2"]),
    ratio: z.enum(["1:1", "2:1", "1:2"]),
    valign: z.enum(["start", "center", "end"]),
    gap: num(LIMITS.Container.gap),
    padding: num(LIMITS.Container.padding),
    bgColor: color,
    radius: num(LIMITS.Container.radius),
    surface: z.enum(["none", "card", "glow", "outline"]).optional(),
    mobile: z.object({
      columns: z.enum(["", "1", "2"]).optional(),
      gap: optNum(LIMITS.Container.gap),
      padding: optNum(LIMITS.Container.padding),
    }),
    left: z.array(ContentElement).max(40),
    right: z.array(ContentElement).max(40),
  }),
});

/** Elements allowed directly inside a section. */
const SectionElement = z.discriminatedUnion("type", [Container, Heading, Paragraph, Image, Button]);

const Section = z.object({
  type: z.literal("Section"),
  props: z.object({
    id,
    anchor: z.string().max(80),
    bgColor: color,
    textColor: color,
    paddingY: num(LIMITS.Section.paddingY),
    gap: num(LIMITS.Section.gap),
    maxWidth: num(LIMITS.Section.maxWidth),
    bgStyle: z.enum(["solid", "gradient", "spotlight"]).optional(),
    mobile: z.object({ paddingY: optNum(LIMITS.Section.paddingY), gap: optNum(LIMITS.Section.gap) }),
    content: z.array(SectionElement).max(60),
  }),
});

// ---------------------------------------------------------------- page

export const PageSchema = z
  .object({
    root: z.object({
      props: z.object({
        title: z.string().max(200),
        description: z.string().max(1000),
        headingFont: font,
        bodyFont: font,
        background: color,
        textColor: color,
        content: z.array(Section).max(30),
      }),
    }),
    content: z.array(z.unknown()).max(0).optional(), // we keep sections in root.props.content
    zones: z.record(z.string(), z.array(z.unknown()).max(0)).optional(),
  })
  .superRefine((page, ctx) => {
    // Every id must be unique, otherwise targeted edits could hit the wrong element.
    const seen = new Set<string>();
    const visit = (nodes: { props: { id: string } & Record<string, unknown> }[]) => {
      for (const node of nodes) {
        if (seen.has(node.props.id)) {
          ctx.addIssue({ code: "custom", message: `Duplicate element id "${node.props.id}"` });
        }
        seen.add(node.props.id);
        for (const key of ["content", "left", "right"]) {
          const children = node.props[key];
          if (Array.isArray(children)) visit(children);
        }
      }
    };
    visit(page.root.props.content);
  });

export type ValidPage = z.infer<typeof PageSchema>;

/** Returns null if the page is valid, otherwise a short, readable reason. */
export function findPageProblem(data: unknown): string | null {
  const result = PageSchema.safeParse(data);
  if (result.success) return null;
  const issue = result.error.issues[0];
  const where = issue.path.length ? ` (at ${issue.path.join(".")})` : "";
  return `${issue.message}${where}`;
}
