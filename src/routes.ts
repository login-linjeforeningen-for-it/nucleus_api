import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import getIndex from './handlers/index.ts'
import {
    getGames,
    getNeverHaveIEver,
    getOkRedFlagDealBreaker,
    getQuestions,
} from './handlers/games.ts'
import VersionHandler from './handlers/version.ts'
import { authCallback, authLogin, authMe } from './handlers/auth.ts'
import {
    deleteScheduledNotificationHandler,
    getNotificationsHandler,
    getScheduledNotificationsHandler,
    postNotificationHandler,
    postScheduledNotificationHandler,
    resendNotificationHandler,
    runScheduledNotificationHandler,
    subscribeHandler,
    unsubscribeHandler,
} from './handlers/notifications.ts'
import {
    getDesktopDownloadHandler,
    getDesktopManifestHandler,
    getDesktopUpdateHandler,
} from './handlers/desktop.ts'

/**
 * Defines the routes available in the API.
 * 
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    // Index handler
    fastify.get('/', getIndex)

    // Game handlers
    fastify.get('/games', getGames)
    fastify.get('/questions', getQuestions)
    fastify.get('/okredflagdealbreaker', getOkRedFlagDealBreaker)
    fastify.get('/neverhaveiever', getNeverHaveIEver)

    // Version handler
    fastify.get('/version',VersionHandler)

    // Desktop app update handlers
    fastify.get('/desktop', getDesktopManifestHandler)
    fastify.get('/desktop/:target/:currentVersion', getDesktopUpdateHandler)
    fastify.get('/desktop/:target/:arch/:currentVersion', getDesktopUpdateHandler)
    fastify.get('/desktop/download/:file', getDesktopDownloadHandler)

    // Auth handlers
    fastify.get('/auth/login', authLogin)
    fastify.get('/auth/callback', authCallback)
    fastify.get('/auth/me', authMe)

    // Notification handlers
    fastify.post('/subscribe', subscribeHandler)
    fastify.post('/unsubscribe', unsubscribeHandler)
    fastify.get('/notifications', getNotificationsHandler)
    fastify.post('/notifications', postNotificationHandler)
    fastify.post('/notifications/:id/resend', resendNotificationHandler)
    fastify.get('/notifications/scheduled', getScheduledNotificationsHandler)
    fastify.post('/notifications/scheduled', postScheduledNotificationHandler)
    fastify.delete('/notifications/scheduled/:id', deleteScheduledNotificationHandler)
    fastify.post('/notifications/scheduled/:id/send', runScheduledNotificationHandler)
}
