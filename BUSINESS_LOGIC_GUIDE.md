# System Business Logic - Simple Explanation

## What This System Does

This is an **Operations Management System** for buildings (units) that:
- Track work done by technicians
- Track invoices (what units owe)
- Track payments (to technicians, from units)
- Show clear financial position at any time

---

## The Three Money Flows

### Flow 1: Technician Earns Money (From Work)

**Process:**
```
1. Technician does work at a unit
2. Create TechnicianWork record with:
   - Who: Technician name
   - Where: Which unit/project
   - How much: Amount earned
   - Status: Mark as paid/unpaid

3. System automatically calculates:
   - Total earned = sum of all work amounts
   - Example: Did 5 jobs totaling $500

4. When paid:
   - Create TechnicianPayment record
   - System updates: pending = earned - paid
   - Example: Paid $300 → Pending = $500 - $300 = $200

5. When pending = 0:
   - Technician is fully paid
```

**Where visible:**
- Technicians list page: See earned/paid/pending side-by-side
- Technician detail page: Full breakdown by unit

---

### Flow 2: Unit Owes Money (From Invoice)

**Process:**
```
1. Create invoice for unit:
   - Invoice #2024-001
   - Unit: Residential Complex A
   - Amount: $500 (what they owe)
   - Date issued

2. System shows balance:
   - Balance = Amount - Paid
   - Initial balance: $500 - $0 = $500

3. When payment received:
   - Create Payment record
   - Record amount received (e.g., $300)
   - System updates balance: $500 - $300 = $200

4. When balance = 0:
   - Invoice marked as PAID
```

**Where visible:**
- Invoices list page: See amount/paid/balance columns
- Invoice detail page: See payment history

---

### Flow 3: All Money Movements (Complete Ledger)

**Process:**
```
Payments ledger shows TWO types in chronological order:

1. Invoice Payments (Money COMING IN from units)
   - Date: 2024-02-01
   - Type: INVOICE
   - Details: Invoice #2024-001 from Unit A (Project X)
   - Amount: $300 (green, money coming in)

2. Technician Payments (Money GOING OUT to technicians)
   - Date: 2024-02-01
   - Type: TECHNICIAN
   - Details: Payment to Technician John (Electrician)
   - Amount: $150 (blue, money going out)

Result: You see complete picture of cash flow
```

**Where visible:**
- Payments page: Complete chronological ledger

---

## What You Can Answer (Business Questions)

### Question 1: How much does Unit A owe?
**Answer:** Look at Invoices page
- Find their invoice
- See: Amount = $500, Paid = $300
- **Unit owes: $200** (shown as Balance)

### Question 2: How much did Technician B earn?
**Answer:** Look at Technicians page
- Find Technician B's card
- See: Earned = $500
- **Technician earned: $500** (from all work combined)

### Question 3: How much does Technician B still need to be paid?
**Answer:** Look at Technicians page
- Find Technician B's card
- See: Earned = $500, Paid = $300
- **Pending payment: $200** (red if > $0)

### Question 4: What's our current cash situation?
**Answer:** Look at Payments ledger page
- Invoices Payments: $5000 (money collected)
- Technician Payments: $2000 (money paid out)
- **Net position: +$3000** (more money in than out)

### Question 5: What work hasn't been paid for yet?
**Answer:** Look at Technicians list or detail page
- See Technician cards with Pending > 0
- Or detail page shows work by unit
- See items marked "unpaid"
- **Red = still owes money**

---

## Page Purpose Summary

| Page | Purpose | Shows What |
|------|---------|-----------|
| **Technicians** | See technician financial status | Earned/Paid/Pending for each technician |
| **Technician Detail** | See technician's breakdown | Earnings by unit, payment history, pending |
| **Invoices** | See unit payment obligations | Amount/Paid/Balance for each invoice |
| **Invoice Detail** | See invoice status | Full details, payment history, balance |
| **Payments Ledger** | See all money movements | Timeline of all payments (in & out) |
| **Residents** | See who lives where | Residents organized by Project → Unit |
| **Accounting Notes** | Record expenses | Submit cash expenses with Project/Unit |

---

## Data You See Everywhere

### For Invoices:
```
Invoice #2024-001
├─ Amount: $500 (what unit owes)
├─ Paid: $300 (what we received)
├─ Balance: $200 (still owed)
└─ Status: UNPAID (if balance > 0)
```

### For Technicians:
```
Technician: John (Electrician)
├─ Earned: $500 (sum of all work)
├─ Paid: $300 (sum of all payments)
└─ Pending: $200 (earned - paid)
```

### For Payment Record:
```
Date: 2024-02-01
├─ Type: Invoice | Technician
├─ Details: Who/What/Where
└─ Amount: $300
```

---

## Real-World Example

**Scenario: Building renovation project**

**Step 1: Technician works (Creates earnings)**
```
Technician "Ahmed" (Plumber) works at "Unit 5A"
Create TechnicianWork:
  - Amount: $200
  
Ahmed's stats → Earned: $200, Paid: $0, Pending: $200 ⚠️
```

**Step 2: Invoice for resident (Creates debt)**
```
Resident "Ahmad" owes for renovation
Create Invoice #INV-2024-001:
  - Unit: 5A
  - Amount: $800
  
Invoice shows → Balance: $800 (UNPAID) ⚠️
```

**Step 3: Unit makes partial payment (Reduces debt)**
```
Building manager pays $500 to invoice
Create Payment:
  - Amount: $500
  
Invoice #INV-2024-001 → Balance: $300 (now less owed)
Payments Ledger → Shows: Invoice payment +$500
```

**Step 4: Technician gets paid (Reduces earnings debt)**
```
Pay technician Ahmed $200
Create TechnicianPayment:
  - Amount: $200
  
Ahmed's stats → Earned: $200, Paid: $200, Pending: $0 ✅
Payments Ledger → Shows: Technician payment -$200
```

**Step 5: Check full picture**
```
Payments Ledger shows:
  - Incoming: $500 (from invoice)
  - Outgoing: $200 (to technician)
  - Net: +$300 (we gained)

Invoice #INV-2024-001:
  - Balance still: $300 (unit still owes)

Ahmed's profile:
  - Pending: $0 (fully paid ✅)
```

---

## Key Principles

### Principle 1: TechnicianWork Is Source of Truth
- When work is recorded, technician immediately "earns" that money
- Payment just reduces the pending amount
- It's not "pending payment" until paid, but system tracks it

### Principle 2: Invoices Track Debts
- Invoice amount = what unit owes
- Payments reduce the balance
- When balance = 0, debt paid

### Principle 3: Everything Is Transparent
- All pages show numbers clearly
- No hidden calculations
- All balances are: Total - Paid = Balance/Pending

### Principle 4: Color Coding
- 🟢 Green = Paid or no pending
- 🔴 Red = Still owed or pending
- 🟠 Orange = Outstanding/unpaid

---

## Financial Health Check

To know system health, check:

1. **Technician Pending** (Technicians page)
   - If any red numbers = Technicians are owed money
   - Total pending = how much we owe to technicians

2. **Invoice Balance** (Invoices page)
   - If any orange numbers = Units haven't paid
   - Total outstanding = how much we're owed by units

3. **Payments Ledger** (Payments page)
   - See incoming vs outgoing
   - If more incoming = good (we're collecting)
   - If more outgoing = we're paying technicians (normal)

4. **Summary Stats**
   - Total Invoices vs Total Collected = how much still owed
   - Total Earned vs Total Paid (technicians) = how much still owed

---

## System Is Simple Because

1. **One source of truth per type:**
   - TechnicianWork = technician earnings
   - Invoice = unit debt
   - Payment = money movement

2. **Simple calculation:**
   - Everything = Amount - Paid
   - No complex formulas
   - Visible everywhere

3. **Clear status:**
   - Green = Done/Paid
   - Red = Pending/Owed
   - Orange = Outstanding

4. **One ledger:**
   - All payments in one chronological list
   - See both types side-by-side
   - No hidden movements

---

## Remember

**The system is designed to answer: "Who owes what, and to whom?"**

- Unit A owes us $300 (invoice balance)
- We owe Technician B $200 (pending payment)
- This month we collected $5000 and paid out $2000

Everything flows from these simple questions. All pages are designed to answer them clearly.
