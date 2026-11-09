/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: serve-demo.mjs
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

import {resolve, sep} from 'node:path'

const port = 4177
const demoRoot = resolve(import.meta.dir, '../demo/dist')

/**
 * Serve only the generated static demo on its permanently assigned port.
 *
 * @param {Request} request - Incoming browser request.
 * @returns {Promise<Response>} Static file response.
 */
const serveFile = async request => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    let relativePath = pathname.replace(/^\/+/, '')
    if (pathname === '/') relativePath = 'index.html'
    else if (pathname.endsWith('/')) relativePath += 'index.html'
    const filePath = resolve(demoRoot, relativePath)
    if (filePath !== demoRoot && !filePath.startsWith(`${demoRoot}${sep}`)) {
        return new Response('Not found', {status: 404})
    }

    const file = Bun.file(filePath)
    if (!await file.exists()) return new Response('Not found', {status: 404})
    return new Response(file)
}

const server = Bun.serve({hostname: '127.0.0.1', port, fetch: serveFile})
console.log(`Autocomplete demo available at ${server.url}`)
