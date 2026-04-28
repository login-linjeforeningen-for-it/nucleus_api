import type { FastifyReply, FastifyRequest } from 'fastify'
import { categories as neverCategories } from '../games/neverhaveiever.ts'
import neverQuestions from '../games/neverhaveiever.ts'
import { categories as redFlagCategories } from '../games/okredflagdealbreaker.ts'
import redFlagQuestions from '../games/okredflagdealbreaker.ts'
import { categories as questionCategories } from '../games/questions.ts'
import questions from '../games/questions.ts'

const catalog = [
    {
        id: 0,
        name: '100 Questions',
        endpoint: '/questions',
        description_no: 'Det klassiske 100 spørsmål / snusboks / pekelek spillet.',
        description_en: 'The classic 100 questions / snusbox / pointing game.',
        categories: questionCategories
    },
    {
        id: 1,
        name: 'Never Have I Ever',
        endpoint: '/neverhaveiever',
        description_no: 'Jeg har aldri... Drikk hvis du har.',
        description_en: 'Never have I ever... Drink if you have.',
        categories: neverCategories
    },
    {
        id: 2,
        name: 'Ok Red Flag Dealbreaker',
        endpoint: '/okredflagdealbreaker',
        description_no: 'Spillet hvor man får en påstand og skal svare om det er ok, red flag eller dealbreaker.',
        description_en: 'The game where you get a statement and have to answer if it\'s ok, red flag or dealbreaker.',
        categories: redFlagCategories
    },
]

export async function games(_: FastifyRequest, res: FastifyReply) {
    res.send(catalog)
}

export async function questionsList(_: FastifyRequest, res: FastifyReply) {
    res.send(questions)
}

export async function redFlags(_: FastifyRequest, res: FastifyReply) {
    res.send(redFlagQuestions)
}

export async function neverHaveIEver(_: FastifyRequest, res: FastifyReply) {
    res.send(neverQuestions)
}
