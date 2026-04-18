# Display & UI System

## Canvas

Each eye displays a **576 x 288 pixel** canvas with the origin at the top-left corner. Colors render as 4-bit greyscale (16 green levels), where white pixels appear bright green and black pixels are transparent/off.

## Containers

The UI uses rectangular **containers** with absolute pixel positioning—no CSS, flexbox, or DOM. Key constraints:

- Maximum 4 image + 8 other containers per page
- Exactly one container must have `isEventCapture: 1` to receive input
- Later containers draw on top; no z-index control beyond declaration order

### Shared Properties

Containers support: `xPosition`, `yPosition`, `width`, `height`, `containerID`, `containerName`, and `isEventCapture`.

### Border Properties

Text and list containers only support: `borderWidth` (0–5), `borderColor` (0–15 greyscale), `borderRadius` (0–10), and `paddingLength` (0–32). There is no background color or fill color property.

## Text Containers

Renders plain, left-aligned, top-aligned text with no formatting options. Content limits: 1,000 characters for startup, 2,000 for upgrades. Text wraps at container width; scrolling is firmware-handled for overflow. Use `textContainerUpgrade` for flicker-free in-place updates.

## List Containers

Native scrollable lists with maximum 20 items (64 characters each). No custom styling or in-place updates—full page rebuild required.

## Image Containers

Display 4-bit greyscale images (20–200 px wide, 20–100 px tall). Cannot send during startup; use placeholder containers updated via `updateImageRawData`. Supports multiple input formats.

## Font & Unicode Support

Single LVGL font in firmware; no size or style control. Useful characters provided for progress bars, navigation, selection, borders, and card suits.
