"use client";

import type { ComponentConfig, Config, Slot } from "@puckeditor/core";
import {
  Button,
  Container,
  Heading,
  Image as ImageBlock,
  PageShell,
  Paragraph,
  Section,
} from "@/components/site/blocks";
import {
  DEFAULT_PROPS,
  DEFAULT_ROOT,
  LIMITS,
  NESTING,
  type ButtonData,
  type ContainerData,
  type HeadingData,
  type ImageData,
  type PageRootData,
  type ParagraphData,
  type SectionData,
} from "@/components/site/model";
import { colorField, imageField, optionalNumberField, withNote } from "./fields";

/**
 * Puck configuration: registers our six blocks with the editor.
 *
 * For each block we tell Puck:
 *  - fields:       which settings appear in the right-hand panel
 *  - defaultProps: the values a new element starts with
 *  - render:       which React component draws it (from components/site/blocks.tsx)
 *
 * "slot" fields are lists of child elements. `allow` restricts what can be
 * dropped inside, so invalid nesting (e.g. a Section inside a Button) is blocked.
 */

type Props = {
  Section: SectionData & { content: Slot };
  Container: ContainerData & { left: Slot; right: Slot };
  Heading: HeadingData;
  Paragraph: ParagraphData;
  Image: ImageData;
  Button: ButtonData;
};
type RootProps = PageRootData & { content: Slot };

/** Turn a [min, max] pair from LIMITS into Puck field options. */
const range = ([min, max]: readonly [number, number]) => ({ min, max });

const alignOptions = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];
const mobileAlignOptions = [{ label: "Same as desktop", value: "" }, ...alignOptions];

const fontOptions = [
  { label: "Modern sans", value: "sans" },
  { label: "Elegant serif", value: "serif" },
  { label: "Friendly rounded", value: "rounded" },
  { label: "Technical mono", value: "mono" },
];

// ---------------------------------------------------------------- Section

const SectionConfig: ComponentConfig<Props["Section"]> = {
  label: "Section",
  fields: {
    content: { type: "slot", allow: [...NESTING.Section] },
    anchor: { type: "text", label: "Anchor name (for links like #contact)" },
    bgColor: colorField("Background"),
    textColor: colorField("Text colour"),
    paddingY: { type: "number", label: "Vertical padding (px)", ...range(LIMITS.Section.paddingY) },
    gap: { type: "number", label: "Space between items (px)", ...range(LIMITS.Section.gap) },
    maxWidth: { type: "number", label: "Content width (px)", ...range(LIMITS.Section.maxWidth) },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        paddingY: optionalNumberField("Vertical padding", { ...range(LIMITS.Section.paddingY) }),
        gap: optionalNumberField("Space between items", { ...range(LIMITS.Section.gap) }),
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Section, content: [] },
  renderFields: withNote(
    "Sections sit directly on the page. Drop containers, headings, paragraphs, images and buttons inside.",
  ),
  render: (props) => <Section {...props} />,
};

// ---------------------------------------------------------------- Container

const ContainerConfig: ComponentConfig<Props["Container"]> = {
  label: "Container",
  fields: {
    left: { type: "slot", allow: [...NESTING.Container] },
    right: { type: "slot", allow: [...NESTING.Container] },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "One", value: "1" },
        { label: "Two", value: "2" },
      ],
    },
    ratio: {
      type: "select",
      label: "Column widths (two columns)",
      options: [
        { label: "Equal (1:1)", value: "1:1" },
        { label: "Wide left (2:1)", value: "2:1" },
        { label: "Wide right (1:2)", value: "1:2" },
      ],
    },
    valign: {
      type: "radio",
      label: "Vertical alignment",
      options: [
        { label: "Top", value: "start" },
        { label: "Middle", value: "center" },
        { label: "Bottom", value: "end" },
      ],
    },
    gap: { type: "number", label: "Gap between columns (px)", ...range(LIMITS.Container.gap) },
    padding: { type: "number", label: "Padding (px)", ...range(LIMITS.Container.padding) },
    bgColor: colorField("Background", "None"),
    radius: { type: "number", label: "Corner radius (px)", ...range(LIMITS.Container.radius) },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        columns: {
          type: "select",
          label: "Columns on phones",
          options: [
            { label: "Stack (default)", value: "" },
            { label: "Keep side by side", value: "2" },
          ],
        },
        gap: optionalNumberField("Gap", { ...range(LIMITS.Container.gap) }),
        padding: optionalNumberField("Padding", { ...range(LIMITS.Container.padding) }),
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Container, left: [], right: [] },
  renderFields: withNote(
    "Containers go inside a section. Each column holds headings, paragraphs, images and buttons (not other containers or sections).",
  ),
  render: (props) => <Container {...props} />,
};

// ---------------------------------------------------------------- Heading

const HeadingConfig: ComponentConfig<Props["Heading"]> = {
  label: "Heading",
  fields: {
    // contentEditable lets the user click the heading in the preview and type.
    text: { type: "text", label: "Text", contentEditable: true },
    level: {
      type: "select",
      label: "Level",
      options: [
        { label: "H1 – page title", value: "h1" },
        { label: "H2 – section title", value: "h2" },
        { label: "H3 – small title", value: "h3" },
      ],
    },
    fontSize: { type: "number", label: "Font size (px)", ...range(LIMITS.Heading.fontSize) },
    fontWeight: {
      type: "select",
      label: "Weight",
      options: [
        { label: "Regular", value: "400" },
        { label: "Medium", value: "500" },
        { label: "Semibold", value: "600" },
        { label: "Bold", value: "700" },
        { label: "Extra bold", value: "800" },
      ],
    },
    color: colorField("Colour"),
    align: { type: "radio", label: "Alignment", options: alignOptions },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        fontSize: optionalNumberField("Font size", { ...range(LIMITS.Heading.fontSize) }),
        align: { type: "select", label: "Alignment", options: mobileAlignOptions },
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Heading },
  render: (props) => <Heading {...props} />,
};

// ---------------------------------------------------------------- Paragraph

const ParagraphConfig: ComponentConfig<Props["Paragraph"]> = {
  label: "Paragraph",
  fields: {
    text: { type: "textarea", label: "Text", contentEditable: true },
    fontSize: { type: "number", label: "Font size (px)", ...range(LIMITS.Paragraph.fontSize) },
    color: colorField("Colour"),
    align: { type: "radio", label: "Alignment", options: alignOptions },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        fontSize: optionalNumberField("Font size", { ...range(LIMITS.Paragraph.fontSize) }),
        align: { type: "select", label: "Alignment", options: mobileAlignOptions },
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Paragraph },
  render: (props) => <Paragraph {...props} />,
};

// ---------------------------------------------------------------- Image

const ImageConfig: ComponentConfig<Props["Image"]> = {
  label: "Image",
  fields: {
    src: imageField,
    alt: { type: "text", label: "Alt text (describe the image)" },
    width: { type: "number", label: "Width (% of column)", ...range(LIMITS.Image.width) },
    height: { type: "number", label: "Height (px, 0 = automatic)", ...range(LIMITS.Image.height) },
    fit: {
      type: "radio",
      label: "Fit",
      options: [
        { label: "Fill (crop)", value: "cover" },
        { label: "Fit (no crop)", value: "contain" },
      ],
    },
    radius: { type: "number", label: "Corner radius (px)", ...range(LIMITS.Image.radius) },
    align: { type: "radio", label: "Alignment", options: alignOptions },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        width: optionalNumberField("Width", { ...range(LIMITS.Image.width), unit: "%" }),
        height: optionalNumberField("Height", { ...range(LIMITS.Image.height) }),
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Image },
  render: (props) => <ImageBlock {...props} />,
};

// ---------------------------------------------------------------- Button

const ButtonConfig: ComponentConfig<Props["Button"]> = {
  label: "Button",
  fields: {
    label: { type: "text", label: "Label", contentEditable: true },
    href: { type: "text", label: "Link (https://…, mailto:…, or #section)" },
    newTab: {
      type: "radio",
      label: "Open in",
      options: [
        { label: "Same tab", value: false },
        { label: "New tab", value: true },
      ],
    },
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Outline", value: "outline" },
      ],
    },
    bgColor: colorField("Background colour", "Default"),
    textColor: colorField("Text colour", "Default"),
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
    radius: { type: "number", label: "Corner radius (px)", ...range(LIMITS.Button.radius) },
    align: { type: "radio", label: "Alignment", options: alignOptions },
    mobile: {
      type: "object",
      label: "Mobile overrides",
      objectFields: {
        fullWidth: {
          type: "select",
          label: "Width on phones",
          options: [
            { label: "Same as desktop", value: "" },
            { label: "Full width", value: "yes" },
          ],
        },
        align: { type: "select", label: "Alignment", options: mobileAlignOptions },
      },
    },
  },
  defaultProps: { ...DEFAULT_PROPS.Button },
  render: (props) => <Button {...props} />,
};

// ---------------------------------------------------------------- Config

export const puckConfig: Config<{
  components: Props;
  root: RootProps;
  categories: ["layout", "content"];
}> = {
  categories: {
    layout: { title: "Layout", components: ["Section", "Container"] },
    content: { title: "Content", components: ["Heading", "Paragraph", "Image", "Button"] },
  },
  components: {
    Section: SectionConfig,
    Container: ContainerConfig,
    Heading: HeadingConfig,
    Paragraph: ParagraphConfig,
    Image: ImageConfig,
    Button: ButtonConfig,
  },
  root: {
    fields: {
      // The page's sections live in this slot. Only Sections may be dropped here.
      content: { type: "slot", allow: [...NESTING.page] },
      title: { type: "text", label: "Page title (browser tab)" },
      description: { type: "textarea", label: "Page description (search engines)" },
      headingFont: { type: "select", label: "Heading font", options: fontOptions },
      bodyFont: { type: "select", label: "Body font", options: fontOptions },
      background: colorField("Page background", "#ffffff"),
      textColor: colorField("Page text colour", "#16181d"),
    },
    defaultProps: { ...DEFAULT_ROOT, content: [] },
    render: ({ content: Content, ...props }) => (
      <PageShell {...props}>
        <Content minEmptyHeight={240} />
      </PageShell>
    ),
  },
};
