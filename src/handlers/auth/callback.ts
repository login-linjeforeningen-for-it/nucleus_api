import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'

type UserInfo = {
    sub: string
    name: string
    email: string
    groups?: string[]
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
            redirectUri: parsed.redirectUri?.startsWith('login://')
                || parsed.redirectUri?.startsWith('exp://')
                || parsed.redirectUri?.startsWith('exp+')
                ? parsed.redirectUri
                : config.auth.defaultRedirectUri,
            target: parsed.target || 'app'
        }
    } catch {
        return {
            redirectUri: config.auth.defaultRedirectUri,
            target: 'app'
        }
    }
}

export default async function authCallback(
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
