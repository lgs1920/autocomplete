---
name: autocomplete-usage
description: Integrate @lgs1920/autocomplete into a consumer application, including local and remote search, forms, recent selections, events, and theme-aware styling. Use for application code, not changes to the component package.
---

# Using LGS1920 Autocomplete

Use this skill when adding or configuring `<lgs1920-autocomplete>` in an application that consumes `@lgs1920/autocomplete`.

## Find the contract

- Check the consumer's framework, package manager, Web Awesome setup, and existing form and theme conventions before editing.
- Treat [the package README](../../README.md) and [the package specification](../../docs/specifications.md) as the API references. Check the matching demo example when behavior depends on interaction details.
- Keep host-owned option data and remote API requests in the consumer. The component handles filtering, request cancellation, rendering, keyboard interaction, and selection state.
- Do not change this package's implementation or generated output when the request is only to integrate it. Use the `autocomplete-component` skill for package changes when available.

## Install and register

Use the consumer's package manager to add `@lgs1920/autocomplete` and `@awesome.me/webawesome`. Load Web Awesome 3 styles and the consumer's selected theme once, following the application's existing setup. Importing the package registers the custom element and its Web Awesome dependencies.

```js
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/styles/themes/default.css'
import '@lgs1920/autocomplete'
```

Use the stable `<lgs1920-autocomplete>` element. Set JavaScript properties after the element has been registered. HTML attributes use kebab case, while JavaScript properties use camel case.

## Supply local options

Each option needs a string or numeric `value` and a string `label`. Optional `icon` data can be a Web Awesome icon name or descriptor, an SVG/PNG URL, or an image descriptor with `src`. Preserve consumer metadata on the option; it remains available in `selectedOptions` and selection event details.

```html
<lgs1920-autocomplete id="city-search" label="City" name="city" placeholder="Search cities" with-clear></lgs1920-autocomplete>
```

```js
const field = document.querySelector('#city-search')
field.options = [
  {value: 'paris', label: 'Paris', icon: 'location-dot', countryCode: 'FR'},
  {value: 'reims', label: 'Reims', icon: 'city', countryCode: 'FR'},
]
```

Local filtering searches `label` and `value` without case sensitivity. An empty query shows recent selections when configured. The disclosure chevron can expand those recent suggestions to the complete local list; it points up while the complete list is open and closes it on the next activation. `page-size` controls pagination, and the complete local list is not limited by `max-results`.

## Use remote search

Assign `searchOptions(query, {signal})` to call the consumer's endpoint and return an option array. Forward the signal to `fetch`. The component debounces requests, aborts stale searches, and never calls the provider for an empty query. `min-chars` sets the minimum non-empty query length; `debounce` sets the delay in milliseconds.

```js
field.minChars = 2
field.debounce = 250
field.maxResults = 32
field.searchOptions = async (query, {signal}) => {
  const endpoint = new URL('/api/cities', window.location.origin)
  endpoint.searchParams.set('q', query)

  const response = await fetch(endpoint, {signal})
  if (!response.ok) throw new Error('City search failed')
  return response.json()
}
```

Remote results are capped by `max-results`. Use `page-size` to choose the number shown per page. The component provides loading, empty, and current-request error messages.

## Connect selection and forms

- Set `name` on the custom element to submit the selected raw value in a form. Typed query text is not submitted.
- In single mode, `value` is the selected raw value and `selectedOption` is its option object. In multiple mode, `value` is an array and `selectedOptions` contains the selected option objects.
- Assigning `value` matches only options already available to the component; it does not start a remote search.
- With `multiple`, selections render as removable tags and repeated form values use the same `name`. `max-options-visible` controls the inline tag count; `0` shows every tag inline.
- Read typed text from `query`. Listen for native `input`, `change`, `focus`, and `blur` events. Use `wa-select` and `wa-deselect` for selection changes, `wa-clear` for a clear action, and `wa-search-error` for failed remote searches.

Selection events include the option object, so consumer-owned metadata remains accessible:

```js
field.addEventListener('wa-select', event => {
  const {option, value} = event.detail
  console.log(value, option.countryCode)
})
```

## Configure recent selections

Set `field.persistence` to `{id, limit}` to keep an independent browser history. Use `{group, limit}` or `{id, group, limit}` to share a history; `group` takes precedence over `id`. `count` is accepted as an alias for `limit`. Only user selections update history. Do not put private or sensitive data in persisted option metadata because it is stored in browser `localStorage`.

## Style with Web Awesome

Forwarded input attributes include `size`, `appearance`, `pill`, `hint`, `readonly`, and `with-clear`. Use the component's documented CSS custom properties for its panels and option states. Prefer Web Awesome semantic surface and text tokens so the styling follows the active theme and color mode. For colored surfaces, blend an accent into the theme surface instead of assigning a fixed light palette shade.

```css
#city-search {
    /* Blend the accent into the active theme surface. */
    --lgs1920-autocomplete-panel-background: color-mix(in srgb, var(--wa-color-surface-raised) 88%, var(--wa-color-purple) 12%);
    /* Keep text aligned with the active theme. */
    --lgs1920-autocomplete-panel-color: var(--wa-color-text-normal);
}
```

Use the `start` and `end` slots for content inside the input. Per-option icons belong in the option data; `icon-position="end"` places them after labels in suggestions and selected tags.

## Verify the integration

- Run the consumer application's build and checks that cover the changed integration.
- Verify local or remote selection, form submission when applicable, recent history when configured, and the active Web Awesome theme.
- Keep application documentation and copied examples aligned with the behavior implemented by the installed package version.
