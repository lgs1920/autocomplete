/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: build.mjs
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

import {mkdir, rm} from 'node:fs/promises'
import {resolve} from 'node:path'

const projectRoot = resolve(import.meta.dir, '..')
const outputRoot = resolve(projectRoot, 'dist')
const inlineCssPaths = new Map()

/**
 * Inline component CSS so it can be attached to the custom element shadow root.
 *
 * @returns {object} Bun CSS import plugin.
 */
const createInlineCssPlugin = () => ({
    name: 'inline-component-css',
    /**
     * Register the inline CSS loader.
     *
     * @param {object} build - Bun build plugin API.
     */
    setup(build) {
        build.onResolve({filter: /\.css\?inline$/}, argumentsValue => {
            const filePath = resolve(argumentsValue.resolveDir, argumentsValue.path.replace('?inline', ''))
            inlineCssPaths.set('autocomplete.css', filePath)
            return {path: 'autocomplete.css', namespace: 'inline-component-css'}
        })
        build.onLoad({filter: /.*/, namespace: 'inline-component-css'}, async argumentsValue => ({
            contents: `export default ${JSON.stringify(await Bun.file(inlineCssPaths.get(argumentsValue.path)).text())}`,
            loader: 'js',
        }))
    },
})

await rm(outputRoot, {recursive: true, force: true})
await mkdir(outputRoot, {recursive: true})
const result = await Bun.build({
    entrypoints: [resolve(projectRoot, 'entries/index.js')],
    outdir: outputRoot,
    naming: 'index.js',
    target: 'browser',
    format: 'esm',
    minify: false,
    sourcemap: 'external',
    external: ['@awesome.me/webawesome/*'],
    plugins: [createInlineCssPlugin()],
})

if (!result.success) {
    result.logs.forEach(log => console.error(log))
    throw new Error('Unable to build the autocomplete package')
}

await Bun.write(resolve(outputRoot, 'styles.css'), Bun.file(resolve(projectRoot, 'src/autocomplete.css')))
