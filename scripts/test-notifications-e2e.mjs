import { spawn } from 'child_process'
import http from 'http'
import net from 'net'

const apiPort = 18088
const expoPort = 19090
const postgresPort = 55432
const adminToken = 'test-admin-token'
const containerName = `app-e2e-${Date.now()}`
const expoRequests = []

const expoServer = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
        body += chunk.toString()
    })
    req.on('end', () => {
        expoRequests.push({
            method: req.method,
            url: req.url,
            body: JSON.parse(body || '[]'),
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            data: (expoRequests.at(-1)?.body || []).map((_, index) => ({
                id: `ticket-${expoRequests.length}-${index}`,
                status: 'ok',
            })),
        }))
    })
})

const apiProcess = {
    child: null,
}

async function main() {
    await startExpoServer()
    try {
        await runCommand('docker', [
            'run',
            '-d',
            '--rm',
            '--name',
            containerName,
            '-e',
            'POSTGRES_PASSWORD=app',
            '-e',
            'POSTGRES_USER=app',
            '-e',
            'POSTGRES_DB=app',
            '-p',
            `${postgresPort}:5432`,
            'postgres:16-alpine',
        ])

        await waitForPort(postgresPort)
        await waitFor(async () => {
            try {
                await runCommand('docker', ['exec', containerName, 'pg_isready', '-U', 'app', '-d', 'app'])
                return true
            } catch {
                return false
            }
        }, 20000)
        await startApi()
        await waitForPort(apiPort)

        await fetchJson(`http://127.0.0.1:${apiPort}/api/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'ExpoPushToken[test-token]',
                topic: 'maintenance',
            }),
        })

        await fetchJson(`http://127.0.0.1:${apiPort}/api/notifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                title: 'Manual',
                body: 'Manual notification',
                topic: 'maintenance',
                data: { target: 'menu', screen: 'NotificationScreen' },
            }),
        })

        if (expoRequests.length !== 1) {
            throw new Error(`Expected 1 Expo request after manual send, got ${expoRequests.length}`)
        }

        const scheduled = await fetchJson(`http://127.0.0.1:${apiPort}/api/notifications/scheduled`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                title: 'Scheduled',
                body: 'Scheduled notification',
                topic: 'maintenance',
                data: { target: 'menu', screen: 'AiScreen' },
                scheduledAt: new Date(Date.now() + 1500).toISOString(),
            }),
        })

        await waitFor(async () => {
            const list = await fetchJson(`http://127.0.0.1:${apiPort}/api/notifications/scheduled?limit=5`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            })
            const item = list.find((entry) => entry.id === scheduled.id)
            return item?.status === 'sent' && expoRequests.length >= 2
        }, 12000)

        const history = await fetchJson(`http://127.0.0.1:${apiPort}/api/notifications?limit=5`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        })

        if (!Array.isArray(history) || history.length < 2) {
            throw new Error('Expected at least 2 history entries after manual + scheduled sends')
        }

        console.log(JSON.stringify({
            ok: true,
            expoRequests: expoRequests.length,
            historyEntries: history.length,
        }, null, 2))
    } finally {
        if (apiProcess.child) {
            apiProcess.child.kill('SIGTERM')
        }
        await new Promise((resolve) => expoServer.close(resolve))
        await runCommand('docker', ['rm', '-f', containerName], { allowFailure: true })
    }
}

function startExpoServer() {
    return new Promise((resolve, reject) => {
        expoServer.once('error', reject)
        expoServer.listen(expoPort, '127.0.0.1', () => resolve(undefined))
    })
}

async function startApi() {
    apiProcess.child = spawn('bun', ['src/index.ts'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: String(apiPort),
            APP_API_ADMIN_TOKEN: adminToken,
            APP_API_DATABASE_URL: `postgresql://app:app@127.0.0.1:${postgresPort}/app`,
            EXPO_PUSH_ENDPOINT: `http://127.0.0.1:${expoPort}/push/send`,
            APP_API_SCHEDULER_INTERVAL_MS: '1000',
        },
        stdio: 'inherit',
    })
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`)
    }
    return payload
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

function runCommand(command, args, { allowFailure = false } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit' })
        child.once('exit', (code) => {
            if (code === 0 || allowFailure) {
                resolve(undefined)
                return
            }
            reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
        })
    })
}

await main()
