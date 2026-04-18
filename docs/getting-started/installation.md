# Installation

## Prerequisites

The setup requires several components:

- **Node.js** version 18 or higher
- A preferred web framework (Vite is suggested)
- The Even Realities App installed on a compatible phone
- G2 glasses for hardware testing (simulator available for early work)
- R1 ring as an optional input device

## SDK Installation

The core SDK can be installed via npm:

```bash
npm install @evenrealities/even_hub_sdk
```

The current release is version 0.0.9, offering typed methods for "display control, input handling, audio, device info, and local storage." The package is available at [@evenrealities/even_hub_sdk](https://www.npmjs.com/package/@evenrealities/even_hub_sdk).

## Simulator Installation

For early development without physical hardware, the simulator provides preview capabilities:

```bash
npm install -g @evenrealities/evenhub-simulator
```

Version 0.6.2 supports macOS, Linux, and Windows. This tool supplements rather than replaces actual device testing. Additional details appear in the [Simulator Reference](/docs/reference/simulator).

## CLI Installation

Command-line tools handle deployment and authentication tasks:

```bash
npm install -D @evenrealities/evenhub-cli
```

Version 0.1.10 can be installed globally or locally. The [CLI Reference](/docs/reference/cli) and [Packaging & Deployment](/docs/reference/packaging) guide provide comprehensive command documentation and configuration schema details.
