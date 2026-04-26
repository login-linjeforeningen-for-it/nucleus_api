import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import IndexHandler from './handlers/index/index.ts'
import GamesHandler from './handlers/games/gamesHandler.ts'
import QuestionsHandler from './handlers/questions/questionsHandler.ts'
import OkRedFlagDealBreakerHandler from './handlers/okredflagdealbreaker/okreadflagdealbreaker.ts'
import NeverHaveIEverHandler from './handlers/neverhaveiever/neverhaveiever.ts'
import VersionHandler from './handlers/version/version.ts'
import AuthLoginHandler from './handlers/auth/login.ts'
import AuthCallbackHandler from './handlers/auth/callback.ts'
import AuthMeHandler from './handlers/auth/me.ts'
import subscribeHandler from './handlers/notifications/subscribe.ts'
import unsubscribeHandler from './handlers/notifications/unsubscribe.ts'
import postNotificationHandler from './handlers/notifications/post.ts'
import getNotificationsHandler from './handlers/notifications/get.ts'
import resendNotificationHandler from './handlers/notifications/resend.ts'
import getScheduledNotificationsHandler from './handlers/notifications/getScheduled.ts'
import postScheduledNotificationHandler from './handlers/notifications/postScheduled.ts'
import deleteScheduledNotificationHandler from './handlers/notifications/deleteScheduled.ts'
import runScheduledNotificationHandler from './handlers/notifications/runScheduled.ts'
import {
    getDesktopDownloadHandler,
    getDesktopManifestHandler,
    getDesktopUpdateHandler,
} from './handlers/desktop/desktop.ts'

/**
 * Defines the routes available in the API.
 * 
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    // Index handler
    fastify.get('/', IndexHandler)

    // Game handlers
    fastify.get('/games', GamesHandler)
    fastify.get('/questions', QuestionsHandler)
    fastify.get('/okredflagdealbreaker', OkRedFlagDealBreakerHandler)
    fastify.get('/neverhaveiever', NeverHaveIEverHandler)

    // Version handler
    fastify.get('/version',VersionHandler)

    // Desktop app update handlers
    fastify.get('/desktop', getDesktopManifestHandler)
    fastify.get('/desktop/:target/:currentVersion', getDesktopUpdateHandler)
    fastify.get('/desktop/:target/:arch/:currentVersion', getDesktopUpdateHandler)
    fastify.get('/desktop/download/:file', getDesktopDownloadHandler)

    // Auth handlers
    fastify.get('/auth/login', AuthLoginHandler)
    fastify.get('/auth/callback', AuthCallbackHandler)
    fastify.get('/auth/me', AuthMeHandler)

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
