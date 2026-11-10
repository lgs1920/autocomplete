import {describe, expect, it} from 'bun:test'
import {findOptionTemplateById, interpolateOptionTemplateText} from '../src/option-template.js'

describe('interpolateOptionTemplateText', () => {
    it('interpolates primitive values from nested option metadata', () => {
        expect(interpolateOptionTemplateText('{{city}} · {{address.region}} ({{population}})', {
            city: 'Paris',
            address: {region: 'Île-de-France'},
            population: 2_100_000,
        })).toBe('Paris · Île-de-France (2100000)')
    })

    it('uses plain strings and blanks for missing or non-primitive values', () => {
        const hostileText = '<img src=x onerror=alert(1)>'
        expect(interpolateOptionTemplateText('{{city}} {{missing}} {{metadata}}', {
            city: hostileText,
            metadata: {value: 'not rendered'},
        })).toBe(`${hostileText}  `)
    })

    it('does not resolve inherited option properties', () => {
        const option = Object.assign(Object.create({secret: 'inherited'}), {label: 'Visible'})
        expect(interpolateOptionTemplateText('{{label}} {{secret}}', option)).toBe('Visible ')
    })
})

describe('findOptionTemplateById', () => {
    it('returns a template element with matching document ID', () => {
        const template = {localName: 'template', content: {nodeType: 11}}
        const document = {getElementById: id => id === 'city-template' ? template : null}
        expect(findOptionTemplateById(document, ' city-template ')).toBe(template)
    })

    it('rejects missing IDs and elements that are not templates', () => {
        const document = {
            getElementById: id => id === 'wrong-element'
                ? {localName: 'div', content: {nodeType: 11}}
                : null,
        }
        expect(findOptionTemplateById(document, null)).toBeNull()
        expect(findOptionTemplateById(document, 'missing')).toBeNull()
        expect(findOptionTemplateById(document, 'wrong-element')).toBeNull()
    })
})
