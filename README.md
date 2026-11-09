# @lgs1920/autocomplete

An accessible autocomplete Web Component built with Web Awesome 3. It supports local option arrays, asynchronous search callbacks, single or multiple selection, Web Awesome icons, SVG/PNG image URLs, and host-owned metadata.

The current release is `0.1.2`.

## Install

```sh
npm install @lgs1920/autocomplete @awesome.me/webawesome
```

With Bun, use `bun add @lgs1920/autocomplete @awesome.me/webawesome`.

## Quick start

### HTML options

Use direct `<wa-option>` children when the choices are static:

```html
<lgs1920-autocomplete id="city-search" label="City" name="city" placeholder="Search cities" with-clear>
  <wa-option value="paris" data-icon="location-dot" data-department="75" data-region="Île-de-France">Paris</wa-option>
  <wa-option value="reims" data-icon="city" data-department="51" data-region="Grand Est">Reims</wa-option>
</lgs1920-autocomplete>
```

### JavaScript options

For a JavaScript-managed list, use an empty element and assign an array to `field.options`. That assignment replaces any `<wa-option>` children on the same element.

```html
<lgs1920-autocomplete id="city-search-js" label="City" name="city" placeholder="Search cities" with-clear></lgs1920-autocomplete>
```

```js
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/styles/themes/default.css'
import '@lgs1920/autocomplete'

const field = document.querySelector('#city-search-js')
field.options = [
  {value: 'paris', label: 'Paris', icon: 'location-dot', department: '75', region: 'Île-de-France', country: 'France'},
  {value: 'reims', label: 'Reims', icon: 'city', department: '51', region: 'Grand Est', country: 'France'},
]

field.addEventListener('wa-select', event => {
  console.log(event.detail.value, event.detail.option.department, event.detail.option.region)
})
```

## Search

### Local options

Declare static choices as direct `<wa-option>` children or set `field.options` to an array in JavaScript. The `value` attribute is submitted, the `label` attribute or trimmed text content supplies the visible label, `data-icon` supplies an icon, and other `data-*` attributes become metadata on the selected option. Setting `field.options` replaces markup options, so it can update them from fetched or generated data at any time.

The component filters `label` and `value` with case-insensitive substring matching and highlights matching text in labels. When the query is empty, saved recent selections appear as suggestions if any exist. If no history exists, the panel stays closed until the chevron opens the complete local list; when recent suggestions are open, the chevron replaces them with that list. `page-size` controls the number of suggestions on each page.

Visible suggestions are rendered as Web Awesome `<wa-option>` elements inside the component's listbox. The component manages their active and selected states alongside its keyboard navigation and pagination.

For richer suggestion layouts, set `renderOption` to a synchronous `(option, {query})` function that returns a fresh DOM node. The option's `label` still supplies search text, selected input text, and the accessible option name; the custom renderer replaces the default label and query highlighting. Option icons still follow `icon-position`. Keep custom suggestion content non-interactive.

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

### Remote search

Assign an asynchronous `searchOptions(query, {signal})` function. It receives the current query and an `AbortSignal`, and must return an array of options. Searches start after one character by default and wait `150` milliseconds after the latest keystroke. Set `min-chars="0"` to allow any non-empty query length; the provider is never called for an empty query. New input restarts the delay and aborts stale requests.

```js
field.searchOptions = async (query, {signal}) => {
  const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {signal})
  if (!response.ok) throw new Error('City search failed')
  return response.json()
}
```

Filtered local and remote results are capped by `max-results` (default `50`). The complete local list opened by the disclosure chevron includes every option. Suggestions use `page-size` (default `10`). When results span multiple pages, a compact footer shows the current result range and a compact page counter with previous/next controls.

## Multiple selection

Add `multiple` to let users select several options. The `value` property becomes an array, and `selectedOptions` contains the full option objects. Adding an option clears the current query and keeps the panel open. Local search shows the complete list; remote search keeps its current results available until the next query. The placeholder stays hidden while tags remain selected. In a form, each selected value is submitted under the same `name`.

Five tags are shown by default. Additional selections appear behind a `+N` control; activating it opens the full selection list, paginated 10 selections per page. Set `max-options-visible` to change the inline tag count, or to `0` to show every tag inline.

```html
<lgs1920-autocomplete id="cities" label="Cities" name="city" multiple with-clear></lgs1920-autocomplete>
```

## Option icons

Set `icon` on an option to show an icon beside its label in suggestions and selected tags. You can mix these forms in one options array:

- A Web Awesome icon name such as `'location-dot'`, or a descriptor such as `{name: 'house', family: 'classic', variant: 'solid'}`. See the [`wa-icon` reference](https://webawesome.com/docs/components/icon).
- A local SVG/PNG path or remote SVG/PNG URL string, such as `'/assets/icons/home.svg'` or `'https://flagcdn.io/fr.svg'`. Direct strings are recognized by their `.svg` or `.png` extension.
- An image descriptor, `{src: imageUrl}`, for Blob URLs, data URLs, extensionless URLs, or a URL with fallback text: `{src: imageUrl, fallback: '🇫🇷'}`. Fallback text appears if the image fails to load.

`icon-position="start|end"` places each option icon before or after its label. For a fixed icon inside the input, use the `start` or `end` slot instead; slots do not set suggestion icons.

```js
field.options = [
  {value: 'paris', label: 'Paris', icon: 'location-dot'},
  {value: 'home', label: 'Home', icon: '/assets/icons/home.svg'},
  {value: 'rocket', label: 'Rocket', icon: {name: 'rocket', family: 'classic', variant: 'solid'}},
  {value: 'france', label: 'France', icon: {src: 'https://flagcdn.io/fr.svg', fallback: '🇫🇷'}},
]
```

For a remote search API, map its image URL into `icon.src` and provide optional fallback text:

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

For SVG/PNG files matched by a [Vite glob import](https://vite.dev/guide/features#glob-import), pass each resolved URL as `icon.src`. This is bundler-specific; the component only receives the resulting URLs:

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

For a Blob, create an object URL and pass it through `src`. Revoke it when the option is no longer used:

```js
const blobUrl = URL.createObjectURL(svgBlob)
field.options = [{value: 'custom', label: 'Custom', icon: {src: blobUrl}}]
// When removing or replacing this option later:
// URL.revokeObjectURL(blobUrl)
```

## Values and events

Each option requires a string or numeric `value` and a string `label`. `valeur` is accepted as an alias for `value`. Additional properties, such as `department`, remain on the selected option and are included in selection events.

The component exposes `value`, `query`, `selectedOption`, and `selectedOptions`. Read the typed text from `event.target.query`; use `selectedOption` for single selection and `selectedOptions` for multiple selection. `wa-select` fires when a suggestion is selected. In multiple mode, `wa-deselect` fires when an item is removed. Both events include the option metadata in `event.detail.option`. If `renderOption` throws or returns something other than a DOM node, `wa-option-render-error` includes `{error, option}` and the suggestion falls back to its default label.

Standard `input`, `change`, `focus`, and `blur` events are available on the component. The `with-clear` attribute adds an accessible query-clear button; in multiple mode, a separate clear-all button removes selected tags. Activating either clear control emits `wa-clear`.

## Input slots and styling

Use the `start` and `end` slots to place fixed icons or other content inside the input. Per-option icons come from each option's `icon` property; set `icon-position="end"` to move them after the label in suggestions and selected tags.

The component forwards Web Awesome input attributes `size`, `appearance`, `pill`, `hint`, and `readonly`. Its colors follow the active Web Awesome theme. Override the component's CSS custom properties on the host to style the panels and option states, or set Web Awesome `--wa-color-*` tokens to theme the input and panels together. See the [styling reference](./docs/specifications.md#styling) for the full list.

## Recent selections

Set the JavaScript `persistence` property to `{id, limit}` to save recent user selections in browser `localStorage`. Each id has a separate history. Use `{group, limit}` or `{id, group, limit}` to share one history between components; `group` takes precedence over `id`. `count` is accepted as an alias for `limit`.

Only user selections are saved. Lowering the limit trims older entries; increasing it later does not restore them. Storage errors emit `wa-persistence-error` without blocking selection.

## Documentation and examples

- [Interactive examples](https://lgs1920.github.io/autocomplete/)
- [Properties, events, and option format](https://lgs1920.github.io/autocomplete/docs/)
- [Package specification](./docs/specifications.md)
- [License](./LICENSE.md)

## Development

```sh
bun install
bun run verify
bun run demo:preview
```

The preview command stops a previous project demo server on port `4177`, rebuilds the demo, and serves it at `http://127.0.0.1:4177/`. `bun run demo:serve` serves the current build without rebuilding it.

## Publish on npm

The release script keeps the version in `package.json` and the current release shown above in sync:

```sh
# Preview the pending version or release notes without changing files
bun run publish --preview

# Publish the current unreleased version, or increment the patch version after a release
bun run publish

# Choose a minor or major version increment
bun run publish --minor
bun run publish --major
```

The script requires a clean `main` branch. It updates and commits the version when needed, creates an annotated version tag, and pushes the commit and tag to GitHub. The tag starts GitHub Actions, which verifies the package, publishes it to npm with the `NPM_TOKEN` repository secret, and creates a GitHub release.
