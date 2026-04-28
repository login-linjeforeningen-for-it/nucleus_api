import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'

type DesktopUpdateManifest = {
    version: string
    notes?: string
    pub_date?: string
    platforms?: Record<string, {
        signature: string
        url?: string
        file?: string
    }>
}

type DesktopUpdateParams = {
    target: string
    arch?: string
    currentVersion: string
}

type DesktopDownloadParams = {
    file: string
}

const updatesDir = path.resolve(process.env.APP_API_DESKTOP_UPDATES_DIR || path.join(process.cwd(), 'data', 'desktop'))
const publicUrl = (process.env.APP_API_PUBLIC_URL || 'https://app.login.no').replace(/\/$/, '')

export async function getDesktopManifestHandler(_: FastifyRequest, res: FastifyReply) {
    const manifest = await readManifest()

    if (!manifest) {
        return res.code(204).send()
    }

    return res.send(normalizeManifest(manifest))
}

export async function getDesktopUpdateHandler(req: FastifyRequest, res: FastifyReply) {
    const { target, arch, currentVersion } = req.params as DesktopUpdateParams
    const manifest = await readManifest()

    if (!manifest || !isNewerVersion(manifest.version, currentVersion)) {
        return res.code(204).send()
    }

    const platform = arch ? `${target}-${arch}` : target
    const normalized = normalizeManifest(manifest)
    const platformUpdate = normalized.platforms?.[platform]

    if (!platformUpdate) {
        return res.code(204).send()
    }

    return res.send({
        ...normalized,
        platforms: {
            [platform]: platformUpdate,
        },
    })
}

export async function getDesktopDownloadHandler(req: FastifyRequest, res: FastifyReply) {
    const { file } = req.params as DesktopDownloadParams
    const safeName = path.basename(file)
    const filePath = path.join(updatesDir, safeName)

    if (safeName !== file || !filePath.startsWith(`${updatesDir}${path.sep}`)) {
        return res.code(400).send({ error: 'Invalid desktop update artifact name' })
    }

    try {
        await access(filePath)
        const fileStat = await stat(filePath)
        res.header('Content-Length', fileStat.size)
        res.header('Content-Type', 'application/gzip')
        return res.send(createReadStream(filePath))
    } catch {
        return res.code(404).send({ error: 'Desktop update artifact not found' })
    }
}

async function readManifest() {
    try {
        const raw = await readFile(path.join(updatesDir, 'latest.json'), 'utf8')
        return JSON.parse(raw) as DesktopUpdateManifest
    } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
            return null
        }
        throw error
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error
}

function normalizeManifest(manifest: DesktopUpdateManifest): DesktopUpdateManifest {
    const platforms = Object.fromEntries(Object.entries(manifest.platforms ?? {}).map(([platform, update]) => {
        const file = update.file ?? inferFileName(update.url)
        const url = update.url && isAbsoluteUrl(update.url)
            ? update.url
            : file
                ? `${publicUrl}/api/desktop/download/${encodeURIComponent(file)}`
                : update.url

        return [platform, { signature: update.signature, url }]
    }))

    return {
        version: manifest.version,
        notes: manifest.notes,
        pub_date: manifest.pub_date,
        platforms,
    }
}

function inferFileName(url?: string) {
    if (!url) {
        return null
    }

    try {
        const parsed = new URL(url)
        return path.basename(parsed.pathname)
    } catch {
        return path.basename(url)
    }
}

function isAbsoluteUrl(url: string) {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

function isNewerVersion(candidate: string, current: string) {
    const candidateParts = parseVersion(candidate)
    const currentParts = parseVersion(current)
    const length = Math.max(candidateParts.length, currentParts.length)

    for (let index = 0; index < length; index += 1) {
        const candidatePart = candidateParts[index] ?? 0
        const currentPart = currentParts[index] ?? 0

        if (candidatePart > currentPart) {
            return true
        }

        if (candidatePart < currentPart) {
            return false
        }
    }

    return false
}

function parseVersion(version: string) {
    return version
        .replace(/^v/, '')
        .split(/[.-]/)
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part))
}
