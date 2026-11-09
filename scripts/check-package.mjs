/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: check-package.mjs
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

import {resolve} from 'node:path'

const projectRoot = resolve(import.meta.dir, '..')
const result = await Bun.build({
    entrypoints: [resolve(projectRoot, 'demo/src/app.js')],
    target: 'browser',
    format: 'esm',
    write: false,
    external: ['@awesome.me/webawesome/*'],
    alias: {'@lgs1920/autocomplete': resolve(projectRoot, 'dist/index.js')},
    define: {'process.env.NODE_ENV': '"production"'},
})

if (!result.success) {
    result.logs.forEach(log => console.error(log))
    throw new Error('A consumer cannot bundle the published autocomplete entry point')
}

const consumerBundle = result.outputs.find(output => output.path.endsWith('.js'))
if (!consumerBundle) throw new Error('The consumer bundle does not contain a JavaScript entry point')

const consumerSource = await consumerBundle.text()
const compactPaginationCount = [...consumerSource.matchAll(/format="compact"/g)].length
if (compactPaginationCount !== 2) {
    throw new Error('Suggestion and selected-option pagination must both use compact controls')
}

if (!consumerSource.includes('this.#showAllOptions = true') || !consumerSource.includes('Show all options') || !consumerSource.includes('chevron-up')) {
    throw new Error('The disclosure chevron must expand recent suggestions to the complete local list')
}

const componentStyles = await Bun.file(resolve(projectRoot, 'src/autocomplete.css')).text()
if (!/\.pagination,\s*\.selected-pagination\s*\{\s*display:\s*block;\s*inline-size:\s*100%;/u.test(componentStyles)) {
    throw new Error('Pagination controls must occupy the full width of their panel')
}
