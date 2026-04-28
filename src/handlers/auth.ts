import config from '#constants'
import { buildProfile, fetchCoreUser, fetchUserInfo, getBearerToken } from '#utils/auth.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

const ALLOWED_REDIRECT_PREFIXES = ['login://', 'exp://']

type LoginQuery = {
    redirect_uri?: string
    target?: string
}

type UserInfo = {
    sub: string
    name: string
    email: string
    groups?: string[]
}

export async function authLogin(req: FastifyRequest<{ Querystring: LoginQuery }>, res: FastifyReply) {
    if (!config.auth.clientId) {
        req.log.error('Missing AUTHENTIK_CLIENT_ID for auth login')
        return res.status(500).send({ error: 'Authentication is not configured' })
    }

    const redirectUri = normalizeAppRedirectUri(req.query.redirect_uri)
    const target = req.query.target || 'app'
    const state = Buffer.from(JSON.stringify({ redirectUri, target })).toString('base64url')

    const params = new URLSearchParams({
        client_id: config.auth.clientId,
        redirect_uri: config.auth.callbackUrl,
        response_type: 'code',
        scope: 'openid profile email',
        state,
    })

    return res.redirect(`${config.auth.baseUrl}/application/o/authorize/?${params.toString()}`)
}

export async function authCallback(
    req: FastifyRequest<{ Querystring: { code?: string, state?: string } }>,
    res: FastifyReply
) {
    if (!config.auth.clientId || !config.auth.clientSecret) {
        req.log.error('Missing Authentik OAuth configuration for auth callback')
        return res.status(500).send({ error: 'Authentication is not configured' })
    }

    const { code, state } = req.query
    if (!code) {
        return res.status(400).send({ error: 'Missing authorization code' })
    }

    try {
        const tokenResponse = await fetch(`${config.auth.baseUrl}/application/o/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.auth.clientId,
                client_secret: config.auth.clientSecret,
                code,
                redirect_uri: config.auth.callbackUrl,
                grant_type: 'authorization_code',
            }).toString()
        })

        if (!tokenResponse.ok) {
            return res.status(500).send({ error: 'Failed to obtain token' })
        }

        const token = await tokenResponse.json() as { access_token: string }
        const userInfoResponse = await fetch(`${config.auth.baseUrl}/application/o/userinfo/`, {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            }
        })

        if (!userInfoResponse.ok) {
            return res.status(500).send({ error: 'Failed to fetch user info' })
        }

        const userInfo = await userInfoResponse.json() as UserInfo
        const { redirectUri, target } = parseState(state)
        const redirectUrl = new URL(redirectUri)
        redirectUrl.searchParams.set('access_token', token.access_token)
        redirectUrl.searchParams.set('id', userInfo.sub)
        redirectUrl.searchParams.set('name', userInfo.name)
        redirectUrl.searchParams.set('email', userInfo.email)
        redirectUrl.searchParams.set('groups', (userInfo.groups || []).join(','))
        redirectUrl.searchParams.set('target', target)

        return res.redirect(redirectUrl.toString())
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Authentication failed' })
    }
}

export async function authMe(req: FastifyRequest, res: FastifyReply) {
    const token = getBearerToken(req.headers.authorization)
    if (!token) {
        return res.status(401).send({ error: 'Missing or invalid Authorization header' })
    }

    try {
        const userInfo = await fetchUserInfo(token)
        let coreUser = null

        try {
            coreUser = await fetchCoreUser(userInfo)
        } catch (error) {
            req.log.warn(error, 'Unable to enrich profile from Authentik core API')
        }

        return res.send(buildProfile(userInfo, coreUser))
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return res.status(401).send({ error: 'Unauthorized' })
        }

        req.log.error(error)
        return res.status(500).send({ error: 'Failed to fetch profile' })
    }
}

function parseState(state: string | undefined) {
    if (!state) {
        return {
            redirectUri: config.auth.defaultRedirectUri,
            target: 'app'
        }
    }

    try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
            redirectUri?: string
            target?: string
        }

        return {
            redirectUri: normalizeAppRedirectUri(parsed.redirectUri),
            target: parsed.target || 'app'
        }
    } catch {
        return {
            redirectUri: config.auth.defaultRedirectUri,
            target: 'app'
        }
    }
}

function normalizeAppRedirectUri(value: string | undefined) {
    const redirectUri = value || config.auth.defaultRedirectUri
    const defaultRedirectUri = normalizeExpoDevClientScheme(config.auth.defaultRedirectUri)
    const nativeRedirectUri = normalizeExpoDevClientScheme(redirectUri)

    if (ALLOWED_REDIRECT_PREFIXES.some(prefix => nativeRedirectUri.startsWith(prefix))) {
        return nativeRedirectUri
    }

    return defaultRedirectUri
}

function normalizeExpoDevClientScheme(value: string) {
    const match = value.match(/^exp\+([a-z][a-z0-9+.-]*:\/\/.*)$/i)
    return match?.[1] || value
}
