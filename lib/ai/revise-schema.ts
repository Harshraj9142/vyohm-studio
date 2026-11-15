import { z } from "zod";
import {
  ButtonGen,
  ContainerGen,
  HeadingGen,
  ImageGen,
  ParagraphGen,
  SectionGen,
} from "./generate-schema";

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

/** Every setting name an "update" may change. Which ones are valid depends on the element type. */
export const PROP_NAMES = [
  "text", "level", "fontSize", "fontWeight", "color", "align",
  "label", "href", "newTab", "variant", "bgColor", "textColor", "size", "radius",
  "src", "alt", "width", "height", "fit",
  "columns", "ratio", "valign", "gap", "padding",
  "anchor", "paddingY", "maxWidth",
  "mobile.fontSize", "mobile.align", "mobile.paddingY", "mobile.gap", "mobile.columns",
  "mobile.padding", "mobile.width", "mobile.height", "mobile.fullWidth",
] as const;

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

const InsertOp = z.object({
  op: z.literal("insert"),
  ...target,
  element: z.union([
    SectionGen.extend({ type: z.literal("Section") }),
    ContainerGen,
    HeadingGen,
    ParagraphGen,
    ImageGen,
    ButtonGen,
  ]),
});

export const OperationSchema = z.union([UpdateOp, UpdatePageOp, DeleteOp, MoveOp, InsertOp]);

export const RevisionSchema = z.object({
  summary: z.string().describe("One short sentence describing what was changed (or why nothing was)."),
  operations: z.array(OperationSchema),
});

export type Operation = z.infer<typeof OperationSchema>;
export type Revision = z.infer<typeof RevisionSchema>;
