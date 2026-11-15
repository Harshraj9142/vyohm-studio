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
      surface: "glow",
      padding: 32,
      radius: 16,
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
        bgStyle: "spotlight",
        content: [
          el("Container", {
            columns: "2",
            ratio: "1:1",
            gap: 56,
            left: [
              el("Paragraph", { text: "SAMPLE PAGE · EDIT ME", fontSize: 12, color: gold, variant: "badge" }),
              el("Heading", { text: "Crafted to be kept.", level: "h1", fontSize: 64, fontWeight: "600" }),
              el("Paragraph", {
                text: "Loom & Line makes timeless garments from natural fibres, cut in small batches and finished by hand.",
                fontSize: 19,
                variant: "lead",
              }),
              el("Button", { label: "Explore the collections", href: "#collections", bgColor: gold, textColor: ink, size: "lg", radius: 2, icon: "arrow" }),
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
          // Section header: label + heading grouped so they sit close together.
          el("Container", {
            columns: "1",
            left: [
              el("Paragraph", { text: "THE COLLECTIONS", fontSize: 12, color: gold, align: "center", variant: "eyebrow" }),
              el("Heading", { text: "Three collections", align: "center", color: gold }),
            ],
          }),
          collection("The Atelier Line", "Tailored outerwear in heavyweight wool, lined in silk.", "Atelier collection photo", false),
          collection("Everyday Essentials", "Knitwear and shirting made to be worn every day for years.", "Essentials collection photo", true),
          collection("Evening Edit", "Black and gold pieces for occasions worth remembering.", "Evening collection photo", false),
        ],
      }),
      // Closing call-to-action band in the brand colour.
      el("Section", {
        anchor: "contact",
        bgColor: gold,
        textColor: ink,
        paddingY: 96,
        gap: 20,
        content: [
          el("Paragraph", { text: "GET IN TOUCH", fontSize: 12, align: "center", variant: "badge" }),
          el("Heading", { text: "Visit the atelier", align: "center" }),
          el("Paragraph", { text: "Book a private fitting or ask us anything. (Placeholder contact details.)", align: "center", variant: "lead" }),
          el("Button", { label: "Contact us", href: "mailto:hello@example.com", bgColor: ink, textColor: gold, align: "center", radius: 2, icon: "arrow" }),
        ],
      }),
    ],
  );
}
