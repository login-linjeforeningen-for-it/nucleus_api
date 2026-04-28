import config from '#constants'
import {
    getHistoryEntry,
    listNotificationHistory,
    removeSubscription,
    upsertSubscription,
} from '#db'
import {
    cancelSchedule,
    createSchedule,
    getSchedule,
    listSchedules,
    markFailed,
    markSent,
} from '#utils/notifications/schedules.ts'
import { resendEntry, sendTopic } from '#utils/notifications/send.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

type SubscriptionBody = {
    token?: string
    topic?: string
}

type MessageBody = {
    title?: string
    body?: string
    topic?: string
    data?: Record<string, string>
    screen?: Record<string, string | number | boolean | null>
}

type ScheduleBody = {
    title?: string
    body?: string
    topic?: string
    data?: Record<string, string>
    scheduledAt?: string
}

export async function subscribe(req: FastifyRequest, res: FastifyReply) {
    return subscription(req, res, upsertSubscription)
}

export async function unsubscribe(req: FastifyRequest, res: FastifyReply) {
    return subscription(req, res, removeSubscription)
}

export const history = adminOnly(async (req, res) => {
    const { limit } = (req.query || {}) as { limit?: string }
    const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)
    return res.send(await listNotificationHistory(parsedLimit))
})

export const send = adminOnly(async (req, res) => {
    const { title, body, topic, data, screen } = (req.body || {}) as MessageBody
    if (!title || !body) {
        return res.status(400).send({ error: 'Missing title or body' })
    }

    const entry = await sendTopic({
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

export const resend = adminOnly(async (req, res) => {
    const { id } = req.params as { id: string }
    const entry = await getHistoryEntry(id)
    if (!entry) {
        return res.status(404).send({ error: 'Notification not found' })
    }

    return res.send(await resendEntry(entry))
})

export const scheduled = adminOnly(async (
    req: FastifyRequest<{ Querystring: { limit?: string } }>,
    res
) => {
    try {
        const limit = Number(req.query.limit || 25)
        return res.send(await listSchedules(limit))
    } catch (error) {
        return res.status(503).send({ error: (error as Error).message })
    }
})

export const schedule = adminOnly(async (req, res) => {
    const { title, body, topic, data, scheduledAt } = (req.body || {}) as ScheduleBody
    if (!title || !body || !scheduledAt) {
        return res.status(400).send({ error: 'Missing title, body or scheduledAt' })
    }

    const parsedDate = new Date(scheduledAt)
    if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).send({ error: 'Invalid scheduledAt value' })
    }

    try {
        return res.send(await createSchedule({
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

export const cancel = adminOnly(async (
    req: FastifyRequest<{ Params: { id: string } }>,
    res
) => {
    try {
        const notification = await cancelSchedule(req.params.id)
        if (!notification) {
            return res.status(404).send({ error: 'Scheduled notification not found' })
        }

        return res.send(notification)
    } catch (error) {
        return res.status(503).send({ error: (error as Error).message })
    }
})

export const runNow = adminOnly(async (
    req: FastifyRequest<{ Params: { id: string } }>,
    res
) => {
    const notification = await getSchedule(req.params.id)
    if (!notification) {
        return res.status(404).send({ error: 'Scheduled notification not found' })
    }

    try {
        const history = await sendTopic({
            title: notification.title,
            body: notification.body,
            topic: notification.topic,
            data: notification.data,
        })

        return res.send(await markSent(notification.id, history))
    } catch (error) {
        await markFailed(notification.id, error)
        return res.status(500).send({ error: (error as Error).message })
    }
})

async function subscription(
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

function adminOnly<Request extends FastifyRequest>(
    handler: (req: Request, res: FastifyReply) => Promise<unknown>
) {
    return async (req: Request, res: FastifyReply) => {
        if (!isAdmin(req, res)) {
            return
        }

        return handler(req, res)
    }
}

function isAdmin(req: FastifyRequest, res: FastifyReply) {
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
