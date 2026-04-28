import type { FastifyReply, FastifyRequest } from 'fastify'

let responseBuffer: Buffer | null = null

export default function index(req: FastifyRequest, res: FastifyReply) {
    if (!responseBuffer) {
        const routes = req.server.printRoutes({ commonPrefix: false })
        const responseString = `Welcome to the Nucleus API!\n\nValid routes are:\n${routes}`
        responseBuffer = Buffer.from(responseString, 'utf-8')
    }

    res.header('Content-Type', 'text/plain; charset=utf-8')
    return res.send(responseBuffer)
}
