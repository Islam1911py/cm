import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting seed...")

  const hashedPassword = await bcrypt.hash("admin123", 10)

  await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      name: "System Administrator",
      password: hashedPassword,
      whatsappPhone: "+201000000000",
      role: "ADMIN"
    }
  })

  await prisma.user.upsert({
    where: { email: "accountant@company.com" },
    update: {},
    create: {
      email: "accountant@company.com",
      name: "Ahmed Accountant",
      password: hashedPassword,
      whatsappPhone: "+201000000010",
      role: "ACCOUNTANT"
    }
  })

  await prisma.user.upsert({
    where: { email: "pm1@company.com" },
    update: {},
    create: {
      email: "pm1@company.com",
      name: "Mohamed Project Manager",
      password: hashedPassword,
      whatsappPhone: "+201000000011",
      role: "PROJECT_MANAGER"
    }
  })

  await prisma.user.upsert({
    where: { email: "pm2@company.com" },
    update: {},
    create: {
      email: "pm2@company.com",
      name: "Sara Project Manager",
      password: hashedPassword,
      whatsappPhone: "+201000000012",
      role: "PROJECT_MANAGER"
    }
  })

  console.log("✓ Users created")
  console.log("\nTest accounts (password: admin123):")
  console.log("  Admin: admin@company.com")
  console.log("  Accountant: accountant@company.com")
  console.log("  PM1: pm1@company.com")
  console.log("  PM2: pm2@company.com")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
