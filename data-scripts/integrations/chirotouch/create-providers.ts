import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const result = await prisma.provider.createMany({
      data: [
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Arthur Adamczyk',
          serviceId: 'cmj0c9hf50000oqap7vs6we3g',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Brian Matfus',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Clint J Price',
          serviceId: 'cmj0c9hf50000oqap7vs6we3g',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Daniel Van Clef',
          serviceId: 'cmj0c9lwy0002oqapuq9zrejd',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Edward J. Kinsella',
          serviceId: 'cmj0c9jth0001oqap0rbu9vot',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Elizabeth Dziuba',
          serviceId: 'cmj0c9lwy0002oqapuq9zrejd',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Joseph Marchitelli',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Ryan Ribeiro',
          serviceId: 'cmj0c9jth0001oqap0rbu9vot',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Shannon Moloughney',
          serviceId: 'cmj0c9jth0001oqap0rbu9vot',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Stephen Bruno',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Thomas Abrams',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Thomas Corbisiero',
          serviceId: 'cmj0c9jth0001oqap0rbu9vot',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Tyler DiGiovanni',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
        {
          companyId: 'cmj0aw8zo0000xwapp9axlyqv',
          name: 'Vincent Zappola',
          serviceId: 'cmj0c9pc40003oqapf0q9x4if',
        },
      ],
    })

    console.log(`✅ Successfully created ${result.count} providers`)
  } catch (error) {
    console.error('❌ Error creating providers:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
