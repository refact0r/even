# Even SDK Project

Even SDK docs are in `/docs/`. Search or read these when working with the SDK.

- `docs/getting-started/` — overview, architecture, installation, first app
- `docs/guides/` — display, input events, device APIs, page lifecycle, design guidelines
- `docs/reference/` — CLI, simulator, packaging
- `docs/community/` — resources

## Glasses UI Flow (`src/glasses.ts`)

Three screens managed by `GlassesApp`:

1. **Home** — list of past items in descending date order. Scroll to highlight, click to open.
2. **Overview** — split view for the selected item. Left panel: scrollable section heading list (nav). Right panel: preview of the currently selected section. Scroll navigates sections; click enters reading mode at that section; double-click returns home.
3. **Reading** — fullscreen text view starting at the section selected in overview. Content spans the full item via `textContainerUpgrade`; double-click returns to overview.

## Even SDK Quirks

- On the simulator, overview input routing is inconsistent. A native list container did not receive scroll reliably; a text container with `isEventCapture: 1` worked. The preview (right panel) now holds event capture so the nav (left panel) doesn't receive firmware scroll events and avoids the scroll-bounce animation.
- Keep the event-capturing overview preview container last in the page container order.
- Some taps/double taps arrive as `sysEvent` with `eventSource` and no `eventType`; normalize those when handling overview/reading navigation.
