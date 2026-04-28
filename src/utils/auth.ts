import config from '#constants'

export type AuthentikUserInfo = {
    sub: string
    name?: string
    email?: string
    groups?: string[]
    preferred_username?: string
    nickname?: string
    given_name?: string
    family_name?: string
    email_verified?: boolean
    picture?: string
}

type AuthentikCoreUser = {
    pk?: number | string
    uid?: string
    username?: string
    name?: string
    email?: string
    is_active?: boolean
    last_login?: string | null
    date_joined?: string | null
    path?: string
    type?: string
    groups?: unknown[]
    attributes?: Record<string, unknown>
}

type AuthentikCoreUsersResponse = {
    results?: AuthentikCoreUser[]
}

export type AuthentikProfile = {
    id: string
    name: string | null
    email: string | null
    username: string | null
    preferredUsername: string | null
    nickname: string | null
    givenName: string | null
    familyName: string | null
    emailVerified: boolean | null
    picture: string | null
    groups: string[]
    authentik: {
        available: boolean
        pk: number | string | null
        uid: string | null
        username: string | null
        name: string | null
        email: string | null
        isActive: boolean | null
        lastLogin: string | null
        dateJoined: string | null
        path: string | null
        type: string | null
        groups: unknown[]
        attributes: Record<string, unknown>
    }
}

export function getBearerToken(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
        return null
    }

    return authorization.slice('Bearer '.length).trim() || null
}

export async function fetchUserInfo(accessToken: string) {
    const response = await fetch(`${config.auth.baseUrl}/application/o/userinfo/`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!response.ok) {
        throw new Error('Unauthorized')
    }

    return await response.json() as AuthentikUserInfo
}

export async function fetchCoreUser(userInfo: AuthentikUserInfo) {
    if (!config.auth.apiToken || !userInfo.email) {
        return null
    }

    const url = new URL(`${config.auth.baseUrl}/api/v3/core/users/`)
    url.searchParams.set('email', userInfo.email)

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${config.auth.apiToken}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        throw new Error('Unable to fetch Authentik user details')
    }

    const data = await response.json() as AuthentikCoreUsersResponse
    return data.results?.[0] || null
}

export function buildProfile(userInfo: AuthentikUserInfo, coreUser: AuthentikCoreUser | null): AuthentikProfile {
    const groups = Array.isArray(userInfo.groups)
        ? userInfo.groups.filter((group): group is string => typeof group === 'string')
        : []

    return {
        id: userInfo.sub,
        name: userInfo.name || coreUser?.name || null,
        email: userInfo.email || coreUser?.email || null,
        username: coreUser?.username || userInfo.preferred_username || null,
        preferredUsername: userInfo.preferred_username || null,
        nickname: userInfo.nickname || null,
        givenName: userInfo.given_name || null,
        familyName: userInfo.family_name || null,
        emailVerified: typeof userInfo.email_verified === 'boolean' ? userInfo.email_verified : null,
        picture: userInfo.picture || null,
        groups,
        authentik: {
            available: Boolean(coreUser),
            pk: coreUser?.pk ?? null,
            uid: coreUser?.uid || null,
            username: coreUser?.username || null,
            name: coreUser?.name || null,
            email: coreUser?.email || null,
            isActive: typeof coreUser?.is_active === 'boolean' ? coreUser.is_active : null,
            lastLogin: coreUser?.last_login || null,
            dateJoined: coreUser?.date_joined || null,
            path: coreUser?.path || null,
            type: coreUser?.type || null,
            groups: Array.isArray(coreUser?.groups) ? coreUser.groups : [],
            attributes: sanitizeAttributes(coreUser?.attributes)
        }
    }
}

function sanitizeAttributes(attributes: Record<string, unknown> | undefined) {
    if (!attributes) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(attributes).filter(([, value]) =>
            value === null
            || ['string', 'number', 'boolean'].includes(typeof value)
            || (Array.isArray(value) && value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry)))
        )
    )
}
