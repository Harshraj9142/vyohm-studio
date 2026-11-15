/**
 * The page model: what we save for every element on the page.
 *
 * This file has no editor or Puck imports, so it is copied as-is into the
 * exported Next.js project. The editor (Puck), the AI and the export all use
 * these same shapes.
 *
 * Saved page shape (this is Puck's data format):
 *
 *   {
 *     root: { props: { title, fonts, colours, content: [Section, Section, ...] } },
 *     content: []
 *   }
 *
 * Every element is { type: "Heading", props: { id: "Heading-1234", ...settings } }.
 * The `id` never changes, which is how AI edits can target one exact element.
 */

export type Align = "left" | "center" | "right";

/** A single element on the page, e.g. { type: "Button", props: { id, label, ... } } */
export type ElementNode = {
  type: string;
  props: { id: string; [key: string]: unknown };
};

/** Fonts are font stacks only (no downloads), so the export works offline. */
export type FontKey = "sans" | "serif" | "rounded" | "mono";

export type PageRootData = {
  title: string;
  description: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  background: string;
  textColor: string;
};

export type SectionData = {
  anchor: string; // used for links like "#contact"
  bgColor: string; // "" means "inherit from the page"
  textColor: string;
  paddingY: number;
  maxWidth: number;
  gap: number;
  /** Background treatment on top of bgColor (optional; older pages don't have it). */
  bgStyle?: "solid" | "gradient" | "spotlight";
  mobile: { paddingY?: number | null; gap?: number | null };
};

export type ContainerData = {
  columns: "1" | "2";
  ratio: "1:1" | "2:1" | "1:2";
  gap: number;
  padding: number;
  valign: "start" | "center" | "end";
  bgColor: string;
  radius: number;
  /** Card look: "card" (soft shadow), "glow" (top glow), "outline" (hairline + corner marks). */
  surface?: "none" | "card" | "glow" | "outline";
  mobile: {
    columns?: "" | "1" | "2"; // "" = stack (default on phones)
    gap?: number | null;
    padding?: number | null;
  };
};

export type HeadingData = {
  text: string;
  level: "h1" | "h2" | "h3";
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  color: string;
  align: Align;
  mobile: { fontSize?: number | null; align?: Align | "" };
};

export type ParagraphData = {
  text: string;
  fontSize: number;
  color: string;
  align: Align;
  /** "lead" = muted intro text, "eyebrow" = small caps label, "badge" = pill label. */
  variant?: "body" | "lead" | "eyebrow" | "badge";
  mobile: { fontSize?: number | null; align?: Align | "" };
};

export type ImageData = {
  /**
   * Where the picture comes from:
   *  - "asset:<id>"         an uploaded image (stored in the browser, exported to /assets)
   *  - "placeholder:<text>" a labelled placeholder box
   *  - "https://..."        an image on the web
   *  - "/assets/..."        a file inside the exported project
   */
  src: string;
  alt: string;
  width: number; // percent of the column
  height: number; // px, 0 = automatic
  fit: "cover" | "contain";
  radius: number;
  align: Align;
  mobile: { width?: number | null; height?: number | null };
};

export type ButtonData = {
  label: string;
  href: string;
  newTab: boolean;
  variant: "solid" | "outline";
  bgColor: string;
  textColor: string;
  size: "sm" | "md" | "lg";
  radius: number;
  align: Align;
  icon?: "none" | "arrow";
  mobile: { fullWidth?: "" | "yes"; align?: Align | "" };
};

/**
 * Allowed number ranges, [min, max]. One source of truth for:
 * the editor's number fields, cleaning up AI output, and page validation.
 */
export const LIMITS = {
  Section: { paddingY: [0, 320], gap: [0, 160], maxWidth: [320, 1600] },
  Container: { gap: [0, 160], padding: [0, 160], radius: [0, 64] },
  Heading: { fontSize: [10, 160] },
  Paragraph: { fontSize: [10, 48] },
  Image: { width: [10, 100], height: [0, 1200], radius: [0, 400] },
  Button: { radius: [0, 64] },
} as const satisfies Record<string, Record<string, readonly [number, number]>>;

/** Starting values for each element type (used by the editor and when building AI pages). */
export const DEFAULT_ROOT: PageRootData = {
  title: "My landing page",
  description: "",
  headingFont: "sans",
  bodyFont: "sans",
  background: "#ffffff",
  textColor: "#16181d",
};

export const DEFAULT_PROPS = {
  Section: {
    anchor: "",
    bgColor: "",
    textColor: "",
    paddingY: 80,
    gap: 24,
    maxWidth: 1120,
    bgStyle: "solid",
    mobile: {},
  } satisfies SectionData,
  Container: {
    columns: "2",
    ratio: "1:1",
    valign: "center",
    gap: 32,
    padding: 0,
    bgColor: "",
    radius: 0,
    surface: "none",
    mobile: {},
  } satisfies ContainerData,
  Heading: {
    text: "Heading",
    level: "h2",
    fontSize: 40,
    fontWeight: "700",
    color: "",
    align: "left",
    mobile: {},
  } satisfies HeadingData,
  Paragraph: {
    text: "Write something about your business here.",
    fontSize: 17,
    color: "",
    align: "left",
    variant: "body",
    mobile: {},
  } satisfies ParagraphData,
  Image: {
    src: "placeholder:Image",
    alt: "",
    width: 100,
    height: 0,
    fit: "cover",
    radius: 0,
    align: "center",
    mobile: {},
  } satisfies ImageData,
  Button: {
    label: "Get in touch",
    href: "#contact",
    newTab: false,
    variant: "solid",
    bgColor: "",
    textColor: "",
    size: "md",
    radius: 8,
    align: "left",
    icon: "none",
    mobile: {},
  } satisfies ButtonData,
};

export type ElementType = keyof typeof DEFAULT_PROPS;
export const ELEMENT_TYPES = Object.keys(DEFAULT_PROPS) as ElementType[];

/** Which settings each element type can override on phones (inside `mobile`). */
export const MOBILE_KEYS: Record<ElementType, readonly string[]> = {
  Section: ["paddingY", "gap"],
  Container: ["columns", "gap", "padding"],
  Heading: ["fontSize", "align"],
  Paragraph: ["fontSize", "align"],
  Image: ["width", "height"],
  Button: ["fullWidth", "align"],
};

/** Every editable setting of a type, e.g. Button -> ["label", "href", ..., "mobile.align"]. */
export function editableProps(type: ElementType): string[] {
  return [
    ...Object.keys(DEFAULT_PROPS[type]).filter((key) => key !== "mobile"),
    ...MOBILE_KEYS[type].map((key) => `mobile.${key}`),
  ];
}

export function isElementType(value: unknown): value is ElementType {
  return typeof value === "string" && value in DEFAULT_PROPS;
}

/** Allowed values for "choice" settings (shown to the AI in the edit prompt). */
export const CHOICES = {
  Section: { bgStyle: ["solid", "gradient", "spotlight"] },
  Container: {
    columns: ["1", "2"],
    ratio: ["1:1", "2:1", "1:2"],
    valign: ["start", "center", "end"],
    surface: ["none", "card", "glow", "outline"],
    "mobile.columns": ["", "2"],
  },
  Heading: { level: ["h1", "h2", "h3"], fontWeight: ["400", "500", "600", "700", "800"], align: ["left", "center", "right"] },
  Paragraph: { variant: ["body", "lead", "eyebrow", "badge"], align: ["left", "center", "right"] },
  Image: { fit: ["cover", "contain"], align: ["left", "center", "right"] },
  Button: {
    variant: ["solid", "outline"],
    size: ["sm", "md", "lg"],
    icon: ["none", "arrow"],
    align: ["left", "center", "right"],
    "mobile.fullWidth": ["", "yes"],
  },
} as const;

/** Which element types each slot accepts. Used by the editor and by AI validation. */
export const NESTING = {
  page: ["Section"],
  Section: ["Container", "Heading", "Paragraph", "Image", "Button"],
  Container: ["Heading", "Paragraph", "Image", "Button"],
} as const;

/** Slot (child list) names for each element type. */
export const SLOT_KEYS: Record<string, readonly string[]> = {
  Section: ["content"],
  Container: ["left", "right"],
};
