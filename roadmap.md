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

## Out of scope (explicit)

- `from-image.ts` (images / PDFs) — next milestone.
- Item eviction / storage cap.
- Server-side URL fetch proxy (only if the default model can't browse).
- Streaming responses.
- Any changes to the glasses-side rendering code.
