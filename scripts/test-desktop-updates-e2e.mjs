import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const apiPort = Number(process.env.APP_API_DESKTOP_TEST_PORT || 23000 + Math.floor(Math.random() * 10000))
const updatesDir = await mkdtemp(path.join(os.tmpdir(), 'app-desktop-updates-'))
const artifactName = 'Login Desktop.app.tar.gz'
const artifactBody = 'signed desktop artifact'

const apiProcess = {
    child: null,
}

async function main() {
    try {
        await startApi()
        await waitForPort(apiPort)

        const empty = await fetchRaw('/api/desktop/darwin-aarch64/0.1.1')
        assertStatus(empty, 204, 'empty update directory should return no update')

        await writeFile(path.join(updatesDir, artifactName), artifactBody)
        await writeFile(path.join(updatesDir, 'latest.json'), JSON.stringify({
            version: '0.1.2',
            notes: 'Desktop update test',
            pub_date: '2026-04-26T00:00:00.000Z',
            platforms: {
                'darwin-aarch64': {
                    signature: 'test-signature',
                    file: artifactName,
                },
                'linux-x86_64': {
                    signature: 'linux-signature',
                    url: 'https://downloads.example.com/login-desktop-linux.tar.gz',
                },
            },
        }, null, 2))

        const current = await fetchRaw('/api/desktop/darwin-aarch64/0.1.2')
        assertStatus(current, 204, 'current client should not receive same-version update')

        const newer = await fetchJson('/api/desktop/darwin-aarch64/0.1.1')
        assertEqual(newer.version, '0.1.2', 'newer manifest version')
        assertEqual(Object.keys(newer.platforms).join(','), 'darwin-aarch64', 'platform-filtered manifest')
        assertEqual(
            newer.platforms['darwin-aarch64'].url,
            `https://updates.example.test/api/desktop/download/${encodeURIComponent(artifactName)}`,
            'relative update file should normalize to public download URL',
        )

        const fullManifest = await fetchJson('/api/desktop')
        assertEqual(
            fullManifest.platforms['linux-x86_64'].url,
            'https://downloads.example.com/login-desktop-linux.tar.gz',
            'absolute update URLs should be preserved',
        )

        const artifact = await fetchRaw(`/api/desktop/download/${encodeURIComponent(artifactName)}`)
        assertStatus(artifact, 200, 'artifact download status')
        assertEqual(await artifact.text(), artifactBody, 'artifact download body')

        const missing = await fetchRaw('/api/desktop/download/missing.tar.gz')
        assertStatus(missing, 404, 'missing artifact status')

        console.log(JSON.stringify({
            ok: true,
            manifestVersion: newer.version,
            downloadUrl: newer.platforms['darwin-aarch64'].url,
        }, null, 2))
    } finally {
        if (apiProcess.child) {
            apiProcess.child.kill('SIGTERM')
        }
        await rm(updatesDir, { recursive: true, force: true })
    }
}

async function startApi() {
    apiProcess.child = spawn('bun', ['src/index.ts'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: String(apiPort),
            APP_API_PUBLIC_URL: 'https://updates.example.test',
            APP_API_DESKTOP_UPDATES_DIR: updatesDir,
            APP_API_SCHEDULER_INTERVAL_MS: '60000',
        },
        stdio: 'inherit',
    })
}

async function fetchJson(pathname) {
    const response = await fetchRaw(pathname)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`)
    }
    return payload
}

function fetchRaw(pathname) {
    return fetch(`http://127.0.0.1:${apiPort}${pathname}`)
}

function assertStatus(response, expected, label) {
    if (response.status !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${response.status}`)
    }
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
}

function waitForPort(port) {
    return waitFor(async () => {
        return await new Promise((resolve) => {
            const socket = net.connect(port, '127.0.0.1')
            socket.once('connect', () => {
                socket.destroy()
                resolve(true)
            })
            socket.once('error', () => {
                socket.destroy()
                resolve(false)
            })
        })
    }, 20000)
}

async function waitFor(check, timeoutMs) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        if (await check()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error('Timed out waiting for condition')
}

await main()
