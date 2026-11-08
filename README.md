# @lgs1920/autocomplete

An accessible autocomplete Web Component built with Web Awesome 3. It supports local option arrays, asynchronous search callbacks, optional Font Awesome icons, and host-owned metadata.

The current release is `0.1.1`.

## Install

```sh
bun add @lgs1920/autocomplete @awesome.me/webawesome
```

## Use

```js
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/styles/themes/default.css'
import '@lgs1920/autocomplete'

const autocomplete = document.querySelector('lgs1920-autocomplete')
autocomplete.options = [
  {value: 'troyes', label: 'Troyes', icon: 'location-dot', department: '10'},
  {value: 'reims', label: 'Reims', icon: 'city', department: '51'},
]
autocomplete.persistence = {id: 'city-search', limit: 5}

autocomplete.addEventListener('wa-select', event => {
  console.log(event.detail.value, event.detail.option.department)
})
```

```html
<lgs1920-autocomplete
  label="City"
  name="city"
  placeholder="Search cities"
></lgs1920-autocomplete>
```

For remote search, assign an asynchronous `searchOptions(query, {signal})` callback. The component debounces calls and aborts stale requests.

```js
autocomplete.searchOptions = async (query, {signal}) => {
  const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {signal})
  if (!response.ok) throw new Error('City search failed')
  return response.json()
}
```

Each returned item uses `{value, label, icon?}`; `valeur` is accepted as an alias for `value`. Other fields, such as `variable`, are preserved and included in the `wa-select` event. The component exposes Web Awesome's native `input`, `change`, `focus`, and `blur` events. Read the current text from `event.target.query`, and the selected item from `event.target.selectedOption`. Set `icon-position="end"` to place option icons after their labels.

Set `persistence` to `{id, limit}` to keep the most recently selected options in browser `localStorage`. The stable `id` gives this autocomplete its own history; changing it loads a separate history. Recent items appear when the query is empty. `count` is accepted as an alias for `limit`. Only user selections are saved. Lowering the limit trims older entries, and raising it does not restore entries already removed. Storage errors emit `wa-persistence-error` without blocking selection.

## Documentation and examples

- [Interactive examples](https://lgs1920.github.io/autocomplete/)
- [Properties, events, and option format](https://lgs1920.github.io/autocomplete/docs/)
- [Package specification](./docs/specifications.md)
- [License](./LICENSE.md)

## Development

```sh
bun install
bun run verify
bun run demo:serve
```

The demo uses port `4177`.

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
