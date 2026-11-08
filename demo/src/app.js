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
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/select/select.js'
import '@lgs1920/autocomplete'

const localOptions = [
    {value: 'troyes', label: 'Troyes', icon: 'location-dot', department: '10', region: 'Grand Est'},
    {value: 'reims', label: 'Reims', icon: 'city', department: '51', region: 'Grand Est'},
    {value: 'strasbourg', label: 'Strasbourg', icon: 'landmark', department: '67', region: 'Grand Est'},
    {value: 'lyon', label: 'Lyon', icon: 'building', department: '69', region: 'Auvergne-Rhône-Alpes'},
    {value: 'dijon', label: 'Dijon', icon: 'map-pin', department: '21', region: 'Bourgogne-Franche-Comté'},
]

const localAutocomplete = document.querySelector('#local-autocomplete')
const trailingAutocomplete = document.querySelector('#trailing-autocomplete')
const remoteAutocomplete = document.querySelector('#remote-autocomplete')
const remoteOptions = [
    {value: 'fr', label: 'France', icon: 'flag', countryCode: 'FR'},
    {value: 'be', label: 'Belgium', icon: 'flag', countryCode: 'BE'},
    {value: 'ch', label: 'Switzerland', icon: 'flag', countryCode: 'CH'},
    {value: 'lu', label: 'Luxembourg', icon: 'flag', countryCode: 'LU'},
]

localAutocomplete.options = localOptions
localAutocomplete.persistence = {id: 'city-search-demo', limit: 3}
trailingAutocomplete.options = localOptions

/**
 * Simulate a network delay while respecting request cancellation.
 *
 * @param {AbortSignal} signal - Search request signal.
 * @returns {Promise<void>} Resolves after the simulated delay.
 */
const waitForSearch = signal => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, 350)
    signal.addEventListener('abort', () => {
        window.clearTimeout(timeout)
        reject(new DOMException('Search cancelled', 'AbortError'))
    }, {once: true})
})

/**
 * Search the demo country records as an asynchronous API would.
 *
 * @param {string} query - Current search query.
 * @param {{signal: AbortSignal}} context - Request context.
 * @returns {Promise<object[]>} Matching countries.
 */
const searchCountries = async (query, {signal}) => {
    await waitForSearch(signal)
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return remoteOptions.filter(option => option.label.toLocaleLowerCase().includes(normalizedQuery))
}

remoteAutocomplete.searchOptions = searchCountries

for (const element of [localAutocomplete, trailingAutocomplete, remoteAutocomplete]) {
    const output = document.querySelector(`#${element.id}-selection`)
    element.addEventListener('wa-select', event => {
        output.textContent = JSON.stringify({
            value: event.detail.value,
            metadata: event.detail.option,
        })
    })
}

document.querySelectorAll('[data-clear]').forEach(button => {
    button.addEventListener('click', () => {
        const element = document.querySelector(button.dataset.clear)
        element.value = ''
        document.querySelector(`#${element.id}-selection`).textContent = 'Nothing selected'
        element.focus()
    })
})

const themeClasses = ['wa-theme-default', 'wa-theme-awesome', 'wa-theme-shoelace']
const paletteClasses = ['wa-palette-default', 'wa-palette-bright', 'wa-palette-shoelace']
const brandClasses = ['wa-brand-blue', 'wa-brand-red', 'wa-brand-orange', 'wa-brand-green', 'wa-brand-purple']
const root = document.documentElement

document.querySelector('#theme-control').addEventListener('change', event => {
    root.classList.remove(...themeClasses)
    root.classList.remove(...paletteClasses)
    const themeIndex = ['default', 'awesome', 'shoelace'].indexOf(event.currentTarget.value)
    root.classList.add(themeClasses[themeIndex], paletteClasses[themeIndex])
})

document.querySelector('#mode-control').addEventListener('change', event => {
    root.classList.toggle('wa-dark', event.currentTarget.value === 'dark')
    root.classList.toggle('wa-light', event.currentTarget.value === 'light')
})

document.querySelector('#brand-control').addEventListener('change', event => {
    root.classList.remove(...brandClasses)
    root.classList.add(`wa-brand-${event.currentTarget.value}`)
})
