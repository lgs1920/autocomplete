/*******************************************************************************
 *
 * This file is part of the LGS1920/autocomplete project.
 *
 * File: stop-demo-server.mjs
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

const port = 4177
const isWindows = process.platform === 'win32'

/**
 * Run a system command and return its output.
 * @param {string} command System command to run.
 * @param {string[]} commandArguments Arguments passed to the command.
 * @returns {{exitCode: number, stdout: string, stderr: string}} Command result.
 */
const runSync = (command, commandArguments) => {
    try {
        const result = Bun.spawnSync([command, ...commandArguments], {
            stdout: 'pipe',
            stderr: 'pipe',
        })

        return {
            exitCode: result.exitCode ?? 1,
            stdout: new TextDecoder().decode(result.stdout).trim(),
            stderr: new TextDecoder().decode(result.stderr).trim(),
        }
    } catch (error) {
        return {exitCode: 1, stdout: '', stderr: error.message}
    }
}

/**
 * Find processes listening on the demo port.
 * @returns {number[]} Listener process identifiers.
 */
const getListenerPids = () => {
    if (isWindows) {
        const result = runSync('netstat.exe', ['-ano', '-p', 'tcp'])
        if (result.exitCode !== 0) throw new Error(result.stderr || 'Unable to inspect TCP listeners.')

        return [...new Set(result.stdout.split(/\r?\n/)
            .filter(line => line.includes('LISTENING'))
            .map(line => line.trim().split(/\s+/))
            .filter(parts => parts[1]?.endsWith(`:${port}`))
            .map(parts => Number(parts.at(-1)))
            .filter(Number.isInteger))]
    }

    const ssResult = runSync('ss', ['-ltnp'])
    if (ssResult.exitCode === 0) {
        return [...new Set(ssResult.stdout.split('\n')
            .filter(line => line.includes('LISTEN') && line.includes(`:${port}`))
            .flatMap(line => [...line.matchAll(/pid=(\d+)/g)].map(([, pid]) => Number(pid))))]
    }

    const lsofResult = runSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'])
    if (lsofResult.exitCode === 0) {
        return [...new Set(lsofResult.stdout.split('\n').map(Number).filter(Number.isInteger))]
    }

    throw new Error(ssResult.stderr || lsofResult.stderr || 'Unable to inspect TCP listeners.')
}

/**
 * Get the command line for a process.
 * @param {number} pid Process identifier.
 * @returns {string} Process command line.
 */
const getProcessCommand = pid => {
    if (isWindows) {
        const result = runSync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`,
        ])

        if (result.exitCode !== 0) throw new Error(result.stderr || `Unable to inspect process ${pid}.`)
        return result.stdout
    }

    const result = runSync('ps', ['-p', String(pid), '-o', 'args='])
    if (result.exitCode !== 0) throw new Error(result.stderr || `Unable to inspect process ${pid}.`)
    return result.stdout
}

/**
 * Stop a demo server process and wait for its listener to close.
 * @param {number} pid Process identifier.
 * @returns {Promise<void>} Resolves when the process releases the demo port.
 */
const stopProcess = async pid => {
    if (isWindows) {
        const result = runSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'])
        if (result.exitCode !== 0) throw new Error(result.stderr || `Unable to stop demo server process ${pid}.`)
    } else {
        try {
            process.kill(pid, 'SIGTERM')
        } catch (error) {
            if (error.code !== 'ESRCH') throw error
        }
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (!getListenerPids().includes(pid)) return
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (!isWindows) process.kill(pid, 'SIGKILL')

    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (!getListenerPids().includes(pid)) return
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Demo server process ${pid} did not release port ${port}.`)
}

const listenerPids = getListenerPids()

for (const pid of listenerPids) {
    const command = getProcessCommand(pid)

    if (!/scripts[\\/]serve-demo\.mjs(?:\s|$)/i.test(command)) {
        console.error(`Port ${port} is used by another process (PID ${pid}); it was left running.`)
        process.exit(1)
    }

    await stopProcess(pid)
    console.log(`Stopped the previous demo server (PID ${pid}) on port ${port}.`)
}
