# Testing and evidence

All results below come from runs on 2026-11-15 on macOS (Apple silicon) with Node 22.23.2, npm 10.9.8 and headless Google Chrome. Raw logs are in [`evidence/`](../evidence/).

- **Observed** means a run produced the result shown.
- **Not tested** lists what was not verified.

## How to reproduce

```bash
# 1. Builder with the test hook enabled (exposes Puck's API to the test scripts)
NEXT_PUBLIC_TEST_HOOKS=1 npm run build
npx next start -p 3211            # keep running in another terminal

# 2. All browser scenarios -> evidence/browser-tests.log
#    (landing "/", chat "/start", editor "/editor"; pass another base URL as the first argument)
npm run test:browser              # = bash tests/browser/run-all.sh [http://localhost:3211]

# 3. Check any exported ZIP the way the evaluator does
npm run verify-export -- evidence/website.zip
```

- For full-page screenshots, `cdp.mjs` takes `--full 1 --reduced-motion 1`. Reduced motion turns off the scroll fade-in, which would otherwise leave off-screen parts invisible in a full-page capture.
- `npm run test:browser` makes three small real Claude calls (`demo-sequence` makes one, `real-ai-edits` makes two). Everything else uses fake responses and is free.
- The runner is [`tests/browser/cdp.mjs`](../tests/browser/cdp.mjs), which drives Chrome through the DevTools protocol with no extra dependencies. Each scenario in [`tests/browser/scenarios/`](../tests/browser/scenarios/) prints *expected / actual / pass* for every check.
- Drag-and-drop is simulated by dispatching Puck's own `move` / `reorder` / `insert` actions, the same actions a drop produces.
- Uploads go through the real file input via `DataTransfer`, which fires the same `change` event as the file picker.

## Results summary

| Run | Result | Log |
|---|---|---|
| Browser scenarios (11 runs, 58 checks) | **58 passed, 0 failed** | [browser-tests.log](../evidence/browser-tests.log) |
| Full flow: generate → manual edits → mobile override → AI edit → export | Completed | [full-flow.log](../evidence/full-flow.log) |
| Export verification: fresh folder, `npm ci` + `npm run build` | **PASS** (`npm ci` 5 s, build 5 s) | [export-verify.log](../evidence/export-verify.log) |
| Exported site served with `npm run start`, checked at 1280 px and 390 px | Matches the editor; no overflow | [exported-site.log](../evidence/exported-site.log) |
| `tsc --noEmit`, `eslint`, `next build` of the builder | Clean | — |

## Edit preservation (the central test)

| Input | Expected | Actual (observed) |
|---|---|---|
| Starter page. Manual edits: rewrite the headline, upload a hero image, move the "View collection" button into the hero container, move the contact section to second place. Then select the hero button and ask: *"Change only this button's background to blue"* (real Claude call). | Only that button's background changes; every manual edit survives. | A deep diff of the whole page before and after the AI edit found **exactly one change**: `…left[3].props.bgColor: "#c9a44c" -> "#2563eb"`. Headline, uploaded image (`asset:…`), moved button and section order unchanged. Response time 3 s. Undo restores `#c9a44c`; Redo restores blue. |
| Mobile preview, heading selected: *"Make this heading smaller"* (real) | Only a phone-only override; desktop untouched | One change: `mobile.fontSize: undefined -> 40`; desktop still 64 px (3 s) |
| Whole page: *"Make every button on the page fully rounded"* (real) | Only button radii change | 5 changes, all `…radius: N -> 64`; no text or other settings touched (3 s) |

## AI failure and concurrency cases

Fake responses, run in the real editor ([ai-failures.js](../tests/browser/scenarios/ai-failures.js)):

| # | Input | Expected | Actual (observed) |
|---|---|---|---|
| 1 | Generation returns a page with an unknown element type and missing fields | Rejected, page unchanged | Error: *"The AI result was rejected: … (at root.props.description)"*; page unchanged |
| 2 | User edits the page title while generation is pending (3 s) | Ask before replacing | Prompt: *"You edited the page while Claude was working…"*; *Keep my page* keeps the edit |
| 3 | Generate, then Undo, then Redo | Old page, then new page | "Crafted to be kept." → "Crafted to be kept." → "Crafted to be worn, made to be remembered" |
| 4 | User renames the selected button while an AI edit is pending | Prompt; nothing applied until confirmed | Before confirming, bg still `#c9a44c`; after *Apply anyway*: label "Shop the collections" + bg `#2563eb` (both kept) |
| 5 | Button selected, AI returns an edit to the headline | Rejected (out of scope) | *"The AI tried to change Heading "Crafted to be kept.", which is outside your selection…"*; page unchanged |
| 6 | AI returns `bgColor: "javascript:alert(1)"` | Rejected | *""javascript:alert(1)" is not a valid colour"*; page unchanged |
| 7 | Server returns HTTP 429 | Readable error, page unchanged | *"Claude is busy (rate limit)…"*; page unchanged |
| 8 | AI inserts a Section inside a Container | Rejected (nesting) | *"A Section cannot go inside a Container."*; page unchanged |

Server-side error handling, observed by starting the builder with a broken configuration and calling `POST /api/generate`:

| Input | Expected | Actual (observed) |
|---|---|---|
| `ANTHROPIC_API_KEY` empty | Clear setup message | HTTP 500: *"The server has no ANTHROPIC_API_KEY. Add it to .env…"* |
| Invalid key | Clear message | HTTP 500: *"The Claude API key was rejected. Check ANTHROPIC_API_KEY…"* |
| API unreachable (`ANTHROPIC_BASE_URL=http://127.0.0.1:9`) | Clear message | HTTP 503: *"Could not reach the Claude API…"* |
| Prompt `"hi"` or a non-JSON body | Validation message | HTTP 400: *"Please describe your business in at least one sentence."* |

During one full test run, a single AI edit took **356 s** to come back from the Claude API (normally ~3 s), and the `real-ai-edits` scenario timed out waiting for it. Since then every AI request has a time limit: generation 150 s with no automatic retry, edits 60 s with one retry. A timeout shows *"Claude took too long to answer. Please try again in a moment."*

## Real drag-and-drop and nesting feedback

[drag-and-drop.js](../tests/browser/scenarios/drag-and-drop.js): **real mouse drags**. `cdp.mjs` sends Chrome mouse input (press, move in small steps, release), and checks run while the button is held and after release.

| Input | Expected | Actual (observed) |
|---|---|---|
| Drag a "View collection" button into the hero's left column | Moves; no warning | Parent became the hero container; no message |
| Drag a new **Section** from the Blocks panel over the hero's right column (hold) | Red dashed outline on that column + explanation | Outline on `Container-…:right`; *"Can't drop a Section here: Sections go directly on the page. Drop it between other sections."* ([screenshot](screenshots/drag-refused.png)) |
| …and let go | Message matches what really happened; nothing invalid nested | Puck placed the section on the page instead; message *"Placed on the page instead…"*; 0 invalid children in containers; outline removed; **Undo** removes the section |
| Drag an existing **Container** card over the hero's right column (hold), then let go | Explanation; not nested | *"Can't drop a Container here: A container can't go inside another container…"*; card still inside its section |

The first version said *"Not moved"* after the Section drop, but the page had actually gained a section. The test caught it, and the message now compares the page before and after the drop (see README, debugging example 5).

## Landing page and *Get started* chat

[landing.js](../tests/browser/scenarios/landing.js) (run at 1440 px and 390 px) and [start-flow.js](../tests/browser/scenarios/start-flow.js) (fake AI answer after 6 s):

| Input | Expected | Actual (observed) |
|---|---|---|
| Open `/` at 1440 px and 390 px | Headline, 6 features, 3 steps, CTAs to `/start` and `/editor`, no sideways scroll | All present at both widths; no overflow |
| `/start`: brief "short" | Send disabled | Disabled |
| Pick *Bakery* + *Warm & friendly*, send | Brief shown with the style; build animation progresses | Brief ends "Style: Warm & friendly."; status visible, steps ticking |
| Answer arrives | Remaining steps finish; real page previewed | Preview h1 = the generated page's h1; "Your page is ready" + *Open in editor* |
| Click *Open in editor* | Page saved, editor opens with it | `/editor` shows the same h1 |
| **Real run** (Claude): florist in Jaipur, *Warm & friendly* | Full flow with a real answer | 25 s; all 6 steps completed; "Petal & Pine — Boutique Florist in Jaipur · 4 sections"; preview uses badges, cards and an arrow button ([screenshot](screenshots/start-ready.png)) |
| Landing page with reduced motion | Everything visible, nothing animated | First attempt: hero demo and terminal were empty (looping animations ended on a faded-out frame). Fixed by `animation: none`; re-checked ([landing-full.jpg](screenshots/landing-full.jpg)) |

## Design system

[design-options.js](../tests/browser/scenarios/design-options.js), plus checks on the exported site:

| Input | Expected | Actual (observed) |
|---|---|---|
| Settings panel: Container *Surface* → Card | Preview shows the card style | `surface: "card"`, class `vs-container--card` present |
| Settings panel: Paragraph *Style* → Badge | Pill label | `variant: "badge"` |
| Settings panel: Section *Background style* → Soft gradient, then Undo | Gradient, then back to solid | `vs-section--gradient` applied; Undo → `solid` |
| Editor preview | No scroll fade-in or hover lift inside the editor | 0 live sections / 0 live containers |
| Exported coffee page | Live effects on; generated options rendered | 4 live sections, 3 `card` surfaces, 11 styled paragraphs, 2 arrow buttons ([exported-site.log](../evidence/exported-site.log)) |
| Old pages without the new settings (test fixture) | Still load and validate | `ai-failures` uses the older fixture and passes |

## AI generation runs (real model, `claude-opus-5-5`, effort `medium`)

| Brief (summary) | Time | Observed result |
|---|---|---|
| Loom & Line, premium clothing, black and gold, three collections, contact button | 27 s | Near-black backgrounds, gold `#c9a227` buttons, serif headings, exactly 3 collections, contact section |
| Crumb & Co., family vegan bakery in Pune, warm pastels, four signature bakes, order button | 20 s | Pastel peach/cream, rounded fonts, exactly 4 bakes as cards. This run had no contact section; I then made the prompt require one. |
| Still Point, yoga studio, sage green and cream, three class types, booking button | 22 s | Sections `home, classes, about, contact`; 3 class types, each with a booking button |
| Ember & Oak, coffee roastery in Bengaluru, espresso brown and cream, three coffees, roasting process, café button | 20 s | Brown/cream theme, serif headings (before the design system) |
| Northline, minimal architecture studio in Pune, white/charcoal + terracotta, three services, consultation button | 31 s | *With the design system:* gradient hero, 7 eyebrow labels, 4 lead paragraphs, 3 `outline` service cards, charcoal CTA band, 2 arrow buttons |
| Ember & Oak again, for the final export | 42 s | *With the design system:* badge labels, 3 `card` coffee cards, espresso-brown CTA band ([full-flow.log](../evidence/full-flow.log), [screenshot](screenshots/exported-full-page.png)) |

Generation got slower (20–27 s → 31–42 s) after the design system was added, because Claude's JSON now includes more style fields.

## Image persistence

| Input | Expected | Actual (observed) |
|---|---|---|
| Edit the headline and upload a JPEG; then close and reopen the browser (same Chrome profile) | Headline and image restored | Headline "Saved headline" restored; image saved as `asset:74d5cd9659ff4139` (not a `blob:` URL) and visible after reload |
| Export after uploading | Image file in `public/assets/`, portable path in `page.json` | `public/assets/0305303b48234b14.jpg`, `"src": "/assets/0305303b48234b14.jpg"`; no `asset:` or `blob:` left; loads when served |

## Mobile rendering

| Input | Expected | Actual (observed) |
|---|---|---|
| Switch to the Mobile preview | 390 px wide, columns stack, no horizontal overflow | 390 px, 1 column, no overflow |
| No override set | Headings scale down on phones | 64 px heading shows at 48 px (75 %) |
| Set the heading's mobile font size to 30 | Phone 30 px, desktop unchanged | Phone 30 px, desktop 64 px; Undo → override removed; Redo → 30 |
| Exported site (coffee page) at 390 px | Override and stacking preserved | h1 34 px on phone / 62 px desktop, 1 column / 2 columns, no overflow |

## Export

| Input | Expected | Actual (observed) |
|---|---|---|
| [evidence/website.zip](../evidence/website.zip), produced after a generation, manual edits, a mobile override and an AI edit | Fresh-folder `npm ci`, `npm run build`, `npm run start` work without the builder or an API key | `npm ci`: 30 packages in 5 s. `npm run build`: compiled, `/` prerendered as static. `npm run start` serves the page. |
| ZIP contents | No secrets, no editor-only references | No `.env`, no `sk-ant` strings, no `asset:` or `blob:` in `data/page.json` (checked by [verify-export.sh](../scripts/verify-export.sh)) |
| Served export vs editor | Same text, links, order, styles | Title, headline, blue `#2563eb` button with `#contact` link, uploaded image, section order `home, contact, coffees, process` all as edited ([screenshots](screenshots/)) |

## Not tested

Recorded honestly, with what was done instead:

- **Touch dragging** (phones and tablets). Real mouse drags are tested; section reorder by dragging is tested with Puck's `reorder` action.
- **Container padding/gap/alignment/columns fields** have no dedicated test. They render through the same CSS that the mobile tests exercise.
- **Browsers other than Chrome.**
- **IndexedDB unavailable** (some private modes) and **storage quota exceeded**: there is code for a warning or an error message, but it was never triggered.
- **Two tabs open at once:** last save wins; not tested.
- **Very large or unusual images** (only PNG and JPEG uploads were tested; the size limit is 8 MB).

## Test-tooling problems found along the way

- The dev server once kept serving a stale copy of `lib/ai/prompts.ts` after rapid edits (`reviseUserPrompt is not a function`). A clean `next build` / `next start` did not have the problem, so the browser tests run against production builds.
- Puck's Outline panel also renders *Duplicate* / *Delete* buttons (one per row). My first duplicate test clicked an Outline button for a container and counted +2 paragraphs. The test now uses the selected element's action bar inside the preview iframe.
- `ai-failures` failed only inside an ad-hoc zsh loop: zsh did not split `$extra`, so the fixture argument was lost. It is fixed by the bash runner; see README, debugging example 3.
