import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'

type LoginQuery = {
    redirect_uri?: string
    target?: string
}

function normalizeRedirectUri(value: string | undefined) {
    const redirectUri = value || config.auth.defaultRedirectUri
    if (redirectUri.startsWith('login://') || redirectUri.startsWith('exp://') || redirectUri.startsWith('exp+')) {
        return redirectUri
    }

    return config.auth.defaultRedirectUri
}

export default async function authLogin(req: FastifyRequest<{ Querystring: LoginQuery }>, res: FastifyReply) {
    if (!config.auth.clientId) {
        req.log.error('Missing AUTHENTIK_CLIENT_ID for auth login')
        return res.status(500).send({ error: 'Authentication is not configured' })
    }

    const redirectUri = normalizeRedirectUri(req.query.redirect_uri)
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
