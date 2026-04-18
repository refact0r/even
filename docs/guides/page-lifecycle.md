# Page Lifecycle

## Methods

| Method | Purpose | Notes |
|--------|---------|-------|
| `createStartUpPageContainer` | Create the initial page | Called exactly once at startup. Returns result code. |
| `rebuildPageContainer` | Replace the entire page | Full redraw — all state is lost, brief flicker on hardware. |
| `textContainerUpgrade` | Update text in-place | Faster, flicker-free on hardware. Requires matching `containerID` + `containerName`. |
| `updateImageRawData` | Update an image container | No concurrent sends allowed. |
| `shutDownPageContainer` | Exit the app | Pass `0` for immediate exit, `1` for exit confirmation dialog. |
| `callEvenApp` | Generic method call | Escape hatch — all typed methods are wrappers around this. |

## Result Codes

For `createStartUpPageContainer`:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid parameters |
| 2 | Oversize |
| 3 | Out of memory |

The `rebuildPageContainer`, `textContainerUpgrade`, and `shutDownPageContainer` methods return boolean values. The `updateImageRawData` method returns status strings: `success`, `imageException`, `imageSizeInvalid`, `imageToGray4Failed`, or `sendFailed`.

## Best Practices

- Employ `textContainerUpgrade` when text needs frequent updates—counters, status displays, or live data streams—to prevent visual flicker from full page redraws
- Use `rebuildPageContainer` when modifying container structure (adding/removing containers or switching content types)
- Always match `containerID` and `containerName` exactly when using `textContainerUpgrade`
- Do not call `updateImageRawData` concurrently — wait for one to complete before sending the next
