import { z } from "zod";
import { editableProps, ELEMENT_TYPES } from "@/components/site/model";

/**
 * The JSON shape Claude must return when EDITING an existing page.
 *
 * Instead of sending back a whole new page (which could silently undo the
 * user's manual edits), Claude returns a short list of operations such as:
 *
 *   { op: "update", id: "Button-3f2a", changes: [{ prop: "bgColor", value: "#2563eb" }] }
 *
 * We then apply only those operations to the user's CURRENT page.
 */

/**
 * Every setting name an "update" may change (which ones are valid depends on the element type).
 * Built from the page model, so a new setting is offered to the AI automatically. It used to be
 * a hand-written list; when "hover" was added to the model but not here, the AI could not name
 * it and changed the wrong setting instead.
 */
export const PROP_NAMES = [...new Set(ELEMENT_TYPES.flatMap((type) => editableProps(type)))] as [string, ...string[]];

export const PAGE_PROP_NAMES = [
  "title", "description", "headingFont", "bodyFont", "background", "textColor",
] as const;

const UpdateOp = z.object({
  op: z.literal("update"),
  id: z.string().describe("Exact id of the element to change."),
  changes: z
    .array(
      z.object({
        prop: z.enum(PROP_NAMES),
        value: z
          .union([z.string(), z.number(), z.boolean(), z.null()])
          .describe("New value. null resets a mobile.* override to the desktop value."),
      }),
    )
    .describe("Only the settings that must change."),
});

const UpdatePageOp = z.object({
  op: z.literal("updatePage"),
  changes: z.array(z.object({ prop: z.enum(PAGE_PROP_NAMES), value: z.string() })),
});

const DeleteOp = z.object({
  op: z.literal("delete"),
  id: z.string(),
});

const target = {
  parentId: z.string().describe('Id of the Section or Container to put it in, or "page" for a top-level section.'),
  slot: z
    .enum(["content", "left", "right"])
    .describe('"content" for a section or the page, "left"/"right" for a container column.'),
  index: z.number().describe("Position in that list, 0 = first."),
};

const MoveOp = z.object({ op: z.literal("move"), id: z.string(), ...target });

/**
 * The new element is a JSON *string* (not a nested schema). Embedding every element
 * type's full schema here made the structured-output grammar too large for the API
 * ("compiled grammar is too large"), so we parse and check this string ourselves
 * (see parseInsertedElement in lib/ai/convert.ts).
 */
const InsertOp = z.object({
  op: z.literal("insert"),
  ...target,
  element: z
    .string()
    .describe(
      'The new element as a JSON string, e.g. {"type":"Button","label":"Book now","href":"#contact","variant":"solid","bgColor":"#2563eb","textColor":"#ffffff","size":"md","radius":8,"align":"left"}. ' +
        "Types and fields: " +
        "Section {anchor, bgColor, textColor, paddingY, gap, children: [Container|Heading|Paragraph|Image|Button]}; " +
        'Container {columns:"1"|"2", ratio:"1:1"|"2:1"|"1:2", valign:"start"|"center"|"end", gap, padding, bgColor, radius, left: [...], right: [...]}; ' +
        'Heading {text, level:"h1"|"h2"|"h3", fontSize, fontWeight:"400"-"800", color, align}; ' +
        "Paragraph {text, fontSize, color, align}; " +
        "Image {placeholderLabel, alt, height, radius}; " +
        'Button {label, href, variant:"solid"|"outline", bgColor, textColor, size:"sm"|"md"|"lg", radius, align}.',
    ),
});

export const OperationSchema = z.union([UpdateOp, UpdatePageOp, DeleteOp, MoveOp, InsertOp]);

export const RevisionSchema = z.object({
  summary: z.string().describe("One short sentence describing what was changed (or why nothing was)."),
  operations: z.array(OperationSchema),
});

export type Operation = z.infer<typeof OperationSchema>;
export type Revision = z.infer<typeof RevisionSchema>;
