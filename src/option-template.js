/**
 * Resolve a dot-separated path through an option's own properties.
 *
 * @param {object} option - Option data.
 * @param {string} path - Property path from a template placeholder.
 * @returns {string} Safe textual value, or an empty string for unsupported values.
 */
const getTemplateValue = (option, path) => {
    let value = option
    for (const part of path.split('.')) {
        if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return ''
        value = value[part]
    }
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : ''
}

/**
 * Interpolate placeholders in a template text node.
 *
 * @param {string} text - Source text containing `{{field}}` placeholders.
 * @param {object} option - Option data for placeholder values.
 * @returns {string} Text with supported placeholders replaced.
 */
export const interpolateOptionTemplateText = (text, option) => text.replace(
    /{{\s*([\w$]+(?:\.[\w$]+)*)\s*}}/g,
    (placeholder, path) => getTemplateValue(option, path),
)

/**
 * Find an HTML template by its ID in the supplied document.
 *
 * @param {Document} document - Document containing the template.
 * @param {string|null} templateId - Template ID from the host attribute.
 * @returns {HTMLTemplateElement|null} Matching template, or null when the ID is missing or invalid.
 */
export const findOptionTemplateById = (document, templateId) => {
    const id = templateId?.trim()
    if (!id) return null
    const template = document.getElementById(id)
    return template?.localName === 'template' && template.content?.nodeType === 11
        ? template
        : null
}
