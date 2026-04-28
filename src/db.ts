import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import config from '#constants'

let pool: Pool | null = null
let initialized = false
let initializationPromise: Promise<void> | null = null

function mapSubscription(row: Record<string, unknown>): AppNotificationSubscription {
    return {
        token: String(row.token),
        topics: Array.isArray(row.topics) ? row.topics.map((item) => String(item)) : [],
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
    }
}

function mapHistoryEntry(row: Record<string, unknown>): AppNotificationHistoryEntry {
    return {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        topic: String(row.topic),
        data: (row.data || {}) as Record<string, string>,
        sentAt: new Date(String(row.sent_at)).toISOString(),
        delivered: typeof row.delivered === 'number' ? row.delivered : Number(row.delivered || 0),
        failed: typeof row.failed === 'number' ? row.failed : Number(row.failed || 0),
        ticketIds: Array.isArray(row.ticket_ids) ? row.ticket_ids.map((item) => String(item)) : [],
    }
}

export function hasDatabase() {
    return Boolean(config.database.url)
}

export function getPool() {
    if (!config.database.url) {
        return null
    }

    if (!pool) {
        pool = new Pool({
            connectionString: config.database.url,
        })
    }

    return pool
}

export function requirePool() {
    const db = getPool()
    if (!db) {
        throw new Error('APP_API_DATABASE_URL is not configured')
    }

    return db
}

export async function initializeDatabase() {
    if (initialized || !config.database.url) {
        return
    }

    if (initializationPromise) {
        await initializationPromise
        return
    }

    initializationPromise = initializeDatabaseSchema()
    try {
        await initializationPromise
        initialized = true
    } finally {
        initializationPromise = null
    }
}

async function initializeDatabaseSchema() {
    const db = getPool()
    if (!db) {
        return
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS app_notification_subscriptions (
            token TEXT PRIMARY KEY,
            topics JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)

    await db.query(`
        CREATE TABLE IF NOT EXISTS app_notification_history (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            topic TEXT NOT NULL DEFAULT 'maintenance',
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            sent_at TIMESTAMPTZ NOT NULL,
            delivered INTEGER NOT NULL DEFAULT 0,
            failed INTEGER NOT NULL DEFAULT 0,
            ticket_ids JSONB NOT NULL DEFAULT '[]'::jsonb
        )
    `)

    await db.query(`
        CREATE TABLE IF NOT EXISTS app_notification_schedules (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            topic TEXT NOT NULL DEFAULT 'maintenance',
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            scheduled_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            sent_at TIMESTAMPTZ NULL,
            cancelled_at TIMESTAMPTZ NULL,
            last_error TEXT NULL,
            delivered INTEGER NULL,
            failed INTEGER NULL,
            history_id TEXT NULL,
            created_by TEXT NULL
        )
    `)

    await db.query(`
        CREATE INDEX IF NOT EXISTS app_notification_history_sent_at_idx
        ON app_notification_history (sent_at DESC)
    `)

    await db.query(`
        CREATE INDEX IF NOT EXISTS app_notification_schedules_due_idx
        ON app_notification_schedules (status, scheduled_at)
    `)

}

export async function listSubscriptions() {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(
        `SELECT token, topics, created_at, updated_at
         FROM app_notification_subscriptions
         ORDER BY created_at ASC`
    )

    return result.rows.map(mapSubscription)
}

export async function upsertSubscription(token: string, topic: string) {
    const db = requirePool()
    await initializeDatabase()
    const existing = await db.query(
        `SELECT token, topics, created_at, updated_at
         FROM app_notification_subscriptions
         WHERE token = $1`,
        [token]
    )

    if (!existing.rows[0]) {
        await db.query(
            `INSERT INTO app_notification_subscriptions (token, topics)
             VALUES ($1, $2::jsonb)`,
            [token, JSON.stringify([topic])]
        )
        return
    }

    const current = mapSubscription(existing.rows[0])
    const topics = Array.from(new Set([...current.topics, topic])).sort()
    await db.query(
        `UPDATE app_notification_subscriptions
         SET topics = $2::jsonb,
             updated_at = NOW()
         WHERE token = $1`,
        [token, JSON.stringify(topics)]
    )
}

export async function removeSubscription(token: string, topic: string) {
    const db = requirePool()
    await initializeDatabase()
    const existing = await db.query(
        `SELECT token, topics, created_at, updated_at
         FROM app_notification_subscriptions
         WHERE token = $1`,
        [token]
    )

    if (!existing.rows[0]) {
        return
    }

    const current = mapSubscription(existing.rows[0])
    const topics = current.topics.filter((item) => item !== topic)

    if (!topics.length) {
        await db.query(`DELETE FROM app_notification_subscriptions WHERE token = $1`, [token])
        return
    }

    await db.query(
        `UPDATE app_notification_subscriptions
         SET topics = $2::jsonb,
             updated_at = NOW()
         WHERE token = $1`,
        [token, JSON.stringify(topics)]
    )
}

export async function listNotificationHistory(limit = 25) {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(
        `SELECT *
         FROM app_notification_history
         ORDER BY sent_at DESC
         LIMIT $1`,
        [limit]
    )

    return result.rows.map(mapHistoryEntry)
}

export async function getHistoryEntry(id: string) {
    const db = requirePool()
    await initializeDatabase()
    const result = await db.query(`SELECT * FROM app_notification_history WHERE id = $1`, [id])
    return result.rows[0] ? mapHistoryEntry(result.rows[0]) : null
}

export async function addHistoryEntry(entry: Omit<AppNotificationHistoryEntry, 'id'>) {
    const db = requirePool()
    await initializeDatabase()
    const id = randomUUID()
    const result = await db.query(
        `INSERT INTO app_notification_history (
            id, title, body, topic, data, sent_at, delivered, failed, ticket_ids
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb)
        RETURNING *`,
        [
            id,
            entry.title,
            entry.body,
            entry.topic,
            JSON.stringify(entry.data),
            entry.sentAt,
            entry.delivered,
            entry.failed,
            JSON.stringify(entry.ticketIds),
        ]
    )

    await db.query(
        `DELETE FROM app_notification_history
         WHERE id IN (
             SELECT id
             FROM app_notification_history
             ORDER BY sent_at DESC
             OFFSET 250
         )`
    )

    return mapHistoryEntry(result.rows[0])
}
