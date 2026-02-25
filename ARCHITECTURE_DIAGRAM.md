# 🏗️ Accounting System Architecture

## Data Model Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL UNIT                                 │
│                   (Building, Branch, Shop, etc.)                         │
├─────────────────────────────────────────────────────────────────────────┤
│ id | name | code | projectId | isActive                                 │
└────────────────┬──────────────────────────────────────────────────────────┘
                 │
    ┌────────────┴──────────────┬─────────────────────────────────────┐
    │                           │                                     │
    ▼                           ▼                                     ▼
┌──────────────────┐  ┌─────────────────────┐        ┌────────────────────┐
│    RESIDENTS     │  │     UNIT EXPENSE    │        │     INVOICES       │
├──────────────────┤  │  (HEART OF SYSTEM)  │        ├────────────────────┤
│ id               │  ├─────────────────────┤        │ id                 │
│ name             │  │ id                  │        │ invoiceNumber      │
│ email            │  │ unitId          ───────────▶│ type *             │
│ phone            │  │ date                │        │   MANAGEMENT_SVCE  │
│ address          │  │ description         │        │   CLAIM            │
│ unitId       ────────│ amount              │        │ amount             │
│                  │  │ sourceType      ────┘        │ unitId         ────┘
└──────────────────┘  │   TECHNICIAN_WORK │          │ ownerAssociationId │
                      │   STAFF_WORK       │          │ issuedAt           │
┌──────────────────┐  │   ELECTRICITY      │          │ totalPaid          │
│     TICKETS      │  │   OTHER            │          │ remainingBalance   │
├──────────────────┤  │ recordedByUserId───┐         │ isPaid             │
│ id               │  │ isClaimed          │         │ dueDate            │
│ title            │  │ claimInvoiceId ────┼────────▶│ expenses       *   │
│ description      │  │ claimedAt          │         │   [UnitExpense[]]  │
│ status           │  │ createdAt          │         └────────────────────┘
│ residentId   ────────│ updatedAt          │
│ unitId       ────────│                    │         ┌────────────────────┐
└──────────────────┘  │ relations:         │         │     PAYMENTS       │
                      │  unit ────────────────────▶│ id                 │
┌──────────────────┐  │  recordedByUser    │        │ amount             │
│ DELIVERY ORDERS  │  │  technicianWork ───┘        │ invoiceId      ────┘
├──────────────────┤  │  staffWorkLog      │        │ paidAt             │
│ id               │  │  claimInvoice      │        └────────────────────┘
│ title            │  └─────────────────────┘
│ description      │
│ status           │  ┌─────────────────────┐
│ residentId   ────────│ TECHNICIAN WORK     │
│ unitId       ────────├─────────────────────┤
└──────────────────┘  │ id                  │
                      │ technicianId        │
                      │ unitId          ────────┐
                      │ description         │    │
                      │ amount              │    │
                      │ isPaid              │    └─▶ [Auto-creates UnitExpense]
                      │ createdAt           │
                      │ paidAt              │
                      │ expense *       ────────┐
                      └─────────────────────┘    │
                                                 │
                      ┌─────────────────────┐    │
                      │ STAFF WORK LOG      │    │
                      ├─────────────────────┤    │
                      │ id                  │    │
                      │ staffId             │    │
                      │ unitId          ────────┐
                      │ description         │ │  │
                      │ amount              │ │  │
                      │ workDate            │ │  └─▶ [Auto-creates UnitExpense]
                      │ isPaid              │ │
                      │ createdAt           │ │
                      │ expense *       ────────┘
                      └─────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        PM ADVANCE TRACKING                               │
├──────────────────────────────────────────────────────────────────────────┤
│  USER (PROJECT_MANAGER)                                                  │
│  ├─ pmAdvances[]                                                         │
│  │  └─ PMAdvance                                                         │
│  │     id | userId | projectId | amount | remainingAmount | givenAt     │
│  │                                                                        │
│  │  When PM records expense:                                             │
│  │    remainingAmount -= expense.amount                                  │
│  │                                                                        │
│  │  Accountant can see:                                                  │
│  │    - Total advanced: amount                                           │
│  │    - Still available: remainingAmount                                 │
│  │    - Status: amount - remainingAmount (spent)                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Financial Flow Diagram

```
SCENARIO 1: Technician Repair → Claim Invoice
═════════════════════════════════════════════════

    User: PM
    Action: Record technician work
    
    TechnicianWork.create({
      technicianId: 'tech_001'
      unitId: 'unit_007'
      description: 'AC repair'
      amount: 500
    })
              │
              ▼
    [AUTO] UnitExpense.create({
      unitId: 'unit_007'
      sourceType: TECHNICIAN_WORK
      amount: 500
      technicianWorkId: 'work_001'
      isClaimed: false
    })
              │
              ▼
    ┌─────────────────────────────────────┐
    │  LEDGER VIEW (Accountant)           │
    │                                     │
    │  Unit 007 Expenses:                 │
    │  ✓ AC repair - 500 EGP (unclaimed)  │
    │  ✓ Floor cleaning - 300 EGP (claimed)
    └─────────────────────────────────────┘
              │
              ▼
    User: Accountant
    Action: Create claim invoice
    
    Invoice.create({
      type: CLAIM
      amount: 500
      unitId: 'unit_007'
    })
    
    UnitExpense.update({
      isClaimed: true
      claimInvoiceId: 'inv_001'
      claimedAt: 2026-02-02
    })
              │
              ▼
    Invoice sent to Owner Association
    Owner receives: "Invoice CLM-001 for 500 EGP"
              │
              ▼
    Owner pays via Payment.create({
      invoiceId: 'inv_001'
      amount: 500
    })
              │
              ▼
    Invoice.update({
      totalPaid: 500
      remainingBalance: 0
      isPaid: true
    })


SCENARIO 2: Monthly Management Fee
═════════════════════════════════════════════════

    User: Accountant
    Action: Create management invoice
    
    Invoice.create({
      type: MANAGEMENT_SERVICE
      amount: 20000
      unitId: 'unit_007'
      invoiceNumber: 'MGT-001'
    })
    
    NOTE: No UnitExpense created!
    This is income, not expense recovery.
              │
              ▼
    Invoice sent to Owner Association
    Owner receives: "Invoice MGT-001 for 20000 EGP (monthly management fee)"
              │
              ▼
    Owner pays via Payment.create({
      invoiceId: 'inv_mgmt_001'
      amount: 20000
    })
              │
              ▼
    Invoice.update({
      totalPaid: 20000
      remainingBalance: 0
      isPaid: true
    })


SCENARIO 3: PM Advance Tracking
═════════════════════════════════════════════════

    User: Accountant
    Action: Give PM advance
    
    PMAdvance.create({
      userId: 'pm1'
      projectId: 'proj_001'
      amount: 5000
      remainingAmount: 5000
    })
              │
              ▼
    PM: pm1 has 5000 EGP to spend
              │
              ▼
    User: PM
    Action: Pay technician 500 EGP
    
    TechnicianPayment.create({
      technicianId: 'tech_001'
      amount: 500
    })
    
    [MANUAL] PMAdvance.update({
      remainingAmount: 4500
    })
              │
              ▼
    Accountant Dashboard shows:
    PM1 Advanced: 5000 EGP
    PM1 Remaining: 4500 EGP
    PM1 Spent: 500 EGP
              │
              ▼
    PM continues using remaining 4500...
    
    Once spent or at month-end:
    Reconcile against expenses
```

---

## Key Model Characteristics

### UnitExpense
```
├─ ALWAYS links to exactly ONE unit
├─ ALWAYS has a source type
├─ Can link to TechnicianWork (1:1)
├─ Can link to StaffWorkLog (1:1)
├─ Can be claimed (link to Invoice)
├─ Is the SOURCE OF TRUTH for all costs
└─ Provides audit trail
```

### Invoice
```
Type: MANAGEMENT_SERVICE
├─ Fixed amount income
├─ Not linked to UnitExpense
├─ Recurring (monthly)
└─ Example: 20,000 EGP/month

Type: CLAIM
├─ Generated from UnitExpense
├─ Amount = sum of expenses
├─ Links to expense records
├─ Example: 500 + 300 = 800 EGP claim
└─ Purpose: cost recovery
```

### PMAdvance
```
├─ Given to PM at project start
├─ Deducted when PM spends
├─ Tracked for reconciliation
├─ Shows remaining budget
└─ Used for cash flow management
```

---

## System Principles

```
1. ✅ SINGLE SOURCE OF TRUTH
   UnitExpense is THE ledger
   All costs tracked here
   Nothing orphaned

2. ✅ CLEAR FINANCIAL SEPARATION
   Income (Management invoices)
   Cost Recovery (Claim invoices)
   Different flows, different logic

3. ✅ AUTO-CREATION, LESS ERROR
   TechnicianWork → auto UnitExpense
   StaffWorkLog → auto UnitExpense
   No manual entry needed

4. ✅ AUDIT TRAIL
   Every expense linked to work
   Every claim linked to expenses
   Everything timestamped

5. ✅ ACCOUNTANT FRIENDLY
   See all expenses
   Batch select → claim
   Track claims to payment
   Simple dashboard
```

---

## API Query Examples

### Get all unclaimed expenses for a unit
```
GET /api/unit-expenses?unitId=unit_007&isClaimed=false
```

### Create claim from expenses
```
POST /api/invoices/create-claim
{
  unitId: 'unit_007',
  expenseIds: ['exp_001', 'exp_002', 'exp_003'],
  ownerAssociationId: 'owner_007'
}
→ Creates invoice, links expenses, updates flags
```

### Get PM advance status
```
GET /api/pm-advances?userId=pm1
→ Shows given amount, remaining, spent, projects
```

### Get unit financial summary
```
GET /api/dashboard/unit/unit_007/summary
→ Total expenses, claimed amount, payment status
```

---

## Success Metrics

✅ **Accuracy:** Every cost is tracked and auditable  
✅ **Clarity:** Accountant sees clear financial picture  
✅ **Efficiency:** Less manual entry (auto-creation)  
✅ **Scalability:** Easy to add new expense types  
✅ **Compliance:** Full audit trail for all transactions  

This is a **real accounting system** built on actual business logic! 🎯
