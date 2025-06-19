const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const symbols = await prisma.symbol.findMany()
  console.log("📊 Symbols :", symbols)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
