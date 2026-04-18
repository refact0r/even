# UI/UX Design Guidelines

## Overview

This documentation covers design guidelines for Even Realities' glasses display and companion applications, published officially in Figma format.

## Display Constraints

The G2 display presents specific technical limitations:

- **Resolution**: 576 x 288 px — described as an exceptionally compact canvas requiring pixel-level precision
- **Color**: 4-bit greyscale with hardware rendering in green tones rather than true grey
- **Structural options**: Borders and content only; background fills are unavailable
- **Container limits**: Maximum of 4 image containers and 8 other containers total
- **Input model**: One event-capturing container restricts interaction design to a single active input target

## Icon Design Principles

Guidelines for creating icons include:

- Work directly at native pixel dimensions rather than scaling from larger designs
- Prioritize instantly recognizable shapes with minimal decorative detail
- Validate appearance on actual hardware or simulator, as the green-tinted rendering differs significantly from standard monitors

## Common UI Patterns

| Pattern | Implementation |
|---------|----------------|
| Buttons | Use `>` prefix as cursor indicator |
| Selection | Toggle `borderWidth` on text containers |
| Multi-row layouts | Stack text containers vertically (~96px each) |
| Progress indicators | Unicode block characters: `━` and `─` |
| Page navigation | Pre-paginate at 400–500 character intervals; rebuild on scroll events |
