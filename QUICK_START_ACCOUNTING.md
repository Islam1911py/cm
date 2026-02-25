# Quick Start - Accounting in Plain English

## The System in 3 Sentences

1. **Technicians do work** → They earn money
2. **We pay technicians** → Pending money reduces
3. **We see everything** → All money flows are visible

---

## Three Simple Rules

### Rule 1: Work = Earnings
When a technician does work:
- Record: "Ahmed did plumbing at Unit 5A for $200"
- System says: "Ahmed now has $200 pending"
- What you see: Technician page shows Pending: $200 (red)

### Rule 2: Payment = Reduces Pending
When you pay a technician:
- Record: "Paid Ahmed $200"
- System says: "Ahmed's pending is now $0"
- What you see: Technician page shows Pending: $0 (green)

### Rule 3: Invoice = Debt
When a unit gets an invoice:
- Record: "Unit 5A owes $500"
- System says: "Unit owes balance = $500"
- What you see: Invoice page shows Balance: $500 (orange)

---

## Three Pages That Show Money

### Page 1: Technicians 
**Purpose:** See who we owe money to

**What you see:**
- Technician name
- Earned: $500 (total from all work)
- Paid: $300 (total we've given them)
- **Pending: $200** (red = we still owe them)

**Click it:** See detailed breakdown by unit

### Page 2: Invoices
**Purpose:** See what money we're owed

**What you see:**
- Invoice #2024-001
- Unit: Residential Building A
- Amount: $500 (what they owe)
- Paid: $300 (what they've paid)
- **Balance: $200** (orange = they still owe us)

**Click it:** See payment history

### Page 3: Payments (Ledger)
**Purpose:** See all money movements

**What you see:**
```
Date: 2024-02-01
Type: INVOICE (green badge)
From: Unit 5A, Project X
Amount: +$300 (money coming in)

Date: 2024-02-01
Type: TECHNICIAN (blue badge)
To: Ahmed (Electrician)
Amount: -$150 (money going out)
```

**Newest payments first:** See what just happened

---

## How to Use It

### To Record Technician Work
1. Go to Technician Work page (or admin area)
2. Create new work record:
   - Select technician: "Ahmed"
   - Select unit: "5A"
   - Enter amount: "$200"
   - Enter description: "Fixed electrical outlet"
3. Save
4. Check: Go to Technicians page → Ahmed card shows: Earned +$200, Pending +$200

### To Pay a Technician
1. Go to Technician payment section
2. Create payment:
   - Select technician: "Ahmed"
   - Enter amount: "$200"
   - Note: "Monthly payment"
3. Save
4. Check: Technician card shows: Pending now reduced by $200

### To Create an Invoice
1. Go to Invoices page
2. Create invoice:
   - Select unit: "Unit 5A"
   - Enter amount: "$500"
   - Assign owner: "Mr. Ahmad"
3. Save
4. Check: Invoice page shows: Balance = $500 (orange = unpaid)

### To Record Invoice Payment
1. Go to Invoices page
2. Click invoice → see Payment History section
3. Add payment:
   - Amount: "$300"
   - Date: today
4. Save
5. Check: Invoice balance updates: $500 - $300 = $200

---

## Color Code Meanings

| Color | Means | Location |
|-------|-------|----------|
| 🟢 Green | Paid ✅ | Technician "Paid" card, Invoice "Status: PAID" |
| 🔴 Red | Pending ⚠️ | Technician "Pending" card when > 0 |
| 🟠 Orange | Unpaid ⚠️ | Invoice "Balance" column when > 0, Status: UNPAID |
| 🔵 Blue | Technician payment | Payments ledger type badge |
| 🟣 Emerald | Invoice payment | Payments ledger type badge |

**Remember:** Red/Orange = action needed, Green = all paid

---

## Questions & Answers

**Q: How much do we owe Ahmed?**
A: Go to Technicians → Find Ahmed → Look at "Pending" (red number)

**Q: How much does Unit 5A owe us?**
A: Go to Invoices → Find their invoice → Look at "Balance" (orange number)

**Q: Did we pay Ahmed this month?**
A: Go to Payments page → Search for Ahmed → See payment date and amount

**Q: How much money came in this month?**
A: Go to Payments page → Sum all green badge (INVOICE) payments

**Q: How much went out to technicians this month?**
A: Go to Payments page → Sum all blue badge (TECHNICIAN) payments

**Q: Is Ahmed's payment pending?**
A: Go to Technicians → Ahmed card → If Pending > 0 = YES (red), if = 0 = NO (green)

**Q: Which invoices aren't paid yet?**
A: Go to Invoices → Filter Status = "Unpaid" → See list with orange balances

---

## Common Tasks

### Task: Pay Ahmed His Pending Money
1. Go to Technicians page
2. Find Ahmed card → See Pending: $200 (red)
3. Go to payment section
4. Create payment: $200 to Ahmed
5. Save
6. Check Ahmed card → Pending now = $0 ✅

### Task: Check Cash Position
1. Go to Payments page
2. See summary cards:
   - Invoice Payments: $5000 (coming in)
   - Technician Payments: $2000 (going out)
3. Net: +$3000 (we gained money)

### Task: Follow Up on Unpaid Invoice
1. Go to Invoices page
2. Filter: Status = "Unpaid"
3. Sort by date
4. Find oldest invoice with balance > 0
5. Click it → See owner details → Contact them

### Task: Verify Technician Earnings
1. Go to Technicians page
2. Click technician → Detail page
3. See "Total Earned" card
4. See "Work by Unit" table
5. Verify: Earned should equal sum of all work amounts

---

## System Principles (Simple)

### Principle 1: Numbers Never Hide
- Every payment visible
- Every earning visible
- Every balance visible
- No secret calculations

### Principle 2: One Source of Truth
- TechnicianWork = technician earnings (first source)
- Invoice = unit debt (first source)
- Payments reduce these amounts
- Everything else is derived from these

### Principle 3: Color Tells You Status
- See red? Something is pending (needs action)
- See green? Something is paid (all done)
- See orange? Something is owed (follow up needed)

### Principle 4: Dates Tell You When
- Every payment has a date
- Payments are shown chronologically (newest first)
- Can see exact timeline of all money movements

---

## Things That Happen Automatically

✅ System calculates automatically:
- Technician earned = sum of all their work
- Technician paid = sum of all their payments
- Technician pending = earned - paid
- Invoice balance = amount - paid
- Invoice status = Paid (if balance ≤ 0) or Unpaid

✅ System updates automatically:
- When you add work → Earned goes up
- When you pay → Pending goes down
- When you create invoice → Balance appears
- When you record payment → Balance goes down

✅ System shows automatically:
- Red pending amounts (action needed)
- Orange unpaid invoices (follow up needed)
- Green paid items (complete)

---

## Don't Do This (It Won't Work Right)

❌ Don't:
- Edit work amounts after paying (system gets confused)
- Delete payments (leaves balance wrong)
- Create duplicate invoices (confuses total owed)
- Pay more than owed (system shows negative balance)

✅ Do This Instead:
- Create new work record if more work done
- Record refund as negative payment if needed
- Use one invoice per unit per period
- Pay exact amount or record partial payment

---

## Summary

The system answers ONE question: **"Who owes what?"**

- Technician earnings → "We owe Ahmed $200" (Pending = $200)
- Unit invoices → "Unit owes us $500" (Balance = $500)
- Payments ledger → "Here's when we paid/received"

Everything else follows from that.

**It's simple. Red = pending. Green = paid. Orange = owed.**

---

## Support

If numbers don't add up:
1. Check Technician detail page → See all work listed
2. Check Invoice detail page → See all payments listed
3. Check Payments ledger → See all transactions dated
4. All sums should match: Earned = sum(work), Pending = earned - paid

If something looks wrong:
- Don't delete records
- Instead create a correcting record
- Example: If you overpaid, create negative (refund) payment
- All records stay visible for audit trail

---

**That's it. The system is simple because the logic is simple.**

Record work → technician is owed money
Pay technician → pending reduces
Create invoice → unit owes money
Record payment → balance reduces

Everything else is just showing these numbers clearly.
