const config = {
    minVersion: '2.4.0',
    latestVersion: process.env.APP_API_LATEST_VERSION || '',
    database: {
        url: process.env.APP_API_DATABASE_URL || process.env.DATABASE_URL || '',
    },
    notifications: {
        adminToken: process.env.APP_API_ADMIN_TOKEN || '',
        storageDir: process.env.APP_API_DATA_DIR || './data/notifications',
        expoEndpoint: process.env.EXPO_PUSH_ENDPOINT || 'https://exp.host/--/api/v2/push/send',
        schedulerIntervalMs: Number(process.env.APP_API_SCHEDULER_INTERVAL_MS || 15000),
    },
    auth: {
        baseUrl: process.env.AUTHENTIK_URL || 'https://authentik.login.no',
        clientId: process.env.AUTHENTIK_CLIENT_ID || '',
        clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || '',
        apiToken: process.env.AUTHENTIK_API_TOKEN || process.env.AUTHENTIK_TOKEN || '',
        callbackUrl: process.env.APP_AUTH_CALLBACK_URL || 'https://app.login.no/api/auth/callback',
        defaultRedirectUri: process.env.NUCLEUS_APP_REDIRECT_URI || 'login://auth',
    }
}

export default config
