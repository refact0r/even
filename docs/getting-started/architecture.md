# Even Hub Architecture

## Overview

Even Hub applications are web-based apps developed using standard web technologies alongside the Even Hub SDK. Developers build locally and package apps for distribution through the Even Hub platform.

## Connection Model

The system uses a three-tier architecture:

- **Even Hub Cloud**: Handles distribution and hosting
- **Phone**: Runs the Even Realities App with a WebView, executing app logic and managing Bluetooth communication
- **G2 Glasses**: Displays UI containers and transmits input events (presses, scrolls, swipes)

The glasses don't execute app logic beyond native scroll processing—all computation occurs on the phone.

## Testing Approaches

Three methods exist for hardware testing during development:

1. **QR sideloading**: Launch a local development server and use the CLI to generate a QR code; scan with the Even Realities App for hot reload
2. **Private builds**: Package via CLI command and upload to the developer portal for device testing
3. **Simulator**: Test layouts and logic entirely on your computer without hardware

## PWA Alternative

Developers can build Progressive Web Apps instead, hosting them independently and distributing directly to users. This bypasses the Even Hub packaging workflow but provides complete distribution control.

## SDK Bridge Mechanism

The SDK injects a JavaScript bridge called `EvenAppBridge` into the WebView. Communication flows bidirectionally:

- **Outbound**: JavaScript invokes `bridge.callEvenApp(method, params)` through the bridge to control displays
- **Inbound**: Input events travel through Bluetooth to trigger `window._listenEvenAppMessage(...)` callbacks

## Project Structure

A standard web project includes an `app.json` manifest:

```
my-app/
├── src/
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── app.json
```

The only Even-specific dependency is the `@evenrealities/even_hub_sdk` package; everything else uses conventional web tooling.
