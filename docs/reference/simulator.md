# Simulator Reference

## Overview

The evenhub-simulator (v0.6.2) is a development tool that enables developers to evaluate UI designs and verify application behavior in a controlled environment without requiring physical hardware.

## Installation

The simulator can be installed globally via npm:

```bash
npm install -g @evenrealities/evenhub-simulator
```

The package is available at [@evenrealities/evenhub-simulator](https://www.npmjs.com/package/@evenrealities/evenhub-simulator) and supports macOS, Linux, and Windows.

## Usage

```bash
evenhub-simulator [OPTIONS] [targetUrl]
```

## Command Options

The tool provides various configuration flags:

| Option | Purpose |
|--------|---------|
| `-c`, `--config <path>` | Specify configuration file location |
| `-g`, `--glow` | Apply glow visual effect |
| `--no-glow` | Disable glow effect |
| `-b`, `--bounce <type>` | Set bounce animation (default or spring) |
| `--list-audio-input-devices` | Display audio devices |
| `--aid <device>` | Select audio input device |
| `--no-aid` | Use system default audio |
| `--print-config-path` | Show config file location |
| `--completions <shell>` | Generate shell completions |
| `-V`, `--version` | Display version number |
| `-h`, `--help` | Show help information |

## Default Configuration Paths

Configuration file locations vary by operating system:

- **Linux:** `$XDG_CONFIG_HOME` or `$HOME/.config`
- **macOS:** `$HOME/Library/Application Support`
- **Windows:** `{FOLDERID_RoamingAppData}` (typically `C:\Users\<user>\AppData\Roaming`)

## Audio Specifications

The simulator generates audio events with these characteristics:

- Sample rate: 16,000 Hz
- Format: signed 16-bit little-endian PCM
- 100ms data segments (3,200 bytes / 1,600 samples per event)

## Screenshot Feature (v0.5.0+)

The simulator can capture and export the glasses display as PNG files. Users can click the screenshot button to save images to the current working directory with timestamp-based filenames. The file path appears in both the simulator console and the glasses web inspector.

## Known Limitations

The simulator has several constraints developers should understand:

- Display rendering may not perfectly match hardware regarding fonts and grayscale fidelity
- List scrolling behavior may differ from actual device functionality
- Image processing operates faster without enforcing hardware constraints
- Status events aren't emitted; only Up, Down, Click, and Double Click inputs are supported
- Error handling under exceptional circumstances may differ from production hardware

Always validate on actual hardware before deployment. Report discrepancies via Discord.
