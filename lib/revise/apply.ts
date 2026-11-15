import type { Data } from "@puckeditor/core";
import {
  editableProps,
  isElementType,
  LIMITS,
  NESTING,
  SLOT_KEYS,
  type ElementNode,
} from "@/components/site/model";
import { safeColor, safeHref, slugify } from "@/components/site/style";
import {
  anchorMaker,
  clamp,
  cleanText,
  parseInsertedElement,
  toSection,
  toSectionChild,
} from "@/lib/ai/convert";
import type { Operation } from "@/lib/ai/revise-schema";
import { findPageProblem } from "@/lib/page-schema";

/**
 * Applies AI edit operations to a page. Used in two places:
 *  - on the server, to check Claude's answer before sending it to the browser;
 *  - in the browser, to apply it to the user's CURRENT page (which may contain
 *    manual edits made while Claude was working — they are kept).
 *
 * Safety rules enforced here (not just asked of the AI in the prompt):
 *  - only known settings of each element type can change, with cleaned values;
 *  - with "selected element" scope, nothing outside that element can change;
 *  - nesting rules (e.g. no section inside a container);
 *  - the final page must pass the strict page validator.
 * If anything fails, nothing is applied.
 */

export type Scope = { kind: "page" } | { kind: "element"; id: string };

/** Elements an edit relies on. "props" = its own settings; "exists" = it must still exist. */
export type Touched = { id: string; check: "props" | "exists" };

export type ApplyResult =
  | { ok: true; data: Data; touched: Touched[] }
  | { ok: false; error: string };

type RootProps = { content: ElementNode[]; [key: string]: unknown };
type Location = {
  node: ElementNode;
  list: ElementNode[];
  index: number;
  parentId: string; // "page" for top-level sections
  ancestors: string[];
};

class ApplyError extends Error {}

// ---------------------------------------------------------------- public API

export function applyOperations(data: Data, operations: Operation[], scope: Scope): ApplyResult {
  try {
    const next = structuredClone(data); // never mutate the editor's state directly
    const root = next.root.props as RootProps;
    if (!Array.isArray(root?.content)) throw new ApplyError("The page has no sections.");
    if (scope.kind === "element" && !locate(root, scope.id)) {
      throw new ApplyError("The selected element no longer exists.");
    }

    const touched: Touched[] = [];
    const uniqueAnchor = anchorMaker(root.content.map((s) => String(s.props.anchor ?? "")));
    for (const op of operations) applyOne(root, op, scope, touched, uniqueAnchor);

    const problem = findPageProblem(next);
    if (problem) throw new ApplyError(`The change would make the page invalid (${problem}).`);
    return { ok: true, data: next, touched };
  } catch (error) {
    if (error instanceof ApplyError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * Did the user change any element this edit relies on while Claude was working?
 * Compares the page from when the request started (`before`) with the page now.
 * Returns readable names of conflicting elements (empty = safe to apply).
 */
export function findConflicts(before: Data, current: Data, touched: Touched[]): string[] {
  const was = before.root.props as RootProps;
  const now = current.root.props as RootProps;
  const conflicts = new Set<string>();

  for (const { id, check } of touched) {
    if (id === "page") {
      if (check === "props" && stableJson(pageSettings(was)) !== stableJson(pageSettings(now))) {
        conflicts.add("the page settings");
      }
      continue;
    }
    const old = locate(was, id);
    if (!old) continue;
    const latest = locate(now, id);
    if (!latest) conflicts.add(`${describe(old.node)} (it was deleted)`);
    else if (check === "props" && stableJson(ownProps(old.node)) !== stableJson(ownProps(latest.node))) {
      conflicts.add(describe(latest.node));
    }
  }
  return [...conflicts];
}

/** e.g. 'Button "Contact us"' */
export function describe(node: { type: string; props: Record<string, unknown> }): string {
  const text = node.props.text ?? node.props.label ?? node.props.alt ?? node.props.anchor;
  const short = typeof text === "string" && text.trim() ? ` "${text.trim().slice(0, 40)}"` : "";
  return `${node.type}${short}`;
}

// ---------------------------------------------------------------- operations

function applyOne(
  root: RootProps,
  op: Operation,
  scope: Scope,
  touched: Touched[],
  uniqueAnchor: ReturnType<typeof anchorMaker>,
) {
  switch (op.op) {
    case "update": {
      const loc = mustLocate(root, op.id);
      assertInScope(scope, loc);
      for (const change of op.changes) setProp(loc.node, change.prop, change.value);
      touched.push({ id: op.id, check: "props" });
      return;
    }
    case "updatePage": {
      if (scope.kind === "element") {
        throw new ApplyError('Page settings can only be changed with "Whole page" selected.');
      }
      for (const change of op.changes) setPageProp(root, change.prop, change.value);
      touched.push({ id: "page", check: "props" });
      return;
    }
    case "delete": {
      const loc = mustLocate(root, op.id);
      assertInScope(scope, loc);
      loc.list.splice(loc.index, 1);
      touched.push({ id: op.id, check: "props" });
      return;
    }
    case "move": {
      const loc = mustLocate(root, op.id);
      assertInScope(scope, loc);
      const dest = mustSlot(root, op.parentId, op.slot);
      // The selected element itself may move anywhere it is allowed ("move this button to the
      // right column"): only its position changes, nothing else on the page.
      if (!(scope.kind === "element" && op.id === scope.id)) assertParentInScope(root, scope, op.parentId);
      assertNesting(dest.parentType, loc.node.type);
      if (op.parentId === op.id) throw new ApplyError("An element cannot be moved into itself.");
      loc.list.splice(loc.index, 1);
      dest.list.splice(clampIndex(op.index, dest.list.length), 0, loc.node);
      touched.push({ id: op.id, check: "props" }, { id: op.parentId, check: "exists" });
      return;
    }
    case "insert": {
      const dest = mustSlot(root, op.parentId, op.slot);
      assertParentInScope(root, scope, op.parentId);
      let parsed: ReturnType<typeof parseInsertedElement>;
      try {
        parsed = parseInsertedElement(op.element);
      } catch (error) {
        throw new ApplyError(error instanceof Error ? error.message : "The new element is invalid.");
      }
      const node =
        parsed.type === "Section"
          ? toSection(parsed.section, uniqueAnchor(parsed.section.anchor, "section"))
          : toSectionChild(parsed.element);
      if (!node) throw new ApplyError("The AI tried to insert an unknown element.");
      assertNesting(dest.parentType, node.type);
      dest.list.splice(clampIndex(op.index, dest.list.length), 0, node);
      touched.push({ id: op.parentId, check: "exists" });
      return;
    }
  }
}

// ---------------------------------------------------------------- settings

const COLOR_KEYS = new Set(["color", "bgColor", "textColor"]);
const TEXT_MAX: Record<string, number> = { text: 1200, label: 60, alt: 300 };
type Ranges = Record<string, Record<string, readonly [number, number]>>;

function setProp(node: ElementNode, prop: string, value: unknown) {
  if (!isElementType(node.type) || !editableProps(node.type).includes(prop)) {
    throw new ApplyError(`A ${node.type} has no setting "${prop}".`);
  }
  const [first, sub] = prop.split(".");
  const key = sub ?? first;
  const range = (LIMITS as Ranges)[node.type]?.[key];

  if (sub) {
    // Mobile override. null/"" means "same as desktop".
    const mobile = { ...((node.props.mobile as Record<string, unknown>) ?? {}) };
    mobile[key] = value === null || value === "" ? (range ? null : "") : cleanValue(node.type, key, value, range);
    node.props.mobile = mobile;
  } else {
    node.props[key] = cleanValue(node.type, key, value, range);
  }
}

function cleanValue(
  type: string,
  key: string,
  value: unknown,
  range: readonly [number, number] | undefined,
): unknown {
  if (COLOR_KEYS.has(key)) {
    if (value === "" || value === null) return "";
    const color = safeColor(value);
    if (!color) throw new ApplyError(`"${String(value)}" is not a valid colour (use #rrggbb).`);
    return color;
  }
  // null only means "same as desktop" for phone settings (handled by the caller) or
  // "inherit" for colours (above). Anywhere else it would silently wipe a real setting,
  // e.g. a button's link, so the whole answer is refused instead.
  if (value === null) {
    throw new ApplyError(`The AI tried to clear the ${type}'s "${key}" setting, which needs a value.`);
  }
  if (range) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) throw new ApplyError(`"${String(value)}" is not a number for ${type}.${key}.`);
    return clamp(n, range, n);
  }
  if (key in TEXT_MAX) return cleanText(String(value ?? ""), TEXT_MAX[key]);
  if (key === "href") return safeHref(value);
  if (key === "anchor") return slugify(value);
  if (key === "newTab") return value === true || value === "true";
  if (key === "src") {
    if (typeof value === "string" && value.startsWith("placeholder:")) return cleanText(value, 140);
    throw new ApplyError("AI can only change images to labelled placeholders. Upload real images yourself.");
  }
  // Remaining settings are choices (e.g. align, size, level). The page validator checks them.
  return typeof value === "string" ? value : String(value);
}

function setPageProp(root: RootProps, prop: string, value: string) {
  if (prop === "background" || prop === "textColor") {
    const color = safeColor(value);
    if (!color) throw new ApplyError(`"${value}" is not a valid colour (use #rrggbb).`);
    root[prop] = color;
  } else if (prop === "title" || prop === "description") {
    root[prop] = cleanText(value, prop === "title" ? 120 : 300);
  } else {
    root[prop] = value; // fonts: checked by the page validator
  }
}

// ---------------------------------------------------------------- tree helpers

function locate(root: RootProps, id: string): Location | null {
  const visit = (list: ElementNode[], parentId: string, ancestors: string[]): Location | null => {
    for (let index = 0; index < list.length; index++) {
      const node = list[index];
      if (node.props.id === id) return { node, list, index, parentId, ancestors };
      for (const slot of SLOT_KEYS[node.type] ?? []) {
        const children = node.props[slot];
        if (!Array.isArray(children)) continue;
        const found = visit(children as ElementNode[], node.props.id, [...ancestors, node.props.id]);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(root.content, "page", []);
}

function mustLocate(root: RootProps, id: string): Location {
  const loc = locate(root, id);
  if (!loc) throw new ApplyError(`There is no element with id "${id}".`);
  return loc;
}

function mustSlot(root: RootProps, parentId: string, slot: string) {
  if (parentId === "page") {
    if (slot !== "content") throw new ApplyError('Top-level sections go in slot "content".');
    return { list: root.content, parentType: "page" as const };
  }
  const parent = mustLocate(root, parentId).node;
  if (!(SLOT_KEYS[parent.type] ?? []).includes(slot)) {
    throw new ApplyError(`A ${parent.type} has no "${slot}" area.`);
  }
  if (!Array.isArray(parent.props[slot])) parent.props[slot] = [];
  return { list: parent.props[slot] as ElementNode[], parentType: parent.type };
}

function assertNesting(parentType: string, childType: string) {
  const allowed = (NESTING as Record<string, readonly string[]>)[parentType] ?? [];
  if (!allowed.includes(childType)) {
    const where = parentType === "page" ? "directly on the page" : `inside a ${parentType}`;
    throw new ApplyError(`A ${childType} cannot go ${where}.`);
  }
}

function assertInScope(scope: Scope, loc: Location) {
  if (scope.kind === "page") return;
  if (loc.node.props.id === scope.id || loc.ancestors.includes(scope.id)) return;
  throw new ApplyError(
    `The AI tried to change ${describe(loc.node)}, which is outside your selection. Choose "Whole page" for wider changes.`,
  );
}

function assertParentInScope(root: RootProps, scope: Scope, parentId: string) {
  if (scope.kind === "page") return;
  if (parentId === scope.id) return;
  const parent = parentId === "page" ? null : locate(root, parentId);
  if (parent && parent.ancestors.includes(scope.id)) return;
  throw new ApplyError(
    'The AI tried to add or move something outside your selection. Choose "Whole page" for wider changes.',
  );
}

const clampIndex = (index: number, length: number) =>
  Math.max(0, Math.min(length, Number.isFinite(index) ? Math.round(index) : length));

/** An element's own settings, without its children. */
function ownProps(node: ElementNode) {
  const props: Record<string, unknown> = { ...node.props };
  for (const slot of SLOT_KEYS[node.type] ?? []) delete props[slot];
  return props;
}

function pageSettings(root: RootProps) {
  const settings: Record<string, unknown> = { ...root };
  delete settings.content;
  return settings;
}

/** JSON with sorted keys, so key order never causes a false conflict. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
