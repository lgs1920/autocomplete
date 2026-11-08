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
