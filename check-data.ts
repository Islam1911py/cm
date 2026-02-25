import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const units = await db.operationalUnit.findMany({
    take: 5,
    select: { id: true, name: true, code: true }
  })
  console.log("First 5 units:")
  units.forEach((unit) => console.log(`  ${unit.id} - ${unit.name} (${unit.code})`))

  const totalUnits = await db.operationalUnit.count()
  console.log(`\nTotal units: ${totalUnits}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
