# CLI Reference

## Overview

The Even Hub CLI (v0.1.10) is a developer tool for authentication, QR code generation, and app packaging.

## Installation

The package is available via npm as `@evenrealities/evenhub-cli` and can be installed locally or globally.

```bash
npm install -D @evenrealities/evenhub-cli
# or globally
npm install -g @evenrealities/evenhub-cli
```

## Key Commands

### evenhub login

Authenticates developers with their Even Hub account, with optional email specification.

### evenhub init

Generate a starter `app.json` manifest in the current or specified directory. Supports custom directory and output paths.

### evenhub qr

Creates QR codes for sideloading applications during development. Accepts full URL or component parts (IP, port, path). The generated code can be scanned with the Even Realities App on mobile devices to load apps on glasses with hot reload capability.

### evenhub pack

Package your built app into an `.ehpk` file for distribution. Requires the app manifest and built output folder, with optional package ID availability checking.

## Additional Features

The CLI includes shell completion generation for Bash, Zsh, and Fish shells, streamlining command-line workflows for developers across different environments.
