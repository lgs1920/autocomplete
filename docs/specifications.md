# Autocomplete component specification

## Purpose

`<lgs1920-autocomplete>` searches local or remote options and supports single or multiple selection. It handles filtering, keyboard navigation, request cancellation, and suggestion popups. It is a standalone Web Component and does not require `wa-combobox`.

Consumers load Web Awesome's base stylesheet and one theme stylesheet in the document before using the element. The package bundles its own shadow-root component styles.

## Option data

Every option needs a string or numeric `value` (or the `valeur` alias) and a string `label`. The `icon` property supports:

- A Web Awesome icon name such as `'location-dot'`, or a descriptor with `name`, `family`, and `variant`. See the [`wa-icon` reference](https://webawesome.com/docs/components/icon).
- A local SVG/PNG path or a remote SVG/PNG URL string. Direct strings ending in `.svg` or `.png` are rendered as images.
- An image descriptor with `src`, such as `{src: imageUrl}`. Use it for Blob URLs, data URLs, or URLs without a recognized extension. Add `fallback` text to show if the image fails to load.

The same `icon` property works for local options and objects returned by a remote `searchOptions` provider. Map an API image URL to `icon: {src: item.iconUrl, fallback: item.iconEmoji}`. A bundler glob is resolved by the host application; pass its output URL to `src`. Other properties, such as `department` or `region`, are preserved as metadata on the selected option.

### HTML mode: direct `<wa-option>` children

Declare static choices as direct `<wa-option>` children. The `value` attribute supplies the submitted value; `label` or trimmed text content supplies the visible label. Use `data-icon` for an icon and other `data-*` attributes for string metadata. Dashed metadata names become camel-case option keys.

```html
<lgs1920-autocomplete label="City" name="city">
  <wa-option value="paris" data-icon="location-dot" data-department="75" data-region="Île-de-France" data-country="France">Paris</wa-option>
</lgs1920-autocomplete>
```

### JavaScript mode: `field.options`

Set `field.options` to an array when choices are generated or managed by JavaScript. This replaces any direct `<wa-option>` children on that field. The selected option keeps its extra metadata.

```html
<lgs1920-autocomplete id="js-city-search" label="City" name="city"></lgs1920-autocomplete>
```

```js
const field = document.querySelector('#js-city-search')
field.options = [
  {value: 'paris', label: 'Paris', icon: 'location-dot', department: '75', region: 'Île-de-France', country: 'France'},
  {value: 'home', label: 'Home', icon: '/assets/icons/home.svg'},
  {value: 'rocket', label: 'Rocket', icon: {name: 'rocket', family: 'classic', variant: 'solid'}},
  {value: 'france', label: 'France', icon: {src: 'https://flagcdn.io/fr.svg', fallback: '🇫🇷'}},
]
```

### Custom suggestion content

Set `renderOption` to a synchronous `(option, {query})` callback that returns a fresh DOM `Node` for each suggestion. It replaces the default suggestion label rendering; `option.label` remains the search text, selected input text, and accessible option name. Option icons still follow `icon-position`. Return non-interactive content so listbox keyboard behavior remains predictable.

```js
field.renderOption = option => {
  const card = document.createElement('wa-card')
  card.setAttribute('appearance', 'outlined')

  for (const [label, value] of [
    ['City', option.city],
    ['Department', option.department],
    ['Region', option.region],
    ['Country', option.country],
  ]) {
    if (!value) continue
    const line = document.createElement('div')
    line.textContent = `${label}: ${value}`
    card.append(line)
  }

  return card
}
```

For markup-based layouts, use an HTML `<template>` element. It replaces the default label rendering and query highlighting; `option.label` still controls matching, selected input text, and the accessible name, while option icons still follow `icon-position`. Put `{{field}}` placeholders in text nodes; dot-separated paths such as `{{address.city}}` are supported. Interpolated values are inserted as plain text. Missing or non-primitive values become empty strings, and placeholders inside attributes are left unchanged. Setting `optionTemplate` clears `renderOption`, and setting `renderOption` clears `optionTemplate`. The `option-template` attribute selects a template by its ID in the same document; declare the template before the autocomplete element. For runtime selection, assign the template element to `field.optionTemplate` instead. An invalid ID emits `wa-option-template-error` and falls back to the default label.

```html
<template id="city-option-template">
  <wa-card appearance="outlined">
    <strong>{{city}}</strong>
    <small>{{region}} · {{country}}</small>
  </wa-card>
</template>

<lgs1920-autocomplete id="templated-city-search" label="City" option-template="city-option-template"></lgs1920-autocomplete>
```

```js
const field = document.querySelector('#templated-city-search')
field.options = [
  {value: 'paris', label: 'Paris', city: 'Paris', region: 'Île-de-France', country: 'France'},
  {value: 'reims', label: 'Reims', city: 'Reims', region: 'Grand Est', country: 'France'},
]
```

For a remote search, map the API's image field to an image descriptor. Fallback text is optional:

```js
field.searchOptions = async (query, {signal}) => {
  const response = await fetch('/api/search?q=' + encodeURIComponent(query), {signal})
  const results = await response.json()
  return results.map(item => ({
    value: item.id,
    label: item.name,
    icon: item.iconUrl
      ? {src: item.iconUrl, fallback: item.iconEmoji}
      : 'location-dot',
  }))
}
```

The component accepts a resolved URL; globbing files is a host-bundler feature. For example, [Vite glob imports](https://vite.dev/guide/features#glob-import) can resolve SVG and PNG files with `import.meta.glob`, then pass those URLs through `icon.src`:

```js
const iconUrls = import.meta.glob('./icons/*.{svg,png}', {
  eager: true,
  import: 'default',
  query: '?url',
})

field.options = Object.entries(iconUrls).map(([path, src]) => ({
  value: path,
  label: path.split('/').pop(),
  icon: {src},
}))
```

For a Blob, create an object URL and revoke it after the option that uses it is removed:

```js
const blobUrl = URL.createObjectURL(svgBlob)
field.options = [{value: 'custom', label: 'Custom', icon: {src: blobUrl}}]
// Later, after removing or replacing the option:
// URL.revokeObjectURL(blobUrl)
```

## Slots

Like `<wa-select>`, the component exposes `start` and `end` slots for content inside the input control. This is useful for custom icons; the disclosure button remains in the end area and opens the complete local list when the query is empty and local options are configured. Icons for individual suggestions continue to use the option's `icon` property.

```html
<lgs1920-autocomplete label="City" placeholder="Search cities">
    <wa-icon slot="start" name="magnifying-glass" aria-hidden="true"></wa-icon>
</lgs1920-autocomplete>
```

## Input and form behavior

The component uses a Web Awesome input for its label and query. As a form-associated custom element, it submits the selected option's `value` under the host's `name`. Typed text is never submitted as a selection.

With `multiple`, `value` is an array and each selected value is submitted under the same `name`. Typing keeps existing selections. Adding an option clears the current query and keeps the panel open. Local search shows the complete list; remote search keeps its current results available until the next query. The placeholder is hidden until all tags are removed. Five selected tags are shown inline by default. The `+N` control opens the full selection list, 10 items per page. Set `max-options-visible` to change the inline limit, or to `0` to show every tag inline.

`selectedOptions` returns the selected option objects. Selected items appear as removable `<wa-tag>` elements. If an option has an icon, `icon-position` places it before or after its label in suggestions and selected tags. In mixed suggestion lists, options without icons reserve the same slot so all labels stay aligned; lists without icons take no extra space.

The `with-clear` attribute adds an accessible query-clear button. In multiple mode, a separate clear-all button removes every selected tag.

The host forwards the Web Awesome input attributes `label`, `placeholder`, `disabled`, `size`, `appearance`, `pill`, `hint`, and `readonly`. The form-associated host uses `name` for submission. Use lowercase kebab case in HTML, such as `min-chars` and `page-size`; the corresponding JavaScript properties use camel case, such as `minChars` and `pageSize`.

## Search behavior

With `options`, the component filters labels and values using case-insensitive substring matching. Matching label text is highlighted. An empty query shows recent selections when available; otherwise, the panel stays closed. With an empty query, the disclosure button opens the complete local list. If recent selections are showing, it replaces them with that list; activate it again to close the panel. In multiple mode, adding an option clears the filter and keeps the list open. Local search expands to the complete list; remote search keeps the current results available until the next query.

Visible suggestions use Web Awesome `<wa-option>` elements inside the component's listbox. The component manages their active and selected states, keyboard navigation, and pagination.

Setting the JavaScript `searchOptions` property enables remote search. The callback receives the query and an `{signal}` object, and must return an array of options. Searches require one character by default. Set `min-chars="0"` to allow any non-empty query length; the provider is never called for an empty query. By default, the callback runs after `150` milliseconds without new input. Each keystroke restarts the delay and aborts an older request. Search does not wait for Enter or blur. A failed current request emits `wa-search-error`.

`max-results` caps filtered local and remote results at `50` by default. The complete local list is not capped. `page-size` defaults to `10` items per page for suggestions. Both settings accept HTML attributes or JavaScript properties (`maxResults` and `pageSize`). When more than one page is available, a compact footer shows the current result range and a compact page counter with previous/next controls. The footer is hidden when all results fit on one page.

## Recent selections

Set the JavaScript `persistence` property to `{id, limit}` to save recent selections in browser `localStorage`. The `limit` must be a positive integer; `count` is accepted as an alias. An `id` creates an independent history and is namespaced as `lgs1920-autocomplete:<encoded-id>`.

Use `persistence = {group, limit}` or `{id, group, limit}` to share history between components. `group` takes precedence over `id`; components using the same group read and update the same recent options. When the query is empty, saved selections appear as suggestions. If no history exists, the panel stays closed. Only user selections update history; setting `value` does not. Reducing the limit removes older entries, and increasing it later does not restore them. Storage or serialization failures emit `wa-persistence-error` with `{error, action, id, group?}` and do not prevent selection.

## Events

The component emits standard `input`, `change`, `focus`, and `blur` events. Read the typed text from `query` and the selected raw value from `value`. Activating either clear control emits `wa-clear`.

`wa-select` includes `{option, value, label, selectedOptions}`. In multiple mode, `value` is an array. Removing a selection emits `wa-deselect` with the same detail shape and the updated selection. `wa-search-error` includes `{error, query}`. `wa-option-render-error` includes `{error, option}` when a custom renderer fails; the suggestion falls back to its default label view. `wa-persistence-error` includes `{error, action, id, group?}`; for a group-only configuration, `id` contains the group name. Component `wa-*` events bubble and cross the shadow boundary.

## Accessibility and lifecycle

The input receives the combobox role and active-descendant state; suggestions use listbox and option roles. Arrow keys move through results, and Home/End move to the first/last result, changing pages when needed. Enter selects the active suggestion. The `+N` control opens the selected-options list with Enter or Space; Escape closes either popup. Popups close when focus or a pointer moves outside the component. On disconnection, document listeners are removed and timers and active requests are cancelled.

## Styling

The suggestion and selected-options panels use Web Awesome design tokens by default. These CSS custom properties override individual colors without changing page-wide theme tokens:

| CSS custom property | Default | Description |
| --- | --- | --- |
| `--lgs1920-autocomplete-max-height` | `16rem` | Maximum suggestion panel height. |
| `--lgs1920-autocomplete-placeholder-color` | `var(--wa-color-text-quiet)` | Input placeholder color. |
| `--lgs1920-autocomplete-panel-background` | `var(--wa-color-surface-raised)` | Suggestion and selected-options panel background. |
| `--lgs1920-autocomplete-panel-color` | `var(--wa-color-text-normal)` | Suggestion and selected-options panel text color. |
| `--lgs1920-autocomplete-panel-border-color` | `var(--wa-color-surface-border)` | Suggestion and selected-options panel border color. |
| `--lgs1920-autocomplete-option-color` | `var(--wa-color-text-normal)` | Option text color. |
| `--lgs1920-autocomplete-option-icon-color` | `var(--wa-color-text-quiet)` | Option icon color. |
| `--lgs1920-autocomplete-option-active-background` | `var(--wa-color-neutral-fill-quiet)` | Keyboard-active option background. |
| `--lgs1920-autocomplete-option-hover-background` | `var(--wa-color-neutral-fill-quiet)` | Pointer-hover option background. |
| `--lgs1920-autocomplete-option-selected-background` | `var(--wa-color-brand-fill-quiet)` | Selected option background. |
| `--lgs1920-autocomplete-option-selected-color` | `var(--wa-color-brand-on-quiet)` | Selected option text color. |

For example, blend a Web Awesome accent into the theme surface so a custom panel keeps adapting to the active theme and color mode:

```css
lgs1920-autocomplete {
    /* Keep the panel surface connected to the active theme. */
    --lgs1920-autocomplete-panel-background: color-mix(in srgb, var(--wa-color-surface-raised) 88%, var(--wa-color-purple) 12%);
    /* Follow the active theme's foreground color. */
    --lgs1920-autocomplete-panel-color: var(--wa-color-text-normal);
    /* Tint hovered options while keeping the active theme surface. */
    --lgs1920-autocomplete-option-hover-background: color-mix(in srgb, var(--wa-color-surface-raised) 86%, var(--wa-color-purple) 14%);
    /* Keep selected text readable on the tinted surface. */
    --lgs1920-autocomplete-option-selected-background: color-mix(in srgb, var(--wa-color-surface-raised) 68%, var(--wa-color-purple) 32%);
    /* Follow the active theme's foreground color. */
    --lgs1920-autocomplete-option-selected-color: var(--wa-color-text-normal);
}
```
