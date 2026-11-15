<!-- Before submitting: read this file and make sure "My role" describes your own contribution accurately, in your own words. -->

# AI-use record

## Tools and models

| Where | Tool / model | Used for |
|---|---|---|
| Building the project | **Claude Code** (VS Code extension) running **Claude Opus 5.5** (`claude-opus-5-5`) | Planning the architecture, writing almost all of the code, the browser tests and these docs, running builds and tests, debugging |
| Design references | **21st.dev MCP server** (component catalog), called by Claude Code | Searching for design patterns; reading the code of 2 components (the free tier's daily limit) for the generated-site design system; preview images of an AI prompt composer, AI loading states and a marketing hero as references for the landing page and the *Get started* chat |
| Inside the product | **Claude API**, `claude-opus-5-5` via `@anthropic-ai/sdk` 1.8.0, structured outputs | Generating pages (`/api/generate`) and AI edits (`/api/revise`) |
| Verification | TypeScript, ESLint, `next build`, headless Google Chrome (own CDP runner), `scripts/verify-export.sh` | Checking the AI-written code and the AI-generated pages |

AI coding tools are allowed by the challenge rules. Claude Code wrote the large majority of the code in this repository, working step by step from the challenge brief.

## My role

- Set the scope and order of work: setup → editor → AI generation → AI edits → export → docs.
- Made the product decisions I was asked about: the project name *Vyohm Studio* and the Claude API as provider. I provided the API key.
- Ran the builder locally while it was being built, and committed and pushed after each step (see the git history).
- Asked for every step to be explained, so that I can explain any component, data transformation or model interaction during the review.

## Consequential suggestions: accepted, changed, rejected

### Accepted: AI edits as operations instead of a regenerated page

**Suggestion:** Claude should not return a new page for an edit. It returns a list of operations (`update` / `insert` / `delete` / `move` / `updatePage`) that reference stable element ids, and they are applied to the user's current page.

**Why accepted:** the challenge's central test requires manual edits to survive an AI edit. Regenerating the page cannot guarantee that; operations guarantee it by construction, and they make scope checks and conflict checks possible.

**Verification:** `demo-sequence` makes four manual edits, then asks *"Change only this button's background to blue"*. A deep diff of the whole page found exactly one changed value, the button's `bgColor` ([browser-tests.log](../evidence/browser-tests.log)).

### Changed: the operation schema (rejected by the API)

**Suggestion:** the first schema embedded every element type's full schema inside the `insert` operation, so Claude could return complete new elements.

**What happened:** the Claude API returned `400 … The compiled grammar is too large`. Claude Code first misread the symptom in the dev server (a stale module error), then reproduced it on a clean production build, where the real error appeared.

**Change:** `insert` now carries the element as a JSON string. Our code parses it (`parseInsertedElement`), cleans it with the same converters used for generation, and returns problems to Claude once as an error message.

**Verification:** a direct API call returned one correct operation in 3.4 s; the browser scenarios passed, including an invalid-nesting insert that is correctly rejected (`ai-failures` #8).

### Changed: how AI results are added to undo history

**Suggestion:** apply AI results with Puck's `setData` action.

**What happened:** a browser test showed that Undo did not bring back the previous page. Reading Puck's reducer source showed that `setData` is excluded from history unless `recordHistory: true` is passed.

**Change:** both the generation and the edit paths now dispatch `setData` with `recordHistory: true`.

**Verification:** Undo/Redo checks in `ai-failures` #3, `demo-sequence` and `mobile-override`.

### Changed: 21st.dev component designs adapted instead of copied

**Suggestion:** 21st.dev returned ready-made React components ("Feature Grid Spotlight Cards", "CTA Section"). The obvious move is to install them as they are.

**Why changed:** they are built on Tailwind + shadcn, and one uses JavaScript for a pointer-following spotlight. Installing them would add Tailwind and extra packages to every exported site (today the export has 3 dependencies), and pull editor-unfriendly JavaScript into the blocks.

**Change:** I kept the visual ideas (card surfaces, a top glow, corner "+" marks, pill labels, a call-to-action band, arrow buttons), rebuilt them as four optional settings in plain CSS, and dropped the pointer spotlight. The design sources are credited in `site.css` and the README.

**Verification:** `design-options` scenario (38/38 checks overall), Claude using the options in two new generations (TESTING.md), and the export still installing and building with 30 packages ([export-verify.log](../evidence/export-verify.log)).

### Rejected: storing uploaded images inside the saved page in localStorage

**Option considered:** the simplest way to persist images is to embed them as data URLs in the page JSON and save it to localStorage.

**Why rejected:** localStorage holds only about 5 MB of text, which one photo can exceed. Data URLs would also bloat every undo-history entry, and every AI request that includes the page.

**Instead:** image files are stored in IndexedDB, and the page keeps a short `asset:<id>` reference. The export turns each reference into `public/assets/<id>.jpg`.

**Verification:** `upload-persist` + `after-reload` (the image survives a browser restart); [export-verify.log](../evidence/export-verify.log) and [exported-site.log](../evidence/exported-site.log) (the image file is bundled and served).

## How AI output was checked

- **AI-written code:** type-checked, linted and production-built after each step, then exercised in a real browser by scripted scenarios. Claims in the README and TESTING.md were checked against test output or library source; one unverified claim found during review was removed.
- **Model output at runtime:** never trusted directly.
  - Structured outputs guarantee the JSON shape.
  - The server cleans values and validates the whole page (`lib/page-schema.ts`).
  - AI edits are test-applied on the server, then checked again in the browser against the scope, the nesting rules and conflicts before anything changes.
  - Model-generated text is rendered as text, never as HTML or scripts. Links are restricted to `http(s):`, `mailto:`, `tel:`, `#anchor` or relative paths.
