/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: LGS1920Autocomplete.js
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

import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/input/input.js'
import '@awesome.me/webawesome/dist/components/popup/popup.js'
import autocompleteStyles from './autocomplete.css?inline'

/**
 * @typedef {Object} AutocompleteOption
 * @property {string|number} value - Stable value submitted with the form.
 * @property {string|number} [valeur] - French alias for `value`.
 * @property {string} label - Text displayed to the user and searched.
 * @property {string|{name: string, family?: string, variant?: string}} [icon] - Optional Web Awesome icon.
 * @property {unknown} [key: string] - Optional host-owned metadata preserved in event details.
 */

/**
 * @typedef {(query: string, context: {signal: AbortSignal}) => Promise<AutocompleteOption[]>} AutocompleteSearch
 */

let nextInstanceId = 0

/**
 * Validate and copy options without dropping host-owned metadata.
 *
 * @param {AutocompleteOption[]} options - Candidate options.
 * @returns {AutocompleteOption[]} Validated options.
 */
const normalizeOptions = options => {
    if (!Array.isArray(options)) throw new TypeError('Autocomplete options must be an array')

    return options.map((option, index) => {
        if (!option || typeof option !== 'object') {
            throw new TypeError(`Autocomplete option at index ${index} must be an object`)
        }
        const value = option.value ?? option.valeur
        if (typeof value !== 'string' && typeof value !== 'number') {
            throw new TypeError(`Autocomplete option at index ${index} must define a string or numeric value`)
        }
        if (typeof option.label !== 'string') {
            throw new TypeError(`Autocomplete option at index ${index} must define a string label`)
        }
        if (option.icon && typeof option.icon !== 'string' && typeof option.icon !== 'object') {
            throw new TypeError(`Autocomplete option at index ${index} has an invalid icon`)
        }
        if (option.icon && typeof option.icon === 'object' && typeof option.icon.name !== 'string') {
            throw new TypeError(`Autocomplete option at index ${index} must define an icon name`)
        }

        return {...option, value, label: option.label}
    })
}

/**
 * Return the searchable text for an option.
 *
 * @param {AutocompleteOption} option - Option to search.
 * @returns {string} Normalized searchable text.
 */
const getSearchText = option => `${option.label} ${option.value}`.toLocaleLowerCase()

/**
 * Create the LGS1920 autocomplete custom element.
 */
export class LGS1920Autocomplete extends HTMLElement {
    static formAssociated = true
    static observedAttributes = ['label', 'placeholder', 'name', 'disabled', 'icon-position', 'min-chars', 'debounce']

    #input
    #popup
    #listbox
    #internals
    #message
    #options = []
    #results = []
    #persistence = null
    #recentOptions = []
    #selectedOption = null
    #activeIndex = -1
    #searchOptions = null
    #timer = 0
    #controller = null
    #requestSequence = 0

    /** Handle edits to the visible query. */
    #onInput = event => {
        const query = event.currentTarget.value ?? ''
        this.#selectedOption = null
        this.#internals.setFormValue(null)
        this.#search(query)
    }

    /** Open suggestions when the input receives focus. */
    #onFocus = event => {
        event.stopPropagation()
        this.dispatchEvent(new FocusEvent('focus', {composed: true}))
        this.#search(this.#input.value ?? '')
    }

    /** Forward the Web Awesome input blur event from the custom element host. */
    #onBlur = event => {
        event.stopPropagation()
        this.dispatchEvent(new FocusEvent('blur', {composed: true}))
    }

    /** Handle combobox keyboard interaction. */
    #onKeydown = event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            this.#moveActive(1)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            this.#moveActive(-1)
        } else if (event.key === 'Home' && this.#isOpen()) {
            event.preventDefault()
            this.#setActive(0)
        } else if (event.key === 'End' && this.#isOpen()) {
            event.preventDefault()
            this.#setActive(this.#results.length - 1)
        } else if (event.key === 'Enter' && this.#isOpen() && this.#activeIndex >= 0) {
            event.preventDefault()
            this.#select(this.#results[this.#activeIndex])
        } else if (event.key === 'Escape') {
            this.#close()
        }
    }

    /** Commit a suggestion selected from the pointer. */
    #onOptionClick = event => {
        const optionElement = event.target.closest('[role="option"][data-index]')
        if (!optionElement) return
        this.#select(this.#results[Number(optionElement.dataset.index)])
    }

    /** Close the popup after pointer interaction outside the custom element. */
    #onOutsidePointerdown = event => {
        if (!event.composedPath().includes(this)) this.#close()
    }

    /** Close the popup when keyboard or pointer focus moves outside. */
    #onOutsideFocus = event => {
        if (!event.composedPath().includes(this)) this.#close()
    }

    /**
     * Build the Web Awesome input and suggestion panel.
     */
    constructor() {
        super()
        const shadow = this.attachShadow({mode: 'open'})
        this.#internals = this.attachInternals()
        const style = document.createElement('style')
        style.textContent = autocompleteStyles

        const root = document.createElement('div')
        root.className = 'autocomplete'
        root.innerHTML = `
            <wa-input class="input" autocomplete="off">
                <wa-icon class="disclosure" slot="end" name="chevron-down" aria-hidden="true"></wa-icon>
            </wa-input>
            <wa-popup class="popup" placement="bottom-start" distance="4" flip shift sync="width">
                <div class="panel">
                    <div class="message" role="status" aria-live="polite" hidden></div>
                    <div class="listbox" role="listbox"></div>
                </div>
            </wa-popup>
        `

        shadow.append(style, root)
        this.#input = root.querySelector('.input')
        this.#popup = root.querySelector('.popup')
        this.#listbox = root.querySelector('.listbox')
        this.#message = root.querySelector('.message')
        this.#popup.anchor = this.#input
        this.#listbox.id = `lgs1920-autocomplete-list-${++nextInstanceId}`

        this.#input.addEventListener('input', this.#onInput)
        this.#input.addEventListener('focus', this.#onFocus)
        this.#input.addEventListener('blur', this.#onBlur)
        this.#input.addEventListener('keydown', this.#onKeydown)
        this.#listbox.addEventListener('click', this.#onOptionClick)
    }

    /**
     * Attach document listeners and synchronize Web Awesome attributes.
     */
    connectedCallback() {
        this.#syncAttributes()
        document.addEventListener('pointerdown', this.#onOutsidePointerdown, true)
        document.addEventListener('focusin', this.#onOutsideFocus, true)
        this.#input.updateComplete.then(() => this.#syncAria())
    }

    /**
     * Release pending work and document listeners when the element disconnects.
     */
    disconnectedCallback() {
        document.removeEventListener('pointerdown', this.#onOutsidePointerdown, true)
        document.removeEventListener('focusin', this.#onOutsideFocus, true)
        this.#cancelSearch()
    }

    /**
     * Clear the selection when the owning form resets.
     */
    formResetCallback() {
        this.#selectedOption = null
        this.#input.value = ''
        this.#internals.setFormValue(null)
        this.#close()
    }

    /**
     * Keep the Web Awesome input disabled when its form disables the control.
     *
     * @param {boolean} disabled - Form-associated disabled state.
     */
    formDisabledCallback(disabled) {
        this.#input.disabled = disabled || this.disabled
        if (disabled) this.#close()
    }

    /**
     * Reflect supported host attributes into the Web Awesome input and form value.
     *
     * @param {string} name - Changed attribute name.
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.#input) return
        if (name === 'disabled' && oldValue !== newValue && newValue !== null) {
            this.#cancelSearch()
            this.#close()
        }
        if (name === 'icon-position') this.#renderOptions()
        this.#syncAttributes()
    }

    /**
     * Set the static options list.
     *
     * @param {AutocompleteOption[]} options - Available suggestions.
     */
    set options(options) {
        this.#options = normalizeOptions(options)
        if (!this.#searchOptions && this.#selectedOption) {
            const selectedOption = this.#options.find(option => String(option.value) === String(this.#selectedOption.value))
            this.#selectedOption = selectedOption ?? null
            this.#input.value = selectedOption?.label ?? ''
            this.#internals.setFormValue(selectedOption ? String(selectedOption.value) : null)
        }
        if (!this.#searchOptions && this.#isOpen()) this.#search(this.#input.value ?? '')
    }

    /**
     * Get the static options list.
     *
     * @returns {AutocompleteOption[]} Current options.
     */
    get options() {
        return [...this.#options]
    }

    /**
     * Set an asynchronous option provider. Assign `null` to use the local list.
     *
     * @param {AutocompleteSearch|null} searchOptions - Search provider.
     */
    set searchOptions(searchOptions) {
        if (searchOptions !== null && typeof searchOptions !== 'function') {
            throw new TypeError('searchOptions must be a function or null')
        }
        this.#searchOptions = searchOptions
        if (this.#isOpen()) this.#search(this.#input.value ?? '')
    }

    /**
     * Get the asynchronous option provider.
     *
     * @returns {AutocompleteSearch|null} Current search provider.
     */
    get searchOptions() {
        return this.#searchOptions
    }

    /**
     * Configure browser storage for recently selected options.
     *
     * @param {{id: string, limit?: number, count?: number}|null} persistence - Stable storage id and recent item limit.
     */
    set persistence(persistence) {
        if (persistence === null || persistence === undefined) {
            this.#persistence = null
            this.#recentOptions = []
            if (this.#isOpen()) this.#search(this.#input.value ?? '')
            return
        }
        if (!persistence || typeof persistence !== 'object' || typeof persistence.id !== 'string' || !persistence.id.trim()) {
            throw new TypeError('persistence must be null or an object with a non-empty id')
        }

        const limit = persistence.limit ?? persistence.count
        if (!Number.isInteger(limit) || limit < 1) {
            throw new TypeError('persistence.limit must be a positive integer')
        }

        this.#persistence = {id: persistence.id, limit}
        this.#loadRecentOptions()
        if (this.#isOpen()) this.#search(this.#input.value ?? '')
    }

    /**
     * Get the current browser persistence configuration.
     *
     * @returns {{id: string, limit: number}|null} Current persistence configuration.
     */
    get persistence() {
        return this.#persistence ? {...this.#persistence} : null
    }

    /**
     * Set the selected option value by matching the current local options.
     *
     * @param {string|number} value - Value to select.
     */
    set value(value) {
        const option = [...this.#options, ...this.#results].find(item => String(item.value) === String(value))
        if (option) this.#select(option, false)
        else {
            this.#selectedOption = null
            this.#input.value = ''
            this.#internals.setFormValue(null)
        }
    }

    /**
     * Get the selected raw value.
     *
     * @returns {string|number|''} Selected value, or an empty string.
     */
    get value() {
        return this.#selectedOption?.value ?? ''
    }

    /**
     * Get the current text query shown in the input.
     *
     * @returns {string} Current input query.
     */
    get query() {
        return this.#input.value ?? ''
    }

    /**
     * Get the selected option, including caller-owned metadata.
     *
     * @returns {AutocompleteOption|null} Selected option.
     */
    get selectedOption() {
        return this.#selectedOption
    }

    /**
     * Get the accessible input label.
     *
     * @returns {string} Input label.
     */
    get label() {
        return this.getAttribute('label') ?? ''
    }

    /**
     * Set the accessible input label.
     *
     * @param {string} value - Input label.
     */
    set label(value) {
        this.setAttribute('label', value)
    }

    /**
     * Get the input placeholder.
     *
     * @returns {string} Input placeholder.
     */
    get placeholder() {
        return this.getAttribute('placeholder') ?? ''
    }

    /**
     * Set the input placeholder.
     *
     * @param {string} value - Input placeholder.
     */
    set placeholder(value) {
        this.setAttribute('placeholder', value)
    }

    /**
     * Get the icon placement for every suggestion.
     *
     * @returns {'start'|'end'} Icon placement.
     */
    get iconPosition() {
        return this.getAttribute('icon-position') === 'end' ? 'end' : 'start'
    }

    /**
     * Set the icon placement for every suggestion.
     *
     * @param {'start'|'end'} value - Icon placement.
     */
    set iconPosition(value) {
        this.setAttribute('icon-position', value === 'end' ? 'end' : 'start')
    }

    /**
     * Get the minimum query length for asynchronous searches.
     *
     * @returns {number} Minimum number of characters.
     */
    get minChars() {
        return Math.max(0, Number(this.getAttribute('min-chars') ?? 0))
    }

    /**
     * Set the minimum query length for asynchronous searches.
     *
     * @param {number} value - Minimum number of characters.
     */
    set minChars(value) {
        this.setAttribute('min-chars', String(Math.max(0, Number(value) || 0)))
    }

    /**
     * Get the asynchronous search debounce delay.
     *
     * @returns {number} Delay in milliseconds.
     */
    get debounce() {
        return Math.max(0, Number(this.getAttribute('debounce') ?? 150))
    }

    /**
     * Set the asynchronous search debounce delay.
     *
     * @param {number} value - Delay in milliseconds.
     */
    set debounce(value) {
        this.setAttribute('debounce', String(Math.max(0, Number(value) || 0)))
    }

    /**
     * Synchronize attributes supported by the public custom element.
     */
    #syncAttributes() {
        this.#input.label = this.label
        this.#input.placeholder = this.placeholder
        this.#input.disabled = this.disabled
        this.#input.autocomplete = 'off'
        this.#syncAria()
    }

    /**
     * Set combobox semantics on Web Awesome's native input element.
     */
    #syncAria() {
        const input = this.#input.input
        if (!input) return
        input.setAttribute('role', 'combobox')
        input.setAttribute('aria-autocomplete', 'list')
        input.setAttribute('aria-haspopup', 'listbox')
        input.setAttribute('aria-controls', this.#listbox.id)
        input.setAttribute('aria-expanded', String(this.#isOpen()))
        if (this.#activeIndex < 0) input.removeAttribute('aria-activedescendant')
        else input.setAttribute('aria-activedescendant', `${this.#listbox.id}-option-${this.#activeIndex}`)
    }

    /**
     * Filter local options or request remote suggestions for a query.
     *
     * @param {string} query - Current input query.
     */
    #search(query) {
        this.#cancelSearch()
        if (this.disabled) {
            this.#close()
            return
        }
        this.#open()

        if (query.trim() === '' && this.#persistence) {
            this.#loadRecentOptions()
            if (this.#recentOptions.length) {
                this.#results = this.#recentOptions.map(recent => this.#options.find(option => String(option.value) === String(recent.value)) ?? recent)
                this.#activeIndex = -1
                this.#renderOptions()
                this.#setMessage('Recently used')
                return
            }
        }

        if (!this.#searchOptions) {
            const normalizedQuery = query.trim().toLocaleLowerCase()
            this.#results = this.#options.filter(option => getSearchText(option).includes(normalizedQuery))
            this.#activeIndex = -1
            this.#renderOptions()
            this.#setMessage(this.#results.length ? '' : 'No results found')
            return
        }

        if (query.trim().length < this.minChars) {
            this.#results = []
            this.#activeIndex = -1
            this.#renderOptions()
            this.#setMessage(`Type at least ${this.minChars} characters`)
            return
        }

        const requestSequence = this.#requestSequence
        this.#results = []
        this.#activeIndex = -1
        this.#renderOptions()
        this.#setMessage('Loading suggestions…')
        this.#timer = window.setTimeout(async () => {
            const controller = new AbortController()
            this.#controller = controller

            try {
                const result = await this.#searchOptions(query, {signal: controller.signal})
                if (requestSequence !== this.#requestSequence || controller.signal.aborted) return
                this.#results = normalizeOptions(result)
                this.#renderOptions()
                this.#setMessage(this.#results.length ? '' : 'No results found')
            } catch (error) {
                if (requestSequence !== this.#requestSequence || controller.signal.aborted) return
                this.#results = []
                this.#renderOptions()
                this.#setMessage('Suggestions could not be loaded')
                this.#dispatch('wa-search-error', {error, query})
            }
        }, this.debounce)
    }

    /**
     * Cancel a pending debounce and abort any active request.
     */
    #cancelSearch() {
        window.clearTimeout(this.#timer)
        this.#timer = 0
        this.#requestSequence += 1
        this.#controller?.abort()
        this.#controller = null
    }

    /**
     * Render the current suggestions with DOM APIs and safe text assignment.
     */
    #renderOptions() {
        this.#listbox.replaceChildren()
        this.#results.forEach((option, index) => {
            const element = document.createElement('div')
            element.id = `${this.#listbox.id}-option-${index}`
            element.className = 'option'
            element.dataset.index = String(index)
            element.setAttribute('role', 'option')
            element.setAttribute('aria-selected', String(option === this.#selectedOption))
            element.dataset.active = String(index === this.#activeIndex)

            const label = document.createElement('span')
            label.className = 'option-label'
            label.textContent = option.label

            const icon = this.#createIcon(option.icon)
            if (icon && this.iconPosition === 'start') element.append(icon)
            element.append(label)
            if (icon && this.iconPosition === 'end') element.append(icon)
            this.#listbox.append(element)
        })
        this.#syncAria()
    }

    /**
     * Create an optional Web Awesome icon from a string or icon descriptor.
     *
     * @param {AutocompleteOption['icon']} iconValue - Public icon definition.
     * @returns {HTMLElement|null} Web Awesome icon element.
     */
    #createIcon(iconValue) {
        if (!iconValue) return null
        const icon = document.createElement('wa-icon')
        if (typeof iconValue === 'string') icon.name = iconValue
        else {
            icon.name = iconValue.name
            if (iconValue.family) icon.family = iconValue.family
            if (iconValue.variant) icon.variant = iconValue.variant
        }
        icon.setAttribute('aria-hidden', 'true')
        icon.className = 'option-icon'
        return icon
    }

    /**
     * Move the active suggestion with wraparound keyboard navigation.
     *
     * @param {number} direction - Positive for down, negative for up.
     */
    #moveActive(direction) {
        if (!this.#isOpen()) this.#search(this.#input.value ?? '')
        if (this.#results.length === 0) return
        const start = this.#activeIndex < 0 ? (direction > 0 ? -1 : 0) : this.#activeIndex
        this.#setActive((start + direction + this.#results.length) % this.#results.length)
    }

    /**
     * Update the active suggestion and scroll it into view.
     *
     * @param {number} index - Suggestion index.
     */
    #setActive(index) {
        this.#activeIndex = index >= 0 && index < this.#results.length ? index : -1
        this.#renderOptions()
        this.#listbox.querySelector('[data-active="true"]')?.scrollIntoView({block: 'nearest'})
    }

    /**
     * Commit an option and optionally notify the host.
     *
     * @param {AutocompleteOption} option - Option to select.
     * @param {boolean} [notify=true] - Whether to emit selection events.
     */
    #select(option, notify = true) {
        if (!option) return
        this.#selectedOption = option
        this.#input.value = option.label
        this.#internals.setFormValue(String(option.value))
        this.#close()
        if (!notify) return

        this.#rememberOption(option)
        const detail = {option, value: option.value, label: option.label}
        this.#dispatch('wa-select', detail)
        this.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
    }

    /**
     * Open the suggestion popup.
     */
    #open() {
        this.#popup.active = true
        this.#syncAria()
    }

    /**
     * Close the suggestion popup and clear active descendant state.
     */
    #close() {
        this.#cancelSearch()
        this.#activeIndex = -1
        this.#popup.active = false
        this.#syncAria()
    }

    /**
     * Return whether the suggestion popup is open.
     *
     * @returns {boolean} Popup state.
     */
    #isOpen() {
        return this.#popup.active
    }

    /**
     * Display a live status message next to the listbox.
     *
     * @param {string} message - Message to announce.
     */
    #setMessage(message) {
        this.#message.textContent = message
        this.#message.hidden = !message
    }

    /**
     * Read recent options from localStorage and enforce the configured limit.
     */
    #loadRecentOptions() {
        if (!this.#persistence) return
        const {id, limit} = this.#persistence

        try {
            const stored = window.localStorage.getItem(this.#getStorageKey(id))
            const options = stored === null ? [] : normalizeOptions(JSON.parse(stored))
            const uniqueOptions = options.filter((option, index, all) => all.findIndex(item => String(item.value) === String(option.value)) === index)
            this.#recentOptions = uniqueOptions.slice(0, limit)
            if (this.#recentOptions.length !== uniqueOptions.length) this.#saveRecentOptions()
        } catch (error) {
            this.#recentOptions = []
            this.#dispatch('wa-persistence-error', {error, action: 'read', id})
        }
    }

    /**
     * Add a user-selected option to the most-recently-used list.
     *
     * @param {AutocompleteOption} option - Selected suggestion.
     */
    #rememberOption(option) {
        if (!this.#persistence) return
        const {limit} = this.#persistence
        this.#recentOptions = [option, ...this.#recentOptions.filter(item => String(item.value) !== String(option.value))].slice(0, limit)
        this.#saveRecentOptions()
    }

    /**
     * Write recent options to localStorage without interrupting selection.
     */
    #saveRecentOptions() {
        if (!this.#persistence) return
        const {id} = this.#persistence

        try {
            window.localStorage.setItem(this.#getStorageKey(id), JSON.stringify(this.#recentOptions))
        } catch (error) {
            this.#dispatch('wa-persistence-error', {error, action: 'write', id})
        }
    }

    /**
     * Create the namespaced localStorage key for a persistence id.
     *
     * @param {string} id - Consumer-provided persistence id.
     * @returns {string} Storage key.
     */
    #getStorageKey(id) {
        return `lgs1920-autocomplete:${encodeURIComponent(id)}`
    }

    /**
     * Dispatch a namespaced, bubbling event with structured details.
     *
     * @param {string} name - Event name.
     * @param {object} detail - Event detail.
     */
    #dispatch(name, detail) {
        this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: true}))
    }
}

if (!customElements.get('lgs1920-autocomplete')) {
    customElements.define('lgs1920-autocomplete', LGS1920Autocomplete)
}
