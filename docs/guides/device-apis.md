# Device APIs

## Audio

The documentation describes microphone control via `bridge.audioControl()`:

- `audioControl(true)` starts capture
- `audioControl(false)` stops capture
- Audio data arrives via `audioEvent` in the event callback. Format: PCM 16kHz, signed 16-bit little-endian, mono.

## IMU (Inertial Measurement Unit)

The G2 glasses include motion sensing capabilities. Control is managed through the `imuControl()` method with two parameters:

**Parameters:**

- `isOpen` (boolean): initiates or terminates data streaming
- `reportFrq` (ImuReportPace): determines sampling frequency

**Supported Pacing Codes:**

Values range from P100 through P1000, representing protocol-level pacing codes rather than literal Hz measurements.

**Data Structure:**

IMU samples contain X, Y, and Z axis float values, delivered through `onEvenHubEvent()` callbacks with event type `IMU_DATA_REPORT`.

## Device & User Information

- **Device Info**: Model identification, serial numbers, battery status, wearing detection, and charging state accessible via `getDeviceInfo()`
- **Status Monitoring**: Real-time updates available through `onDeviceStatusChanged()`
- **User Data**: UID, display name, avatar, and country information retrievable via `getUserInfo()`

## Local Storage

Simple key-value persistence: `setLocalStorage()` and `getLocalStorage()` methods.

## Limitations

The SDK explicitly does not expose: direct Bluetooth, pixel-level drawing, audio playback, text formatting controls, background colors, per-item styling, scroll manipulation, animations, camera access, or color imaging.
