/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: eleventy.config.cjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-08
 * Last modified: 2026-11-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Configure the static component demonstration site.
 *
 * @param {object} eleventyConfig - Eleventy configuration API.
 * @returns {object} Eleventy directory configuration.
 */
const configureDemo = eleventyConfig => {
    eleventyConfig.addGlobalData('packageVersion', require('./package.json').version)
    eleventyConfig.addPassthroughCopy({'demo/src/assets/styles.css': 'assets/styles.css'})
    eleventyConfig.addPassthroughCopy({'demo/src/assets/app.bundle.js': 'assets/app.bundle.js'})
    eleventyConfig.addPassthroughCopy({'demo/src/assets/webawesome.css': 'assets/webawesome.css'})
    eleventyConfig.addPassthroughCopy({'demo/icons': 'icons'})
    return {
        dir: {input: 'demo/src', output: 'demo/dist'},
        templateFormats: ['njk'],
    }
}

module.exports = configureDemo
