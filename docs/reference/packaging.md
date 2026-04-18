# Packaging & Deployment

## Overview

This page covers the complete process for preparing and deploying Even Hub applications, starting with the manifest file and concluding with distribution.

## The `app.json` Manifest

Every Even Hub app requires an `app.json` manifest file. Developers can generate a starter template using `evenhub init`, which creates a structured configuration file.

### Required Fields

The manifest contains several mandatory fields:

- **package_id**: Must follow reverse-domain format (e.g., `com.yourname.appname`) with lowercase letters and numbers only, minimum two segments, and no hyphens.
- **edition**: Currently must be `"202601"`.
- **name**: Limited to 20 characters maximum.
- **version**: Requires semantic versioning in `x.y.z` format.
- **min_app_version** and **min_sdk_version**: Specify minimum compatibility requirements.
- **entrypoint**: References the HTML entry file path relative to the build folder.
- **permissions**: An array of permission objects (can be empty).
- **supported_languages**: Array of language codes including English, German, French, Spanish, Italian, Chinese, Japanese, and Korean.

### Permissions Configuration

Permissions must be structured as an array of objects — not a key-value map. Each permission object requires:

- **name**: One of several options including network, location, or microphone access
- **desc**: A 1–300 character explanation
- **whitelist** (network only): Optional list of allowed domains

## Building and Deployment

The deployment process involves two main steps:

1. **Build**: Execute `npm run build` to produce the output directory
2. **Pack**: Run `evenhub pack app.json dist -o myapp.ehpk` to create the deployable package

The entrypoint file specified in the manifest must exist within the built output folder, or packing will fail.

## Troubleshooting

Common validation errors include invalid package IDs, oversized app names, incorrect version formats, missing version fields, malformed permissions structures, unsupported language codes, missing entrypoint files, and non-existent project folders. Each issue has specific remediation guidance.

## Distribution

Successfully submitted apps become available on Even Hub, allowing users to download and launch them through the glasses interface or mobile application.
