# Input & Events

## Input Sources

The documentation describes three primary input mechanisms for the G2 glasses platform:

**G2 Touchpads (temple)**: "Press, double press, swipe up, swipe down" actions constitute the primary input method on the glasses frame.

**R1 Touchpads (ring)**: The optional ring device supports an identical gesture set, with events distinguishable by their source origin.

**IMU Sensors**: "Head orientation, motion data" are available for motion-aware applications through the IMU API.

## Event Types

The platform defines seven distinct event categories:

- `CLICK_EVENT` (0): Single press action
- `DOUBLE_CLICK_EVENT` (3): Double press action
- `SCROLL_TOP_EVENT` (1): Upward swipe or scroll boundary
- `SCROLL_BOTTOM_EVENT` (2): Downward swipe or scroll boundary
- `FOREGROUND_ENTER_EVENT` (4): App activation
- `FOREGROUND_EXIT_EVENT` (5): App backgrounding
- `ABNORMAL_EXIT_EVENT` (6): Unexpected disconnection

## Event Handling

The code example demonstrates using a switch statement to process different event types through the bridge's `onEvenHubEvent` callback, with special handling for cases where the SDK normalizes certain values.

## Event Routing & Constraints

Only one container per page can capture events. Event delivery routes through either text or list containers based on the `isEventCapture` property setting.

## Lifecycle Events

Apps receive notifications when visibility changes: entering foreground (resume operations), exiting foreground (pause work), or experiencing abnormal disconnection.
