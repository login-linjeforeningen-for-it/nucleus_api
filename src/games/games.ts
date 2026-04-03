import { categories as questionCategories } from './questions'
import { categories as neverhaveieverCategories } from './neverhaveiever'
import { categories as okredflagdealbreakerCategories } from './okredflagdealbreaker'

const Games = [
    {
        id: 0,
        name: "100 Questions",
        endpoint: "/questions",
        description_no: "Det klassiske 100 spørsmål / snusboks / pekelek spillet.",
        description_en: "The classic 100 questions / snusbox / pointing game.",
        categories: questionCategories
    },
    {
        id: 1,
        name: "Never Have I Ever",
        endpoint: "/neverhaveiever",
        description_no: "Jeg har aldri... Drikk hvis du har.",
        description_en: "Never have I ever... Drink if you have.",
        categories: neverhaveieverCategories
    },
    {
        id: 2,
        name: "Ok Red Flag Dealbreaker",
        endpoint: "/okredflagdealbreaker",
        description_no: "Spillet hvor man får en påstand og skal svare om det er ok, red flag eller dealbreaker.",
        description_en: "The game where you get a statement and have to answer if it's ok, red flag or dealbreaker.",
        categories: okredflagdealbreakerCategories
    },
]

export default Games
