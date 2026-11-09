/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: options-from-markup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-09
 * Last modified: 2026-11-09
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Convert a data attribute name to the corresponding option metadata key. */
const toMetadataKey = attributeName => attributeName.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())

/**
 * Read direct child wa-option elements as the autocomplete's initial options.
 *
 * @param {HTMLElement} element - The autocomplete element containing option children.
 * @returns {Array<object>} Options mapped from values, labels, icons, and data attributes.
 */
export const readOptionsFromMarkup = element => Array.from(element.children)
    .filter(child => child.localName === 'wa-option')
    .map(option => {
        const metadata = Object.fromEntries(Array.from(option.attributes)
            .filter(attribute => attribute.name.startsWith('data-') && attribute.name !== 'data-icon')
            .map(attribute => [toMetadataKey(attribute.name), attribute.value]))
        const icon = option.getAttribute('data-icon')

        return {
            ...metadata,
            value: option.getAttribute('value'),
            label: option.getAttribute('label')?.trim() || option.textContent.trim(),
            ...(icon ? {icon} : {}),
        }
    })
