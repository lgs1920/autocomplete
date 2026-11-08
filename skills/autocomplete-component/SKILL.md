---
name: autocomplete-component
description: Implement or maintain the @lgs1920/autocomplete Web Component, its local and asynchronous suggestions, accessibility, package documentation, and demo.
---

# Autocomplete component

Use this skill for the `@lgs1920/autocomplete` package and its `<lgs1920-autocomplete>` custom element.

## Public contract

- Keep the custom element name and package entry point stable. Expose Web Awesome native form events and use lowercase, kebab-style `wa-*` names for custom events.
- Accept option arrays with `value`, `label`, optional Web Awesome `icon`, and arbitrary pass-through metadata.
- Keep local filtering and asynchronous `searchOptions(query, {signal})` behavior inside the component.
- Support optional recent-selection persistence in browser `localStorage`, isolated by consumer-provided id and bounded by a configured limit.
- Keep selected raw values, visible labels, and caller metadata distinct.
- Render icons with `wa-icon`; use `icon-position="start|end"` to place them in suggestions.
- Do not depend on or reproduce `wa-combobox` behavior.

## Boundaries and lifecycle

- Use Web Awesome 3 controls, icon, popup, theme, and token APIs.
- Keep host data and remote API calls outside the component. Pass an abort signal to providers and ignore stale responses.
- Preserve combobox, listbox, option, and active descendant semantics and keyboard navigation.
- Remove document listeners, timers, and pending requests when the element disconnects.
- Keep public and site documentation in professional English.

## Verification

- Build package exports with `bun run build`.
- Build the dedicated site with `bun run demo:build`.
- Run `bun run verify` for package, lint, consumer-bundle, site, and pack checks.
