# {{TITLE}}

A landing page built with **Vyohm Studio** and exported as a standalone Next.js project.
It does not need the builder, an AI key, or an internet connection to run.

## Requirements

- Node.js **22** (any version ≥ 20.9 works; see `.nvmrc`)
- npm 10 or newer

## Commands

```bash
npm ci          # install the exact dependency versions from package-lock.json
npm run dev     # development server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build on http://localhost:3000
```

## What's inside

| Path | Purpose |
|---|---|
| `app/page.tsx` | Renders the landing page |
| `app/layout.tsx` | HTML document, page title and description |
| `data/page.json` | All content: text, order, styles, links and mobile overrides |
| `components/site/` | The page's React components (`blocks.tsx`), renderer (`render.tsx`) and responsive CSS (`site.css`) |
| `public/assets/` | Images you uploaded in the builder |

To change text or colours, edit `data/page.json` (or re-export from Vyohm Studio).
Phone styles apply below 768px wide (see the `@media` rule in `components/site/site.css`).

## Known limits

- Fonts use each device's built-in fonts (system font stacks), so they can look slightly different between operating systems. No web fonts are downloaded.
- Images pasted as web links (https://…) are loaded from that website; only uploaded images are included in `public/assets/`.
- Boxes labelled "Placeholder image" are stand-ins for photos you have not uploaded yet.
- Buttons are links. There is no contact form backend; "contact" buttons link to a section or an email address.
