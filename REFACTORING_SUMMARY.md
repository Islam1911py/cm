# Database Architecture Refactoring Summary

## Overview
The database has been successfully refactored to align with the correct business model where **Operational Unit is the core entity**, **Owner Association is the financial client**, and **Project is only an organizational container**.

## Key Architectural Changes

### 1. Core Entity Shift
- **Before**: Project was the core entity with many direct relations
- **After**: Operational Unit is now the central entity that all other models connect through

### 2. New Financial Client Model
- **OwnerAssociation** introduced as the legal financial client
- Represents: Building Owners Association, Branch/Shop management
- Invoices now link to OwnerAssociation, not directly to OperationalUnit
- Each OperationalUnit can have one OwnerAssociation

### 3. Simplified Models

#### User Model
**Removed fields:**
- `phone`
- `avatar`
- `isActive`

**Kept fields:**
- `id`, `email`, `name`, `password`, `role`
- `assignedProjects` (for RBAC)

#### Project Model
**Removed fields:**
- `code`
- `address`
- `description`

**Kept fields:**
- `id`, `name`, `type`, `isActive`, `createdAt`
- `operationalUnits`, `projectAssignments`

#### OperationalUnit Model (Core Entity)
**Minimal fields retained:**
- `id`, `name`, `code`, `type`, `projectId`, `isActive`

**Central relations:**
- `project` (organizational container)
- `residents[]`
- `tickets[]`
- `deliveryOrders[]`
- `accountingNotes[]`
- `invoices[]`
- `staff[]`
- `ownerAssociation` (financial client)

#### Resident Model
**Simplified to:**
- `id`, `name`, `phone` (unique), `unitId`

**Removed fields:**
- `projectId` (derived from unit)
- `unitNumber`
- `email`
- `isActive`
- `createdAt`, `updatedAt`

#### Ticket Model
**Simplified to:**
- `id`, `description`, `status`, `residentId`, `unitId`

**Removed fields:**
- `priority`
- `resolution`
- `createdAt`, `updatedAt`, `closedAt`
- `assignedToId`, `closedBy`
- `projectId` (derived from unit)

#### DeliveryOrder Model
**Simplified to:**
- `id`, `orderText`, `status`, `residentId`, `unitId`

**Removed fields:**
- `notes`
- `createdAt`, `updatedAt`, `deliveredAt`
- `assignedToId`, `deliveredBy`
- `projectId` (derived from unit)

#### AccountingNote Model
**Simplified to:**
- `id`, `amount`, `reason`, `status`, `unitId`, `sentById`

**Removed fields:**
- `notes`
- `createdAt`, `updatedAt`, `recordedAt`
- `projectId` (derived from unit)
- `recordedById`

#### Invoice Model
**Key changes:**
- Links to `ownerAssociationId` (the financial client)
- Links to `unitId` (the operational unit)

**Removed fields:**
- `status`, `currency`, `dueDate`
- `issuedDate`, `description`, `notes`
- `createdAt`, `updatedAt`, `paidAt`
- `paymentTermsId`

#### Payment Model
**Simplified to:**
- `id`, `amount`, `invoiceId`

**Removed fields:**
- `paymentNumber`, `currency`
- `method`, `reference`
- `notes`, `paidAt`, `createdAt`
- `receivedById`

#### Staff Model
**Simplified to:**
- `id`, `name`, `role`, `unitId`

**Removed fields:**
- `phone`, `nationalId`
- `status`, `salary`, `currency`
- `joinDate`, `leaveDate`
- `address`, `notes`, `avatar`
- `createdAt`, `updatedAt`
- `projectId` (now only belongs to a unit)

## Files Updated

### Database
1. `prisma/schema.prisma` - Complete rewrite with new architecture
2. `prisma/seed.ts` - New seed script for simplified schema
3. Database recreated with new schema

### Backend
1. `src/lib/auth.ts` - Removed `isActive` check from user authentication
2. `src/app/api/dashboard/stats/route.ts` - Updated to query through OperationalUnit's project relation

### Frontend
1. `src/app/dashboard/admin/page.tsx` - Removed `active` staff count (Staff no longer has status field)

## Query Pattern Changes

### Before (Project-centric)
```typescript
// Filter by projectId directly
db.ticket.findMany({
  where: { projectId: someId }
})
```

### After (OperationalUnit-centric)
```typescript
// Filter by unit's project relation
db.ticket.findMany({
  where: {
    unit: {
      project: { id: someId }
    }
  }
})
```

## Role-Based Access Control

RBAC remains unchanged:
- **Project Managers**: Can only see data from assigned projects
- **Accountants**: Full access to financial data
- **Admins**: Full access to everything

The filtering logic now works through the OperationalUnit → Project relation.

## Testing

The refactoring maintains all existing functionality:
- ✅ Authentication & Authorization
- ✅ Tickets Module
- ✅ Delivery Orders Module
- ✅ Accounting Notes Module
- ✅ Financial System (Invoices & Payments)
- ✅ Staff Module
- ✅ Dashboard Statistics

## Next Steps

Future modules should:
1. Always query through OperationalUnit when filtering by project
2. Link OwnerAssociation for any financial operations
3. Keep the schema minimal - only essential fields
4. Use Project only as an organizational container

## Seed Data

The new seed script creates:
- 4 Users (Admin, Accountant, 2 Project Managers)
- 5 Projects (Compound, Pharmacy, Mall, Standalone, Resort)
- 25 Operational Units (Buildings, Branches, Shops)
- 18 Owner Associations (Financial Clients)
- 30 Residents
- 15 Tickets
- 10 Delivery Orders
- 8 Invoices (Monthly + Claim)
- 3 Payments
- 8 Accounting Notes
- 20 Staff Members

Test accounts:
- Admin: admin@company.com / admin123
- Accountant: accountant@company.com / admin123
- PM1: pm1@company.com / admin123
- PM2: pm2@company.com / admin123
