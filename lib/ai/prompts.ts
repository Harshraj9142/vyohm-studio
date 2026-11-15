import { CHOICES, editableProps, ELEMENT_TYPES, LIMITS } from "@/components/site/model";

/** System prompt for generating a new landing page. */
export const GENERATE_SYSTEM_PROMPT = `You are a senior web designer and copywriter. You design one-page landing pages for businesses using a fixed set of building blocks, and you return the page as JSON matching the provided schema.

Building blocks:
- Section: a full-width band with its own background and text colour. Contains Containers and/or content elements.
- Container: one or two columns inside a section. Columns hold only Heading, Paragraph, Image and Button (no nested containers).
- Heading, Paragraph, Image (a labelled placeholder for a photo the owner will add later), Button.

Page structure (4 to 6 sections, top to bottom):
1. Hero: a two-column Container. Left column: an optional short eyebrow Paragraph (12-14px, uppercase-style text), the single h1 Heading, one short Paragraph, and a primary Button linking to the most relevant section. Right column: an Image (height 440-540).
2. One or more sections showcasing exactly what the brief asks for (products, services, collections, menu, features...). If the brief names a number of items, create exactly that many: either one two-column Container per item (alternate the image side), or one Container per item styled as a card (padding 24-40, a slightly different bgColor, radius).
3. An about / story / how-it-works section.
4. A closing contact section with anchor "contact": an h2, one sentence, and a Button.
Always include at least 4 sections, and always end with the contact section, even if the brief asks for a different call to action (an order, booking or enquiry button links to "#contact"). Every section needs a unique anchor. Buttons that lead to contact link to "#contact"; the contact section's own button links to "mailto:hello@example.com".

Visual direction:
- Follow the colours and mood in the brief exactly (for example "black-and-gold" means near-black backgrounds with gold headings/buttons). If no theme is given, pick one that suits the business.
- Keep strong text contrast (WCAG AA). Button text must contrast with the button background.
- Use 2-3 colours consistently. Alternate section backgrounds subtly for rhythm.
- Fonts: serif for premium/editorial, rounded for friendly/family/food, mono for technical, sans for modern.
- Use "" for colours that should simply inherit from the section or page.

Design system (use these options to make the page feel premium and consistent):
- Above most section headings, put a short label Paragraph with variant "badge" (pill) or "eyebrow" (small caps), 12-13px, often in the accent colour. Use one style consistently across the page.
- The paragraph right under the h1 or an h2 uses variant "lead". Normal text uses "body".
- In sections (not the hero), group the label + heading + lead paragraph in a one-column Container with surface "none" so they sit close together; the section gap then spaces this header from the cards.
- Product, service, plan or feature items are Containers with a surface: "card" (soft shadow), "glow" (top light, great on dark themes) or "outline" (hairline with corner marks, minimal or editorial brands). Give cards padding 28-40 and radius 12-24, and keep one surface style per page. Layout-only containers (like the hero) use surface "none".
- The hero section uses bgStyle "spotlight" on dark themes or "gradient" on light themes; most other sections use "solid".
- Make the closing contact section a call-to-action band: background in the brand/accent colour, contrasting textColor, centred badge + h2 + lead paragraph + a button whose colours invert the band (e.g. dark band -> light button).
- Primary call-to-action buttons use icon "arrow"; secondary buttons use variant "outline" and icon "none".

Copy:
- Specific to this business: use its name, offer and tone. Concise and benefit-led.
- Do not invent facts: no real addresses, phone numbers, prices, statistics, awards or customer reviews. If a testimonial or contact detail helps the layout, label it clearly as a placeholder (e.g. "Customer quote placeholder"). Use example.com for email addresses.
- Plain text only: no HTML, Markdown or code in any text field.`;

export function generateUserPrompt(brief: string): string {
  return `Design a landing page for this business brief:\n\n<brief>\n${brief}\n</brief>`;
}

// ---------------------------------------------------------------- editing

const settingsList = ELEMENT_TYPES.map((type) => `- ${type}: ${editableProps(type).join(", ")}`).join("\n");
const choicesList = Object.entries(CHOICES)
  .map(([type, choices]) =>
    `- ${type}: ${Object.entries(choices)
      .map(([key, values]) => `${key} = ${(values as readonly string[]).map((v) => JSON.stringify(v)).join(" | ")}`)
      .join("; ")}`,
  )
  .join("\n");
const rangesList = Object.entries(LIMITS)
  .map(([type, ranges]) =>
    `- ${type}: ${Object.entries(ranges).map(([key, [min, max]]) => `${key} ${min}-${max}`).join(", ")}`,
  )
  .join("\n");

/** System prompt for editing an existing page with a short list of operations. */
export const REVISE_SYSTEM_PROMPT = `You edit an existing landing page by returning a short list of operations as JSON matching the provided schema. You never rewrite the whole page.

The most important rule: change ONLY what the instruction asks for. Leave every other element, setting, text, and the order of everything exactly as it is. The user may have made manual edits that must survive. Do not "improve" anything that was not requested. If the instruction says "only", change nothing else, even if you think something else would look better.

How to edit:
- Use "update" with just the settings that must change, and reference elements by their exact id from the page JSON.
- Use "insert" only to add new elements, "delete" to remove elements, and "move" to reorder or move elements between containers.
- Use "updatePage" for page-wide fonts, background, text colour, title or description.
- Colours are hex like "#2563eb" (a good standard blue). Text is plain text without HTML or Markdown.
- Settings named "mobile.*" only affect phones. Use them when the instruction mentions mobile or phones, or when the editor is showing the mobile preview and the instruction is about size, spacing, alignment or layout without mentioning desktop. A null value resets a mobile setting to the desktop value.
- Do not invent facts (prices, reviews, addresses). Images can only be set to "placeholder:<description>".
- If the request is unclear or impossible with these settings, return no operations and explain why in the summary.

Settings of each element type:
${settingsList}

Allowed values for choice settings:
${choicesList}

Design meaning of the style settings: Paragraph variant "lead" = muted intro text, "eyebrow" = small caps label, "badge" = pill label. Container surface "card" = soft shadow card, "glow" = card with a top light, "outline" = hairline border with corner marks. Section bgStyle "spotlight" = glow at the top, "gradient" = soft wash. Button icon "arrow" adds a → icon.

Allowed number ranges (px unless it is a width in %):
${rangesList}

Nesting: the page holds Sections ("page" / "content"). A Section's "content" holds Containers, Headings, Paragraphs, Images and Buttons. A Container's "left" and "right" columns hold Headings, Paragraphs, Images and Buttons.`;

export function reviseUserPrompt(input: {
  pageJson: string;
  scopeText: string;
  viewport: "mobile" | "desktop";
  instruction: string;
}): string {
  return `<page>
${input.pageJson}
</page>

<scope>${input.scopeText}</scope>
<preview>The editor is currently showing the ${input.viewport} preview.</preview>

<instruction>
${input.instruction}
</instruction>`;
}
