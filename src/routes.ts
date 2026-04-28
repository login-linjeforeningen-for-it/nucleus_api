import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'
import {
    games,
    neverHaveIEver,
    questionsList,
    redFlags,
} from './handlers/games.ts'
import version from './handlers/version.ts'
import { callback, login, me } from './handlers/auth.ts'
import {
    cancel,
    history,
    resend,
    runNow,
    schedule,
    scheduled,
    send,
    subscribe,
    unsubscribe,
} from './handlers/notifications.ts'
import { download, manifest, update } from './handlers/desktop.ts'

let indexBuffer: Buffer | null = null

export function index(req: FastifyRequest, res: FastifyReply) {
    if (!indexBuffer) {
        const routes = req.server.printRoutes({ commonPrefix: false })
        const body = `Welcome to the Nucleus API!\n\nValid routes are:\n${routes}`
        indexBuffer = Buffer.from(body, 'utf-8')
    }

    res.header('Content-Type', 'text/plain; charset=utf-8')
    return res.send(indexBuffer)
}

/**
 * Defines the routes available in the API.
 * 
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    fastify.get('/', index)

    fastify.get('/games', games)
    fastify.get('/questions', questionsList)
    fastify.get('/okredflagdealbreaker', redFlags)
    fastify.get('/neverhaveiever', neverHaveIEver)

    fastify.get('/version', version)

    fastify.get('/desktop', manifest)
    fastify.get('/desktop/:target/:currentVersion', update)
    fastify.get('/desktop/:target/:arch/:currentVersion', update)
    fastify.get('/desktop/download/:file', download)

    fastify.get('/auth/login', login)
    fastify.get('/auth/callback', callback)
    fastify.get('/auth/me', me)

    fastify.post('/subscribe', subscribe)
    fastify.post('/unsubscribe', unsubscribe)
    fastify.get('/notifications', history)
    fastify.post('/notifications', send)
    fastify.post('/notifications/:id/resend', resend)
    fastify.get('/notifications/scheduled', scheduled)
    fastify.post('/notifications/scheduled', schedule)
    fastify.delete('/notifications/scheduled/:id', cancel)
    fastify.post('/notifications/scheduled/:id/send', runNow)
}
