import config from '#constants'
import type { FastifyReply, FastifyRequest } from 'fastify'

type VersionQuery = {
    version?: string
    lang?: string
}

export default async function VersionHandler(req: FastifyRequest, res: FastifyReply) {
    const { version, lang: queryLang } = req.query as VersionQuery
    const currentVersion = version?.trim() || '0.0.0'
    const lang = queryLang === 'no' ? queryLang : 'en'
    const forceUpdate = isVersionBelow(currentVersion, config.minVersion)

    const updateMessages = {
        no: {
            title: 'Oppdatering tilgjengelig!',
            body: 'Gode nyheter! En ny versjon er tilgjengelig. 😃'
        },
        en: {
            title: 'New update available!',
            body: 'Good news! A new version is available. 😃'
        }
    }

    const forcedUpdateMessages = {
        no: {
            title: 'Oppdatering påkrevd!',
            body: 'Appen er utdatert og må oppdateres for å fortsette å bruke appen 🚨'
        },
        en: {
            title: 'Update Required!',
            body: 'Your version is outdated and must be updated to continue using the app 🚨'
        }
    }

    const message = forceUpdate ? forcedUpdateMessages[lang] : updateMessages[lang]
    const buttons = forceUpdate
        ? [{ text: lang === 'no' ? 'Oppdater nå' : 'Update Now', action: 'update' }]
        : [
            { text: lang === 'no' ? 'Oppdater nå' : 'Update Now', action: 'update' },
            { text: lang === 'no' ? 'Senere' : 'Later', action: 'later' }
        ]

    res.send({
        updateRequired: forceUpdate,
        update: message,
        buttons
    })
}

function isVersionBelow(current: string, minimum: string) {
    const c = current.split('.').map(Number)
    const m = minimum.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
        if ((c[i] || 0) < (m[i] || 0)) return true
        if ((c[i] || 0) > (m[i] || 0)) return false
    }

    return false
}
