import config from '#constants'
import {
    getNotificationHistoryEntry,
    listNotificationHistory,
    removeSubscription,
    upsertSubscription,
} from '#db'
import {
    cancelScheduledNotification,
    createScheduledNotification,
    getScheduledNotification,
    listScheduledNotifications,
    markScheduledNotificationFailed,
    markScheduledNotificationSent,
} from '#utils/notifications/schedules.ts'
import { resendNotification, sendTopicNotification } from '#utils/notifications/send.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

type SubscriptionBody = {
    token?: string
    topic?: string
}

type PostNotificationBody = {
    title?: string
    body?: string
    topic?: string
    data?: Record<string, string>
    screen?: Record<string, string | number | boolean | null>
}

type PostScheduledNotificationBody = {
    title?: string
    body?: string
    topic?: string
    data?: Record<string, string>
    scheduledAt?: string
}

export async function subscribeHandler(req: FastifyRequest, res: FastifyReply) {
    return handleSubscription(req, res, upsertSubscription)
}

export async function unsubscribeHandler(req: FastifyRequest, res: FastifyReply) {
    return handleSubscription(req, res, removeSubscription)
}

export const getNotificationsHandler = withNotificationAdmin(async (req, res) => {
    const { limit } = (req.query || {}) as { limit?: string }
    const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)
    return res.send(await listNotificationHistory(parsedLimit))
})

export const postNotificationHandler = withNotificationAdmin(async (req, res) => {
    const { title, body, topic, data, screen } = (req.body || {}) as PostNotificationBody
    if (!title || !body) {
        return res.status(400).send({ error: 'Missing title or body' })
    }

    const entry = await sendTopicNotification({
        title,
        body,
        topic,
        data: {
            ...normalizeData(data),
            ...normalizeData(screen),
        },
    })

    return res.send(entry)
})

export const resendNotificationHandler = withNotificationAdmin(async (req, res) => {
    const { id } = req.params as { id: string }
    const entry = await getNotificationHistoryEntry(id)
    if (!entry) {
        return res.status(404).send({ error: 'Notification not found' })
    }

    return res.send(await resendNotification(entry))
})

export const getScheduledNotificationsHandler = withNotificationAdmin(async (
    req: FastifyRequest<{ Querystring: { limit?: string } }>,
    res
) => {
    try {
        const limit = Number(req.query.limit || 25)
        return res.send(await listScheduledNotifications(limit))
    } catch (error) {
        return res.status(503).send({ error: (error as Error).message })
    }
})

export const postScheduledNotificationHandler = withNotificationAdmin(async (req, res) => {
    const { title, body, topic, data, scheduledAt } = (req.body || {}) as PostScheduledNotificationBody
    if (!title || !body || !scheduledAt) {
        return res.status(400).send({ error: 'Missing title, body or scheduledAt' })
    }

    const parsedDate = new Date(scheduledAt)
    if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).send({ error: 'Invalid scheduledAt value' })
    }

    try {
        return res.send(await createScheduledNotification({
            title,
            body,
            topic: topic || 'maintenance',
            data: data || {},
            scheduledAt: parsedDate.toISOString(),
            createdBy: req.headers['x-user-email']?.toString() || null,
        }))
    } catch (error) {
        return res.status(503).send({ error: (error as Error).message })
    }
})

export const deleteScheduledNotificationHandler = withNotificationAdmin(async (
    req: FastifyRequest<{ Params: { id: string } }>,
    res
) => {
    try {
        const notification = await cancelScheduledNotification(req.params.id)
        if (!notification) {
            return res.status(404).send({ error: 'Scheduled notification not found' })
        }

        return res.send(notification)
    } catch (error) {
        return res.status(503).send({ error: (error as Error).message })
    }
})

export const runScheduledNotificationHandler = withNotificationAdmin(async (
    req: FastifyRequest<{ Params: { id: string } }>,
    res
) => {
    const notification = await getScheduledNotification(req.params.id)
    if (!notification) {
        return res.status(404).send({ error: 'Scheduled notification not found' })
    }

    try {
        const history = await sendTopicNotification({
            title: notification.title,
            body: notification.body,
            topic: notification.topic,
            data: notification.data,
        })

        return res.send(await markScheduledNotificationSent(notification.id, history))
    } catch (error) {
        await markScheduledNotificationFailed(notification.id, error)
        return res.status(500).send({ error: (error as Error).message })
    }
})

async function handleSubscription(
    req: FastifyRequest,
    res: FastifyReply,
    update: (token: string, topic: string) => Promise<void>
) {
    const { token, topic } = (req.body || {}) as SubscriptionBody

    if (!token || !topic) {
        return res.status(400).send({ error: 'Missing token or topic' })
    }

    await update(token, topic)
    return res.send({ success: true })
}

function withNotificationAdmin<Request extends FastifyRequest>(
    handler: (req: Request, res: FastifyReply) => Promise<unknown>
) {
    return async (req: Request, res: FastifyReply) => {
        if (!requireNotificationAdmin(req, res)) {
            return
        }

        return handler(req, res)
    }
}

function requireNotificationAdmin(req: FastifyRequest, res: FastifyReply) {
    const configuredToken = config.notifications.adminToken
    if (!configuredToken) {
        return true
    }

    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (token !== configuredToken) {
        res.status(401).send({ error: 'Unauthorized' })
        return false
    }

    return true
}

function normalizeData(input?: Record<string, string | number | boolean | null>) {
    if (!input) {
        return {}
    }

    return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
            acc[key] = String(value)
        }
        return acc
    }, {})
}
