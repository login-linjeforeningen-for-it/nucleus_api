import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import config from '#constants'
import { sendTopic } from '#utils/notifications/send.ts'
import {
    claimDueSchedules,
    markFailed,
    markSent,
} from '#utils/notifications/schedules.ts'
import { hasDatabase, initializeDatabase } from '#db'

let intervalHandle: ReturnType<typeof setInterval> | null = null
let running = false

async function flushDueNotifications(fastify: FastifyInstance) {
    if (running || !hasDatabase()) {
        return
    }

    running = true
    try {
        await initializeDatabase()
        const items = await claimDueSchedules(10)
        for (const item of items) {
            try {
                const history = await sendTopic({
                    title: item.title,
                    body: item.body,
                    topic: item.topic,
                    data: item.data,
                })
                await markSent(item.id, history)
            } catch (error) {
                await markFailed(item.id, error)
                fastify.log.error(error)
            }
        }
    } finally {
        running = false
    }
}

export default async function notificationScheduler(fastify: FastifyInstance, _: FastifyPluginOptions) {
    if (!hasDatabase()) {
        fastify.log.info('Notification scheduler disabled: APP_API_DATABASE_URL is not configured')
        return
    }

    void flushDueNotifications(fastify).catch((error) => {
        fastify.log.error(error)
    })

    intervalHandle = setInterval(() => {
        void flushDueNotifications(fastify).catch((error) => {
            fastify.log.error(error)
        })
    }, config.notifications.schedulerIntervalMs)

    fastify.addHook('onClose', async () => {
        if (intervalHandle) {
            clearInterval(intervalHandle)
            intervalHandle = null
        }
    })
}
