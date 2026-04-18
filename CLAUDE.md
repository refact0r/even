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
