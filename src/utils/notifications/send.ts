import config from '#constants'
import { addHistoryEntry, listSubscriptions } from '#db'

const expoTokenPattern = /^(Exponent|Expo)PushToken\[[^\]]+\]$/

type TopicMessage = {
    title: string
    body: string
    topic?: string
    data?: Record<string, string>
}

type ExpoTicket = {
    id?: string
    status?: 'ok' | 'error'
    message?: string
}

export async function sendTopic({
    title,
    body,
    topic = 'maintenance',
    data = {},
}: TopicMessage) {
    const subscriptions = await listSubscriptions()
    const tokens = subscriptions
        .filter((subscription) => subscription.topics.includes(topic))
        .map((subscription) => subscription.token)
        .filter((token) => expoTokenPattern.test(token))

    if (!tokens.length) {
        return await addHistoryEntry({
            title,
            body,
            topic,
            data,
            sentAt: new Date().toISOString(),
            delivered: 0,
            failed: 0,
            ticketIds: [],
        })
    }

    const tickets: ExpoTicket[] = []
    for (const chunk of chunks(tokens, 100)) {
        try {
            const response = await fetch(config.notifications.expoEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(
                    chunk.map((token) => ({
                        to: token,
                        title,
                        body,
                        data,
                        sound: 'default',
                        channelId: 'default',
                    }))
                ),
            })

            const payload = await response.json() as { data?: ExpoTicket[] }
            tickets.push(...(payload.data || []))
        } catch (error) {
            tickets.push(...chunk.map(() => ({
                status: 'error' as const,
                message: error instanceof Error ? error.message : 'Push send failed',
            })))
        }
    }

    return await addHistoryEntry({
        title,
        body,
        topic,
        data,
        sentAt: new Date().toISOString(),
        delivered: tickets.filter((ticket) => ticket.status === 'ok').length,
        failed: tickets.filter((ticket) => ticket.status === 'error').length,
        ticketIds: tickets.map((ticket) => ticket.id).filter((id): id is string => Boolean(id)),
    })
}

export async function resendEntry(entry: AppNotificationHistoryEntry) {
    return await sendTopic({
        title: entry.title,
        body: entry.body,
        topic: entry.topic,
        data: entry.data,
    })
}

function chunks<T>(items: T[], size: number) {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }
    return chunks
}
