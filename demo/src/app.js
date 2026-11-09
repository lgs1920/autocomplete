/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: app.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-08
 * Last modified: 2026-11-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/copy-button/copy-button.js'
import '@awesome.me/webawesome/dist/components/details/details.js'
import '@awesome.me/webawesome/dist/components/dialog/dialog.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/input/input.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/select/select.js'
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js'
import '@lgs1920/autocomplete'

if (document.querySelector('#local-autocomplete')) {
const fruitOptions = [
    {value: 'apple', label: 'Apple', category: 'Pome fruit'},
    {value: 'apricot', label: 'Apricot', category: 'Stone fruit'},
    {value: 'avocado', label: 'Avocado', category: 'Tropical fruit'},
    {value: 'banana', label: 'Banana', category: 'Tropical fruit'},
    {value: 'blackberry', label: 'Blackberry', category: 'Berry'},
    {value: 'blueberry', label: 'Blueberry', category: 'Berry'},
    {value: 'cantaloupe', label: 'Cantaloupe', category: 'Melon'},
    {value: 'cherry', label: 'Cherry', category: 'Stone fruit'},
    {value: 'coconut', label: 'Coconut', category: 'Tropical fruit'},
    {value: 'cranberry', label: 'Cranberry', category: 'Berry'},
    {value: 'dragon-fruit', label: 'Dragon fruit', category: 'Tropical fruit'},
    {value: 'fig', label: 'Fig', category: 'Tropical fruit'},
    {value: 'grape', label: 'Grape', category: 'Berry'},
    {value: 'grapefruit', label: 'Grapefruit', category: 'Citrus fruit'},
    {value: 'guava', label: 'Guava', category: 'Tropical fruit'},
    {value: 'kiwi', label: 'Kiwi', category: 'Tropical fruit'},
    {value: 'lemon', label: 'Lemon', category: 'Citrus fruit'},
    {value: 'lime', label: 'Lime', category: 'Citrus fruit'},
    {value: 'mango', label: 'Mango', category: 'Tropical fruit'},
    {value: 'nectarine', label: 'Nectarine', category: 'Stone fruit'},
    {value: 'orange', label: 'Orange', category: 'Citrus fruit'},
    {value: 'papaya', label: 'Papaya', category: 'Tropical fruit'},
    {value: 'peach', label: 'Peach', category: 'Stone fruit'},
    {value: 'pear', label: 'Pear', category: 'Pome fruit'},
    {value: 'pineapple', label: 'Pineapple', category: 'Tropical fruit'},
    {value: 'plum', label: 'Plum', category: 'Stone fruit'},
    {value: 'pomegranate', label: 'Pomegranate', category: 'Pome fruit'},
    {value: 'raspberry', label: 'Raspberry', category: 'Berry'},
    {value: 'strawberry', label: 'Strawberry', category: 'Berry'},
    {value: 'watermelon', label: 'Watermelon', category: 'Melon'},
]

const localAutocomplete = document.querySelector('#local-autocomplete')
const brandColorAutocomplete = document.querySelector('#brand-color-autocomplete')
const brandColorResponseDetails = document.querySelector('#brand-color-response-details')
const remoteAutocomplete = document.querySelector('#remote-autocomplete')
const multipleAutocomplete = document.querySelector('#multiple-autocomplete')
const countryResponseDetails = document.querySelector('#multiple-autocomplete-response-details')
const countryResponseOutput = document.querySelector('#multiple-autocomplete-response')
const iconSourceAutocomplete = document.querySelector('#icon-source-autocomplete')
const formAutocomplete = document.querySelector('#form-autocomplete')

const countryFlagEmoji = countryCode => {
    const code = String(countryCode).toUpperCase()
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
    return Array.from(code, letter => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join('')
}

const brandColorOptions = [
    {value: 'red', label: 'Red', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'orange', label: 'Orange', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'yellow', label: 'Yellow', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'green', label: 'Green', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'cyan', label: 'Cyan', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'blue', label: 'Blue', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'indigo', label: 'Indigo', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'purple', label: 'Purple', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'pink', label: 'Pink', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
    {value: 'gray', label: 'Gray', backgroundToken: '--wa-color-brand-fill-loud', textToken: '--wa-color-brand-on-loud'},
]

localAutocomplete.options = fruitOptions
localAutocomplete.persistence = {id: 'fruit-search-demo', limit: 3}
brandColorAutocomplete.options = brandColorOptions
brandColorAutocomplete.persistence = {id: 'brand-color-search-demo', limit: 3}

/**
 * Search Photon for cities and map its GeoJSON places to autocomplete options.
 *
 * @param {string} query - Current search query.
 * @param {{signal: AbortSignal}} context - Request context.
 * @param {number} [maxResults=remoteAutocomplete.maxResults] - Maximum number of results to retain.
 * @returns {Promise<object[]>} Matching cities, capped by the requested maximum.
 */
const searchCities = async (query, {signal}, maxResults = remoteAutocomplete.maxResults) => {
    const endpoint = new URL('https://photon.komoot.io/api/')
    endpoint.searchParams.set('q', query.trim())
    endpoint.searchParams.set('limit', String(maxResults))
    endpoint.searchParams.set('lang', 'en')
    endpoint.searchParams.append('layer', 'city')

    const response = await fetch(endpoint, {signal})
    if (!response.ok) throw new Error(`City search failed with status ${response.status}`)

    const result = await response.json()
    if (!Array.isArray(result?.features)) throw new TypeError('Photon response must contain a features array')

    return result.features.slice(0, maxResults).flatMap(feature => {
        const place = feature?.properties
        if (!place?.name || place.osm_id == null || !place.osm_type) return []

        const [longitude, latitude] = feature.geometry?.coordinates ?? []
        return [{
            value: `${place.osm_type}/${place.osm_id}`,
            label: [place.name, place.country].filter(Boolean).join(', '),
            icon: 'city',
            city: place.name,
            country: place.country,
            countryCode: place.countrycode,
            region: place.state,
            latitude,
            longitude,
            osmType: place.osm_type,
            osmId: place.osm_id,
        }]
    })
}

remoteAutocomplete.searchOptions = searchCities
iconSourceAutocomplete.options = [
    {value: 'compass', label: 'Compass route', icon: '/icons/compass.svg'},
    {value: 'landmark', label: 'Historic landmark', icon: 'landmark'},
    {value: 'old-town', label: 'Old town', icon: {src: '/icons/landmark.svg'}},
    {value: 'france', label: 'France', icon: {src: 'https://flagcdn.io/fr.svg', fallback: '🇫🇷'}},
]

/**
 * Search countries.dev by name and add a FlagCDN URL for each country's ISO code.
 *
 * @param {string} query - Current search query.
 * @param {{signal: AbortSignal}} context - Request context.
 * @param {number} [maxResults=multipleAutocomplete.maxResults] - Maximum number of countries to request.
 * @returns {Promise<object[]>} Matching countries, capped by the element's max-results setting.
 */
const searchCountries = async (query, {signal}, maxResults = multipleAutocomplete.maxResults) => {
    countryResponseDetails.hidden = true
    countryResponseOutput.replaceChildren()

    const endpoint = new URL(`https://countries.dev/name/${encodeURIComponent(query.trim())}`)
    endpoint.searchParams.set('fields', 'name,alpha2Code,flag,flags')
    endpoint.searchParams.set('limit', String(maxResults))

    const response = await fetch(endpoint, {signal})
    if (signal.aborted) return []
    if (response.status === 404) {
        renderSelectedResult(countryResponseOutput, [])
        countryResponseDetails.hidden = false
        return []
    }
    if (!response.ok) throw new Error(`Country search failed with status ${response.status}`)

    const countries = await response.json()
    if (signal.aborted) return []
    if (!Array.isArray(countries)) throw new TypeError('countries.dev response must be an array')

    renderSelectedResult(countryResponseOutput, countries)
    countryResponseDetails.hidden = false

    return countries.slice(0, maxResults).flatMap(country => {
        if (!country?.name || !country.alpha2Code) return []

        const flagUrl = `https://flagcdn.io/${country.alpha2Code.toLowerCase()}.svg`
        const flagEmoji = countryFlagEmoji(country.alpha2Code)

        return [{
            value: country.alpha2Code,
            label: country.name,
            countryCode: country.alpha2Code,
            flagUrl,
            flagEmoji,
            icon: {src: flagUrl, fallback: flagEmoji},
        }]
    })
}

multipleAutocomplete.searchOptions = searchCountries
formAutocomplete.searchOptions = (query, context) => searchCountries(query, context, formAutocomplete.maxResults)

/**
 * Set each example dialog's copy button to its visible HTML and JavaScript samples.
 */
const prepareExampleCodeDialogs = () => {
    document.querySelectorAll('.example-code-dialog').forEach(dialog => {
        const copyButton = dialog.querySelector('wa-copy-button')
        const samples = Array.from(dialog.querySelectorAll('pre'), pre => {
            const code = pre.querySelector('code')?.textContent.trim() ?? ''
            return `${pre.dataset.language ?? 'Code'}\n${code}`
        })
        copyButton.value = samples.join('\n\n')
    })
}

prepareExampleCodeDialogs()

const selectedResultPattern = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g

/**
 * Render a selected option as syntax-highlighted, safely escaped JSON.
 *
 * @param {HTMLElement} codeElement - Code element that receives the formatted JSON.
 * @param {object} result - Selected option result.
 */
const renderSelectedResult = (codeElement, result) => {
    let json
    try {
        json = JSON.stringify(result, null, 2)
    } catch {
        codeElement.textContent = 'The selected result could not be serialized.'
        return
    }

    if (json === undefined) {
        codeElement.textContent = 'Nothing selected'
        return
    }

    codeElement.replaceChildren()
    let cursor = 0

    for (const match of json.matchAll(selectedResultPattern)) {
        const token = match[0]
        const tokenStart = match.index
        const tokenEnd = tokenStart + token.length
        if (tokenStart > cursor) codeElement.append(document.createTextNode(json.slice(cursor, tokenStart)))

        const span = document.createElement('span')
        const nextContent = json.slice(tokenEnd)
        span.className = token.startsWith('"')
            ? /^\s*:/.test(nextContent) ? 'token-property' : 'token-string'
            : /^(true|false|null)$/.test(token) ? 'token-literal' : 'token-number'
        span.textContent = token
        codeElement.append(span)
        cursor = tokenEnd
    }

    if (cursor < json.length) codeElement.append(document.createTextNode(json.slice(cursor)))
}

/**
 * Display selected country flags with accessible country names.
 *
 * @param {HTMLElement} container - Gallery that receives the flag images.
 * @param {object[]} selectedOptions - Selected country options.
 */
const renderCountryFlags = (container, selectedOptions) => {
    container.replaceChildren()
    if (selectedOptions.length === 0) {
        const emptyState = document.createElement('span')
        emptyState.className = 'selected-flags-empty'
        emptyState.textContent = 'No countries selected'
        container.append(emptyState)
        return
    }

    selectedOptions.forEach(country => {
        const image = document.createElement('img')
        image.className = 'country-flag'
        image.id = `country-flag-${country.countryCode.toLowerCase()}`
        image.src = country.flagUrl
        image.alt = `Flag of ${country.label}`
        image.loading = 'lazy'
        image.decoding = 'async'
        image.addEventListener('error', () => {
            const fallback = document.createElement('span')
            fallback.className = 'country-flag-fallback'
            fallback.textContent = country.flagEmoji
            fallback.setAttribute('role', 'img')
            fallback.setAttribute('aria-label', `Flag of ${country.label}`)
            image.replaceWith(fallback)
        }, {once: true})

        const tooltip = document.createElement('wa-tooltip')
        tooltip.setAttribute('for', image.id)
        tooltip.textContent = country.label

        container.append(image, tooltip)
    })
}

/**
 * Apply the selected hue to the demo-wide brand theme and preview.
 *
 * @param {object|undefined} option - Selected brand color option, if any.
 */
const renderBrandColorPreview = option => {
    if (!option) {
        applyBrand(preferences.brand)
        return
    }

    preferences.brand = option.value
    applyBrand(preferences.brand)
    savePreferences()
}

/**
 * Render the current value and option metadata for an autocomplete element.
 *
 * @param {HTMLElement} element - Autocomplete element whose selection changed.
 */
const renderSelection = element => {
    const output = document.querySelector(`#${element.id}-selection`)
    const selectedOptions = element.selectedOptions
    if (element === brandColorAutocomplete) {
        renderBrandColorPreview(selectedOptions[0])
        brandColorResponseDetails.hidden = selectedOptions.length === 0
    }

    if (element === multipleAutocomplete) {
        renderCountryFlags(output, selectedOptions)
        return
    }

    if (selectedOptions.length === 0) {
        output.textContent = 'Nothing selected'
        return
    }

    renderSelectedResult(output, element.multiple
        ? {value: element.value, selectedOptions}
        : {value: element.value, metadata: selectedOptions[0]})
}

for (const element of [
    localAutocomplete,
    brandColorAutocomplete,
    remoteAutocomplete,
    multipleAutocomplete,
    iconSourceAutocomplete,
    formAutocomplete,
]) {
    element.addEventListener('wa-select', () => renderSelection(element))
    element.addEventListener('wa-deselect', () => renderSelection(element))
    element.addEventListener('wa-clear', () => renderSelection(element))
}

document.querySelector('#form-demo').addEventListener('submit', event => {
    event.preventDefault()
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries())
    renderSelectedResult(document.querySelector('#form-demo-data'), formData)
})

document.querySelectorAll('[data-clear]').forEach(button => {
    button.addEventListener('click', () => {
        const element = document.querySelector(button.dataset.clear)
        element.value = ''
        document.querySelector(`#${element.id}-selection`).textContent = 'Nothing selected'
        element.focus()
    })
})
}

const root = document.documentElement
const themeValues = ['default', 'awesome', 'shoelace']
const themeClasses = ['wa-theme-default', 'wa-theme-awesome', 'wa-theme-shoelace']
const paletteClasses = ['wa-palette-default', 'wa-palette-bright', 'wa-palette-shoelace']
const brandValues = ['blue', 'red', 'orange', 'yellow', 'green', 'cyan', 'indigo', 'purple', 'pink', 'gray']
const brandClasses = brandValues.map(value => `wa-brand-${value}`)
const themeControl = document.querySelector('#theme-control')
const modeControl = document.querySelector('#mode-control')
const brandControl = document.querySelector('#brand-control')
const activeBrandPreview = document.querySelector('#brand-color-preview')
const activeBrandPreviewName = document.querySelector('#brand-color-preview-name')
const preferenceKey = root.dataset.demoPreferenceKey || 'lgs1920-autocomplete-demo-preferences'
const preferences = {
    theme: themeValues.includes(root.dataset.demoTheme) ? root.dataset.demoTheme : 'default',
    mode: ['system', 'light', 'dark'].includes(root.dataset.demoMode) ? root.dataset.demoMode : 'system',
    brand: brandValues.includes(root.dataset.demoBrand) ? root.dataset.demoBrand : 'cyan',
}
const systemColorScheme = window.matchMedia('(prefers-color-scheme: dark)')

themeControl.value = preferences.theme
modeControl.value = preferences.mode
brandControl.value = preferences.brand

/**
 * Persist the current demo appearance choices when browser storage is available.
 */
const savePreferences = () => {
    try {
        localStorage.setItem(preferenceKey, JSON.stringify(preferences))
    } catch {}
}

/**
 * Apply the selected Web Awesome theme and matching palette.
 *
 * @param {'default'|'awesome'|'shoelace'} theme - Selected theme.
 */
const applyTheme = theme => {
    const themeIndex = themeValues.indexOf(theme)
    if (themeIndex < 0) return

    root.classList.remove(...themeClasses, ...paletteClasses)
    root.classList.add(themeClasses[themeIndex], paletteClasses[themeIndex])
    root.dataset.demoTheme = theme
}

/**
 * Apply a saved color mode or resolve the current system preference.
 *
 * @param {'system'|'light'|'dark'} mode - Selected color mode.
 */
const applyMode = mode => {
    const effectiveMode = mode === 'system' ? (systemColorScheme.matches ? 'dark' : 'light') : mode

    root.classList.remove('wa-light', 'wa-dark')
    root.classList.add(`wa-${effectiveMode}`)
    root.dataset.demoMode = mode
    root.dataset.demoEffectiveMode = effectiveMode
    modeControl.value = mode
}

/**
 * Apply the selected Web Awesome brand color.
 *
 * @param {'blue'|'red'|'orange'|'yellow'|'green'|'cyan'|'indigo'|'purple'|'pink'|'gray'} brand - Selected brand color.
 */
const applyBrand = brand => {
    if (!brandValues.includes(brand)) return

    root.classList.remove(...brandClasses)
    root.classList.add(`wa-brand-${brand}`)
    root.dataset.demoBrand = brand
    brandControl.value = brand
    activeBrandPreview?.classList.add('brand-color-preview--selected')
    if (activeBrandPreviewName) activeBrandPreviewName.textContent = `${brand[0].toUpperCase()}${brand.slice(1)} brand`
}

applyTheme(preferences.theme)
applyMode(preferences.mode)
applyBrand(preferences.brand)

themeControl.addEventListener('change', event => {
    preferences.theme = event.currentTarget.value
    applyTheme(preferences.theme)
    savePreferences()
})

modeControl.addEventListener('change', event => {
    preferences.mode = event.currentTarget.value
    applyMode(preferences.mode)
    savePreferences()
})

brandControl.addEventListener('change', event => {
    preferences.brand = event.currentTarget.value
    applyBrand(preferences.brand)
    savePreferences()
})

/** Keep the selected mode in sync with operating-system changes in System mode. */
const followSystemColorScheme = () => {
    if (preferences.mode === 'system') applyMode('system')
}

if (systemColorScheme.addEventListener) {
    systemColorScheme.addEventListener('change', followSystemColorScheme)
} else {
    systemColorScheme.addListener(followSystemColorScheme)
}
