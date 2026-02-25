# 🚀 Accounting System Refactor - Implementation Roadmap

## ✅ COMPLETED

### Database Schema
- [x] Created `UnitExpense` model (core ledger)
- [x] Created `PMAdvance` model 
- [x] Removed `AccountingNote` model
- [x] Updated `InvoiceType` enum (MANAGEMENT_SERVICE + CLAIM)
- [x] Updated `Invoice` model with financial fields
- [x] Created relationships (TechnicianWork → UnitExpense, StaffWorkLog → UnitExpense)
- [x] Database migration created and applied
- [x] Seed script updated
- [x] Build passes ✓

---

## 📋 TODO - PHASE 1: API ENDPOINTS

### 1. Unit Expenses API (NEW)
**Path:** `/api/unit-expenses`

**Routes:**
```
GET    /api/unit-expenses
       - Get all unit expenses
       - Query params: ?unitId=xxx, ?claimed=true|false, ?sourceType=TECHNICIAN_WORK
       
GET    /api/unit-expenses/[unitId]
       - Get expenses for specific unit
       - Filter by date range, source type
       
POST   /api/unit-expenses
       - Create manual expense (sourceType: ELECTRICITY | OTHER)
       - Body: { unitId, description, amount, sourceType, recordedByUserId }
       - Auto-create for TechnicianWork/StaffWorkLog (handled elsewhere)
       
PUT    /api/unit-expenses/[id]
       - Update unclaimed expense
       - Cannot update if isClaimed=true
       
DELETE /api/unit-expenses/[id]
       - Delete unclaimed expense only
```

### 2. TechnicianWork Endpoint Updates
**Path:** `/api/technician-work`

**Changes to POST handler:**
```typescript
// When creating TechnicianWork, auto-create UnitExpense
const work = await db.technicianWork.create({ ... })

const expense = await db.unitExpense.create({
  unitId: work.unitId,
  description: work.description,
  amount: work.amount,
  sourceType: "TECHNICIAN_WORK",
  recordedByUserId: userId,
  technicianWorkId: work.id  // Link to work record
})

return { work, expense }
```

### 3. StaffWorkLog Endpoint Updates
**Path:** `/api/staff-work-logs` (if exists)

**Same pattern as TechnicianWork:**
```typescript
const workLog = await db.staffWorkLog.create({ ... })

const expense = await db.unitExpense.create({
  unitId: workLog.unitId,
  description: workLog.description,
  amount: workLog.amount,
  sourceType: "STAFF_WORK",
  recordedByUserId: userId,
  staffWorkLogId: workLog.id
})

return { workLog, expense }
```

### 4. Invoices Endpoint Updates
**Path:** `/api/invoices`

**New Route: Create Claim Invoice**
```
POST   /api/invoices/create-claim
       Body: {
         unitId: string
         expenseIds: string[]    // Array of UnitExpense IDs
         ownerAssociationId: string
       }
       
       Logic:
       1. Fetch all expenses by IDs
       2. Verify all belong to same unit
       3. Verify none are already claimed
       4. Sum amounts
       5. Create Invoice with type=CLAIM
       6. Update all expenses:
          - isClaimed = true
          - claimInvoiceId = invoice.id
          - claimedAt = now()
       7. Return invoice with linked expenses
```

**Update GET /api/invoices:**
```typescript
// Add filter by type
GET /api/invoices?type=MANAGEMENT_SERVICE|CLAIM|all

// Include expenses for CLAIM invoices
invoices.map(inv => ({
  ...inv,
  expenses: inv.type === 'CLAIM' 
    ? await db.unitExpense.findMany({ where: { claimInvoiceId: inv.id } })
    : null
}))
```

### 5. PM Advances API (NEW)
**Path:** `/api/pm-advances`

**Routes:**
```
GET    /api/pm-advances
       - List all advances
       - Query: ?userId=xxx, ?projectId=xxx
       
GET    /api/pm-advances/[userId]/project/[projectId]
       - Get specific PM's advance for project
       
POST   /api/pm-advances
       - Accountant creates advance
       - Body: { userId, projectId, amount, notes }
       
PUT    /api/pm-advances/[id]
       - Update advance amount or remaining
       - Only if still has balance
       
GET    /api/pm-advances/[userId]/balance
       - Get total remaining from all advances for PM
```

---

## 📋 TODO - PHASE 2: DASHBOARD APIs

### 1. Accountant Dashboard Summary
**Path:** `/api/dashboard/accountant`

**Returns:**
```typescript
{
  unitExpenses: {
    total: number
    unclaimed: number
    claimed: number
    totalAmount: number,
    unclaimedAmount: number
  },
  
  invoices: {
    managementTotal: number,
    managementPaid: number,
    managementDue: number,
    claimTotal: number,
    claimPaid: number,
    claimDue: number
  },
  
  pmAdvances: {
    totalGiven: number,
    totalRemaining: number,
    byUser: [
      { userId, name, given, remaining, projects }
    ]
  },
  
  technicians: {
    pendingPayments: number,
    totalPending: number
  },
  
  staff: {
    pendingPayments: number,
    totalPending: number
  }
}
```

### 2. Unit Expenses Summary
**Path:** `/api/dashboard/unit/[unitId]/expenses`

**Returns:**
```typescript
{
  unit: { id, name, code },
  expenses: UnitExpense[],
  summary: {
    total: number,
    unclaimed: number,
    claimed: number,
    bySourceType: { TECHNICIAN_WORK, STAFF_WORK, ELECTRICITY, OTHER }
  },
  claimedInvoices: Invoice[] // Linked CLAIM invoices
}
```

---

## 📋 TODO - PHASE 3: UI UPDATES

### 1. Unit Detail Page
**File:** `src/app/dashboard/operational-units/[id]/page.tsx`

**Add Tab: "Unit Expenses"**
```
- List all UnitExpenses
- Show sourceType with icon
- Show if claimed (yes/no)
- Show linked invoice if claimed
- Action: Select multiple + "Create Claim Invoice"
```

**Add Tab: "Claim Invoices"**
```
- List CLAIM invoices for this unit
- Show linked expenses
- Show payment status
```

**Remove or Hide: "Accounting Notes" tab**
```
- This data is now in Unit Expenses
```

### 2. Invoices Page
**File:** `src/app/dashboard/invoices/page.tsx`

**Add filter:**
```
- Type: All | Management | Claim
- Status: All | Paid | Due
- Unit filter
- Date range
```

### 3. New Accountant Dashboard
**File:** `src/app/dashboard/accountant/expenses/page.tsx` (NEW)

**Sections:**
```
1. Unit Expenses Summary
   - Total, Unclaimed, Claimed
   - By source type breakdown
   
2. Unclaimed Expenses Table
   - All units
   - Filter by unit, date, source
   - Multi-select + Create Claim Invoice button
   
3. Recent Claims
   - Last 5 claim invoices created
   
4. PM Advances Status
   - Table of all PMs
   - Given vs Remaining
   - Alert if PM over budget
```

### 4. PM Advances Management
**File:** `src/app/dashboard/accountant/pm-advances/page.tsx` (NEW)

**Sections:**
```
1. Create New Advance
   - Select PM
   - Select Project
   - Enter amount
   - Save
   
2. All Advances Table
   - PM name
   - Project
   - Given amount
   - Remaining
   - Status bar
   
3. Advance Details
   - Click row to see history
   - When given
   - Expenses charged against it
   - Running balance
```

---

## 📋 TODO - PHASE 4: BUSINESS LOGIC UPDATES

### 1. Auto-Create UnitExpense on Work Records
- TechnicianWork POST: Create UnitExpense
- StaffWorkLog POST: Create UnitExpense
- (Done via API endpoints)

### 2. Claim Invoice Creation Flow
- Select unclaimed expenses
- Create CLAIM invoice
- Link expenses
- Update expense status
- (Done via `/api/invoices/create-claim`)

### 3. PM Advance Tracking
- Deduct from advance when expense recorded
- Track remaining balance
- Alert when running low
- (Backend tracking in database)

### 4. Financial Reporting
- Total expenses per unit
- Claimed vs unclaimed
- Revenue from management fees
- Cost recovery from claims
- (Done via dashboard APIs)

---

## 📋 TODO - PHASE 5: REMOVE OLD CODE

### Files to Delete/Update:
```
❌ /src/app/api/accounting-notes/*
   - Entire folder no longer needed
   
❌ /src/app/dashboard/accounting-notes/*
   - UI page no longer needed
   
✏️ /src/app/dashboard/operational-units/[id]/page.tsx
   - Remove AccountingNote tab
   - Add Unit Expenses tab
   
✏️ Pages that reference AccountingNote
   - Find and replace with UnitExpense references
```

---

## 🧪 PHASE 6: TESTING

### Unit Tests
```
- Unit expense creation
- Unit expense linking to work records
- Claim invoice generation from expenses
- PM advance tracking
- Invoice payment tracking
```

### Integration Tests
```
- End-to-end flow:
  Technician Work → UnitExpense → Claim Invoice → Payment
  
- PM Advance flow:
  Create Advance → Expense deduction → Balance tracking
```

### Manual Testing
```
1. Create technician work → Verify UnitExpense auto-created
2. Create staff work → Verify UnitExpense auto-created
3. Select multiple expenses → Create claim invoice
4. View claim invoice with linked expenses
5. Verify expense marked as claimed
6. Track PM advance balance
```

---

## 📅 Priority Order

1. **CRITICAL (Do First):**
   - [x] Schema refactor ✓
   - [ ] Unit Expenses API endpoints
   - [ ] Update TechnicianWork to auto-create expenses
   - [ ] Update StaffWorkLog to auto-create expenses
   - [ ] Create Claim Invoice endpoint

2. **HIGH (Do Second):**
   - [ ] PM Advances API
   - [ ] Unit detail page with expenses tab
   - [ ] Remove accounting notes references

3. **MEDIUM (Do Third):**
   - [ ] Accountant dashboard summary
   - [ ] Accountant expense management UI
   - [ ] PM advance management UI

4. **LOW (Do Last):**
   - [ ] Delete old accounting notes code
   - [ ] Financial reports
   - [ ] Testing & refinement

---

## ✨ Success Criteria

✅ Database schema reflects business logic  
✅ UnitExpense is the single source of truth for costs  
✅ Claim invoices generated FROM expenses (not created manually)  
✅ PM advances tracked and balanced  
✅ Accountant can see all financial data clearly  
✅ No AccountingNote references in codebase  
✅ Build passes with no warnings  
✅ All tests pass  

---

## 🎯 End State

A system where:
- **Accountants** see a clear ledger of all unit expenses
- **PMs** work normally, system auto-tracks expenses
- **Invoices** are generated from actual costs incurred
- **Cash advances** are properly tracked and balanced
- **Management fees** and **cost recovery** are separate and clear
- **Auditing** is easy - everything is linked and traceable

This is a **real accounting system**, not a CRUD app! 💪
