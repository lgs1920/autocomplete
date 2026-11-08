/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: build-demo.mjs
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
const outputRoot = resolve(projectRoot, 'demo/src/assets')

/**
 * Build a demo asset with Bun.
 *
 * @param {string} entryPoint - Source entry file.
 * @param {string} outputName - Generated asset name.
 * @param {object} [options={}] - Bun build options.
 * @returns {Promise<void>} Resolves when the asset is written.
 */
const buildAsset = async (entryPoint, outputName, options = {}) => {
    const result = await Bun.build({
        entrypoints: [resolve(projectRoot, entryPoint)],
        outfile: resolve(outputRoot, outputName),
        target: 'browser',
        format: 'esm',
        minify: false,
        sourcemap: 'inline',
        write: false,
        ...options,
    })

    if (!result.success) {
        result.logs.forEach(log => console.error(log))
        throw new Error(`Unable to build demo asset: ${entryPoint}`)
    }

    await Bun.write(resolve(outputRoot, outputName), result.outputs[0])
}

await rm(outputRoot, {recursive: true, force: true})
await mkdir(outputRoot, {recursive: true})
await buildAsset('demo/src/app.js', 'app.bundle.js', {
    alias: {'@lgs1920/autocomplete': resolve(projectRoot, 'dist/index.js')},
})
await buildAsset('demo/webawesome.css', 'webawesome.css')
await Bun.write(resolve(outputRoot, 'styles.css'), Bun.file(resolve(projectRoot, 'demo/src/styles.css')))
