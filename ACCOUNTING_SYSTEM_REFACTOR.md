# 🏢 Accounting System Refactor - Complete

## ✅ What Changed

### 1. **Removed AccountingNote Model**
   - **Old:** Generic "AccountingNote" model with status (PENDING/RECORDED)
   - **New:** Specialized `UnitExpense` ledger - the heart of the system
   - **Why:** AccountingNote didn't represent real accounting logic. UnitExpense tracks WHERE money goes and WHY.

---

## 📊 New Core Models

### **UnitExpense (HEART OF ACCOUNTING)**
```
UnitExpense {
  id                String
  unitId            String              // Which unit/building
  date              DateTime            // When did expense occur
  description       String              // What was it for?
  amount            Float               // How much?
  sourceType        ExpenseSourceType   // From where? (TECHNICIAN_WORK | STAFF_WORK | ELECTRICITY | OTHER)
  recordedByUserId  String              // Who recorded this?
  
  // Links to actual work records (one-to-one)
  technicianWorkId  String? @unique     // If from technician
  staffWorkLogId    String? @unique     // If from staff
  
  // Claim tracking
  isClaimed         Boolean             // Has this been claimed to customer?
  claimInvoiceId    String?             // Which invoice claimed this?
  claimedAt         DateTime?           // When was it claimed?
  
  Relations:
  - unit            OperationalUnit
  - recordedByUser  User
  - technicianWork  TechnicianWork?
  - staffWorkLog    StaffWorkLog?
  - claimInvoice    Invoice? (CLAIM type)
}

enum ExpenseSourceType {
  TECHNICIAN_WORK    // Plumber, carpenter, electrician fixed something
  STAFF_WORK         // Office staff or field worker did something
  ELECTRICITY        // Utility bill, electricity costs
  OTHER              // Other miscellaneous
}
```

### **PMAdvance (Project Manager Cash Advances)**
```
PMAdvance {
  id               String
  userId           String   // Which PM got the advance?
  projectId        String   // For which project?
  amount           Float    // How much was advanced?
  remainingAmount  Float    // How much is left to spend?
  givenAt          DateTime
  notes            String?
  
  Relations:
  - user           User (PROJECT_MANAGER)
  - project        Project
}
```

---

## 💰 Invoice Types (Updated)

```typescript
enum InvoiceType {
  MANAGEMENT_SERVICE  // Monthly fee invoice (INCOME for CMD)
                      // Example: Building owner pays 20,000 EGP/month for management
                      
  CLAIM              // Claim invoice for expenses (RECOVERY of costs)
                      // Example: Plumber was paid 500 EGP, invoice customer to recover
}
```

### Invoice Model Updates
```
Invoice {
  id                String
  invoiceNumber     String
  type              InvoiceType    // MANAGEMENT_SERVICE or CLAIM
  amount            Float          // Total invoice amount
  ownerAssociationId String        // Which owners association?
  unitId            String
  issuedAt          DateTime
  totalPaid         Float          // How much has been paid?
  remainingBalance  Float          // How much is still due?
  isPaid            Boolean        // Is invoice fully paid?
  dueDate           DateTime?      // Payment deadline
  
  // NEW: CLAIM invoices reference their expenses
  expenses          UnitExpense[]  @relation("ClaimInvoiceExpenses")
  
  payments          Payment[]
}
```

---

## 🔗 Relationships

### TechnicianWork → UnitExpense
```
When a TechnicianWork is created:
1. System automatically creates UnitExpense with sourceType=TECHNICIAN_WORK
2. Links via technicianWorkId (one-to-one, unique)
3. Expense is NOT claimed yet (isClaimed=false)
```

### StaffWorkLog → UnitExpense
```
When StaffWorkLog is created:
1. System automatically creates UnitExpense with sourceType=STAFF_WORK
2. Links via staffWorkLogId (one-to-one, unique)
3. Expense is NOT claimed yet (isClaimed=false)
```

### UnitExpense → Invoice (CLAIM)
```
When Accountant creates CLAIM invoice:
1. Select multiple UnitExpenses from a unit
2. Create Invoice with type=CLAIM
3. Link all selected expenses to invoice via claimInvoiceId
4. Mark expenses as isClaimed=true, claimedAt=now()
5. Invoice amount = sum of all linked expenses
```

---

## 🧾 Financial Flow Examples

### Example 1: Technician Repair → Claim Invoice

```
1. Technician fixes AC unit in Building 7
   TechnicianWork created:
   - technicianId: "tech_001"
   - unitId: "unit_007"
   - description: "AC repair"
   - amount: 500 EGP
   - isPaid: false

2. System auto-creates UnitExpense:
   - unitId: "unit_007"
   - sourceType: TECHNICIAN_WORK
   - description: "AC repair"
   - amount: 500 EGP
   - isClaimed: false
   - technicianWorkId: "work_001"

3. Accountant claims expenses:
   - Creates CLAIM Invoice for unit_007
   - Amount: 500 EGP
   - Links UnitExpense to invoice

4. UnitExpense updated:
   - isClaimed: true
   - claimInvoiceId: "inv_001"
   - claimedAt: 2026-02-02

5. Owner Association pays invoice:
   - Creates Payment linked to invoice
   - Invoice.totalPaid increases
   - Invoice.remainingBalance decreases
```

### Example 2: Monthly Management Fee

```
1. Project Manager responsible for Building 7
   - Owner Association pays 20,000 EGP/month management fee

2. Accountant creates MANAGEMENT_SERVICE invoice:
   - type: MANAGEMENT_SERVICE (NOT expense-based)
   - amount: 20,000 EGP
   - unitId: "unit_007"
   - ownerAssociationId: "owner_007"

3. Owner pays the invoice
   - Creates Payment record
   - Invoice marked as paid

🔑 KEY: Management invoice is NOT linked to any UnitExpense!
   It's pure income, not expense recovery.
```

### Example 3: PM Advance Tracking

```
1. Accountant gives PM1 advance:
   PMAdvance created:
   - userId: "pm1"
   - projectId: "proj_001"
   - amount: 5,000 EGP
   - remainingAmount: 5,000 EGP

2. PM uses money for expenses:
   - Pays technician 500 EGP
   - PMAdvance.remainingAmount becomes 4,500 EGP
   
3. Accountant can see:
   - How much advance was given
   - How much PM has spent
   - How much is left to spend
```

---

## 🎯 UI/UX Implications

### Unit Detail Page Tabs
```
- Residents
- Tickets
- Technician Work
- Staff Work
- Unit Expenses (NEW LEDGER)
  ├─ View all unit expenses
  ├─ Filter by source type
  ├─ See which are claimed/unclaimed
  └─ See linked invoices
- Claim Invoices
  ├─ Generate NEW invoice from expenses
  ├─ View claimed expenses per invoice
  └─ Track invoice payments
- Management Invoices
  ├─ View monthly fee invoices
  └─ Track payments
```

### Accountant Dashboard
```
Features:
✓ All Unit Expenses across all units
✓ Filter by unit, date range, source type
✓ Multi-select expenses → Generate claim invoice
✓ See PM advances & remaining balances
✓ See technician pending payments
✓ See staff pending salaries
✓ Invoice management (both types)
✓ Payment tracking
```

---

## 🛠️ API Changes Required

### ✅ Already Fixed
- Prisma schema migration complete
- Database reset and seeded
- Build passes successfully

### 🚧 Need to Update (Next Steps)
```
APIs to refactor:
1. /api/unit-expenses (NEW)
   - GET /api/unit-expenses                    (all)
   - GET /api/unit-expenses/[unitId]          (by unit)
   - POST /api/unit-expenses                  (create)
   - PUT /api/unit-expenses/[id]              (update)
   - DELETE /api/unit-expenses/[id]           (delete)

2. /api/technician-work (UPDATE)
   - Auto-create UnitExpense on POST
   
3. /api/staff-work-logs (UPDATE)
   - Auto-create UnitExpense on POST

4. /api/invoices (UPDATE)
   - Add type filter (MANAGEMENT_SERVICE vs CLAIM)
   - POST /api/invoices/create-claim
     → Takes array of expenseIds
     → Creates invoice
     → Links expenses
     → Updates isClaimed flags

5. /api/pm-advances (NEW)
   - CRUD operations for PM advances

6. Accounting endpoints
   - Dashboard data for accountant view
```

---

## 📋 Migration Checklist

- [x] Update Prisma schema
  - [x] Add UnitExpense model
  - [x] Add PMAdvance model
  - [x] Remove AccountingNote model
  - [x] Update InvoiceType enum
  - [x] Update Invoice model
  - [x] Link TechnicianWork to UnitExpense
  - [x] Link StaffWorkLog to UnitExpense

- [x] Create and apply migration
  - [x] Database schema updated
  - [x] Seed script updated

- [x] Build verification
  - [x] TypeScript compiles
  - [x] No build errors
  - [x] Prisma client regenerated

- [ ] API endpoint updates (NEXT)
  - [ ] Create UnitExpense endpoints
  - [ ] Update TechnicianWork endpoint
  - [ ] Update StaffWorkLog endpoint
  - [ ] Update Invoice endpoints
  - [ ] Create PMAdvance endpoints
  - [ ] Update Accounting routes

- [ ] UI updates (NEXT)
  - [ ] Add UnitExpense display
  - [ ] Add expense to claim flow
  - [ ] Update accountant dashboard
  - [ ] Remove AccountingNote pages

- [ ] Testing (NEXT)
  - [ ] Test expense creation
  - [ ] Test claim invoice generation
  - [ ] Test PM advance tracking
  - [ ] Test financial reports

---

## 🔑 Key Principles

1. **UnitExpense is the source of truth**
   - Every cost CMD incurs is tracked here
   - Links to actual work records
   - Easy to audit and trace

2. **Clear financial separation**
   - MANAGEMENT_SERVICE invoices = fixed income
   - CLAIM invoices = cost recovery
   - Different business logic, different tracking

3. **Accountant-friendly**
   - See all expenses per unit
   - Batch claim multiple expenses
   - Track what's been recovered vs pending

4. **Work records stay as-is**
   - TechnicianWork, StaffWorkLog unchanged
   - System auto-creates expenses
   - Less manual entry = fewer errors

---

## ✨ Benefits

✅ **Clear business logic** - Mirrors real accounting
✅ **Audit trail** - Every expense tracked and linked
✅ **Financial accuracy** - No orphaned records
✅ **Scalable** - Easy to add new expense types
✅ **Accountant-focused** - Dashboard designed for financial ops
✅ **Reduced errors** - Auto-creation of expense records
✅ **Better reporting** - Expenses grouped, claimed, tracked

---

## 📞 Summary

The system is now built on proper accounting principles:
- **Expenses** (UnitExpense) are tracked in a ledger
- **Invoices** are generated FROM expenses (claims) or as fixed fees (management)
- **Payments** are tracked against invoices
- **Advances** are tracked for project managers

Everything flows logically and accountants can actually use the system! 🎯
