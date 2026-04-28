import { randomUUID } from 'crypto'
import { getPool, initializeDatabase, requirePool } from '#db'

type CreateScheduledNotificationInput = {
    title: string
    body: string
    topic: string
    data: Record<string, string>
    scheduledAt: string
    createdBy?: string | null
}

export async function createScheduledNotification(input: CreateScheduledNotificationInput) {
    const db = requirePool()
    await initializeDatabase()
    const id = randomUUID()
    const result = await db.query(
        `INSERT INTO app_notification_schedules (
            id, title, body, topic, data, scheduled_at, created_by
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        RETURNING *`,
        [
            id,
            input.title,
            input.body,
            input.topic,
            JSON.stringify(input.data),
            input.scheduledAt,
            input.createdBy || null,
        ]
    )

    return map(result.rows[0])
}

export async function cancelScheduledNotification(id: string) {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(
        `UPDATE app_notification_schedules
         SET status = 'cancelled',
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status IN ('scheduled', 'failed')
         RETURNING *`,
        [id]
    )

    return result.rows[0] ? map(result.rows[0]) : null
}

export async function getScheduledNotification(id: string) {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(`SELECT * FROM app_notification_schedules WHERE id = $1`, [id])
    return result.rows[0] ? map(result.rows[0]) : null
}

export async function listScheduledNotifications(limit = 50) {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(
        `SELECT *
         FROM app_notification_schedules
         ORDER BY scheduled_at DESC, created_at DESC
         LIMIT $1`,
        [limit]
    )

    return result.rows.map(map)
}

export async function claimDueScheduledNotifications(limit = 5) {
    const db = getPool()
    if (!db) {
        return []
    }

    await initializeDatabase()
    const client = await db.connect()

    try {
        await client.query('BEGIN')
        const result = await client.query(
            `WITH due AS (
                SELECT id
                FROM app_notification_schedules
                WHERE status = 'scheduled'
                  AND scheduled_at <= NOW()
                ORDER BY scheduled_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE app_notification_schedules AS schedules
            SET status = 'processing',
                updated_at = NOW()
            FROM due
            WHERE schedules.id = due.id
            RETURNING schedules.*`,
            [limit]
        )
        await client.query('COMMIT')
        return result.rows.map(map)
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

export async function markScheduledNotificationSent(id: string, history: AppNotificationHistoryEntry) {
    const db = requirePool()
    const result = await db.query(
        `UPDATE app_notification_schedules
         SET status = 'sent',
             sent_at = NOW(),
             updated_at = NOW(),
             history_id = $2,
             delivered = $3,
             failed = $4,
             last_error = NULL
         WHERE id = $1
         RETURNING *`,
        [id, history.id, history.delivered, history.failed]
    )

    return result.rows[0] ? map(result.rows[0]) : null
}

export async function markScheduledNotificationFailed(id: string, error: unknown) {
    const db = requirePool()
    const result = await db.query(
        `UPDATE app_notification_schedules
         SET status = 'failed',
             updated_at = NOW(),
             last_error = $2
         WHERE id = $1
         RETURNING *`,
        [id, error instanceof Error ? error.message : String(error)]
    )

    return result.rows[0] ? map(result.rows[0]) : null
}

function map(row: Record<string, unknown>): ScheduledNotificationRecord {
    return {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        topic: String(row.topic),
        data: (row.data || {}) as Record<string, string>,
        scheduledAt: new Date(String(row.scheduled_at)).toISOString(),
        status: String(row.status) as ScheduledNotificationRecord['status'],
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : null,
        cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)).toISOString() : null,
        lastError: row.last_error ? String(row.last_error) : null,
        delivered: typeof row.delivered === 'number' ? row.delivered : row.delivered === null ? null : Number(row.delivered),
        failed: typeof row.failed === 'number' ? row.failed : row.failed === null ? null : Number(row.failed),
        historyId: row.history_id ? String(row.history_id) : null,
        createdBy: row.created_by ? String(row.created_by) : null,
    }
}
