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
 * Last modified: 2026-11-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/card/card.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/input/input.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/pagination/pagination.js'
import '@awesome.me/webawesome/dist/components/popup/popup.js'
import '@awesome.me/webawesome/dist/components/tag/tag.js'
import autocompleteStyles from './autocomplete.css?inline'
import {readOptionsFromMarkup} from './options-from-markup.js'

/**
 * @typedef {Object} AutocompleteOption
 * @property {string|number} value - Stable value submitted with the form.
 * @property {string|number} [valeur] - French alias for `value`.
 * @property {string} label - Text displayed to the user and searched.
 * @property {string|{name: string, family?: string, variant?: string}|{src: string, fallback?: string}} [icon] - Web Awesome icon name/descriptor or SVG/PNG URL with optional text fallback.
 * @property {unknown} [key: string] - Optional host-owned metadata preserved in event details.
 */

/**
 * @typedef {(query: string, context: {signal: AbortSignal}) => Promise<AutocompleteOption[]>} AutocompleteSearch
 */

let nextInstanceId = 0
const selectedOptionsPageSize = 10

/**
 * Determine whether a plain icon string points to an SVG or PNG image.
 *
 * @param {string} value - Option icon string.
 * @returns {boolean} Whether the string has an SVG or PNG file extension.
 */
const isImageIconSource = value => /\.(?:svg|png)(?:[?#].*)?$/i.test(value)

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
        if (option.icon && typeof option.icon === 'object') {
            const hasName = typeof option.icon.name === 'string' && option.icon.name.length > 0
            const hasSource = typeof option.icon.src === 'string' && option.icon.src.trim().length > 0
            if ((option.icon.name !== undefined && !hasName) || (option.icon.src !== undefined && !hasSource) || hasName === hasSource) {
                throw new TypeError(`Autocomplete option at index ${index} must define exactly one icon name or image source`)
            }
            if (option.icon.fallback !== undefined
                && (!hasSource || typeof option.icon.fallback !== 'string' || !option.icon.fallback.trim())) {
                throw new TypeError(`Autocomplete option at index ${index} must define fallback text with an image source`)
            }
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
 *
 * @slot start - Content placed at the start of the input, such as a Web Awesome icon.
 * @slot end - Content placed at the end of the input alongside its clear and disclosure controls.
 */
export class LGS1920Autocomplete extends HTMLElement {
    static formAssociated = true
    static observedAttributes = ['label', 'placeholder', 'name', 'disabled', 'icon-position', 'min-chars', 'debounce', 'with-clear', 'size', 'appearance', 'pill', 'hint', 'readonly', 'page-size', 'max-results', 'multiple', 'max-options-visible']

    #input
    #disclosureButton
    #disclosureIcon
    #popup
    #listbox
    #pagination
    #selectedTags
    #selectionActions
    #selectedCountTag
    #clearSelectionButton
    #selectedPopup
    #selectedList
    #selectedPagination
    #internals
    #message
    #options = []
    #optionsProvidedByHost = false
    #results = []
    #persistence = null
    #recentOptions = []
    #selectedOption = null
    #selectedOptions = []
    #formDisabled = false
    #activeIndex = -1
    #page = 1
    #showAllOptions = false
    #selectedPage = 1
    #searchOptions = null
    #timer = 0
    #controller = null
    #requestSequence = 0

    /** Handle edits to the visible query. */
    #onInput = event => {
        const query = event.currentTarget.value ?? ''
        this.#showAllOptions = false
        this.#closeSelectedOptions()
        if (!this.multiple) {
            this.#selectedOption = null
            this.#syncFormValue()
        }
        this.#renderSelectedTags()
        this.#search(query)
    }

    /** Clear a selected value when Web Awesome's input clear button is activated. */
    #onClear = event => {
        event.stopPropagation()
        if (!this.multiple) {
            this.#selectedOption = null
            this.#syncFormValue()
            this.#renderSelectedTags()
        }
        this.#dispatch('wa-clear', {})
    }

    /** Clear all selected values from the multiple-selection control. */
    #onClearSelection = event => {
        event.preventDefault()
        event.stopPropagation()
        if (this.disabled || this.#formDisabled) return
        this.#clearMultipleSelection()
        this.#input.value = ''
        this.#search('')
        this.#dispatch('wa-clear', {})
        this.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
        this.#input.focus()
    }

    /** Toggle the popup containing every selected option. */
    #onSelectedCountClick = event => {
        event.preventDefault()
        event.stopPropagation()
        if (this.disabled || this.#formDisabled) return
        if (this.#selectedPopup.active) {
            this.#closeSelectedOptions()
            return
        }

        this.#close()
        this.#selectedPage = 1
        this.#renderSelectedOptions()
        this.#selectedPopup.active = true
        this.#selectedCountTag.setAttribute('aria-expanded', 'true')
    }

    /** Toggle the selected options popup from the keyboard. */
    #onSelectedCountKeydown = event => {
        if (event.key === 'Escape' && this.#selectedPopup.active) {
            event.preventDefault()
            this.#closeSelectedOptions()
            return
        }
        if (event.key !== 'Enter' && event.key !== ' ') return
        this.#onSelectedCountClick(event)
    }

    /** Close the selected options popup with Escape and restore focus to its trigger. */
    #onSelectedPopupKeydown = event => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        this.#closeSelectedOptions()
        this.#selectedCountTag.focus()
    }

    /** Update the selected options after a page change. */
    #onSelectedPageChange = event => {
        this.#selectedPage = event.detail.page
        this.#renderSelectedOptions()
    }

    /** Remove the tag that emitted Web Awesome's remove event. */
    #onTagRemove = event => {
        const tag = event.target.closest('wa-tag[data-value]')
        if (!tag) return
        const removedFromExpandedList = this.#selectedList.contains(tag)
        event.stopPropagation()
        if (this.disabled || this.#formDisabled) return
        const option = this.#selectedOptions.find(item => String(item.value) === tag.dataset.value)
        if (option) this.#select(option)
        if (removedFromExpandedList && !this.#selectedCountTag.hidden) this.#selectedCountTag.focus()
        else this.#input.focus()
    }

    /** Open suggestions when the input receives focus. */
    #onFocus = event => {
        event.stopPropagation()
        this.#closeSelectedOptions()
        this.dispatchEvent(new FocusEvent('focus', {composed: true}))
        this.#search(this.#input.value ?? '')
    }

    /** Expand recent suggestions to the complete local list or close the popup. */
    #onDisclosureClick = event => {
        event.preventDefault()
        event.stopPropagation()
        if (this.disabled || this.#formDisabled) return
        if (this.#isOpen()) {
            const query = this.#input.value ?? ''
            const selectedLabel = !this.multiple && query === this.#selectedOption?.label
            const canShowAllOptions = !this.#searchOptions && this.#options.length > 0 && (!query.trim() || selectedLabel)

            if (canShowAllOptions && !this.#showAllOptions) {
                this.#showAllOptions = true
                this.#page = 1
                this.#search(query)
                this.#input.focus()
                return
            }

            this.#close()
            return
        }

        const query = this.#input.value ?? ''
        const selectedLabel = !this.multiple && query === this.#selectedOption?.label
        this.#showAllOptions = !this.#searchOptions && this.#options.length > 0 && (!query.trim() || selectedLabel)
        if (this.#showAllOptions) this.#page = 1
        this.#search(query)
        this.#input.focus()
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

    /** Update the visible options after a pagination event. */
    #onPageChange = event => {
        this.#page = event.detail.page
        this.#activeIndex = -1
        this.#renderOptions()
    }

    /** Close the popup after pointer interaction outside the custom element. */
    #onOutsidePointerdown = event => {
        if (!event.composedPath().includes(this)) {
            this.#close()
            this.#closeSelectedOptions()
        }
    }

    /** Close the popup when keyboard or pointer focus moves outside. */
    #onOutsideFocus = event => {
        if (!event.composedPath().includes(this)) {
            this.#close()
            this.#closeSelectedOptions()
        }
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
                <slot name="start" slot="start"></slot>
                <div class="selected-tags" slot="start" hidden></div>
                <slot name="end" slot="end"></slot>
                <div class="selection-actions" slot="end" hidden>
                    <wa-tag class="selected-count" role="button" tabindex="0" aria-expanded="false" hidden></wa-tag>
                    <wa-button class="clear-selection" type="button" appearance="plain" size="s" aria-label="Clear selected options" hidden>
                        <wa-icon name="circle-xmark" library="system" variant="regular" aria-hidden="true"></wa-icon>
                    </wa-button>
                </div>
                <wa-button class="disclosure" slot="end" type="button" appearance="plain" size="s" aria-label="Show options" aria-haspopup="listbox" aria-expanded="false">
                    <wa-icon class="disclosure-icon" name="chevron-down" aria-hidden="true"></wa-icon>
                </wa-button>
            </wa-input>
            <wa-popup class="selected-popup" placement="bottom-end" distance="4" flip shift>
                <wa-card class="selected-card">
                    <div class="selected-panel">
                        <div class="selected-list" role="list" aria-label="Selected options"></div>
                        <wa-pagination class="selected-pagination" appearance="plain" format="compact" hide-single-page with-summary label="Selected options pages"></wa-pagination>
                    </div>
                </wa-card>
            </wa-popup>
            <wa-popup class="popup" placement="bottom-start" distance="4" flip shift sync="width">
                <div class="panel">
                    <div class="message" role="status" aria-live="polite" hidden></div>
                    <div class="listbox" role="listbox"></div>
                    <wa-pagination class="pagination" appearance="plain" format="compact" hide-single-page with-summary label="Suggestion pages"></wa-pagination>
                </div>
            </wa-popup>
        `

        shadow.append(style, root)
        this.#input = root.querySelector('.input')
        this.#disclosureButton = root.querySelector('.disclosure')
        this.#disclosureIcon = root.querySelector('.disclosure-icon')
        this.#popup = root.querySelector('.popup')
        this.#listbox = root.querySelector('.listbox')
        this.#pagination = root.querySelector('.pagination')
        this.#selectedTags = root.querySelector('.selected-tags')
        this.#selectionActions = root.querySelector('.selection-actions')
        this.#selectedCountTag = root.querySelector('.selected-count')
        this.#clearSelectionButton = root.querySelector('.clear-selection')
        this.#selectedPopup = root.querySelector('.selected-popup')
        this.#selectedList = root.querySelector('.selected-list')
        this.#selectedPagination = root.querySelector('.selected-pagination')
        this.#message = root.querySelector('.message')
        this.#popup.anchor = this.#input
        this.#selectedPopup.anchor = this.#selectedCountTag
        const instanceId = ++nextInstanceId
        this.#listbox.id = `lgs1920-autocomplete-list-${instanceId}`
        this.#selectedList.id = `lgs1920-autocomplete-selected-${instanceId}`
        this.#selectedCountTag.setAttribute('aria-controls', this.#selectedList.id)

        this.#input.addEventListener('input', this.#onInput)
        this.#input.addEventListener('focus', this.#onFocus)
        this.#input.addEventListener('blur', this.#onBlur)
        this.#input.addEventListener('keydown', this.#onKeydown)
        this.#input.addEventListener('wa-clear', this.#onClear)
        this.#disclosureButton.addEventListener('click', this.#onDisclosureClick)
        this.#listbox.addEventListener('click', this.#onOptionClick)
        this.#pagination.addEventListener('wa-page-change', this.#onPageChange)
        this.#selectedTags.addEventListener('wa-remove', this.#onTagRemove)
        this.#selectedCountTag.addEventListener('click', this.#onSelectedCountClick)
        this.#selectedCountTag.addEventListener('keydown', this.#onSelectedCountKeydown)
        this.#selectedList.addEventListener('wa-remove', this.#onTagRemove)
        this.#selectedPagination.addEventListener('wa-page-change', this.#onSelectedPageChange)
        this.#selectedPopup.addEventListener('keydown', this.#onSelectedPopupKeydown)
        this.#clearSelectionButton.addEventListener('click', this.#onClearSelection)
    }

    /**
     * Attach document listeners and synchronize Web Awesome attributes.
     */
    connectedCallback() {
        if (!this.#optionsProvidedByHost) this.#options = normalizeOptions(readOptionsFromMarkup(this))
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
        this.#selectedOptions = []
        this.#input.value = ''
        this.#syncFormValue()
        this.#renderSelectedTags()
        this.#close()
    }

    /**
     * Keep the Web Awesome input disabled when its form disables the control.
     *
     * @param {boolean} disabled - Form-associated disabled state.
     */
    formDisabledCallback(disabled) {
        this.#formDisabled = disabled
        this.#input.disabled = disabled || this.disabled
        this.#disclosureButton.disabled = disabled || this.disabled
        this.#renderSelectedTags()
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
            this.#closeSelectedOptions()
        }
        if (name === 'multiple' && oldValue !== newValue) {
            if (newValue !== null) {
                if (this.#selectedOption) this.#selectedOptions = [this.#selectedOption]
                this.#selectedOption = null
                this.#input.value = ''
            } else {
                this.#selectedOption = this.#selectedOptions[0] ?? null
                this.#selectedOptions = []
                this.#input.value = this.#selectedOption?.label ?? ''
            }
            this.#syncFormValue()
            this.#renderSelectedTags()
            this.#renderOptions()
        }
        if (name === 'max-options-visible') this.#renderSelectedTags()
        if (name === 'name') this.#syncFormValue()
        if (name === 'icon-position') {
            this.#renderOptions()
            this.#renderSelectedTags()
        }
        if (name === 'page-size' && oldValue !== newValue) {
            this.#page = 1
            this.#renderOptions()
        }
        if (name === 'max-results' && oldValue !== newValue && this.#isOpen()) {
            this.#search(this.#input.value ?? '')
        }
        this.#syncAttributes()
    }

    /**
     * Set the static options list, replacing any wa-option children declared in markup.
     *
     * @param {AutocompleteOption[]} options - Available suggestions.
     */
    set options(options) {
        const normalizedOptions = normalizeOptions(options)
        this.#optionsProvidedByHost = true
        this.#options = normalizedOptions
        if (!this.#searchOptions && this.multiple && this.#selectedOptions.length) {
            this.#selectedOptions = this.#selectedOptions.map(selectedOption => this.#options.find(option => String(option.value) === String(selectedOption.value)) ?? selectedOption)
            this.#syncFormValue()
            this.#renderSelectedTags()
        } else if (!this.#searchOptions && this.#selectedOption) {
            const selectedOption = this.#options.find(option => String(option.value) === String(this.#selectedOption.value))
            this.#selectedOption = selectedOption ?? null
            this.#input.value = selectedOption?.label ?? ''
            this.#syncFormValue()
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
        this.#showAllOptions = false
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
     * @param {{id?: string, group?: string, limit?: number, count?: number}|null} persistence - Storage id or shared group and recent item limit.
     */
    set persistence(persistence) {
        if (persistence === null || persistence === undefined) {
            this.#persistence = null
            this.#recentOptions = []
            if (this.#isOpen()) this.#search(this.#input.value ?? '')
            return
        }
        if (!persistence || typeof persistence !== 'object' || Array.isArray(persistence)) {
            throw new TypeError('persistence must be null or an object with an id or group')
        }

        const id = persistence.id
        const group = persistence.group
        if (id !== undefined && (typeof id !== 'string' || !id.trim())) {
            throw new TypeError('persistence.id must be a non-empty string')
        }
        if (group !== undefined && (typeof group !== 'string' || !group.trim())) {
            throw new TypeError('persistence.group must be a non-empty string')
        }
        if (!id?.trim() && !group?.trim()) {
            throw new TypeError('persistence must include a non-empty id or group')
        }

        const limit = persistence.limit ?? persistence.count
        if (!Number.isInteger(limit) || limit < 1) {
            throw new TypeError('persistence.limit must be a positive integer')
        }

        this.#persistence = {
            ...(id ? {id: id.trim()} : {}),
            ...(group ? {group: group.trim()} : {}),
            limit,
        }
        this.#loadRecentOptions()
        if (this.#isOpen()) this.#search(this.#input.value ?? '')
    }

    /**
     * Get the current browser persistence configuration.
     *
     * @returns {{id?: string, group?: string, limit: number}|null} Current persistence configuration.
     */
    get persistence() {
        return this.#persistence ? {...this.#persistence} : null
    }

    /**
     * Set the selected option value or values by matching the current options.
     *
     * @param {string|number|(string|number)[]} value - Value or values to select.
     */
    set value(value) {
        const availableOptions = [...this.#options, ...this.#results, ...this.#selectedOptions]
        if (this.multiple) {
            const values = Array.isArray(value) ? value : value === '' || value === null || value === undefined ? [] : [value]
            this.#selectedOptions = values.reduce((selected, selectedValue) => {
                const option = availableOptions.find(item => String(item.value) === String(selectedValue))
                if (option && !selected.some(item => String(item.value) === String(option.value))) selected.push(option)
                return selected
            }, [])
            this.#syncFormValue()
            this.#renderSelectedTags()
            this.#renderOptions()
            return
        }

        const option = availableOptions.find(item => String(item.value) === String(value))
        if (option) this.#select(option, false)
        else {
            this.#selectedOption = null
            this.#input.value = ''
            this.#syncFormValue()
        }
    }

    /**
     * Get the selected raw value.
     *
     * @returns {string|number|(string|number)[]|''} Selected value, or an empty string.
     */
    get value() {
        if (this.multiple) return this.#selectedOptions.map(option => option.value)
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
     * @returns {AutocompleteOption|null} Single selected option, or null in multiple mode.
     */
    get selectedOption() {
        return this.multiple ? null : this.#selectedOption
    }

    /**
     * Get the selected options, including caller-owned metadata.
     *
     * @returns {AutocompleteOption[]} Selected options.
     */
    get selectedOptions() {
        return this.multiple ? [...this.#selectedOptions] : this.#selectedOption ? [this.#selectedOption] : []
    }

    /**
     * Get whether multiple options can be selected.
     *
     * @returns {boolean} Whether multiple selection is enabled.
     */
    get multiple() {
        return this.hasAttribute('multiple')
    }

    /**
     * Set whether multiple options can be selected.
     *
     * @param {boolean} value - Whether multiple selection is enabled.
     */
    set multiple(value) {
        this.toggleAttribute('multiple', Boolean(value))
    }

    /**
     * Get the maximum number of selected tags shown before a count is displayed.
     *
     * @returns {number} Visible tag limit. Defaults to 5; zero shows all tags.
     */
    get maxOptionsVisible() {
        const value = Number(this.getAttribute('max-options-visible') ?? 5)
        return Number.isInteger(value) && value >= 0 ? value : 5
    }

    /**
     * Set the maximum number of selected tags shown before a count is displayed.
     *
     * @param {number} value - Non-negative visible tag limit; zero shows all tags.
     */
    set maxOptionsVisible(value) {
        const maxOptionsVisible = Number(value)
        this.setAttribute('max-options-visible', String(Number.isInteger(maxOptionsVisible) && maxOptionsVisible >= 0 ? maxOptionsVisible : 5))
    }

    /**
     * Get whether the autocomplete is disabled.
     *
     * @returns {boolean} Whether the disabled attribute is present.
     */
    get disabled() {
        return this.hasAttribute('disabled')
    }

    /**
     * Set whether the autocomplete is disabled.
     *
     * @param {boolean} value - Whether to disable the autocomplete.
     */
    set disabled(value) {
        this.toggleAttribute('disabled', Boolean(value))
    }

    /**
     * Get the form field name.
     *
     * @returns {string} Form field name.
     */
    get name() {
        return this.getAttribute('name') ?? ''
    }

    /**
     * Set the form field name.
     *
     * @param {string} value - Form field name.
     */
    set name(value) {
        this.setAttribute('name', value)
    }

    /**
     * Get whether the input clear button is enabled.
     *
     * @returns {boolean} Whether the clear button is enabled.
     */
    get withClear() {
        return this.hasAttribute('with-clear')
    }

    /**
     * Set whether the input clear button is enabled.
     *
     * @param {boolean} value - Whether the clear button is enabled.
     */
    set withClear(value) {
        this.toggleAttribute('with-clear', Boolean(value))
    }

    /**
     * Get the Web Awesome input size.
     *
     * @returns {'xs'|'s'|'m'|'l'|'xl'|'small'|'medium'|'large'} Input size.
     */
    get size() {
        return this.getAttribute('size') ?? 'm'
    }

    /**
     * Set the Web Awesome input size.
     *
     * @param {'xs'|'s'|'m'|'l'|'xl'|'small'|'medium'|'large'|''} value - Input size, or an empty string to use the Web Awesome default.
     */
    set size(value) {
        if (value) this.setAttribute('size', value)
        else this.removeAttribute('size')
    }

    /**
     * Get the Web Awesome input appearance.
     *
     * @returns {'filled'|'outlined'|'filled-outlined'} Input appearance.
     */
    get appearance() {
        return this.getAttribute('appearance') ?? 'outlined'
    }

    /**
     * Set the Web Awesome input appearance.
     *
     * @param {'filled'|'outlined'|'filled-outlined'|''} value - Input appearance, or an empty string to use the Web Awesome default.
     */
    set appearance(value) {
        if (value) this.setAttribute('appearance', value)
        else this.removeAttribute('appearance')
    }

    /**
     * Get whether the input uses pill styling.
     *
     * @returns {boolean} Whether pill styling is enabled.
     */
    get pill() {
        return this.hasAttribute('pill')
    }

    /**
     * Set whether the input uses pill styling.
     *
     * @param {boolean} value - Whether pill styling is enabled.
     */
    set pill(value) {
        this.toggleAttribute('pill', Boolean(value))
    }

    /**
     * Get the input hint.
     *
     * @returns {string} Hint text.
     */
    get hint() {
        return this.getAttribute('hint') ?? ''
    }

    /**
     * Set the input hint.
     *
     * @param {string} value - Hint text.
     */
    set hint(value) {
        this.setAttribute('hint', value)
    }

    /**
     * Get whether the input is read-only.
     *
     * @returns {boolean} Whether the input is read-only.
     */
    get readonly() {
        return this.hasAttribute('readonly')
    }

    /**
     * Set whether the input is read-only.
     *
     * @param {boolean} value - Whether the input is read-only.
     */
    set readonly(value) {
        this.toggleAttribute('readonly', Boolean(value))
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
     * Set the icon placement for suggestions and selected tags.
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
        const value = Number(this.getAttribute('min-chars') ?? 1)
        return Number.isFinite(value) && value >= 0 ? value : 1
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
     * Get the number of suggestions displayed on each page.
     *
     * @returns {number} Suggestion page size. Defaults to 10.
     */
    get pageSize() {
        const value = Number(this.getAttribute('page-size') ?? 10)
        return Number.isInteger(value) && value > 0 ? value : 10
    }

    /**
     * Set the number of suggestions displayed on each page.
     *
     * @param {number} value - Positive number of suggestions per page.
     */
    set pageSize(value) {
        const pageSize = Number(value)
        this.setAttribute('page-size', String(Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10))
    }

    /**
     * Get the maximum number of suggestions retained from a search response.
     *
     * @returns {number} Maximum suggestion count. Defaults to 50.
     */
    get maxResults() {
        const value = Number(this.getAttribute('max-results') ?? 50)
        return Number.isInteger(value) && value > 0 ? value : 50
    }

    /**
     * Set the maximum number of suggestions retained from a search response.
     *
     * @param {number} value - Positive maximum suggestion count.
     */
    set maxResults(value) {
        const maxResults = Number(value)
        this.setAttribute('max-results', String(Number.isInteger(maxResults) && maxResults > 0 ? maxResults : 50))
    }

    /**
     * Synchronize attributes supported by the public custom element.
     */
    #syncAttributes() {
        this.#input.label = this.label
        this.#input.placeholder = this.placeholder
        this.#input.disabled = this.disabled
        this.#disclosureButton.disabled = this.disabled || this.#formDisabled
        this.#input.withClear = this.withClear && (!this.multiple || this.#selectedOptions.length === 0)
        this.#input.pill = this.pill
        this.#input.readonly = this.readonly
        this.#input.hint = this.hint
        if (this.hasAttribute('size')) this.#input.setAttribute('size', this.size)
        else this.#input.removeAttribute('size')
        if (this.hasAttribute('appearance')) this.#input.setAttribute('appearance', this.appearance)
        else this.#input.removeAttribute('appearance')
        this.#input.autocomplete = 'off'
        this.#input.classList.toggle('multiple', this.multiple)
        this.#input.classList.toggle('has-selection', this.multiple && this.#selectedOptions.length > 0)
        this.#renderSelectedTags()
        this.#syncAria()
    }

    /** Keep the form value in sync with the selected option or options. */
    #syncFormValue() {
        if (this.multiple) {
            if (!this.name || this.#selectedOptions.length === 0) {
                this.#internals.setFormValue(null)
                return
            }

            const formData = new FormData()
            this.#selectedOptions.forEach(option => formData.append(this.name, String(option.value)))
            this.#internals.setFormValue(formData)
            return
        }

        this.#internals.setFormValue(this.#selectedOption ? String(this.#selectedOption.value) : null)
    }

    /** Clear all values selected in multiple-selection mode. */
    #clearMultipleSelection() {
        this.#selectedOptions = []
        this.#closeSelectedOptions()
        this.#syncFormValue()
        this.#renderSelectedTags()
        this.#renderOptions()
    }

    /** Render removable Web Awesome tags for the current multiple selection. */
    #renderSelectedTags() {
        if (!this.#selectedTags) return

        this.#selectedTags.replaceChildren()
        this.#input.classList.toggle('has-selection', this.multiple && this.#selectedOptions.length > 0)
        this.#input.withClear = this.withClear && (!this.multiple || this.#selectedOptions.length === 0)
        this.#input.placeholder = this.multiple && this.#selectedOptions.length > 0 ? '' : this.placeholder
        if (!this.multiple || this.#selectedOptions.length === 0) {
            this.#selectedTags.hidden = true
            this.#selectedCountTag.hidden = true
            this.#clearSelectionButton.hidden = true
            this.#selectionActions.hidden = true
            this.#closeSelectedOptions()
            this.#selectedList.replaceChildren()
            this.#selectedPagination.total = 0
            this.#selectedPagination.page = 1
            this.#selectedPage = 1
            return
        }

        this.#selectedTags.hidden = false
        const visibleLimit = this.maxOptionsVisible
        const visibleOptions = visibleLimit === 0 ? this.#selectedOptions : this.#selectedOptions.slice(0, visibleLimit)
        visibleOptions.forEach(option => {
            const tag = document.createElement('wa-tag')
            tag.dataset.value = String(option.value)
            const icon = this.#createIcon(option.icon)
            if (icon && this.iconPosition === 'start') tag.append(icon, document.createTextNode(' '))
            tag.append(document.createTextNode(option.label))
            if (icon && this.iconPosition === 'end') tag.append(document.createTextNode(' '), icon)
            if (!this.disabled && !this.#formDisabled) tag.setAttribute('with-remove', '')
            this.#selectedTags.append(tag)
        })

        const hiddenCount = this.#selectedOptions.length - visibleOptions.length
        this.#selectedCountTag.hidden = hiddenCount === 0
        this.#selectedCountTag.tabIndex = this.disabled || this.#formDisabled ? -1 : 0
        this.#selectedCountTag.setAttribute('aria-disabled', String(this.disabled || this.#formDisabled))
        this.#selectedCountTag.setAttribute('aria-expanded', String(this.#selectedPopup.active && hiddenCount > 0))
        if (hiddenCount > 0) {
            this.#selectedCountTag.textContent = '+' + hiddenCount
            this.#selectedCountTag.setAttribute('aria-label', `Show selected options (${this.#selectedOptions.length} total)`)
        }
        this.#clearSelectionButton.hidden = !this.withClear || this.disabled || this.#formDisabled
        this.#selectionActions.hidden = this.#selectedCountTag.hidden && this.#clearSelectionButton.hidden
        if (hiddenCount === 0 || this.disabled || this.#formDisabled) this.#closeSelectedOptions()
        else if (this.#selectedPopup.active) this.#renderSelectedOptions()
    }

    /** Render a page of selected options in the expandable selection popup. */
    #renderSelectedOptions() {
        this.#selectedList.replaceChildren()
        const pageCount = Math.max(1, Math.ceil(this.#selectedOptions.length / selectedOptionsPageSize))
        this.#selectedPage = Math.min(this.#selectedPage, pageCount)
        this.#selectedPagination.pageSize = selectedOptionsPageSize
        this.#selectedPagination.total = this.#selectedOptions.length
        this.#selectedPagination.page = this.#selectedPage
        this.#selectedPagination.hidden = this.#selectedOptions.length <= selectedOptionsPageSize

        const pageOffset = (this.#selectedPage - 1) * selectedOptionsPageSize
        this.#selectedOptions.slice(pageOffset, pageOffset + selectedOptionsPageSize).forEach(option => {
            const tag = document.createElement('wa-tag')
            tag.dataset.value = String(option.value)
            tag.setAttribute('role', 'listitem')
            const icon = this.#createIcon(option.icon)
            if (icon && this.iconPosition === 'start') tag.append(icon, document.createTextNode(' '))
            tag.append(document.createTextNode(option.label))
            if (icon && this.iconPosition === 'end') tag.append(document.createTextNode(' '), icon)
            if (!this.disabled && !this.#formDisabled) tag.setAttribute('with-remove', '')
            this.#selectedList.append(tag)
        })
    }

    /** Close the expandable selected options popup. */
    #closeSelectedOptions() {
        if (!this.#selectedPopup) return
        this.#selectedPopup.active = false
        this.#selectedCountTag?.setAttribute('aria-expanded', 'false')
    }

    /** Check whether an option is currently selected. */
    #isSelected(option) {
        if (this.multiple) return this.#selectedOptions.some(selected => String(selected.value) === String(option.value))
        return String(this.#selectedOption?.value) === String(option.value)
    }

    /**
     * Set combobox semantics on Web Awesome's native input element.
     */
    #syncAria() {
        const recentListCanExpand = this.#isOpen()
            && !this.#showAllOptions
            && !this.#searchOptions
            && this.#options.length > 0
            && !(this.#input.value ?? '').trim()
            && this.#recentOptions.length > 0
        const fullListVisible = this.#isOpen() && !recentListCanExpand
        this.#disclosureButton.setAttribute('aria-controls', this.#listbox.id)
        this.#disclosureButton.setAttribute('aria-expanded', String(this.#isOpen()))
        this.#disclosureButton.setAttribute('aria-label', recentListCanExpand ? 'Show all options' : this.#isOpen() ? 'Hide options' : 'Show options')
        this.#disclosureIcon.setAttribute('name', fullListVisible ? 'chevron-up' : 'chevron-down')
        const input = this.#input.input
        if (!input) return
        input.setAttribute('role', 'combobox')
        input.setAttribute('aria-autocomplete', 'list')
        input.setAttribute('aria-haspopup', 'listbox')
        input.setAttribute('aria-controls', this.#listbox.id)
        input.setAttribute('aria-expanded', String(this.#isOpen()))
        this.#listbox.setAttribute('aria-multiselectable', String(this.multiple))
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
        if (query.trim() !== '' || !this.#showAllOptions || this.#searchOptions) this.#page = 1

        if (this.#showAllOptions && !this.#searchOptions) {
            this.#results = [...this.#options]
            this.#activeIndex = -1
            if (this.#results.length) {
                this.#open()
                this.#renderOptions()
            } else {
                this.#close()
                this.#renderOptions()
            }
            this.#setMessage('')
            return
        }

        if (query.trim() === '') {
            // Recent selections are the only suggestions shown before the user enters a query.
            if (this.#persistence) {
                this.#loadRecentOptions()
                if (this.#recentOptions.length) {
                    this.#results = this.#recentOptions
                        .map(recent => this.#options.find(option => String(option.value) === String(recent.value)) ?? recent)
                        .slice(0, this.maxResults)
                    this.#activeIndex = -1
                    this.#open()
                    this.#renderOptions()
                    this.#setMessage('Recently used')
                    return
                }
            }

            this.#results = []
            this.#close()
            this.#renderOptions()
            this.#setMessage('')
            return
        }

        this.#open()

        if (!this.#searchOptions) {
            const normalizedQuery = query.trim().toLocaleLowerCase()
            this.#results = this.#options.filter(option => getSearchText(option).includes(normalizedQuery)).slice(0, this.maxResults)
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
                this.#results = normalizeOptions(result).slice(0, this.maxResults)
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
        const pageCount = Math.max(1, Math.ceil(this.#results.length / this.pageSize))
        this.#page = Math.min(this.#page, pageCount)
        this.#pagination.pageSize = this.pageSize
        this.#pagination.total = this.#results.length
        this.#pagination.page = this.#page
        this.#pagination.hidden = this.#results.length <= this.pageSize

        const pageOffset = (this.#page - 1) * this.pageSize
        this.#results.slice(pageOffset, pageOffset + this.pageSize).forEach((option, pageIndex) => {
            const index = pageOffset + pageIndex
            const element = document.createElement('div')
            element.id = `${this.#listbox.id}-option-${index}`
            element.className = 'option'
            element.dataset.index = String(index)
            element.setAttribute('role', 'option')
            element.setAttribute('aria-selected', String(this.#isSelected(option)))
            element.dataset.active = String(index === this.#activeIndex)

            const label = document.createElement('span')
            label.className = 'option-label'
            this.#renderHighlightedLabel(label, option.label)

            const icon = this.#createIcon(option.icon)
            if (icon && this.iconPosition === 'start') element.append(icon)
            element.append(label)
            if (icon && this.iconPosition === 'end') element.append(icon)
            this.#listbox.append(element)
        })
        this.#syncAria()
    }

    /**
     * Highlight the current query inside a suggestion label using safe text nodes.
     *
     * @param {HTMLElement} label - Suggestion label element.
     * @param {string} text - Plain option label.
     */
    #renderHighlightedLabel(label, text) {
        const query = this.#showAllOptions ? '' : (this.#input.value ?? '').trim()
        const labelOffset = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1

        if (labelOffset < 0) {
            label.textContent = text
            return
        }

        const matchEnd = labelOffset + query.length
        const match = document.createElement('mark')
        match.className = 'option-match'
        match.textContent = text.slice(labelOffset, matchEnd)
        label.append(
            document.createTextNode(text.slice(0, labelOffset)),
            match,
            document.createTextNode(text.slice(matchEnd)),
        )
    }

    /**
     * Create an optional Web Awesome icon or decorative image from an option value.
     *
     * @param {AutocompleteOption['icon']} iconValue - Public icon definition.
     * @returns {HTMLElement|null} Web Awesome icon or image element.
     */
    #createIcon(iconValue) {
        if (!iconValue) return null

        const imageSource = typeof iconValue === 'string'
            ? isImageIconSource(iconValue) ? iconValue : null
            : iconValue.src ?? null

        if (imageSource) {
            const image = document.createElement('img')
            image.alt = ''
            image.draggable = false
            image.decoding = 'async'
            image.setAttribute('aria-hidden', 'true')
            image.className = 'option-icon option-icon-image'
            const fallback = typeof iconValue === 'object' ? iconValue.fallback : null
            if (fallback) {
                image.addEventListener('error', () => {
                    const fallbackElement = document.createElement('span')
                    fallbackElement.className = 'option-icon option-icon-fallback'
                    fallbackElement.textContent = fallback
                    fallbackElement.setAttribute('aria-hidden', 'true')
                    image.replaceWith(fallbackElement)
                }, {once: true})
            }
            image.src = imageSource
            return image
        }

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
        if (this.#activeIndex >= 0) this.#page = Math.floor(this.#activeIndex / this.pageSize) + 1
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

        if (this.multiple) {
            const selectedIndex = this.#selectedOptions.findIndex(selected => String(selected.value) === String(option.value))
            const selected = selectedIndex < 0
            this.#selectedOptions = selected
                ? [...this.#selectedOptions, option]
                : this.#selectedOptions.filter(item => String(item.value) !== String(option.value))
            this.#syncFormValue()
            this.#renderSelectedTags()
            if (selected) {
                if (notify) this.#rememberOption(option)
                // Keep the selected value while clearing the transient query for the next choice.
                this.#input.value = ''
                this.#search('')
            } else {
                this.#renderOptions()
            }
            if (!notify) return

            const detail = {option, value: this.value, label: option.label, selectedOptions: this.selectedOptions}
            this.#dispatch(selected ? 'wa-select' : 'wa-deselect', detail)
            this.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
            return
        }

        this.#selectedOption = option
        this.#selectedOptions = []
        this.#input.value = option.label
        this.#syncFormValue()
        this.#renderSelectedTags()
        this.#close()
        if (!notify) return

        this.#rememberOption(option)
        const detail = {option, value: option.value, label: option.label, selectedOptions: this.selectedOptions}
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
        this.#showAllOptions = false
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
        const {id, group, limit} = this.#persistence

        try {
            const stored = window.localStorage.getItem(this.#getStorageKey({id, group}))
            const options = stored === null ? [] : normalizeOptions(JSON.parse(stored))
            const uniqueOptions = options.filter((option, index, all) => all.findIndex(item => String(item.value) === String(option.value)) === index)
            this.#recentOptions = uniqueOptions.slice(0, limit)
            if (this.#recentOptions.length !== uniqueOptions.length) this.#saveRecentOptions()
        } catch (error) {
            this.#recentOptions = []
            this.#dispatch('wa-persistence-error', {error, action: 'read', id: id ?? group, ...(group ? {group} : {})})
        }
    }

    /**
     * Add a user-selected option to the most-recently-used list.
     *
     * @param {AutocompleteOption} option - Selected suggestion.
     */
    #rememberOption(option) {
        if (!this.#persistence) return
        this.#loadRecentOptions()
        const {limit} = this.#persistence
        this.#recentOptions = [option, ...this.#recentOptions.filter(item => String(item.value) !== String(option.value))].slice(0, limit)
        this.#saveRecentOptions()
    }

    /**
     * Write recent options to localStorage without interrupting selection.
     */
    #saveRecentOptions() {
        if (!this.#persistence) return
        const {id, group} = this.#persistence

        try {
            window.localStorage.setItem(this.#getStorageKey({id, group}), JSON.stringify(this.#recentOptions))
        } catch (error) {
            this.#dispatch('wa-persistence-error', {error, action: 'write', id: id ?? group, ...(group ? {group} : {})})
        }
    }

    /**
     * Create the namespaced localStorage key for a persistence id or shared group.
     *
     * @param {{id?: string, group?: string}} persistence - Consumer-provided persistence scope.
     * @returns {string} Storage key.
     */
    #getStorageKey({id, group}) {
        if (group) return `lgs1920-autocomplete:group:${encodeURIComponent(group)}`
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
