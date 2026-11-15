import type { CSSProperties, ReactNode } from "react";
import { Button, Container, Heading, Image, PageShell, Paragraph, Section, type SlotComponent } from "./blocks";
import { SLOT_KEYS, type ElementNode, type PageRootData } from "./model";

/**
 * Renders a saved page WITHOUT the editor.
 *
 * Used by the exported Next.js project. It walks the page data and draws the
 * same block components the editor uses, so the output matches the preview.
 * A "slot" (list of children) becomes a small component that renders a <div>
 * with the class the block asks for, just like Puck does on a published page.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCKS: Record<string, (props: any) => ReactNode> = {
  Section,
  Container,
  Heading,
  Paragraph,
  Image,
  Button,
};

function makeSlot(children: unknown): SlotComponent {
  const items = Array.isArray(children) ? (children as ElementNode[]) : [];
  function Slot({ className, style }: { className?: string; style?: CSSProperties }) {
    return (
      <div className={className} style={style}>
        {items.map((child) => (
          <Element key={child.props.id} node={child} />
        ))}
      </div>
    );
  }
  return Slot;
}

function Element({ node }: { node: ElementNode }) {
  const Block = BLOCKS[node.type];
  if (!Block) return null; // unknown types are skipped, never executed
  const props: Record<string, unknown> = { ...node.props };
  for (const key of SLOT_KEYS[node.type] ?? []) props[key] = makeSlot(node.props[key]);
  return <Block {...props} />;
}

type PageData = { root?: { props?: Partial<PageRootData> & { content?: unknown } } };

export function SitePage({ data }: { data: unknown }) {
  const root = (data as PageData)?.root?.props ?? {};
  const sections = Array.isArray(root.content) ? (root.content as ElementNode[]) : [];
  return (
    <PageShell {...root}>
      <div>
        {sections.map((section) => (
          <Element key={section.props.id} node={section} />
        ))}
      </div>
    </PageShell>
  );
}
