# OpenRouter Integration — Roadmap

Execution plan for wiring OpenRouter.ai summarization into the existing
item store. Each step is independently testable; do not start step N+1
until step N is verified.

Schema contract (source of truth): [src/types.ts](src/types.ts).
Storage contract: [src/store.ts](src/store.ts) — `addItem` already handles
id stamping, `unshift`, and the 60s `recent-id` flag.

---

## Step 1 — Prompt files  ✅ DONE

**Files:**
- [src/client/prompts/short-form.txt](src/client/prompts/short-form.txt)
- [src/client/prompts/long-form.txt](src/client/prompts/long-form.txt)

**Built:** both prompts lock the JSON shape to `Item`-minus-id/createdAt,
forbid code fences and prose, cap title at 40 chars, and include an
"Unreadable" escape hatch so the validator never sees a non-conforming
error response. Long-form requires 3–7 distinct sections (with the
Unreadable path as the single-element exception).

**Each file contains a system prompt that:**
1. States the task (summarize the user-provided document or URL).
2. Specifies the exact JSON shape to return, matching the `Item` type
   minus `id` and `createdAt` (those are stamped client-side).
3. Forbids any output outside the JSON object — no markdown fences,
   no prose, no preamble.
4. Constrains `title` to a short human-readable string (≤40 chars;
   the glasses UI truncates to 11 at render time but we keep the
   full string in storage).
5. Short form: `type: "short"`, `sections` must be an array with
   exactly one `{heading, content}` entry.
6. Long form: `type: "long"`, `sections` is 3–7 `{heading, content}`
   entries covering distinct topics/chapters.

**Verification:** open each file, confirm the example JSON block in
the prompt parses as valid JSON and matches the `Item` shape.

---

## Step 2 — Client module  ✅ DONE

**File:** [src/client/client.ts](src/client/client.ts) + [src/vite-env.d.ts](src/vite-env.d.ts)

**Built:**
- `getApiKey` / `setApiKey` read/write `universal-reader:openrouter-key`.
- `generateItem({ mode, messages })` builds the OpenRouter request with
  `response_format: json_object`, default model `openai/gpt-4o-mini` (top-of-file const).
- `parseJsonPayload` tolerates stray whitespace and (as a fallback only) a
  single outer `{…}` block, never code fences — but our prompts forbid those.
- `validateItem` enforces: `type` matches requested `mode`, non-empty title,
  non-empty sections, short-form has exactly one section, every section has
  trimmed non-empty heading + content.
- `stampItem` adds `id` + `createdAt`. Pipelines never see a partial `Item`.
- Added `src/vite-env.d.ts` so `.txt?raw` imports typecheck.
- `npx tsc --noEmit` clean.

**Exports:**
- `getApiKey(): string | null` — reads `universal-reader:openrouter-key`.
- `setApiKey(key: string): void` — writes same.
- `generateItem(args: { mode: 'short' | 'long', messages: ChatMessage[] }): Promise<Item>`
  — builds the OpenRouter request, calls it, parses, validates, stamps
  id+createdAt, returns an `Item`. Throws on any failure (missing key,
  network, malformed JSON, schema mismatch) with a message suitable for
  the debug console.

**Internals (not exported):**
- `loadPrompt(mode)` — Vite `?raw` imports of the two `.txt` files.
- `buildRequest(mode, userMessages)` — prepends the system prompt,
  sets `response_format: { type: 'json_object' }`, picks a default
  model (start with `openai/gpt-4o-mini`; make it a top-of-file const
  so it's easy to swap).
- `validateItem(raw: unknown, mode): Item | null` — strict shape check
  against `types.ts`. Rejects if `type` doesn't match requested mode,
  if `sections` is empty, if short-form has >1 section, if any field
  is wrong type.

**Verification:** unit-test-free for now — we'll exercise it through
the pipelines in steps 3–4.

---

## Step 3 — `from-file` pipeline  ✅ DONE

**File:** [src/data-stream/from-file.ts](src/data-stream/from-file.ts)

**Built:**
- `ingestFile(file, mode)` guards `.txt` / `text/plain`, reads via `file.text()`,
  trims, rejects empty input.
- Truncates at 60k chars to stay well inside model context limits on the default
  `gpt-4o-mini`. If we hit this cap we'll switch to chunked summarization — not
  needed now.
- Hands the text to `generateItem` with a one-line user instruction that names
  the source file. On success calls `store.addItem` (which also sets the
  60s recent-id flag) and returns the `Item`.
- Typecheck clean.

**Export:** `ingestFile(file: File, mode: 'short' | 'long'): Promise<Item>`

**Flow:**
1. Read `file` as text (`.txt` only for v1 — reject other MIME types early).
2. Build a single user message: `"Summarize the following document titled '<filename>':\n\n<text>"`.
3. Call `client.generateItem({ mode, messages: [userMessage] })`.
4. Call `store.addItem(item)` on success.
5. Return the `Item` so the caller can update UI / debug log.

**Verification:** drop a small `.txt` file through the form, confirm a
new item appears in Stored Items list and the recent-id flag fires.

---

## Step 4 — `from-link` pipeline  ✅ DONE

**File:** [src/data-stream/from-link.ts](src/data-stream/from-link.ts)

**Built:**
- `ingestLink(url, mode)` validates the URL via `new URL()` and rejects
  non-http(s) schemes (no `file://`, `javascript:`, etc.).
- Sends the URL as a string to `generateItem`; relies on the model's
  browsing capability. If `openai/gpt-4o-mini` doesn't fetch the URL
  reliably we'll swap the `DEFAULT_MODEL` const in `client.ts` — no
  pipeline change needed.
- Same downstream handling as `from-file`: `addItem` + return.
- Typecheck clean.

**Export:** `ingestLink(url: string, mode: 'short' | 'long'): Promise<Item>`

**Flow:**
1. Validate `url` is a well-formed http(s) URL.
2. Build user message:
   `"Fetch the contents of this URL and summarize it: <url>"`.
   (We rely on the model's web-browsing capability; if the chosen
   model can't fetch URLs we switch models in the client const —
   that's a step-2 config change, not a pipeline change.)
3. Call `client.generateItem` → `addItem` → return.

**Verification:** submit a known-good article URL, confirm a new item
lands in storage with mode-appropriate section count.

---

## Step 5 — WebView wiring  ✅ DONE

**Files:** [src/main.ts](src/main.ts), [src/style.css](src/style.css)

**Built:**
- New `ingest` card inserted above the `actions` card. No existing layout
  touched — the status card, dummy-add, reset, debug console, and
  stored-items list are all unchanged.
- Card contents: API-key password field + "Get a key ↗" link to
  `openrouter.ai/keys`, save button, mode `<select>`, `.txt`-gated
  file input, URL input, per-row buttons, status line.
- Handlers call `ingestFile` / `ingestLink`, disable both buttons while
  in-flight, log success/failure via `console.info`/`console.error`
  (already piped to the debug log). On success `location.reload()`
  reuses the existing recent-id skip-to-overview flow.
- `style.css` gained input/select styling and a `button:disabled`
  rule so busy states are visible.
- Typecheck clean. `npm run build` clean (~89 kB JS, ~3.6 kB CSS).

**Additions inside the existing `innerHTML` template (no layout
rewrite):**
1. New `<section class="card">` above the existing `actions` card:
   - API key `<input type="password">` + "Get a key ↗" link to
     `https://openrouter.ai/keys` (opens in new tab).
   - Save button (writes via `client.setApiKey`).
   - Mode `<select>`: short / long.
   - `<input type="file" accept=".txt">` + "Summarize file" button.
   - URL `<input type="url">` + "Summarize URL" button.
2. Button handlers call `ingestFile` / `ingestLink`, then
   `location.reload()` on success (matches the existing dummy-add
   pattern so the glasses jump straight to the new item).
3. Errors route to the existing debug console via `console.error`
   (already piped to the debug log by `installDebugConsole`).

**Verification:** open `npm run dev`, paste a real key, ingest one
file and one URL in each mode, confirm four items added and the
recent-id skip still works.

---

## Step 6 — Manual integration test  ⚠ PARTIAL

**Automated checks (done):**
- `npx tsc --noEmit` clean.
- `npm run build` clean (vite production bundle builds).

**Manual browser test (not done by me — needs a live OpenRouter key):**
Run `npm run dev`, then from the web view:
1. Paste an OpenRouter key, hit Save key; status should show `saved · …xxxx`.
2. Mode = short, pick a `.txt`, click Summarize file → expect reload with
   a new item at the top of Stored Items and glasses jumping to overview.
3. Mode = long, repeat with the same or different file → expect a
   multi-section item.
4. Mode = short, paste a URL, click Summarize URL → expect same flow.
5. Mode = long, URL → expect 3–7 sections.
6. Malformed key or bad URL → expect red error in the debug console
   and no new item added.
7. Dummy-add and Reset buttons still work.

I can't drive a browser against a real API key in this sandbox —
flagging explicitly per the "UI changes require browser verification"
rule. Ping me with any failures and I'll debug.

---

## Step 7 — Image + PDF support in `from-file`  ✅ DONE

**Files:** [src/client/client.ts](src/client/client.ts), [src/data-stream/from-file.ts](src/data-stream/from-file.ts), [src/main.ts](src/main.ts)

**Problem:** file input rejected anything that wasn't `.txt`, so PNG/PDF uploads threw `Unsupported file type` before reaching the model.

**Built:**
- `ChatMessage.content` now accepts `string | ContentPart[]`. New `ContentPart` union covers `text`, `image_url`, and `file` parts per the OpenRouter content-parts spec.
- `generateItem` takes an optional `plugins` array and attaches it to the request body when set.
- `ingestFile` detects kind from MIME + extension (`text`, `image`, `pdf`). Text path unchanged. Image path sends base64 data URL as an `image_url` part (handled natively by `gpt-4o-mini`). PDF path sends a `file` part and enables `{ id: 'file-parser', pdf: { engine: 'pdf-text' } }` so OpenRouter extracts text before the model sees it.
- 20 MB hard cap on binary uploads.
- File input `accept` widened to `.txt,.pdf,.png,.jpg,.jpeg,.webp,.gif`.
- Typecheck + `npm run build` clean.

**Follow-ups if needed:** switch PDF engine to `mistral-ocr` for scanned PDFs (paid), or `native` for models that parse PDFs directly (Claude, Gemini).

---

# Phase 2 — Mode restructure (always-lead Summary + auto heuristic)  ✅ DONE

**Built (Steps 8–12):**
- Both prompts rewritten: short-form now requires a single `heading: "Summary"` section (40–80 words). Long-form requires `sections[0].heading === "Summary"` (40–80 word recap) followed by 2–6 chapter sections with distinct 1–3 word headings.
- `validateItem` in [client.ts](src/client/client.ts) enforces `sections[0].heading.toLowerCase() === 'summary'` and normalizes the stored heading to the literal `"Summary"`. Long-form capped at 7 sections.
- New [src/data-stream/mode.ts](src/data-stream/mode.ts) exports `pickTextMode(text)` → `short` when word count < 250, else `long`.
- [from-file.ts](src/data-stream/from-file.ts) applies the heuristic on the text branch only. Image/PDF branches default to `long` (no word count available without parsing).
- [from-link.ts](src/data-stream/from-link.ts) dropped its `mode` parameter and always requests `long` (URL body isn't available client-side without CORS-bound fetching).
- [main.ts](src/main.ts) + [style.css](src/style.css): mode `<select>` removed. Ingest card now shows a one-line hint describing the auto behavior. Pipelines called without `mode`.
- Typecheck + `npm run build` clean.

## Goal

Every item starts with a first section literally titled **"Summary"** — a single short paragraph, always visible first in overview. Remove the short/long toggle from the UI. Auto-detect:

- **Short path** (single Summary section, no chapters): triggered when the input is **text-based AND under 250 words**. Covers short `.txt` files and short URL bodies.
- **Long path** (Summary + 2–6 chapter sections): everything else (long text, images, PDFs, URLs ≥ 250 words).

The Summary section acts like the old short-form content; the chapters are unchanged in spirit but come after it.

## Step 8 — Prompt rewrite

**Files:** `src/client/prompts/short-form.txt`, `src/client/prompts/long-form.txt`

- `short-form.txt`: single-section output, section heading MUST be the literal word `Summary`. Otherwise unchanged.
- `long-form.txt`: sections array is now 3–7 elements as before, but **element 0 MUST have `heading: "Summary"` and be a short 40–80-word recap of the whole piece**. Elements 1..N are chapter sections as before (1–3 word headings, distinct).

## Step 9 — Client-side validator

**File:** `src/client/client.ts`

- `validateItem` stays mode-aware but gains one new rule: **first section's heading must equal `"Summary"`** (case-insensitive match, normalize to title-case on the way into storage).
- Long-form count range widened to 3–7 (was 3–7 already — confirm rules still allow Summary + 2–6 chapters).

## Step 10 — Word-count heuristic

**File:** `src/data-stream/from-file.ts` and `src/data-stream/from-link.ts`

- Helper `pickMode(input): Mode` lives in a small shared module (`src/data-stream/mode.ts`). Returns `"short"` only when:
  - `input.kind === "text"` AND
  - word count (split on whitespace) < 250.
  - Otherwise `"long"`.
- `from-file`: applies after reading the text. Images/PDFs bypass → always long.
- `from-link`: no access to the URL body at request time, so URLs always go `long`. We could fetch the URL client-side first for word-counting but that adds CORS headaches; long-by-default is the sane choice.

## Step 11 — UI cleanup

**File:** `src/main.ts`, `src/style.css`

- Remove the mode `<select>` and its label row.
- Remove `currentMode()` in handlers; call the pipelines without the mode arg (pipelines pick internally).
- Update the ingest card to state the behavior in one line: "Short inputs get a single Summary; longer inputs get a Summary plus chapter sections."

## Step 12 — Typecheck + build + manual test

- `tsc --noEmit` and `npm run build` clean.
- Manual: short .txt → single-Summary item. Long .txt → Summary + chapters. Image → Summary + chapters. PDF → Summary + chapters. URL → Summary + chapters.

---

# Phase 3 — Settings view + delete + list actions  ✅ DONE

**Built (Steps 13–16):**
- Header now has a `Notes` / `Settings` tab nav; `setView()` toggles `hidden` on two `<div>` wrappers. Memory-only; reloads land on Notes.
- Notes view: Upload card (file + URL inputs), Notes list, Debug console.
- Settings view: OpenRouter API key card, Glasses status telemetry, Developer actions (dummy-add, reset storage).
- `removeItem(id)` added to [store.ts](src/store.ts). Stored items render a per-row Delete button; click → `confirm()` → filter → in-place re-render (no reload). `state.itemIndex` clamps to the new list length.
- New CSS for `.view-nav`, `.view-tab.active`, `.actions-row`, `.item-actions`.
- Typecheck + `npm run build` clean.

## Goal

Split the webView into two views so the main view is focused on notes, and push every configurable/admin control into Settings. Add a delete action on stored items.

**Decided (locks in your answers):**
- Main view (`Notes`) = ingest card + debug console + stored-items list (each row now has Export and Delete buttons; Export gets wired in Phase 4).
- Settings view = OpenRouter API key, Google Drive connect/disconnect (wired in Phase 4), dev buttons (dummy-add, reset storage).
- Toggle between views via a two-button header nav. No router — in-memory view state, defaults to Notes on reload.

## Step 13 — View switcher scaffolding

**File:** `src/main.ts`, `src/style.css`

- Add a `<nav class="view-nav">` in the header with `Notes` / `Settings` buttons. Active button gets an `.active` class.
- Two top-level wrappers inside `<main>`: `<div id="view-notes">` and `<div id="view-settings" hidden>`. Swap by toggling the `hidden` attribute.
- Small `setView('notes' | 'settings')` helper. View state is memory-only; reloads land on Notes.

## Step 14 — Move configurables into Settings

**Files:** `src/main.ts`, `src/style.css`

- Move the OpenRouter API key block (input + save button + key-link + status) into `#view-settings`.
- Move the status card (bridge / screen / item / section / last-call) into `#view-settings` — it's developer telemetry.
- Move the Actions card (dummy-add, reset storage) into `#view-settings` under a "Developer" heading.
- Keep on Notes: ingest card, debug console, stored items.
- Rename the page header/sub to reflect the cleaner main surface.

## Step 15 — Delete action on stored items

**Files:** `src/store.ts`, `src/main.ts`, `src/style.css`

- Add `removeItem(id: string): Item[]` to `store.ts` — filters, re-saves, returns the new list.
- Render a small "Delete" ghost button next to each item in the Stored Items list. Click → `window.confirm("Delete this note?")` → `removeItem(id)` → re-render in place (no full `location.reload()` — `renderItemList(loadItems(), state)` is enough).
- If the deleted item was the currently active one, reset `state.itemIndex` to 0 and call `state.onChange()` so the status mirrors reality.

## Step 16 — Typecheck + build

- `tsc --noEmit` clean; `npm run build` clean. No API key needed to verify this phase; manual smoke test is "toggle views, delete a dummy item, confirm it stays gone after reload."

---

# Phase 4 — Local Markdown export (browser download)

## Goal

Per-item **Export** and **Export all** actions on the Notes view that trigger a browser `.md` download — no accounts, no OAuth, no external services. One file per note; "Export all" fires multiple downloads in a single user gesture (browser prompts once to allow multiple).

No new dependencies. Everything is `Blob` + anchor-click.

## Step 17 — Markdown export module

**File:** `src/client/export.ts` (new)

**Exports:**
- `itemToMarkdown(item: Item): string` — deterministic formatter:

  ```markdown
  # <title>

  > Captured <ISO timestamp> · type: <short|long>

  ## Summary
  <content of sections[0]>

  ## <sections[1].heading>
  <sections[1].content>

  ...
  ```

- `downloadItem(item: Item): void` — builds the markdown, wraps in a `Blob`, creates an object URL, triggers an `<a download>` click, revokes the URL on next tick. Filename: `<sanitized-title>-<yyyy-mm-dd>.md`.
- `downloadAll(items: Item[]): void` — loops over `items` calling `downloadItem`. No zipping; the browser will prompt once for "Allow multiple downloads" the first time, then batch.
- `sanitizeFilename(name: string): string` — strips `/\\:*?"<>|`, collapses whitespace, truncates to 80 chars, falls back to `untitled` on empty.

## Step 18 — Notes UI: per-item Export + Export all

**Files:** `src/main.ts`, `src/style.css`

- Add a per-item "Export" ghost button on each stored-items `<li>` (sibling to the Delete button from Step 15). Click → `downloadItem(item)`.
- Add an "Export all" button to the items section header (next to the item count). Click → `downloadAll(loadItems())` when the list is non-empty; no-op otherwise.
- No auth gating, no disabled state, no Settings wiring — download-to-disk just works.

## Step 19 — Typecheck + build + smoke test

- `tsc --noEmit` and `npm run build` clean.
- Manual:
  1. Notes → pick an item → Export → browser saves `<title>-<date>.md`. Open it, confirm the Summary and chapter sections render.
  2. Export all → browser asks to allow multiple downloads once → every item saved.
  3. Delete an item locally → already-downloaded file on disk is untouched (downloads are fire-and-forget; we don't track them).
  4. Rename a note's title in a follow-up ingest (not currently possible) — filenames would diverge, which is fine for v1.

---

## Out of scope (explicit)

- Item eviction / storage cap.
- Server-side URL fetch proxy (only if the default model can't browse).
- Streaming responses.
- Any changes to the glasses-side rendering code.
