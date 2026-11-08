# Autocomplete component specification

## Purpose

`<lgs1920-autocomplete>` provides a single-value text search with a suggestion list. Its source code owns filtering, asynchronous request cancellation, active-option navigation, and popup lifecycle. It uses Web Awesome input, icon, and popup components and does not depend on `wa-combobox`.

Consumers load Web Awesome's base stylesheet and one theme stylesheet in the document before using the element. The package bundles its own shadow-root component styles.

## Option data

Every option must contain a string or numeric `value` (or the `valeur` alias) and a string `label`. An optional `icon` can be a Web Awesome icon name or an object with `name`, `family`, and `variant`. Other properties such as `variable` remain host-owned metadata and are preserved on the selected option.

## Input and form behavior

The component uses its visible Web Awesome input for the label and query. As a form-associated custom element, it submits the option's raw `value` under the host `name` attribute after selection. Typing after selection clears the submitted value. Arbitrary text is never submitted as a selected option.

## Search behavior

With `options`, the component filters locally using case-insensitive substring matching against option labels and values. Assigning `searchOptions` switches to asynchronous mode. The callback receives the current query and `{signal}` and must return an array of options. Calls are debounced, stale requests are aborted, and rejected requests emit a namespaced error event.

## Recent selections


Assign `persistence = {id, limit}` to save the last selected options in browser `localStorage`; `count` is accepted as an alias for `limit`. The id is namespaced as `lgs1920-autocomplete:<encoded-id>` and separates independent autocomplete histories. Recent selections are fetched from browser storage and shown as suggestions when the query is empty. If there is no history, normal empty-query behavior applies. Only user selections are saved; setting the `value` property does not change history. Reducing the limit truncates stored history, and removed entries cannot be recovered by increasing it later. Stored options are JSON serialized. Storage access or serialization failures emit `wa-persistence-error` with `{error, action, id}` and do not prevent selection.

## Events

The component exposes Web Awesome's native `input`, `change`, `focus`, and `blur` events. Read the typed text from the component's `query` property and the selected raw value from `value`. Custom events follow Web Awesome's `wa-` prefix convention: `wa-select` includes `{option, value, label}`, `wa-search-error` includes `{error, query}`, and `wa-persistence-error` includes `{error, action, id}`. All component custom events bubble and cross the shadow boundary.

## Accessibility and lifecycle

The native input inside `wa-input` receives the combobox role and active descendant state. The suggestion panel exposes listbox and option roles, supports arrow keys, Home, End, Enter, and Escape, and closes on outside pointer or focus movement. Document listeners, timers, and active requests are removed or cancelled when the custom element disconnects.

## Styling

The `--lgs1920-autocomplete-max-height` custom property controls the maximum suggestion panel height and defaults to `16rem`. Other visible colors, borders, and spacing use Web Awesome theme tokens.
