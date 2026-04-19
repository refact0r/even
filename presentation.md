# Nutshell — 5-Minute Presentation Script

**[0:00 — Hook, ~20s]**

Imagine you're walking to a meeting. You have a 40-page PDF you were supposed to read, an article someone DM'd you, and a photo of a whiteboard you haven't transcribed. You can't pull out your phone. What if all of that was already in your field of view, distilled down to what matters, when you glance up?

That's Nutshell.

**[0:20 — What it is, ~30s]**

Nutshell is a reading companion for the Even Realities G2 smart glasses. You feed it anything — a text file, a PDF, a photo of a page, a URL — and it returns a clean, structured summary you can navigate hands-free on the HUD. The phone does the heavy lifting: ingest, parse, summarize. The glasses just display.

It's built on the Even Hub SDK, with OpenRouter powering the summarization layer, which means any frontier model — GPT-4o, Claude, Gemini — is swappable with a one-line change.

**[0:50 — The phone-side flow, ~45s]**

On the phone web view, you get two surfaces. **Notes**, where you upload and read, and **Settings**, where everything configurable lives — API key, developer tools, glasses telemetry.

Upload is dead simple. One file input accepts `.txt`, `.pdf`, and common image formats up to 20 megabytes. One URL input takes any article link. Behind the scenes, text files go straight to the model. PDFs route through OpenRouter's file-parser plugin with the `pdf-text` engine — no client-side PDF libs. Images go as base64 data URLs to a vision-capable model. URLs get fetched by the model itself.

Every ingest produces a structured item, stored locally in `localStorage` under a stable schema.

**[1:35 — The Summary-first structure, ~45s]**

Here's the core design choice that sets us apart. Every note — no matter the source — **starts with a section literally called "Summary."** A 40-to-80 word recap, enforced by the prompt and double-checked by a client-side validator that rejects any model output that doesn't comply.

For short text under 250 words, that Summary *is* the whole note. For anything longer — a PDF, an image, a long article — the Summary is followed by 2 to 6 chapter sections, each with a distinct 1-to-3-word heading. Think: Summary, Background, Methods, Findings, Implications.

This means on the glasses, you always land on the gist first. You decide if you want to go deeper.

**[2:20 — The glasses experience, ~1:00]**

Three screens on the HUD, each tuned to the G2's tiny glanceable display.

**Home** is your list of notes in reverse chronological order. Swipe up and down on the temple to scroll, tap to open.

**Overview** is a split view. Left: a scrollable list of section headings for the selected note. Right: a live preview of whatever section you're currently on. Scroll navigates sections, tap enters reading mode, double-tap drops you back home. One subtle detail — we had to put event capture on the preview panel, not the list, because of a firmware quirk where native list containers drop scroll events on the simulator. Small thing, but it's the difference between "works" and "feels broken."

**Reading** is fullscreen text. The SDK's `textContainerUpgrade` lets us span the entire note across pages. Double-tap returns to overview. That's it. No menus, no chrome, just text.

**[3:20 — Ingestion quality-of-life, ~35s]**

A few things that make it actually usable day-to-day.

When you ingest something new, the phone drops a 60-second "recent-id" flag. The next time the glasses launch, they skip the home list entirely and jump straight into the thing you just added. No fishing for it.

Every note has a one-click markdown export. Or "Export all" in the header, which batches every note into separate `.md` files. No account, no cloud, no lock-in — just Blob downloads. Your data is portable by default.

And every note has a delete button. Right there in the list.

**[3:55 — What makes it different, ~45s]**

So what makes Nutshell different from Notion, Apple Notes, Obsidian, Readwise?

**One**, it's not a capture tool. It's a *consumption* tool. Those apps optimize for filing things away. Nutshell optimizes for the moment you want to actually read them — when your hands are busy and your phone is in your pocket.

**Two**, AI summarization isn't a feature, it's the foundation. Every note is structured the same way — Summary first, chapters after — which means the navigation model on a two-line HUD actually works. You can't do that with free-form text.

**Three**, it's local-first and model-agnostic. Your notes live in `localStorage`. Your model is whichever OpenRouter endpoint you choose. There's no server, no account, no vendor owning your reading habits.

That's the pitch. Happy to demo.

---

**Timing notes:** ~750 words, paces to roughly 5 minutes at a conversational 150 wpm. Trim the glasses-quirk aside (2:20) if you need to recover time; expand the differentiators section if you have an extra minute.

