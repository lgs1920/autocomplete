# Project rules

## Core directives

- Conversational responses must be in French. Code comments, JSDoc, and documentation must be in professional English.
- Preserve unrelated work. Do not stage, commit, push, publish, deploy, or release unless explicitly requested.
- Do not use semicolons in source files. Use arrow functions except for class constructors and class methods.
- Use named exports only.
- Keep source files focused and below 1500 lines.

## Component contract

- Preserve the `@lgs1920/autocomplete` package name and `<lgs1920-autocomplete>` custom element.
- Keep UI controls on Web Awesome 3. Use `wa-input`, `wa-icon`, and `wa-popup`; do not use or imitate `wa-combobox`.
- Keep option filtering and request lifecycle inside the component. The host owns option data and asynchronous search callbacks.
- Preserve arbitrary option metadata in the selected option event. Search providers must accept an `AbortSignal` and return option arrays.
- Expose Web Awesome native `input`, `change`, `focus`, and `blur` events. Prefix component-specific custom events with `wa-` and use lowercase kebab-case names.
- Keep keyboard navigation, ARIA state, form submission, outside-interaction handling, and disconnected cleanup covered at the public boundary.
- Do not change generated `dist/` or demo assets by hand.

## Package and demo

- Keep exports, README examples, demo, package metadata, and package documentation aligned.
- Keep user documentation in English and the demo port fixed at `4177`.
- Use Web Awesome components and design tokens for visible UI. Comment every component-owned CSS custom property in English.
- Run `bun run verify` after package changes. It covers lint, package build, consumer bundling, demo build, and dry-run packing.
