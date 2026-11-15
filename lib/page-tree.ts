import type { Data } from "@puckeditor/core";
import {
  DEFAULT_PROPS,
  DEFAULT_ROOT,
  type ElementNode,
  type ElementType,
  type PageRootData,
} from "@/components/site/model";

/**
 * Small helpers for building page data in code (starter page, AI results).
 * Every element gets a stable, unique id like "Heading-9f3a1c2b".
 */

export function newId(type: string): string {
  return `${type}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function makeElement(
  type: ElementType,
  props: Record<string, unknown> = {},
  id: string = newId(type),
): ElementNode {
  return { type, props: { ...DEFAULT_PROPS[type], ...props, id } };
}

export function makePage(root: Partial<PageRootData>, sections: ElementNode[]): Data {
  // Our root has extra props (fonts, colours, the sections slot) that Puck's
  // generic Data type doesn't know about, hence the cast.
  const props = { ...DEFAULT_ROOT, ...root, content: sections };
  return { root: { props } as Data["root"], content: [] };
}

/** Visit every element in the page (depth first). */
export function walkElements(data: Data, visit: (node: ElementNode) => void) {
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes as ElementNode[]) {
      visit(node);
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) walk(value);
      }
    }
  };
  walk((data.root?.props as { content?: unknown } | undefined)?.content);
}
