import {describe, expect, it} from 'bun:test'
import {readOptionsFromMarkup} from '../src/options-from-markup.js'

/** Create an option-like fixture for the markup parser. */
const createOption = ({localName = 'wa-option', attributes = {}, textContent = ''} = {}) => ({
    localName,
    attributes: Object.entries(attributes).map(([name, value]) => ({name, value})),
    getAttribute: name => attributes[name] ?? null,
    textContent,
})

describe('readOptionsFromMarkup', () => {
    it('maps direct wa-option children and preserves data attributes as metadata', () => {
        const options = readOptionsFromMarkup({
            children: [
                createOption({
                    attributes: {
                        value: 'paris',
                        'data-icon': 'location-dot',
                        'data-department': '75',
                        'data-region': 'Île-de-France',
                    },
                    textContent: ' Paris ',
                }),
                createOption({
                    attributes: {value: 'reims', label: 'Reims', 'data-country-code': 'FR'},
                    textContent: 'Ignored fallback',
                }),
                createOption({localName: 'wa-icon', attributes: {name: 'magnifying-glass'}}),
            ],
        })

        expect(options).toEqual([
            {value: 'paris', label: 'Paris', icon: 'location-dot', department: '75', region: 'Île-de-France'},
            {value: 'reims', label: 'Reims', countryCode: 'FR'},
        ])
    })

    it('returns an empty list when no wa-option children are present', () => {
        expect(readOptionsFromMarkup({children: []})).toEqual([])
    })
})
