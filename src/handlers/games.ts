import type { FastifyReply, FastifyRequest } from 'fastify'
import { categories as neverhaveieverCategories } from '../games/neverhaveiever.ts'
import neverhaveiever from '../games/neverhaveiever.ts'
import { categories as okredflagdealbreakerCategories } from '../games/okredflagdealbreaker.ts'
import okredflagdealbreaker from '../games/okredflagdealbreaker.ts'
import { categories as questionCategories } from '../games/questions.ts'
import questions from '../games/questions.ts'

const games = [
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
        categories: neverhaveieverCategories
    },
    {
        id: 2,
        name: 'Ok Red Flag Dealbreaker',
        endpoint: '/okredflagdealbreaker',
        description_no: 'Spillet hvor man får en påstand og skal svare om det er ok, red flag eller dealbreaker.',
        description_en: 'The game where you get a statement and have to answer if it\'s ok, red flag or dealbreaker.',
        categories: okredflagdealbreakerCategories
    },
]

export async function getGames(_: FastifyRequest, res: FastifyReply) {
    res.send(games)
}

export async function getQuestions(_: FastifyRequest, res: FastifyReply) {
    res.send(questions)
}

export async function getOkRedFlagDealBreaker(_: FastifyRequest, res: FastifyReply) {
    res.send(okredflagdealbreaker)
}

export async function getNeverHaveIEver(_: FastifyRequest, res: FastifyReply) {
    res.send(neverhaveiever)
}
