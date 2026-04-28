import cors from '@fastify/cors'
import Fastify from 'fastify'
import routes from './routes.ts'
import index from './handlers/index.ts'
import notificationScheduler from './plugins/notificationScheduler.ts'

const fastify = Fastify({
    logger: true
})

fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
})

const port = Number(process.env.PORT) || 8080

fastify.register(routes, { prefix: '/api' })
fastify.register(notificationScheduler)
fastify.get('/', index)

async function start() {
    try {
        await fastify.listen({ port, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()
