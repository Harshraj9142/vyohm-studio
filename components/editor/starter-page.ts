import type { Data } from "@puckeditor/core";
import { makeElement as el, makePage } from "@/lib/page-tree";

/**
 * The page shown the first time the editor opens (before any AI generation).
 * All content is clearly labelled sample content.
 */
export function createStarterPage(): Data {
  const gold = "#c9a44c";
  const ink = "#0d0d0d";

  const collection = (name: string, text: string, imageLabel: string, flip: boolean) => {
    const image = el("Image", { src: `placeholder:${imageLabel}`, alt: imageLabel, radius: 4 });
    const copy = [
      el("Heading", { text: name, level: "h3", fontSize: 30, color: gold }),
      el("Paragraph", { text }),
      el("Button", { label: "View collection", href: "#contact", variant: "outline", bgColor: gold, size: "sm" }),
    ];
    return el("Container", {
      columns: "2",
      ratio: "1:1",
      gap: 48,
      left: flip ? copy : [image],
      right: flip ? [image] : copy,
    });
  };

  return makePage(
    {
      title: "Loom & Line — Sample page",
      description: "Sample landing page for a premium clothing brand.",
      headingFont: "serif",
      bodyFont: "sans",
      background: ink,
      textColor: "#f3eee3",
    },
    [
      el("Section", {
        paddingY: 120,
        content: [
          el("Container", {
            columns: "2",
            ratio: "1:1",
            gap: 56,
            left: [
              el("Paragraph", { text: "SAMPLE PAGE · EDIT ME", fontSize: 13, color: gold }),
              el("Heading", { text: "Crafted to be kept.", level: "h1", fontSize: 64, fontWeight: "600" }),
              el("Paragraph", {
                text: "Loom & Line makes timeless garments from natural fibres, cut in small batches and finished by hand.",
                fontSize: 19,
              }),
              el("Button", { label: "Explore the collections", href: "#collections", bgColor: gold, textColor: ink, size: "lg", radius: 2 }),
            ],
            right: [el("Image", { src: "placeholder:Hero photo – model in signature coat", alt: "Model wearing the signature wool coat", height: 520, radius: 4 })],
          }),
        ],
      }),
      el("Section", {
        anchor: "collections",
        bgColor: "#151412",
        gap: 56,
        content: [
          el("Heading", { text: "Three collections", align: "center", color: gold }),
          collection("The Atelier Line", "Tailored outerwear in heavyweight wool, lined in silk.", "Atelier collection photo", false),
          collection("Everyday Essentials", "Knitwear and shirting made to be worn every day for years.", "Essentials collection photo", true),
          collection("Evening Edit", "Black and gold pieces for occasions worth remembering.", "Evening collection photo", false),
        ],
      }),
      el("Section", {
        anchor: "contact",
        content: [
          el("Heading", { text: "Visit the atelier", align: "center" }),
          el("Paragraph", { text: "Book a private fitting or ask us anything. (Placeholder contact details.)", align: "center" }),
          el("Button", { label: "Contact us", href: "mailto:hello@example.com", bgColor: gold, textColor: ink, align: "center", radius: 2 }),
        ],
      }),
    ],
  );
}
