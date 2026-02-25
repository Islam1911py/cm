import { PrismaClient, UserRole, StaffRole, StaffStatus, StaffType, TicketStatus, DeliveryStatus, InvoiceType, ExpenseSourceType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting seed...")

  // Hash password for all users
  const hashedPassword = await bcrypt.hash("admin123", 10)

  // ============================================
  // CREATE USERS
  // ============================================

  // Admin user
  const admin = await prisma.user.upsert({
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

  // Accountant user
  const accountant = await prisma.user.upsert({
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

  // Project Manager 1
  const pm1 = await prisma.user.upsert({
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

  // Project Manager 2
  const pm2 = await prisma.user.upsert({
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

  // ============================================
  // CREATE PROJECT TYPES
  // ============================================

  const typeResidential = await prisma.projectType.upsert({
    where: { name: "سكني" },
    update: {},
    create: { name: "سكني" }
  })

  const typePharmacy = await prisma.projectType.upsert({
    where: { name: "صيدلية" },
    update: {},
    create: { name: "صيدلية" }
  })

  const typeMall = await prisma.projectType.upsert({
    where: { name: "مول" },
    update: {},
    create: { name: "مول" }
  })

  const typeBuilding = await prisma.projectType.upsert({
    where: { name: "مبنى" },
    update: {},
    create: { name: "مبنى" }
  })

  const typeResort = await prisma.projectType.upsert({
    where: { name: "منتجع سياحي" },
    update: {},
    create: { name: "منتجع سياحي" }
  })

  console.log("✓ Project Types created")

  // ============================================
  // CREATE TECHNICIAN SPECIALTIES
  // ============================================

  const specCarpenter = await prisma.technicianSpecialty.upsert({
    where: { name: "نجار" },
    update: {},
    create: { name: "نجار" }
  })

  const specPlumber = await prisma.technicianSpecialty.upsert({
    where: { name: "سباك" },
    update: {},
    create: { name: "سباك" }
  })

  const specElectrician = await prisma.technicianSpecialty.upsert({
    where: { name: "كهربائي" },
    update: {},
    create: { name: "كهربائي" }
  })

  const specSmith = await prisma.technicianSpecialty.upsert({
    where: { name: "حداد" },
    update: {},
    create: { name: "حداد" }
  })

  const specPainter = await prisma.technicianSpecialty.upsert({
    where: { name: "دهاش" },
    update: {},
    create: { name: "دهاش" }
  })

  console.log("✓ Technician Specialties created")

  // ============================================
  // CREATE PROJECTS
  // ============================================

  // Residential Compound
  const compound = await prisma.project.upsert({
    where: { name: "Green Hills Compound" },
    update: {},
    create: {
      name: "Green Hills Compound",
      typeId: typeResidential.id,
      isActive: true
    }
  })

  // Pharmacy Chain
  const pharmacy = await prisma.project.upsert({
    where: { name: "Care Pharmacy Chain" },
    update: {},
    create: {
      name: "Care Pharmacy Chain",
      typeId: typePharmacy.id,
      isActive: true
    }
  })

  // Mall
  const mall = await prisma.project.upsert({
    where: { name: "City Center Mall" },
    update: {},
    create: {
      name: "City Center Mall",
      typeId: typeMall.id,
      isActive: true
    }
  })

  // Standalone Building
  const standalone = await prisma.project.upsert({
    where: { name: "Al-Tayeb Tower" },
    update: {},
    create: {
      name: "Al-Tayeb Tower",
      typeId: typeBuilding.id,
      isActive: true
    }
  })

  // Resort
  const resort = await prisma.project.upsert({
    where: { name: "Red Sea Resort" },
    update: {},
    create: {
      name: "Red Sea Resort",
      typeId: typeResort.id,
      isActive: true
    }
  })

  console.log("✓ Projects created")

  // ============================================
  // CREATE OPERATIONAL UNITS
  // ============================================

  // Buildings in compound
  const buildings: any[] = []
  for (let i = 1; i <= 10; i++) {
    const code = `GH-B${i.toString().padStart(2, '0')}`
    const building = await prisma.operationalUnit.upsert({
      where: { projectId_code: { projectId: compound.id, code } },
      update: {},
      create: {
        projectId: compound.id,
        name: `Building ${i}`,
        code,
        type: "Building",
        monthlyManagementFee: 500 + Math.random() * 500,
        monthlyBillingDay: 1 + Math.floor(Math.random() * 28),
        isActive: true
      }
    })
    buildings.push(building)
  }

  // Pharmacy branches
  const branches: any[] = []
  for (let i = 1; i <= 5; i++) {
    const code = `CP-BR${i.toString().padStart(2, '0')}`
    const branch = await prisma.operationalUnit.upsert({
      where: { projectId_code: { projectId: pharmacy.id, code } },
      update: {},
      create: {
        projectId: pharmacy.id,
        name: `Branch ${i}`,
        code,
        type: "Branch",
        monthlyManagementFee: 700 + Math.random() * 800,
        monthlyBillingDay: 1 + Math.floor(Math.random() * 28),
        isActive: true
      }
    })
    branches.push(branch)
  }

  // Mall shops
  const shops: any[] = []
  for (let i = 1; i <= 10; i++) {
    const code = `CC-SH${i.toString().padStart(2, '0')}`
    const shop = await prisma.operationalUnit.upsert({
      where: { projectId_code: { projectId: mall.id, code } },
      update: {},
      create: {
        projectId: mall.id,
        name: `Shop ${i}`,
        code,
        type: "Shop",
        monthlyManagementFee: 600 + Math.random() * 900,
        monthlyBillingDay: 1 + Math.floor(Math.random() * 28),
        isActive: true
      }
    })
    shops.push(shop)
  }

  console.log("✓ Operational units created")

  // ============================================
  // CREATE OWNER ASSOCIATIONS (Financial Clients)
  // ============================================

  for (const building of buildings) {
    await prisma.ownerAssociation.upsert({
      where: { unitId: building.id },
      update: {},
      create: {
        name: `${building.name} Owners Association`,
        phone: `+20123456${Math.floor(1000 + Math.random() * 9000)}`,
        email: `owners${building.code}@email.com`,
        unitId: building.id
      }
    })
  }

  for (const branch of branches) {
    await prisma.ownerAssociation.upsert({
      where: { unitId: branch.id },
      update: {},
      create: {
        name: `${branch.name} Management`,
        phone: `+20123456${Math.floor(1000 + Math.random() * 9000)}`,
        email: `mgmt${branch.code}@email.com`,
        unitId: branch.id
      }
    })
  }

  for (const shop of shops.slice(0, 5)) {
    await prisma.ownerAssociation.upsert({
      where: { unitId: shop.id },
      update: {},
      create: {
        name: `${shop.name} Owner`,
        phone: `+20123456${Math.floor(1000 + Math.random() * 9000)}`,
        unitId: shop.id
      }
    })
  }

  console.log("✓ Owner associations created")

  // ============================================
  // CREATE RESIDENTS
  // ============================================

  // Residents in compound
  const residents: any[] = []
  for (let i = 1; i <= 30; i++) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    const whatsappPhone = `+20100${String(i).padStart(5, '0')}`
    const resident = await prisma.resident.upsert({
      where: { whatsappPhone },
      update: {
        name: `Resident ${i}`,
        phone: whatsappPhone,
        unitId: buildings[buildingIndex].id
      },
      create: {
        name: `Resident ${i}`,
        phone: whatsappPhone,
        whatsappPhone,
        unitId: buildings[buildingIndex].id
      }
    })
    residents.push(resident)
  }

  console.log("✓ Residents created")

  // ============================================
  // ASSIGN PROJECT MANAGERS
  // ============================================

  await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId: pm1.id, projectId: compound.id } },
    update: {},
    create: { userId: pm1.id, projectId: compound.id }
  })
  await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId: pm1.id, projectId: pharmacy.id } },
    update: {},
    create: { userId: pm1.id, projectId: pharmacy.id }
  })
  await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId: pm2.id, projectId: mall.id } },
    update: {},
    create: { userId: pm2.id, projectId: mall.id }
  })
  await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId: pm2.id, projectId: standalone.id } },
    update: {},
    create: { userId: pm2.id, projectId: standalone.id }
  })
  await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId: pm1.id, projectId: resort.id } },
    update: {},
    create: { userId: pm1.id, projectId: resort.id }
  })

  console.log("✓ Project managers assigned")

  // ============================================
  // CREATE SAMPLE TICKETS
  // ============================================

  const ticketPriorities = ["Low", "Normal", "High", "Urgent"]

  for (let i = 1; i <= 15; i++) {
    const residentIndex = Math.floor(Math.random() * residents.length)
    const status = [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.DONE][Math.floor(Math.random() * 3)]
    const isDone = status === TicketStatus.DONE
    const assignedPm = i % 2 === 0 ? pm1.id : pm2.id
    
    const description = [
      "Water leakage in bathroom",
      "Elevator not working properly",
      "Common area needs cleaning",
      "AC unit not cooling",
      "Parking gate malfunction",
      "Garden needs maintenance"
    ][Math.floor(Math.random() * 6)]

    await prisma.ticket.create({
      data: {
        title: description,
        description: description,
        status: status,
        priority: ticketPriorities[Math.floor(Math.random() * ticketPriorities.length)],
        resolution: isDone ? "Issue has been resolved successfully" : null,
        residentId: residents[residentIndex].id,
        unitId: residents[residentIndex].unitId,
        assignedToId: assignedPm,
        closedAt: isDone ? new Date() : null
      }
    })
  }

  console.log("✓ Tickets created")

  // ============================================
  // CREATE SAMPLE DELIVERY ORDERS
  // ============================================

  for (let i = 1; i <= 10; i++) {
    const residentIndex = Math.floor(Math.random() * residents.length)
    const status = [DeliveryStatus.NEW, DeliveryStatus.IN_PROGRESS, DeliveryStatus.DELIVERED][Math.floor(Math.random() * 3)]
    const isDelivered = status === DeliveryStatus.DELIVERED
    const assignedPm = i % 2 === 0 ? pm1.id : pm2.id
    
    const orderText = [
      "3kg chicken, 2l milk, 1kg rice",
      "Vegetables: tomatoes, cucumbers, onions",
      "Bread, eggs, cheese, butter",
      "Cleaning supplies, detergent, soap",
      "Baby formula, diapers, wipes"
    ][Math.floor(Math.random() * 5)]

    await prisma.deliveryOrder.create({
      data: {
        title: `Order ${i}`,
        description: orderText,
        status: status,
        priority: "Normal",
        notes: isDelivered ? "Delivered to front desk" : null,
        residentId: residents[residentIndex].id,
        unitId: residents[residentIndex].unitId,
        assignedToId: assignedPm,
        deliveredById: isDelivered ? assignedPm : null,
        deliveredAt: isDelivered ? new Date() : null
      }
    })
  }

  console.log("✓ Delivery orders created")

  // ============================================
  // CREATE SAMPLE INVOICES
  // ============================================

  // Get owner associations
  const ownerAssociations = await prisma.ownerAssociation.findMany()

  // Monthly Service Invoices
  for (let i = 0; i < 5; i++) {
    const owner = ownerAssociations[i % ownerAssociations.length]
    const unit = await prisma.operationalUnit.findUnique({
      where: { id: owner.unitId }
    })

    if (unit) {
      const invoiceNumber = `INV-2025-00${i + 1}-${unit.code}`
      const amount = 5000 + Math.random() * 3000
      
      await prisma.invoice.upsert({
        where: { unitId_invoiceNumber: { unitId: unit.id, invoiceNumber } },
        update: {},
        create: {
          invoiceNumber,
          type: InvoiceType.MANAGEMENT_SERVICE,
          amount,
          ownerAssociationId: owner.id,
          unitId: unit.id,
          totalPaid: 0,
          remainingBalance: amount,
          isPaid: false
        }
      })
    }
  }

  // Claim Invoices
  for (let i = 0; i < 3; i++) {
    const owner = ownerAssociations[(i + 5) % ownerAssociations.length]
    const unit = await prisma.operationalUnit.findUnique({
      where: { id: owner.unitId }
    })

    if (unit) {
      const invoiceNumber = `CLM-2025-00${i + 1}-${unit.code}`
      const amount = 500 + Math.random() * 1000
      
      const claimInvoice = await prisma.invoice.upsert({
        where: { unitId_invoiceNumber: { unitId: unit.id, invoiceNumber } },
        update: {},
        create: {
          invoiceNumber,
          type: InvoiceType.CLAIM,
          amount,
          ownerAssociationId: owner.id,
          unitId: unit.id,
          totalPaid: 0,
          remainingBalance: amount,
          isPaid: false
        }
      })

      // Create UnitExpenses for this claim invoice
      const expenseAmount1 = 300 + Math.random() * 500
      const expenseAmount2 = 200 + Math.random() * 300
      
      await prisma.unitExpense.upsert({
        where: { id: `${claimInvoice.id}-exp-1` },
        update: {},
        create: {
          id: `${claimInvoice.id}-exp-1`,
          unitId: unit.id,
          description: `تصليح كهرباء - صيانة وحدة سكنية`,
          amount: expenseAmount1,
          sourceType: "OTHER",
          recordedByUserId: accountant.id,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          claimInvoiceId: claimInvoice.id
        }
      })

      await prisma.unitExpense.upsert({
        where: { id: `${claimInvoice.id}-exp-2` },
        update: {},
        create: {
          id: `${claimInvoice.id}-exp-2`,
          unitId: unit.id,
          description: `تصليح الأنابيب والسباكة`,
          amount: expenseAmount2,
          sourceType: "OTHER",
          recordedByUserId: accountant.id,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          claimInvoiceId: claimInvoice.id
        }
      })

      // Add payment for some invoices
      const paymentId = `payment-${claimInvoice.id}`
      await prisma.payment.upsert({
        where: { id: paymentId },
        update: {},
        create: {
          id: paymentId,
          amount: 5000,
          invoiceId: claimInvoice.id
        }
      })
    }
  }

  console.log("✓ Invoices and payments created")

  // ============================================
  // CREATE SAMPLE UNIT EXPENSES
  // ============================================

  for (let i = 1; i <= 8; i++) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    const sourceType = [ExpenseSourceType.TECHNICIAN_WORK, ExpenseSourceType.STAFF_WORK, ExpenseSourceType.ELECTRICITY, ExpenseSourceType.OTHER][Math.floor(Math.random() * 4)]
    const recordedPm = i % 2 === 0 ? pm1.id : pm2.id
    
    const description = [
      "Emergency light bulb replacement",
      "Cleaning supplies purchase",
      "Minor plumbing repair",
      "Electric box maintenance"
    ][Math.floor(Math.random() * 4)]

    await prisma.unitExpense.create({
      data: {
        description: description,
        amount: 100 + Math.random() * 500,
        sourceType: sourceType,
        unitId: buildings[buildingIndex].id,
        recordedByUserId: recordedPm,
        date: new Date(),
        isClaimed: false
      }
    })
  }

  console.log("✓ Accounting notes created")

  // ============================================
  // CREATE STAFF
  // ============================================

  // Office staff (monthly salary)
  const officeStaffRoles = [StaffRole.MANAGER, StaffRole.ACCOUNTANT]
  const fieldWorkerRoles = [StaffRole.PLUMBER, StaffRole.CARPENTER, StaffRole.ELECTRICIAN, StaffRole.PAINTER, StaffRole.GENERAL_WORKER]
  const staffStatuses = [StaffStatus.ACTIVE, StaffStatus.ACTIVE, StaffStatus.ON_LEAVE, StaffStatus.INACTIVE]

  // Create office staff (10 members with monthly salary)
  const initialOfficeStaff: any[] = []
  for (let i = 1; i <= 10; i++) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    
    const staff = await prisma.staff.create({
      data: {
        name: `Office Staff ${i}`,
        type: StaffType.OFFICE_STAFF,
        role: officeStaffRoles[Math.floor(Math.random() * officeStaffRoles.length)],
        phone: `+20109999${100 + i}`,
        salary: 5000 + Math.random() * 3000,
        paymentDay: 1 + Math.floor(Math.random() * 30),
        currency: "EGP",
        status: staffStatuses[Math.floor(Math.random() * staffStatuses.length)],
        unitId: buildings[buildingIndex].id,
        isProjectManager: false
      }
    })
    initialOfficeStaff.push(staff)
  }

  // Create project managers (Sara and Mohamed as office staff with project manager role)
  const saraManager = await prisma.staff.create({
    data: {
      name: "Sara Project Manager",
      type: StaffType.OFFICE_STAFF,
      role: StaffRole.MANAGER,
      phone: "+201000000001",
      salary: 8000,
      paymentDay: 15,
      currency: "EGP",
      status: StaffStatus.ACTIVE,
      unitId: buildings[0].id,
      isProjectManager: true
    }
  })

  const mohamedManager = await prisma.staff.create({
    data: {
      name: "Mohamed Project Manager",
      type: StaffType.OFFICE_STAFF,
      role: StaffRole.MANAGER,
      phone: "+201000000002",
      salary: 8000,
      paymentDay: 15,
      currency: "EGP",
      status: StaffStatus.ACTIVE,
      unitId: buildings[1].id,
      isProjectManager: true
    }
  })

  // Create field workers (15 members without fixed salary)
  const fieldWorkers: any[] = []
  for (let i = 1; i <= 15; i++) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    
    const fieldWorker = await prisma.staff.create({
      data: {
        name: `Field Worker ${i}`,
        type: StaffType.FIELD_WORKER,
        role: fieldWorkerRoles[Math.floor(Math.random() * fieldWorkerRoles.length)],
        phone: `+20108888${100 + i}`,
        salary: null,
        status: staffStatuses[Math.floor(Math.random() * staffStatuses.length)],
        unitId: buildings[buildingIndex].id,
        isProjectManager: false
      }
    })
    fieldWorkers.push(fieldWorker)
  }

  // Create sample work logs for field workers
  for (const worker of fieldWorkers.slice(0, 5)) {
    for (let j = 0; j < 3; j++) {
      const buildingIndex = Math.floor(Math.random() * buildings.length)
      const workDate = new Date()
      workDate.setDate(workDate.getDate() - Math.floor(Math.random() * 30))
      
      await prisma.staffWorkLog.create({
        data: {
          staffId: worker.id,
          unitId: buildings[buildingIndex].id,
          description: `Work task for ${worker.role.replace(/_/g, " ")}`,
          amount: 200 + Math.random() * 800,
          workDate: workDate,
          isPaid: Math.random() > 0.5
        }
      })
    }
  }

  console.log("✓ Staff created (10 office staff + 2 project managers + 15 field workers with work logs)")

  // ============================================
  // ASSIGN STAFF TO PROJECTS
  // ============================================

  // Assign office staff randomly to projects
  for (const staff of initialOfficeStaff) {
    const projectIndex = Math.floor(Math.random() * 5)
    const projects = [compound, pharmacy, mall, standalone, resort]
    
    await prisma.staffProjectAssignment.create({
      data: {
        staffId: staff.id,
        projectId: projects[projectIndex].id,
        notes: `Assigned to ${projects[projectIndex].name}`
      }
    })
  }

  // Assign project managers to all projects
  const allProjects = [compound, pharmacy, mall, standalone, resort]
  for (const project of allProjects) {
    await prisma.staffProjectAssignment.create({
      data: {
        staffId: saraManager.id,
        projectId: project.id,
        notes: `Sara managing ${project.name}`
      }
    })
    
    await prisma.staffProjectAssignment.create({
      data: {
        staffId: mohamedManager.id,
        projectId: project.id,
        notes: `Mohamed managing ${project.name}`
      }
    })
  }

  // Assign field workers to projects
  for (const worker of fieldWorkers) {
    const projectIndex = Math.floor(Math.random() * 5)
    const projects = [compound, pharmacy, mall, standalone, resort]
    
    await prisma.staffProjectAssignment.create({
      data: {
        staffId: worker.id,
        projectId: projects[projectIndex].id,
        notes: `Field worker assigned to ${projects[projectIndex].name}`
      }
    })
  }

  console.log("✓ Staff assigned to projects")

  // ============================================
  // CREATE TECHNICIANS
  // ============================================

  // Create technicians with various specialties
  const technicians: any[] = []
  
  const technicianData = [
    { name: "محمود النجار", specialtyId: specCarpenter.id, phone: "+201088881001", salaryType: "DAILY", dailySalary: 150 },
    { name: "علي السباك", specialtyId: specPlumber.id, phone: "+201088881002", salaryType: "DAILY", dailySalary: 160 },
    { name: "أحمد الكهربائي", specialtyId: specElectrician.id, phone: "+201088881003", salaryType: "PER_JOB", jobRate: 250 },
    { name: "عمر الحداد", specialtyId: specSmith.id, phone: "+201088881004", salaryType: "DAILY", dailySalary: 140 },
    { name: "فاروق الدهاش", specialtyId: specPainter.id, phone: "+201088881005", salaryType: "DAILY", dailySalary: 120 },
    { name: "محمد النجار الثاني", specialtyId: specCarpenter.id, phone: "+201088881006", salaryType: "MONTHLY", monthlySalary: 3500 },
    { name: "سالم السباك الثاني", specialtyId: specPlumber.id, phone: "+201088881007", salaryType: "PER_JOB", jobRate: 300 },
    { name: "خالد الكهربائي الثاني", specialtyId: specElectrician.id, phone: "+201088881008", salaryType: "MONTHLY", monthlySalary: 4000 },
    { name: "جمال الحداد الثاني", specialtyId: specSmith.id, phone: "+201088881009", salaryType: "DAILY", dailySalary: 130 },
    { name: "كريم الدهاش الثاني", specialtyId: specPainter.id, phone: "+201088881010", salaryType: "PER_JOB", jobRate: 200 }
  ]

  for (const data of technicianData) {
    const technician = await prisma.technician.create({
      data: {
        name: data.name,
        phone: data.phone,
        specialtyId: data.specialtyId,
        salaryType: data.salaryType as any,
        dailySalary: data.salaryType === "DAILY" ? data.dailySalary : null,
        jobRate: data.salaryType === "PER_JOB" ? data.jobRate : null,
        monthlySalary: data.salaryType === "MONTHLY" ? data.monthlySalary : null,
        currency: "EGP"
      }
    })
    technicians.push(technician)
  }

  console.log("✓ Technicians created with proper specialties and flexible salaries")

  // Create sample technician work (ensure each technician has at least one work)
  const workDescriptions = [
    "Elevator motor replacement",
    "AC unit repair",
    "Water pump maintenance",
    "Electrical panel servicing",
    "Lock replacement",
    "Plumbing leak repair",
    "HVAC system checkup",
    "Emergency lighting repair"
  ]

  for (const technician of technicians) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    await prisma.technicianWork.create({
      data: {
        technicianId: technician.id,
        unitId: buildings[buildingIndex].id,
        description: workDescriptions[Math.floor(Math.random() * workDescriptions.length)],
        amount: 200 + Math.random() * 800,
        isPaid: false
      }
    })
  }

  // Add extra random technician work
  for (let i = 1; i <= 10; i++) {
    const buildingIndex = Math.floor(Math.random() * buildings.length)
    const technicianIndex = Math.floor(Math.random() * technicians.length)

    await prisma.technicianWork.create({
      data: {
        technicianId: technicians[technicianIndex].id,
        unitId: buildings[buildingIndex].id,
        description: workDescriptions[Math.floor(Math.random() * workDescriptions.length)],
        amount: 200 + Math.random() * 800,
        isPaid: false
      }
    })
  }

  console.log("✓ Technician work created")

  // Create sample technician payments
  for (let i = 1; i <= 8; i++) {
    const technicianIndex = Math.floor(Math.random() * technicians.length)

    await prisma.technicianPayment.create({
      data: {
        technicianId: technicians[technicianIndex].id,
        amount: 3000 + Math.random() * 2000,
        notes: i % 2 === 0 ? "Payment for completed work batch" : "Emergency call payment"
      }
    })
  }

  console.log("✓ Technician payments created")

  // ============================================
  // CREATE PAYROLL DATA
  // ============================================

  // Get all office staff (those with salary)
  const officeStaff = await prisma.staff.findMany({
    where: { type: StaffType.OFFICE_STAFF }
  })

  // Create payroll for last month
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const monthString = lastMonth.toISOString().substring(0, 7) // YYYY-MM

  let totalGross = 0
  let totalAdvances = 0
  const payrollItems: any[] = []

  for (const staff of officeStaff) {
    const salary = staff.salary || 0
    totalGross += salary
    payrollItems.push({
      staffId: staff.id,
      name: staff.name,
      salary,
      advances: 0,
      net: salary
    })
  }

  const payroll = await prisma.payroll.create({
    data: {
      month: monthString,
      totalGross,
      totalAdvances,
      totalNet: totalGross - totalAdvances,
      status: "PAID",
      paidAt: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 5),
      createdByUserId: admin.id,
      payrollItems: {
        createMany: {
          data: payrollItems
        }
      }
    }
  })

  // Create staff advances (pending)
  for (const staff of officeStaff.slice(0, 5)) {
    await prisma.staffAdvance.create({
      data: {
        staffId: staff.id,
        amount: 1000 + Math.random() * 2000,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 15),
        status: "PENDING",
        note: "Employee loan"
      }
    })
  }

  // Create staff advances (deducted)
  for (const staff of officeStaff.slice(5, 8)) {
    await prisma.staffAdvance.create({
      data: {
        staffId: staff.id,
        amount: 1500 + Math.random() * 2500,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 10),
        status: "DEDUCTED",
        deductedFromPayrollId: payroll.id,
        note: "Deducted from salary"
      }
    })
  }

  console.log("✓ Payroll and advances created")

  console.log("\n✅ Seed completed successfully!")
  console.log("\nTest Accounts:")
  console.log("  Admin: admin@company.com / admin123")
  console.log("  Accountant: accountant@company.com / admin123")
  console.log("  PM1: pm1@company.com / admin123 (Compound, Pharmacy, Resort)")
  console.log("  PM2: pm2@company.com / admin123 (Mall, Standalone)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
