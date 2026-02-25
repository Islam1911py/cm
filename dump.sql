BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "AccountingNote" (
	"id"	TEXT NOT NULL,
	"projectId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"createdByUserId"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'PENDING',
	"convertedToExpenseId"	TEXT,
	"convertedAt"	DATETIME,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "AccountingNote_createdByUserId_fkey" FOREIGN KEY("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "AccountingNote_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "AccountingNote_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "DeliveryOrder" (
	"id"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'NEW',
	"priority"	TEXT NOT NULL DEFAULT 'Normal',
	"notes"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	"deliveredAt"	DATETIME,
	"residentId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"assignedToId"	TEXT,
	"deliveredById"	TEXT,
	PRIMARY KEY("id"),
	CONSTRAINT "DeliveryOrder_assignedToId_fkey" FOREIGN KEY("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "DeliveryOrder_deliveredById_fkey" FOREIGN KEY("deliveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "DeliveryOrder_residentId_fkey" FOREIGN KEY("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "DeliveryOrder_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Invoice" (
	"id"	TEXT NOT NULL,
	"invoiceNumber"	TEXT NOT NULL,
	"type"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"ownerAssociationId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"issuedAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"totalPaid"	REAL NOT NULL DEFAULT 0,
	"remainingBalance"	REAL NOT NULL DEFAULT 0,
	"isPaid"	BOOLEAN NOT NULL DEFAULT false,
	"dueDate"	DATETIME,
	PRIMARY KEY("id"),
	CONSTRAINT "Invoice_ownerAssociationId_fkey" FOREIGN KEY("ownerAssociationId") REFERENCES "OwnerAssociation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "N8nApiKey" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"key"	TEXT NOT NULL,
	"role"	TEXT NOT NULL,
	"projectId"	TEXT,
	"rateLimit"	INTEGER NOT NULL DEFAULT 100,
	"requestCount"	INTEGER NOT NULL DEFAULT 0,
	"lastResetAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"isActive"	BOOLEAN NOT NULL DEFAULT true,
	"description"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "N8nWebhookLog" (
	"id"	TEXT NOT NULL,
	"apiKeyId"	TEXT NOT NULL,
	"eventType"	TEXT NOT NULL,
	"endpoint"	TEXT NOT NULL,
	"method"	TEXT NOT NULL,
	"statusCode"	INTEGER NOT NULL,
	"requestBody"	TEXT,
	"responseBody"	TEXT,
	"ipAddress"	TEXT,
	"errorMessage"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "N8nWebhookLog_apiKeyId_fkey" FOREIGN KEY("apiKeyId") REFERENCES "N8nApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "OperationalExpense" (
	"id"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"sourceType"	TEXT NOT NULL,
	"pmAdvanceId"	TEXT,
	"claimInvoiceId"	TEXT,
	"convertedFromNoteId"	TEXT,
	"recordedByUserId"	TEXT NOT NULL,
	"recordedAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "OperationalExpense_claimInvoiceId_fkey" FOREIGN KEY("claimInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "OperationalExpense_convertedFromNoteId_fkey" FOREIGN KEY("convertedFromNoteId") REFERENCES "AccountingNote"("convertedToExpenseId") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "OperationalExpense_pmAdvanceId_fkey" FOREIGN KEY("pmAdvanceId") REFERENCES "PMAdvance"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "OperationalExpense_recordedByUserId_fkey" FOREIGN KEY("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "OperationalExpense_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "OperationalUnit" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"code"	TEXT NOT NULL,
	"type"	TEXT NOT NULL,
	"projectId"	TEXT NOT NULL,
	"monthlyManagementFee"	REAL DEFAULT 0,
	"monthlyBillingDay"	INTEGER DEFAULT 1,
	"isActive"	BOOLEAN NOT NULL DEFAULT true,
	PRIMARY KEY("id"),
	CONSTRAINT "OperationalUnit_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "OwnerAssociation" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"phone"	TEXT,
	"email"	TEXT,
	"unitId"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "OwnerAssociation_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "PMAdvance" (
	"id"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"projectId"	TEXT,
	"amount"	REAL NOT NULL,
	"remainingAmount"	REAL NOT NULL,
	"givenAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"notes"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "PMAdvance_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "PMAdvance_staffId_fkey" FOREIGN KEY("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Payment" (
	"id"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"invoiceId"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Payroll" (
	"id"	TEXT NOT NULL,
	"month"	TEXT NOT NULL,
	"totalGross"	REAL NOT NULL,
	"totalAdvances"	REAL NOT NULL DEFAULT 0,
	"totalNet"	REAL NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'PENDING',
	"paidAt"	DATETIME,
	"createdByUserId"	TEXT NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "Payroll_createdByUserId_fkey" FOREIGN KEY("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "PayrollItem" (
	"id"	TEXT NOT NULL,
	"payrollId"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"salary"	REAL NOT NULL,
	"advances"	REAL NOT NULL DEFAULT 0,
	"net"	REAL NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "PayrollItem_payrollId_fkey" FOREIGN KEY("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Project" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"typeId"	TEXT NOT NULL,
	"monthlyBillingDay"	INTEGER DEFAULT 1,
	"isActive"	BOOLEAN NOT NULL DEFAULT true,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "Project_typeId_fkey" FOREIGN KEY("typeId") REFERENCES "ProjectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ProjectAssignment" (
	"id"	TEXT NOT NULL,
	"userId"	TEXT NOT NULL,
	"projectId"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "ProjectAssignment_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ProjectElement" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"projectId"	TEXT NOT NULL,
	"typeId"	TEXT NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "ProjectElement_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "ProjectElement_typeId_fkey" FOREIGN KEY("typeId") REFERENCES "ProjectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ProjectType" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "Resident" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"email"	TEXT,
	"phone"	TEXT,
	"address"	TEXT,
	"status"	TEXT NOT NULL DEFAULT 'ACTIVE',
	"unitId"	TEXT NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	"whatsappPhone"	TEXT,
	PRIMARY KEY("id"),
	CONSTRAINT "Resident_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Staff" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"type"	TEXT NOT NULL,
	"role"	TEXT NOT NULL,
	"phone"	TEXT,
	"salary"	REAL,
	"currency"	TEXT NOT NULL DEFAULT 'EGP',
	"status"	TEXT NOT NULL DEFAULT 'ACTIVE',
	"paymentDay"	INTEGER,
	"unitId"	TEXT NOT NULL,
	"isProjectManager"	BOOLEAN NOT NULL DEFAULT false,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "Staff_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StaffAdvance" (
	"id"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"date"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"status"	TEXT NOT NULL DEFAULT 'PENDING',
	"note"	TEXT,
	"deductedFromPayrollId"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "StaffAdvance_deductedFromPayrollId_fkey" FOREIGN KEY("deductedFromPayrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "StaffAdvance_staffId_fkey" FOREIGN KEY("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StaffProjectAssignment" (
	"id"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"projectId"	TEXT NOT NULL,
	"assignedAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"notes"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "StaffProjectAssignment_projectId_fkey" FOREIGN KEY("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "StaffProjectAssignment_staffId_fkey" FOREIGN KEY("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StaffUnitAssignment" (
	"id"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"assignedAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"notes"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "StaffUnitAssignment_staffId_fkey" FOREIGN KEY("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "StaffUnitAssignment_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StaffWorkLog" (
	"id"	TEXT NOT NULL,
	"staffId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"workDate"	DATETIME NOT NULL,
	"isPaid"	BOOLEAN NOT NULL DEFAULT false,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "StaffWorkLog_staffId_fkey" FOREIGN KEY("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "StaffWorkLog_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Technician" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"phone"	TEXT NOT NULL,
	"address"	TEXT,
	"specialtyId"	TEXT NOT NULL,
	"salaryType"	TEXT NOT NULL DEFAULT 'PER_JOB',
	"monthlySalary"	REAL,
	"dailySalary"	REAL,
	"jobRate"	REAL,
	"currency"	TEXT NOT NULL DEFAULT 'EGP',
	"notes"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "Technician_specialtyId_fkey" FOREIGN KEY("specialtyId") REFERENCES "TechnicianSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "TechnicianPayment" (
	"id"	TEXT NOT NULL,
	"technicianId"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"notes"	TEXT,
	"paidAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "TechnicianPayment_technicianId_fkey" FOREIGN KEY("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "TechnicianSpecialty" (
	"id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "TechnicianWork" (
	"id"	TEXT NOT NULL,
	"technicianId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"description"	TEXT,
	"amount"	REAL,
	"status"	TEXT NOT NULL DEFAULT 'PENDING',
	"isPaid"	BOOLEAN NOT NULL DEFAULT false,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"startedAt"	DATETIME,
	"completedAt"	DATETIME,
	"paidAt"	DATETIME,
	PRIMARY KEY("id"),
	CONSTRAINT "TechnicianWork_technicianId_fkey" FOREIGN KEY("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "TechnicianWork_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Ticket" (
	"id"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'NEW',
	"priority"	TEXT NOT NULL DEFAULT 'Normal',
	"resolution"	TEXT,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	"closedAt"	DATETIME,
	"residentId"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"assignedToId"	TEXT,
	PRIMARY KEY("id"),
	CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "Ticket_residentId_fkey" FOREIGN KEY("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "Ticket_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "UnitExpense" (
	"id"	TEXT NOT NULL,
	"unitId"	TEXT NOT NULL,
	"pmAdvanceId"	TEXT,
	"date"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"description"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"sourceType"	TEXT NOT NULL,
	"recordedByUserId"	TEXT NOT NULL,
	"technicianWorkId"	TEXT,
	"staffWorkLogId"	TEXT,
	"isClaimed"	BOOLEAN NOT NULL DEFAULT false,
	"claimInvoiceId"	TEXT,
	"claimedAt"	DATETIME,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "UnitExpense_claimInvoiceId_fkey" FOREIGN KEY("claimInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "UnitExpense_pmAdvanceId_fkey" FOREIGN KEY("pmAdvanceId") REFERENCES "PMAdvance"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "UnitExpense_recordedByUserId_fkey" FOREIGN KEY("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "UnitExpense_staffWorkLogId_fkey" FOREIGN KEY("staffWorkLogId") REFERENCES "StaffWorkLog"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "UnitExpense_technicianWorkId_fkey" FOREIGN KEY("technicianWorkId") REFERENCES "TechnicianWork"("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "UnitExpense_unitId_fkey" FOREIGN KEY("unitId") REFERENCES "OperationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "User" (
	"id"	TEXT NOT NULL,
	"email"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"password"	TEXT NOT NULL,
	"whatsappPhone"	TEXT,
	"role"	TEXT NOT NULL DEFAULT 'PROJECT_MANAGER',
	"canViewAllProjects"	BOOLEAN NOT NULL DEFAULT false,
	"createdAt"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
INSERT INTO "AccountingNote" VALUES ('cml9y6gz70005wl3k66pmdccn','cml9xi5gi000fwlw83bvg87et','cml9xi5hn000pwlw82o33iaof','cml9xi5da0000wlw8xaybqxue','شباك',500.0,'CONVERTED','cml9y6p7c0009wl3kb5lutgzi',1770325654328,1770325643635,1770325654331);
INSERT INTO "AccountingNote" VALUES ('cmldhfb8d0005wlpomftppsaq','cml9xi5gi000fwlw83bvg87et','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye','تجربة كده',2220.0,'PENDING',NULL,NULL,1770539367326,1770539367326);
INSERT INTO "AccountingNote" VALUES ('cmldhg8zo000bwlpo2335viv1','cml9xi5gi000fwlw83bvg87et','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye','صلح الماسورة',1110.0,'CONVERTED','cmldhlbsj0003wlecbacbxcdu',1770539648028,1770539411077,1770539648031);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi62k005zwlw8oif49rgu','Order 1','3kg chicken, 2l milk, 1kg rice','NEW','Normal',NULL,1770324509757,1770324509757,NULL,'cml9xi5qg003bwlw81bl11aou','cml9xi5i9000vwlw8f1j14dmc','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi62s0061wlw8g4chb6qj','Order 2','3kg chicken, 2l milk, 1kg rice','IN_PROGRESS','Normal',NULL,1770324509764,1770324509764,NULL,'cml9xi5vr0049wlw85nmv49iy','cml9xi5i1000twlw8l2qne4w9','cml9xi5dz0002wlw8emdz9tye',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi62z0063wlw83deaqpaf','Order 3','Baby formula, diapers, wipes','DELIVERED','Normal','Delivered to front desk',1770324509771,1770324509771,1770324509770,'cml9xi5sz003twlw80bnraf2f','cml9xi5hn000pwlw82o33iaof','cml9xi5e70003wlw86ntjlgh4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "DeliveryOrder" VALUES ('cml9xi6360065wlw8kysj68ij','Order 4','Baby formula, diapers, wipes','DELIVERED','Normal','Delivered to front desk',1770324509778,1770324509778,1770324509777,'cml9xi5y7004twlw8q0aoxrga','cml9xi5i1000twlw8l2qne4w9','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cml9xi63c0067wlw8zbqt520c','Order 5','Bread, eggs, cheese, butter','IN_PROGRESS','Normal',NULL,1770324509785,1770324509785,NULL,'cml9xi5q20037wlw8352qym7y','cml9xi5hn000pwlw82o33iaof','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi63j0069wlw8tdicqfvp','Order 6','Cleaning supplies, detergent, soap','NEW','Normal',NULL,1770324509791,1770324509791,NULL,'cml9xi5wj004fwlw8agqfsb7n','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi63p006bwlw8pwa2yzn3','Order 7','Baby formula, diapers, wipes','IN_PROGRESS','Normal',NULL,1770324509797,1770324509797,NULL,'cml9xi5xq004pwlw8t93e8js2','cml9xi5j00013wlw8q6vr2xd0','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi63v006dwlw8szuog7z4','Order 8','Bread, eggs, cheese, butter','IN_PROGRESS','Normal',NULL,1770324509804,1770324509804,NULL,'cml9xi5tx003xwlw8dl90pl2p','cml9xi5jd0017wlw8bpznvjhc','cml9xi5dz0002wlw8emdz9tye',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cml9xi642006fwlw8i16khgpe','Order 9','Bread, eggs, cheese, butter','DELIVERED','Normal','Delivered to front desk',1770324509810,1770324509810,1770324509809,'cml9xi5q90039wlw8q0kp9qcx','cml9xi5jd0017wlw8bpznvjhc','cml9xi5e70003wlw86ntjlgh4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "DeliveryOrder" VALUES ('cml9xi64a006hwlw8ytkpnlcf','Order 10','Bread, eggs, cheese, butter','DELIVERED','Normal','Delivered to front desk',1770324509818,1770324509818,1770324509817,'cml9xi5tx003xwlw8dl90pl2p','cml9xi5jd0017wlw8bpznvjhc','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fw2005zwls0kd69fcyj','Order 1','Cleaning supplies, detergent, soap','DELIVERED','Normal','Delivered to front desk',1770334086962,1770334086962,1770334086961,'cmla35yll0045wle0ovilrz04','cml9xi5j00013wlw8q6vr2xd0','cml9xi5e70003wlw86ntjlgh4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fw90061wls0ksirpoqe','Order 2','Cleaning supplies, detergent, soap','DELIVERED','Normal','Delivered to front desk',1770334086970,1770334086970,1770334086969,'cmla35yl60041wle0fkaqf02k','cml9xi5i9000vwlw8f1j14dmc','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fwg0063wls08mm5gsg4','Order 3','3kg chicken, 2l milk, 1kg rice','IN_PROGRESS','Normal',NULL,1770334086977,1770334086977,NULL,'cmla35yit003fwle053ae4wqg','cml9xi5in000zwlw8jji4tbz6','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cmla37fwo0065wls0j3ik284a','Order 4','Cleaning supplies, detergent, soap','DELIVERED','Normal','Delivered to front desk',1770334086985,1770334086985,1770334086983,'cmla35yl60041wle0fkaqf02k','cml9xi5i9000vwlw8f1j14dmc','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fww0067wls0efyi3o9f','Order 5','3kg chicken, 2l milk, 1kg rice','NEW','Normal',NULL,1770334086993,1770334086993,NULL,'cmla35ynw004twle0c3vwyo4m','cml9xi5hn000pwlw82o33iaof','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cmla37fx50069wls0g58rzint','Order 6','3kg chicken, 2l milk, 1kg rice','DELIVERED','Normal','Delivered to front desk',1770334087001,1770334087001,1770334087000,'cmla35ymd004dwle0ywkst9sk','cml9xi5in000zwlw8jji4tbz6','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fxe006bwls0xhzw4d37','Order 7','3kg chicken, 2l milk, 1kg rice','IN_PROGRESS','Normal',NULL,1770334087011,1770334087011,NULL,'cmla35ync004nwle0efwwcpha','cml9xi5i1000twlw8l2qne4w9','cml9xi5e70003wlw86ntjlgh4',NULL);
INSERT INTO "DeliveryOrder" VALUES ('cmla37fxn006dwls0wold2c1m','Order 8','Cleaning supplies, detergent, soap','DELIVERED','Normal','Delivered to front desk',1770334087019,1770334087019,1770334087018,'cmla35ylt0047wle0cogwkbq3','cml9xi5hn000pwlw82o33iaof','cml9xi5dz0002wlw8emdz9tye','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fxw006fwls0xeypjvn6','Order 9','Bread, eggs, cheese, butter','DELIVERED','Normal','Delivered to front desk',1770334087028,1770334087028,1770334087027,'cmla35ykd003twle0uassg83s','cml9xi5it0011wlw8jlcuxq6r','cml9xi5e70003wlw86ntjlgh4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "DeliveryOrder" VALUES ('cmla37fy4006hwls007gw9fam','Order 10','Baby formula, diapers, wipes','NEW','Normal',NULL,1770334087036,1770334087036,NULL,'cmla35yid003bwle0rwhis576','cml9xi5it0011wlw8jlcuxq6r','cml9xi5dz0002wlw8emdz9tye',NULL);
INSERT INTO "Invoice" VALUES ('cml9xi64i006jwlw8db7t00cm','INV-2025-001-GH-B01','MANAGEMENT_SERVICE',7602.37242742045,'cml9xi5me0023wlw8f7k19ldy','cml9xi5hn000pwlw82o33iaof',1770324509826,7602.37,0.0,1,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi64r006lwlw8bozrgl5y','INV-2025-002-GH-B02','MANAGEMENT_SERVICE',6836.00488724326,'cml9xi5mm0025wlw8y0utoiq5','cml9xi5hv000rwlw8bvm5a9n4',1770324509835,0.0,6836.00488724326,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi64z006nwlw8s7va0erj','INV-2025-003-GH-B03','MANAGEMENT_SERVICE',5170.7820973166,'cml9xi5ms0027wlw8cl957m59','cml9xi5i1000twlw8l2qne4w9',1770324509843,0.0,5170.7820973166,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi658006pwlw8b2im3omj','INV-2025-004-GH-B04','MANAGEMENT_SERVICE',5288.67535357559,'cml9xi5mz0029wlw85dpyl2xj','cml9xi5i9000vwlw8f1j14dmc',1770324509852,0.0,5288.67535357559,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi65h006rwlw88eogyoy2','INV-2025-005-GH-B05','MANAGEMENT_SERVICE',6746.28490657514,'cml9xi5n5002bwlw8ifo58byb','cml9xi5if000xwlw8y30jc3aw',1770324509861,0.0,6746.28490657514,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi65q006twlw83lrivjdq','CLM-2025-001-GH-B06','CLAIM',880.185356810314,'cml9xi5nb002dwlw8wgo9aijk','cml9xi5in000zwlw8jji4tbz6',1770324509870,880.19,0.0,1,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi66t006vwlw8benxncss','CLM-2025-002-GH-B07','CLAIM',1152.22300273245,'cml9xi5ni002fwlw8txr0qp8l','cml9xi5it0011wlw8jlcuxq6r',1770324509909,0.0,1152.22300273245,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9xi67u006xwlw8pcs3w8m3','CLM-2025-003-GH-B08','CLAIM',1270.10753716908,'cml9xi5nn002hwlw8khaq4cx8','cml9xi5j00013wlw8q6vr2xd0',1770324509947,0.0,1270.10753716908,0,NULL);
INSERT INTO "Invoice" VALUES ('cml9y6p6w0007wl3kehvmp2zv','INV-1770325654279','CLAIM',500.0,'cml9xi5me0023wlw8f7k19ldy','cml9xi5hn000pwlw82o33iaof',1770325654281,500.0,0.0,1,NULL);
INSERT INTO "Invoice" VALUES ('cmldhlbs50001wlecedj2sk07','INV-1770539647967','CLAIM',1110.0,'cml9xi5mm0025wlw8y0utoiq5','cml9xi5hv000rwlw8bvm5a9n4',1770539647972,0.0,1110.0,0,NULL);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5hn000pwlw82o33iaof','Test 1','GH-B01','Building','cml9xi5gi000fwlw83bvg87et',15000.0,7,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5hv000rwlw8bvm5a9n4','Building 2','GH-B02','Building','cml9xi5gi000fwlw83bvg87et',511.209780611666,7,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5i1000twlw8l2qne4w9','Building 3','GH-B03','Building','cml9xi5gi000fwlw83bvg87et',957.826604504282,2,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5i9000vwlw8f1j14dmc','Building 4','GH-B04','Building','cml9xi5gi000fwlw83bvg87et',572.373017696375,18,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5if000xwlw8y30jc3aw','Building 5','GH-B05','Building','cml9xi5gi000fwlw83bvg87et',694.127312687554,1,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5in000zwlw8jji4tbz6','Building 6','GH-B06','Building','cml9xi5gi000fwlw83bvg87et',507.123553026705,8,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5it0011wlw8jlcuxq6r','Building 7','GH-B07','Building','cml9xi5gi000fwlw83bvg87et',588.297691073285,23,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5j00013wlw8q6vr2xd0','Building 8','GH-B08','Building','cml9xi5gi000fwlw83bvg87et',515.119903766474,22,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5j60015wlw8sj8qysq5','Building 9','GH-B09','Building','cml9xi5gi000fwlw83bvg87et',815.734588721517,3,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5jd0017wlw8bpznvjhc','Building 10','GH-B10','Building','cml9xi5gi000fwlw83bvg87et',823.574490012529,21,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5jl0019wlw8dwwvv0l2','Branch 1','CP-BR01','Branch','cml9xi5gq000hwlw8olknv25d',12000.0,15,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5jr001bwlw8eb9qglqx','Branch 2','CP-BR02','Branch','cml9xi5gq000hwlw8olknv25d',919.661263249667,9,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5jy001dwlw8l2gn0xm2','Branch 3','CP-BR03','Branch','cml9xi5gq000hwlw8olknv25d',1299.98976333588,28,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5k5001fwlw84ft9fep7','Branch 4','CP-BR04','Branch','cml9xi5gq000hwlw8olknv25d',1186.57501820078,2,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5kc001hwlw86dl7qnk3','Branch 5','CP-BR05','Branch','cml9xi5gq000hwlw8olknv25d',868.782389331495,26,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5ki001jwlw8tc45ahz0','Shop 1','CC-SH01','Shop','cml9xi5gy000jwlw8xx1bd4hh',946.25426827577,17,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5ko001lwlw84xxwffmg','Shop 2','CC-SH02','Shop','cml9xi5gy000jwlw8xx1bd4hh',1407.88877147616,12,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5kv001nwlw8q79jm5h8','Shop 3','CC-SH03','Shop','cml9xi5gy000jwlw8xx1bd4hh',1237.29535193211,26,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5l2001pwlw8k4ycjse7','Shop 4','CC-SH04','Shop','cml9xi5gy000jwlw8xx1bd4hh',886.603690395897,2,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5la001rwlw85pwkjsaq','Shop 5','CC-SH05','Shop','cml9xi5gy000jwlw8xx1bd4hh',1479.22282870552,8,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5lg001twlw8twszk1px','Shop 6','CC-SH06','Shop','cml9xi5gy000jwlw8xx1bd4hh',1131.12718612047,15,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5lm001vwlw8x1p5wyqk','Shop 7','CC-SH07','Shop','cml9xi5gy000jwlw8xx1bd4hh',1456.85483157351,2,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5lt001xwlw85w23bqqr','Shop 8','CC-SH08','Shop','cml9xi5gy000jwlw8xx1bd4hh',1109.0411522954,24,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5lz001zwlw8c6sbw9z4','Shop 9','CC-SH09','Shop','cml9xi5gy000jwlw8xx1bd4hh',1011.58864674301,13,1);
INSERT INTO "OperationalUnit" VALUES ('cml9xi5m70021wlw80kuii8sk','Shop 10','CC-SH10','Shop','cml9xi5gy000jwlw8xx1bd4hh',1079.54587837623,20,1);
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5me0023wlw8f7k19ldy','Building 1 Owners Association','+201234565556','ownersGH-B01@email.com','cml9xi5hn000pwlw82o33iaof');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5mm0025wlw8y0utoiq5','Building 2 Owners Association','+201234567689','ownersGH-B02@email.com','cml9xi5hv000rwlw8bvm5a9n4');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5ms0027wlw8cl957m59','Building 3 Owners Association','+201234567649','ownersGH-B03@email.com','cml9xi5i1000twlw8l2qne4w9');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5mz0029wlw85dpyl2xj','Building 4 Owners Association','+201234562749','ownersGH-B04@email.com','cml9xi5i9000vwlw8f1j14dmc');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5n5002bwlw8ifo58byb','Building 5 Owners Association','+201234566923','ownersGH-B05@email.com','cml9xi5if000xwlw8y30jc3aw');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5nb002dwlw8wgo9aijk','Building 6 Owners Association','+201234563293','ownersGH-B06@email.com','cml9xi5in000zwlw8jji4tbz6');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5ni002fwlw8txr0qp8l','Building 7 Owners Association','+201234569739','ownersGH-B07@email.com','cml9xi5it0011wlw8jlcuxq6r');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5nn002hwlw8khaq4cx8','Building 8 Owners Association','+201234566285','ownersGH-B08@email.com','cml9xi5j00013wlw8q6vr2xd0');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5nt002jwlw8k6dxszuf','Building 9 Owners Association','+201234569839','ownersGH-B09@email.com','cml9xi5j60015wlw8sj8qysq5');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5o0002lwlw8zrhetx1i','Building 10 Owners Association','+201234561233','ownersGH-B10@email.com','cml9xi5jd0017wlw8bpznvjhc');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5o6002nwlw8b7ptnoyl','Branch 1 Management','+201234569609','mgmtCP-BR01@email.com','cml9xi5jl0019wlw8dwwvv0l2');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5od002pwlw8l1q8tp8l','Branch 2 Management','+201234568464','mgmtCP-BR02@email.com','cml9xi5jr001bwlw8eb9qglqx');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5oj002rwlw898jbqyyu','Branch 3 Management','+201234563742','mgmtCP-BR03@email.com','cml9xi5jy001dwlw8l2gn0xm2');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5oq002twlw81ipyrax4','Branch 4 Management','+201234566559','mgmtCP-BR04@email.com','cml9xi5k5001fwlw84ft9fep7');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5ow002vwlw83j93ww2c','Branch 5 Management','+201234561191','mgmtCP-BR05@email.com','cml9xi5kc001hwlw86dl7qnk3');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5p4002xwlw8y4blourn','Shop 1 Owner','+201234565460',NULL,'cml9xi5ki001jwlw8tc45ahz0');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5pc002zwlw8gdcbz3rm','Shop 2 Owner','+201234569977',NULL,'cml9xi5ko001lwlw84xxwffmg');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5pj0031wlw8tk3sxnum','Shop 3 Owner','+201234564794',NULL,'cml9xi5kv001nwlw8q79jm5h8');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5pp0033wlw8e6u19jcn','Shop 4 Owner','+201234564557',NULL,'cml9xi5l2001pwlw8k4ycjse7');
INSERT INTO "OwnerAssociation" VALUES ('cml9xi5pv0035wlw8jiolqb4z','Shop 5 Owner','+201234568314',NULL,'cml9xi5la001rwlw85pwkjsaq');
INSERT INTO "Payment" VALUES ('payment-cml9xi65q006twlw83lrivjdq',5000.0,'cml9xi65q006twlw83lrivjdq');
INSERT INTO "Payment" VALUES ('payment-cml9xi66t006vwlw8benxncss',5000.0,'cml9xi66t006vwlw8benxncss');
INSERT INTO "Payment" VALUES ('payment-cml9xi67u006xwlw8pcs3w8m3',5000.0,'cml9xi67u006xwlw8pcs3w8m3');
INSERT INTO "Payment" VALUES ('cml9y51xn0001wl3k7s4n4uq0',7602.37,'cml9xi64i006jwlw8db7t00cm');
INSERT INTO "Payment" VALUES ('cml9y70g0000bwl3k8yyzbdcf',500.0,'cml9y6p6w0007wl3kehvmp2zv');
INSERT INTO "Payment" VALUES ('cmla28iqy0008wl78zvlfxorn',880.19,'cml9xi65q006twlw83lrivjdq');
INSERT INTO "Payroll" VALUES ('cml9xi75d00djwlw896amgzuv','2026-01',76922.8853391364,0.0,76922.8853391364,'PAID',1770242400000,'cml9xi5da0000wlw8xaybqxue',1770324511153,1770324511153);
INSERT INTO "Payroll" VALUES ('cmla37gs600dtwls060yhah8e','2026-01',164211.817994659,0.0,164211.817994659,'PAID',1770242400000,'cml9xi5da0000wlw8xaybqxue',1770334088118,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dkwlw8fwhou8el','cml9xi75d00djwlw896amgzuv','cml9xi6bh007fwlw8e3erk984','Office Staff 1',5915.25702210076,0.0,5915.25702210076,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dlwlw8snrmih4b','cml9xi75d00djwlw896amgzuv','cml9xi6bs007hwlw8wqnnlf5q','Office Staff 2',6001.93640491732,0.0,6001.93640491732,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dmwlw8joswq7ds','cml9xi75d00djwlw896amgzuv','cml9xi6c2007jwlw8o8jb0qoj','Office Staff 3',6854.80759968322,0.0,6854.80759968322,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dnwlw821juodaz','cml9xi75d00djwlw896amgzuv','cml9xi6cb007lwlw8c8zlp6cu','Office Staff 4',6373.99060538276,0.0,6373.99060538276,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dowlw8eytb7vx0','cml9xi75d00djwlw896amgzuv','cml9xi6cl007nwlw8o0731eyl','Office Staff 5',5748.2491300638,0.0,5748.2491300638,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dpwlw8uuiyrmsq','cml9xi75d00djwlw896amgzuv','cml9xi6cu007pwlw88y131mk1','Office Staff 6',5832.50386842547,0.0,5832.50386842547,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dqwlw8ye3eaqed','cml9xi75d00djwlw896amgzuv','cml9xi6d2007rwlw8dm4jspxj','Office Staff 7',6213.73888773122,0.0,6213.73888773122,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00drwlw8v3zdjp8p','cml9xi75d00djwlw896amgzuv','cml9xi6da007twlw8bg28beki','Office Staff 8',6120.59641028593,0.0,6120.59641028593,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dswlw8w8mzhhg3','cml9xi75d00djwlw896amgzuv','cml9xi6dj007vwlw88fyirgrd','Office Staff 9',5162.48908273661,0.0,5162.48908273661,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dtwlw8dxvbv9eb','cml9xi75d00djwlw896amgzuv','cml9xi6ds007xwlw8jj86g3t0','Office Staff 10',6699.31632780934,0.0,6699.31632780934,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00duwlw8h3wejr7v','cml9xi75d00djwlw896amgzuv','cml9xi6e4007zwlw82m302tdm','Sara Project Manager',8000.0,0.0,8000.0,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cml9xi75d00dvwlw8nrui24ic','cml9xi75d00djwlw896amgzuv','cml9xi6ee0081wlw8cclq4mdx','Mohamed Project Manager',8000.0,0.0,8000.0,1770324511153);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600duwls09r34nm4b','cmla37gs600dtwls060yhah8e','cml9xi6bh007fwlw8e3erk984','Office Staff 1',5915.25702210076,0.0,5915.25702210076,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600dvwls0o3pigduk','cmla37gs600dtwls060yhah8e','cml9xi6bs007hwlw8wqnnlf5q','Office Staff 2',6001.93640491732,0.0,6001.93640491732,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600dwwls0lu5u1gi6','cmla37gs600dtwls060yhah8e','cml9xi6c2007jwlw8o8jb0qoj','Office Staff 3',6854.80759968322,0.0,6854.80759968322,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600dxwls0dhopb2dy','cmla37gs600dtwls060yhah8e','cml9xi6cb007lwlw8c8zlp6cu','Office Staff 4',6373.99060538276,0.0,6373.99060538276,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600dywls0gfd0xbsd','cmla37gs600dtwls060yhah8e','cml9xi6cl007nwlw8o0731eyl','Office Staff 5',5748.2491300638,0.0,5748.2491300638,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600dzwls0o7m6mzsm','cmla37gs600dtwls060yhah8e','cml9xi6cu007pwlw88y131mk1','Office Staff 6',5832.50386842547,0.0,5832.50386842547,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e0wls058nkkkeg','cmla37gs600dtwls060yhah8e','cml9xi6d2007rwlw8dm4jspxj','Office Staff 7',6213.73888773122,0.0,6213.73888773122,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e1wls0eqoucibl','cmla37gs600dtwls060yhah8e','cml9xi6da007twlw8bg28beki','Office Staff 8',6120.59641028593,0.0,6120.59641028593,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e2wls0eiomrawb','cmla37gs600dtwls060yhah8e','cml9xi6dj007vwlw88fyirgrd','Office Staff 9',5162.48908273661,0.0,5162.48908273661,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e3wls0mrhtz1cf','cmla37gs600dtwls060yhah8e','cml9xi6ds007xwlw8jj86g3t0','Office Staff 10',6699.31632780934,0.0,6699.31632780934,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e4wls07ak2ofpg','cmla37gs600dtwls060yhah8e','cml9xi6e4007zwlw82m302tdm','Sara Project Manager',8000.0,0.0,8000.0,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e5wls0b869tv54','cmla37gs600dtwls060yhah8e','cml9xi6ee0081wlw8cclq4mdx','Mohamed Project Manager',8000.0,0.0,8000.0,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e6wls06lbk6qn5','cmla37gs600dtwls060yhah8e','cmla37g18007fwls0lkxgfdeu','Office Staff 1',7817.12568999899,0.0,7817.12568999899,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e7wls08l05i56g','cmla37gs600dtwls060yhah8e','cmla37g1g007hwls0mior4ngj','Office Staff 2',7244.19209026037,0.0,7244.19209026037,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e8wls00n8lqnb7','cmla37gs600dtwls060yhah8e','cmla37g1p007jwls05zomeiue','Office Staff 3',7877.10388536685,0.0,7877.10388536685,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600e9wls06fufp1oz','cmla37gs600dtwls060yhah8e','cmla37g1w007lwls09xvmziho','Office Staff 4',6922.65338771696,0.0,6922.65338771696,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600eawls02g0j7m70','cmla37gs600dtwls060yhah8e','cmla37g27007nwls0ncm6zu7m','Office Staff 5',5990.35369201405,0.0,5990.35369201405,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600ebwls0mjossd7a','cmla37gs600dtwls060yhah8e','cmla37g2e007pwls0iwahkz6v','Office Staff 6',7539.47188828436,0.0,7539.47188828436,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600ecwls0cff9ao6c','cmla37gs600dtwls060yhah8e','cmla37g2l007rwls0c0b4cu6x','Office Staff 7',7090.01303247845,0.0,7090.01303247845,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600edwls0pdaket70','cmla37gs600dtwls060yhah8e','cmla37g2t007twls0dlka1kuv','Office Staff 8',6130.25117283349,0.0,6130.25117283349,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600eewls0dr00zufl','cmla37gs600dtwls060yhah8e','cmla37g31007vwls0f8imggd4','Office Staff 9',7102.85214828055,0.0,7102.85214828055,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600efwls0wcbef1n3','cmla37gs600dtwls060yhah8e','cmla37g39007xwls0yyti64xd','Office Staff 10',7574.91566828809,0.0,7574.91566828809,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600egwls0khv6vbz2','cmla37gs600dtwls060yhah8e','cmla37g3h007zwls0dv57o8u2','Sara Project Manager',8000.0,0.0,8000.0,1770334088118);
INSERT INTO "PayrollItem" VALUES ('cmla37gs600ehwls0cayp4cqb','cmla37gs600dtwls060yhah8e','cmla37g3q0081wls0pkx8qec3','Mohamed Project Manager',8000.0,0.0,8000.0,1770334088118);
INSERT INTO "Project" VALUES ('cml9xi5gi000fwlw83bvg87et','Green Hills Compound','cml9xi5ee0004wlw8pg1mrjhg',1,1,1770324508962,1770324508962);
INSERT INTO "Project" VALUES ('cml9xi5gq000hwlw8olknv25d','Care Pharmacy Chain','cml9xi5el0005wlw87jdwtxq6',1,1,1770324508971,1770324508971);
INSERT INTO "Project" VALUES ('cml9xi5gy000jwlw8xx1bd4hh','City Center Mall','cml9xi5et0006wlw890p3tbdr',1,1,1770324508979,1770324508979);
INSERT INTO "Project" VALUES ('cml9xi5h7000lwlw808i5ibr2','Al-Tayeb Tower','cml9xi5ez0007wlw8rsjznicj',1,1,1770324508987,1770324508987);
INSERT INTO "Project" VALUES ('cml9xi5he000nwlw8qckmgokc','Red Sea Resort','cml9xi5f70008wlw8yfkhcat4',1,1,1770324508995,1770324508995);
INSERT INTO "ProjectAssignment" VALUES ('cml9xi5yh004vwlw8rpke4901','cml9xi5dz0002wlw8emdz9tye','cml9xi5gi000fwlw83bvg87et');
INSERT INTO "ProjectAssignment" VALUES ('cml9xi5ys004xwlw8gdl4w4ad','cml9xi5dz0002wlw8emdz9tye','cml9xi5gq000hwlw8olknv25d');
INSERT INTO "ProjectAssignment" VALUES ('cml9xi5z2004zwlw8b3xj99ze','cml9xi5e70003wlw86ntjlgh4','cml9xi5gy000jwlw8xx1bd4hh');
INSERT INTO "ProjectAssignment" VALUES ('cml9xi5za0051wlw8077s4c4h','cml9xi5e70003wlw86ntjlgh4','cml9xi5h7000lwlw808i5ibr2');
INSERT INTO "ProjectAssignment" VALUES ('cml9xi5zi0053wlw8pjnkd592','cml9xi5dz0002wlw8emdz9tye','cml9xi5he000nwlw8qckmgokc');
INSERT INTO "ProjectType" VALUES ('cml9xi5ee0004wlw8pg1mrjhg','سكني',1770324508887,1770324508887);
INSERT INTO "ProjectType" VALUES ('cml9xi5el0005wlw87jdwtxq6','صيدلية',1770324508894,1770324508894);
INSERT INTO "ProjectType" VALUES ('cml9xi5et0006wlw890p3tbdr','مول',1770324508901,1770324508901);
INSERT INTO "ProjectType" VALUES ('cml9xi5ez0007wlw8rsjznicj','مبنى',1770324508907,1770324508907);
INSERT INTO "ProjectType" VALUES ('cml9xi5f70008wlw8yfkhcat4','منتجع سياحي',1770324508915,1770324508915);
INSERT INTO "ProjectType" VALUES ('cmla1lops0000wl78nvul0x3x','شاطئ',1770331392348,1770331392348);
INSERT INTO "Resident" VALUES ('cml9xi5q20037wlw8352qym7y','Resident 1',NULL,'+2010000001',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770324509306,1770324509306,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5q90039wlw8q0kp9qcx','Resident 2',NULL,'+2010000002',NULL,'ACTIVE','cml9xi5jd0017wlw8bpznvjhc',1770324509313,1770324509313,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5qg003bwlw81bl11aou','Resident 3',NULL,'+2010000003',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770324509321,1770324509321,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5qr003dwlw85n7tnh03','Resident 4',NULL,'+2010000004',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770324509331,1770324509331,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5qy003fwlw8fqu87ca5','Resident 5',NULL,'+2010000005',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770324509338,1770324509338,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5r5003hwlw84wzk6v3v','Resident 6',NULL,'+2010000006',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770324509345,1770324509345,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5rs003jwlw8m336dasm','Resident 7',NULL,'+2010000007',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770324509369,1770324509369,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5s2003lwlw8vsqo176a','Resident 8',NULL,'+2010000008',NULL,'ACTIVE','cml9xi5if000xwlw8y30jc3aw',1770324509378,1770324509378,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5sb003nwlw8wndp6l9m','Resident 9',NULL,'+2010000009',NULL,'ACTIVE','cml9xi5jd0017wlw8bpznvjhc',1770324509387,1770324509387,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5si003pwlw8iazizh6p','Resident 10',NULL,'+2010000010',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770324509395,1770324509395,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5sq003rwlw89jr16e1r','Resident 11',NULL,'+2010000011',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770324509403,1770324509403,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5sz003twlw80bnraf2f','Resident 12',NULL,'+2010000012',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770324509411,1770324509411,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5t7003vwlw8383i9y31','Resident 13',NULL,'+2010000013',NULL,'ACTIVE','cml9xi5j60015wlw8sj8qysq5',1770324509419,1770324509419,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5tx003xwlw8dl90pl2p','Resident 14',NULL,'+2010000014',NULL,'ACTIVE','cml9xi5jd0017wlw8bpznvjhc',1770324509445,1770324509445,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5uk003zwlw8h6e9zg8g','Resident 15',NULL,'+2010000015',NULL,'ACTIVE','cml9xi5if000xwlw8y30jc3aw',1770324509468,1770324509468,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5ut0041wlw85qycsmgo','Resident 16',NULL,'+2010000016',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770324509478,1770324509478,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5v20043wlw86vcipxv6','Resident 17',NULL,'+2010000017',NULL,'ACTIVE','cml9xi5j60015wlw8sj8qysq5',1770324509486,1770324509486,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5va0045wlw8f28amgc6','Resident 18',NULL,'+2010000018',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770324509494,1770324509494,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5vi0047wlw86zaygtkb','Resident 19',NULL,'+2010000019',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770324509503,1770324509503,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5vr0049wlw85nmv49iy','Resident 20',NULL,'+2010000020',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770324509511,1770324509511,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5w0004bwlw8lhcxkc4a','Resident 21',NULL,'+2010000021',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770324509520,1770324509520,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5w8004dwlw8ce93hc30','Resident 22',NULL,'+2010000022',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770324509528,1770324509528,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5wj004fwlw8agqfsb7n','Resident 23',NULL,'+2010000023',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770324509539,1770324509539,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5wq004hwlw887lzg7nv','Resident 24',NULL,'+2010000024',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770324509547,1770324509547,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5wz004jwlw87gljur27','Resident 25',NULL,'+2010000025',NULL,'ACTIVE','cml9xi5in000zwlw8jji4tbz6',1770324509555,1770324509555,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5x9004lwlw8crd8u8ce','Resident 26',NULL,'+2010000026',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770324509566,1770324509566,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5xh004nwlw80nw4450f','Resident 27',NULL,'+2010000027',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770324509573,1770324509573,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5xq004pwlw8t93e8js2','Resident 28',NULL,'+2010000028',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770324509582,1770324509582,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5xz004rwlw8ttrwhi0z','Resident 29',NULL,'+2010000029',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770324509591,1770324509591,NULL);
INSERT INTO "Resident" VALUES ('cml9xi5y7004twlw8q0aoxrga','Resident 30',NULL,'+2010000030',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770324509600,1770324509600,NULL);
INSERT INTO "Resident" VALUES ('cmla35yhs0037wle0a198to2t','Resident 1',NULL,'+2010000001',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770334017760,1770334086566,'+2010000001');
INSERT INTO "Resident" VALUES ('cmla35yi40039wle0qfjt51dp','Resident 2',NULL,'+2010000002',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770334017772,1770334086602,'+2010000002');
INSERT INTO "Resident" VALUES ('cmla35yid003bwle0rwhis576','Resident 3',NULL,'+2010000003',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017781,1770334086612,'+2010000003');
INSERT INTO "Resident" VALUES ('cmla35yin003dwle0a5ikja0x','Resident 4',NULL,'+2010000004',NULL,'ACTIVE','cml9xi5if000xwlw8y30jc3aw',1770334017791,1770334086621,'+2010000004');
INSERT INTO "Resident" VALUES ('cmla35yit003fwle053ae4wqg','Resident 5',NULL,'+2010000005',NULL,'ACTIVE','cml9xi5in000zwlw8jji4tbz6',1770334017798,1770334086639,'+2010000005');
INSERT INTO "Resident" VALUES ('cmla35yj3003hwle04bxxtqdr','Resident 6',NULL,'+2010000006',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770334017807,1770334086649,'+2010000006');
INSERT INTO "Resident" VALUES ('cmla35yjb003jwle0wfnkpyz9','Resident 7',NULL,'+2010000007',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017815,1770334086660,'+2010000007');
INSERT INTO "Resident" VALUES ('cmla35yji003lwle0z8av2or0','Resident 8',NULL,'+2010000008',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770334017822,1770334086670,'+2010000008');
INSERT INTO "Resident" VALUES ('cmla35yjp003nwle0675iwkom','Resident 9',NULL,'+2010000009',NULL,'ACTIVE','cml9xi5if000xwlw8y30jc3aw',1770334017829,1770334086679,'+2010000009');
INSERT INTO "Resident" VALUES ('cmla35yjv003pwle04vfq6ikv','Resident 10',NULL,'+2010000010',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770334017835,1770334086688,'+2010000010');
INSERT INTO "Resident" VALUES ('cmla35yk4003rwle0pe360hqu','Resident 11',NULL,'+2010000011',NULL,'ACTIVE','cml9xi5jd0017wlw8bpznvjhc',1770334017844,1770334086697,'+2010000011');
INSERT INTO "Resident" VALUES ('cmla35ykd003twle0uassg83s','Resident 12',NULL,'+2010000012',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017854,1770334086705,'+2010000012');
INSERT INTO "Resident" VALUES ('cmla35ykl003vwle0fh0xkf3m','Resident 13',NULL,'+2010000013',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770334017862,1770334086711,'+2010000013');
INSERT INTO "Resident" VALUES ('cmla35ykr003xwle08bpga6tn','Resident 14',NULL,'+2010000014',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017868,1770334086719,'+2010000014');
INSERT INTO "Resident" VALUES ('cmla35ykz003zwle0phytcntv','Resident 15',NULL,'+2010000015',NULL,'ACTIVE','cml9xi5in000zwlw8jji4tbz6',1770334017875,1770334086727,'+2010000015');
INSERT INTO "Resident" VALUES ('cmla35yl60041wle0fkaqf02k','Resident 16',NULL,'+2010000016',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770334017882,1770334086735,'+2010000016');
INSERT INTO "Resident" VALUES ('cmla35yld0043wle0sksvszvl','Resident 17',NULL,'+2010000017',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017889,1770334086742,'+2010000017');
INSERT INTO "Resident" VALUES ('cmla35yll0045wle0ovilrz04','Resident 18',NULL,'+2010000018',NULL,'ACTIVE','cml9xi5j00013wlw8q6vr2xd0',1770334017897,1770334086750,'+2010000018');
INSERT INTO "Resident" VALUES ('cmla35ylt0047wle0cogwkbq3','Resident 19',NULL,'+2010000019',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770334017906,1770334086757,'+2010000019');
INSERT INTO "Resident" VALUES ('cmla35ym00049wle02vs8kv46','Resident 20',NULL,'+2010000020',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770334017913,1770334086765,'+2010000020');
INSERT INTO "Resident" VALUES ('cmla35ym7004bwle0fq5kz406','Resident 21',NULL,'+2010000021',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770334017919,1770334086773,'+2010000021');
INSERT INTO "Resident" VALUES ('cmla35ymd004dwle0ywkst9sk','Resident 22',NULL,'+2010000022',NULL,'ACTIVE','cml9xi5in000zwlw8jji4tbz6',1770334017926,1770334086781,'+2010000022');
INSERT INTO "Resident" VALUES ('cmla35yml004fwle0xkqu49yd','Resident 23',NULL,'+2010000023',NULL,'ACTIVE','cml9xi5it0011wlw8jlcuxq6r',1770334017933,1770334086788,'+2010000023');
INSERT INTO "Resident" VALUES ('cmla35yms004hwle0wiasufze','Resident 24',NULL,'+2010000024',NULL,'ACTIVE','cml9xi5j60015wlw8sj8qysq5',1770334017941,1770334086797,'+2010000024');
INSERT INTO "Resident" VALUES ('cmla35ymy004jwle0bk83d30a','Resident 25',NULL,'+2010000025',NULL,'ACTIVE','cml9xi5in000zwlw8jji4tbz6',1770334017946,1770334086804,'+2010000025');
INSERT INTO "Resident" VALUES ('cmla35yn5004lwle0uc8av1yv','Resident 26',NULL,'+2010000026',NULL,'ACTIVE','cml9xi5i9000vwlw8f1j14dmc',1770334017953,1770334086810,'+2010000026');
INSERT INTO "Resident" VALUES ('cmla35ync004nwle0efwwcpha','Resident 27',NULL,'+2010000027',NULL,'ACTIVE','cml9xi5i1000twlw8l2qne4w9',1770334017960,1770334086817,'+2010000027');
INSERT INTO "Resident" VALUES ('cmla35ynj004pwle0l2ruaobj','Resident 28',NULL,'+2010000028',NULL,'ACTIVE','cml9xi5hv000rwlw8bvm5a9n4',1770334017967,1770334086823,'+2010000028');
INSERT INTO "Resident" VALUES ('cmla35ynp004rwle0931y2f0f','Resident 29',NULL,'+2010000029',NULL,'ACTIVE','cml9xi5jd0017wlw8bpznvjhc',1770334017974,1770334086830,'+2010000029');
INSERT INTO "Resident" VALUES ('cmla35ynw004twle0c3vwyo4m','Resident 30',NULL,'+2010000030',NULL,'ACTIVE','cml9xi5hn000pwlw82o33iaof',1770334017980,1770334086837,'+2010000030');
INSERT INTO "Staff" VALUES ('cml9xi6bh007fwlw8e3erk984','Office Staff 1','OFFICE_STAFF','ACCOUNTANT','+20109999101',5915.25702210076,'EGP','ACTIVE',26,'cml9xi5in000zwlw8jji4tbz6',0,1770324510077,1770324510077);
INSERT INTO "Staff" VALUES ('cml9xi6bs007hwlw8wqnnlf5q','Office Staff 2','OFFICE_STAFF','MANAGER','+20109999102',6001.93640491732,'EGP','ACTIVE',16,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510088,1770324510088);
INSERT INTO "Staff" VALUES ('cml9xi6c2007jwlw8o8jb0qoj','Office Staff 3','OFFICE_STAFF','MANAGER','+20109999103',6854.80759968322,'EGP','ACTIVE',2,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510098,1770324510098);
INSERT INTO "Staff" VALUES ('cml9xi6cb007lwlw8c8zlp6cu','Office Staff 4','OFFICE_STAFF','ACCOUNTANT','+20109999104',6373.99060538276,'EGP','ACTIVE',3,'cml9xi5in000zwlw8jji4tbz6',0,1770324510107,1770324510107);
INSERT INTO "Staff" VALUES ('cml9xi6cl007nwlw8o0731eyl','Office Staff 5','OFFICE_STAFF','ACCOUNTANT','+20109999105',5748.2491300638,'EGP','ON_LEAVE',29,'cml9xi5jd0017wlw8bpznvjhc',0,1770324510118,1770324510118);
INSERT INTO "Staff" VALUES ('cml9xi6cu007pwlw88y131mk1','Office Staff 6','OFFICE_STAFF','ACCOUNTANT','+20109999106',5832.50386842547,'EGP','ACTIVE',2,'cml9xi5hn000pwlw82o33iaof',0,1770324510127,1770324510127);
INSERT INTO "Staff" VALUES ('cml9xi6d2007rwlw8dm4jspxj','Office Staff 7','OFFICE_STAFF','MANAGER','+20109999107',6213.73888773122,'EGP','ACTIVE',23,'cml9xi5jd0017wlw8bpznvjhc',0,1770324510135,1770324510135);
INSERT INTO "Staff" VALUES ('cml9xi6da007twlw8bg28beki','Office Staff 8','OFFICE_STAFF','ACCOUNTANT','+20109999108',6120.59641028593,'EGP','INACTIVE',4,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510143,1770324510143);
INSERT INTO "Staff" VALUES ('cml9xi6dj007vwlw88fyirgrd','Office Staff 9','OFFICE_STAFF','MANAGER','+20109999109',5162.48908273661,'EGP','ACTIVE',11,'cml9xi5i9000vwlw8f1j14dmc',0,1770324510151,1770324510151);
INSERT INTO "Staff" VALUES ('cml9xi6ds007xwlw8jj86g3t0','Office Staff 10','OFFICE_STAFF','ACCOUNTANT','+20109999110',6699.31632780934,'EGP','ACTIVE',22,'cml9xi5it0011wlw8jlcuxq6r',0,1770324510160,1770324510160);
INSERT INTO "Staff" VALUES ('cml9xi6e4007zwlw82m302tdm','Sara Project Manager','OFFICE_STAFF','MANAGER','+201000000001',8000.0,'EGP','ACTIVE',15,'cml9xi5hn000pwlw82o33iaof',1,1770324510173,1770324510173);
INSERT INTO "Staff" VALUES ('cml9xi6ee0081wlw8cclq4mdx','Mohamed Project Manager','OFFICE_STAFF','MANAGER','+201000000002',8000.0,'EGP','ACTIVE',15,'cml9xi5hv000rwlw8bvm5a9n4',1,1770324510183,1770324510183);
INSERT INTO "Staff" VALUES ('cml9xi6eo0083wlw8phxm9esb','Field Worker 1','FIELD_WORKER','CARPENTER','+20108888101',NULL,'EGP','ACTIVE',NULL,'cml9xi5if000xwlw8y30jc3aw',0,1770324510192,1770324510192);
INSERT INTO "Staff" VALUES ('cml9xi6ew0085wlw8krmv31tj','Field Worker 2','FIELD_WORKER','PAINTER','+20108888102',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510200,1770324510200);
INSERT INTO "Staff" VALUES ('cml9xi6f30087wlw83l9g3ckl','Field Worker 3','FIELD_WORKER','PAINTER','+20108888103',NULL,'EGP','INACTIVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510207,1770324510207);
INSERT INTO "Staff" VALUES ('cml9xi6fc0089wlw87dgglkmr','Field Worker 4','FIELD_WORKER','CARPENTER','+20108888104',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5it0011wlw8jlcuxq6r',0,1770324510216,1770324510216);
INSERT INTO "Staff" VALUES ('cml9xi6fl008bwlw89btl489h','Field Worker 5','FIELD_WORKER','GENERAL_WORKER','+20108888105',NULL,'EGP','ACTIVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510225,1770324510225);
INSERT INTO "Staff" VALUES ('cml9xi6ft008dwlw8qhcenfoo','Field Worker 6','FIELD_WORKER','PLUMBER','+20108888106',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770324510234,1770324510234);
INSERT INTO "Staff" VALUES ('cml9xi6g1008fwlw84w0pggts','Field Worker 7','FIELD_WORKER','ELECTRICIAN','+20108888107',NULL,'EGP','ACTIVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770324510241,1770324510241);
INSERT INTO "Staff" VALUES ('cml9xi6gb008hwlw80xgfoprz','Field Worker 8','FIELD_WORKER','GENERAL_WORKER','+20108888108',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510251,1770324510251);
INSERT INTO "Staff" VALUES ('cml9xi6gk008jwlw8j8202kas','Field Worker 9','FIELD_WORKER','PLUMBER','+20108888109',NULL,'EGP','INACTIVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770324510260,1770324510260);
INSERT INTO "Staff" VALUES ('cml9xi6gv008lwlw89b85yqe2','Field Worker 10','FIELD_WORKER','PAINTER','+20108888110',NULL,'EGP','INACTIVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770324510272,1770324510272);
INSERT INTO "Staff" VALUES ('cml9xi6h3008nwlw8x6oq9udh','Field Worker 11','FIELD_WORKER','ELECTRICIAN','+20108888111',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5it0011wlw8jlcuxq6r',0,1770324510280,1770324510280);
INSERT INTO "Staff" VALUES ('cml9xi6hc008pwlw88n66v54p','Field Worker 12','FIELD_WORKER','PLUMBER','+20108888112',NULL,'EGP','ACTIVE',NULL,'cml9xi5j60015wlw8sj8qysq5',0,1770324510289,1770324510289);
INSERT INTO "Staff" VALUES ('cml9xi6hk008rwlw8fky1cucw','Field Worker 13','FIELD_WORKER','PLUMBER','+20108888113',NULL,'EGP','ACTIVE',NULL,'cml9xi5j60015wlw8sj8qysq5',0,1770324510296,1770324510296);
INSERT INTO "Staff" VALUES ('cml9xi6hs008twlw8c4qo7wfu','Field Worker 14','FIELD_WORKER','ELECTRICIAN','+20108888114',NULL,'EGP','INACTIVE',NULL,'cml9xi5j00013wlw8q6vr2xd0',0,1770324510304,1770324510304);
INSERT INTO "Staff" VALUES ('cml9xi6i0008vwlw8k1p8koel','Field Worker 15','FIELD_WORKER','ELECTRICIAN','+20108888115',NULL,'EGP','ACTIVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770324510312,1770324510312);
INSERT INTO "Staff" VALUES ('cmla37g18007fwls0lkxgfdeu','Office Staff 1','OFFICE_STAFF','MANAGER','+20109999101',7817.12568999899,'EGP','INACTIVE',17,'cml9xi5j60015wlw8sj8qysq5',0,1770334087149,1770334087149);
INSERT INTO "Staff" VALUES ('cmla37g1g007hwls0mior4ngj','Office Staff 2','OFFICE_STAFF','MANAGER','+20109999102',7244.19209026037,'EGP','ON_LEAVE',16,'cml9xi5i9000vwlw8f1j14dmc',0,1770334087156,1770334087156);
INSERT INTO "Staff" VALUES ('cmla37g1p007jwls05zomeiue','Office Staff 3','OFFICE_STAFF','ACCOUNTANT','+20109999103',7877.10388536685,'EGP','INACTIVE',26,'cml9xi5j00013wlw8q6vr2xd0',0,1770334087166,1770334087166);
INSERT INTO "Staff" VALUES ('cmla37g1w007lwls09xvmziho','Office Staff 4','OFFICE_STAFF','ACCOUNTANT','+20109999104',6922.65338771696,'EGP','ON_LEAVE',18,'cml9xi5it0011wlw8jlcuxq6r',0,1770334087173,1770334087173);
INSERT INTO "Staff" VALUES ('cmla37g27007nwls0ncm6zu7m','Office Staff 5','OFFICE_STAFF','MANAGER','+20109999105',5990.35369201405,'EGP','ON_LEAVE',30,'cml9xi5j60015wlw8sj8qysq5',0,1770334087183,1770334087183);
INSERT INTO "Staff" VALUES ('cmla37g2e007pwls0iwahkz6v','Office Staff 6','OFFICE_STAFF','ACCOUNTANT','+20109999106',7539.47188828436,'EGP','INACTIVE',18,'cml9xi5hn000pwlw82o33iaof',0,1770334087191,1770334087191);
INSERT INTO "Staff" VALUES ('cmla37g2l007rwls0c0b4cu6x','Office Staff 7','OFFICE_STAFF','ACCOUNTANT','+20109999107',7090.01303247845,'EGP','INACTIVE',24,'cml9xi5i9000vwlw8f1j14dmc',0,1770334087198,1770334087198);
INSERT INTO "Staff" VALUES ('cmla37g2t007twls0dlka1kuv','Office Staff 8','OFFICE_STAFF','MANAGER','+20109999108',6130.25117283349,'EGP','ACTIVE',1,'cml9xi5hn000pwlw82o33iaof',0,1770334087206,1770334087206);
INSERT INTO "Staff" VALUES ('cmla37g31007vwls0f8imggd4','Office Staff 9','OFFICE_STAFF','MANAGER','+20109999109',7102.85214828055,'EGP','INACTIVE',7,'cml9xi5i1000twlw8l2qne4w9',0,1770334087213,1770334087213);
INSERT INTO "Staff" VALUES ('cmla37g39007xwls0yyti64xd','Office Staff 10','OFFICE_STAFF','MANAGER','+20109999110',7574.91566828809,'EGP','INACTIVE',9,'cml9xi5it0011wlw8jlcuxq6r',0,1770334087222,1770334087222);
INSERT INTO "Staff" VALUES ('cmla37g3h007zwls0dv57o8u2','Sara Project Manager','OFFICE_STAFF','MANAGER','+201000000001',8000.0,'EGP','ACTIVE',15,'cml9xi5hn000pwlw82o33iaof',1,1770334087229,1770334087229);
INSERT INTO "Staff" VALUES ('cmla37g3q0081wls0pkx8qec3','Mohamed Project Manager','OFFICE_STAFF','MANAGER','+201000000002',8000.0,'EGP','ACTIVE',15,'cml9xi5hv000rwlw8bvm5a9n4',1,1770334087239,1770334087239);
INSERT INTO "Staff" VALUES ('cmla37g3y0083wls06cs5v2yg','Field Worker 1','FIELD_WORKER','ELECTRICIAN','+20108888101',NULL,'EGP','ACTIVE',NULL,'cml9xi5it0011wlw8jlcuxq6r',0,1770334087246,1770334087246);
INSERT INTO "Staff" VALUES ('cmla37g460085wls0qczr3v72','Field Worker 2','FIELD_WORKER','PLUMBER','+20108888102',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5if000xwlw8y30jc3aw',0,1770334087254,1770334087254);
INSERT INTO "Staff" VALUES ('cmla37g4e0087wls0p64ug10h','Field Worker 3','FIELD_WORKER','GENERAL_WORKER','+20108888103',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5hn000pwlw82o33iaof',0,1770334087262,1770334087262);
INSERT INTO "Staff" VALUES ('cmla37g4m0089wls03q1qephd','Field Worker 4','FIELD_WORKER','GENERAL_WORKER','+20108888104',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770334087271,1770334087271);
INSERT INTO "Staff" VALUES ('cmla37g4v008bwls0b0sb47vb','Field Worker 5','FIELD_WORKER','PAINTER','+20108888105',NULL,'EGP','ACTIVE',NULL,'cml9xi5if000xwlw8y30jc3aw',0,1770334087279,1770334087279);
INSERT INTO "Staff" VALUES ('cmla37g52008dwls0iufn2mar','Field Worker 6','FIELD_WORKER','ELECTRICIAN','+20108888106',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770334087287,1770334087287);
INSERT INTO "Staff" VALUES ('cmla37g59008fwls0t91cflwf','Field Worker 7','FIELD_WORKER','CARPENTER','+20108888107',NULL,'EGP','ACTIVE',NULL,'cml9xi5j60015wlw8sj8qysq5',0,1770334087293,1770334087293);
INSERT INTO "Staff" VALUES ('cmla37g5g008hwls0qfhmb2u0','Field Worker 8','FIELD_WORKER','ELECTRICIAN','+20108888108',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5hn000pwlw82o33iaof',0,1770334087301,1770334087301);
INSERT INTO "Staff" VALUES ('cmla37g5o008jwls0cf41nzhv','Field Worker 9','FIELD_WORKER','ELECTRICIAN','+20108888109',NULL,'EGP','ACTIVE',NULL,'cml9xi5j00013wlw8q6vr2xd0',0,1770334087308,1770334087308);
INSERT INTO "Staff" VALUES ('cmla37g5z008lwls0nzym7fzy','Field Worker 10','FIELD_WORKER','PLUMBER','+20108888110',NULL,'EGP','ACTIVE',NULL,'cml9xi5jd0017wlw8bpznvjhc',0,1770334087319,1770334087319);
INSERT INTO "Staff" VALUES ('cmla37g67008nwls0usleg426','Field Worker 11','FIELD_WORKER','CARPENTER','+20108888111',NULL,'EGP','ACTIVE',NULL,'cml9xi5i9000vwlw8f1j14dmc',0,1770334087327,1770334087327);
INSERT INTO "Staff" VALUES ('cmla37g6e008pwls0lpavajc3','Field Worker 12','FIELD_WORKER','CARPENTER','+20108888112',NULL,'EGP','ACTIVE',NULL,'cml9xi5hv000rwlw8bvm5a9n4',0,1770334087334,1770334087334);
INSERT INTO "Staff" VALUES ('cmla37g6k008rwls029l1y8mp','Field Worker 13','FIELD_WORKER','PLUMBER','+20108888113',NULL,'EGP','ACTIVE',NULL,'cml9xi5j00013wlw8q6vr2xd0',0,1770334087340,1770334087340);
INSERT INTO "Staff" VALUES ('cmla37g6t008twls0kcysgn71','Field Worker 14','FIELD_WORKER','ELECTRICIAN','+20108888114',NULL,'EGP','ACTIVE',NULL,'cml9xi5it0011wlw8jlcuxq6r',0,1770334087349,1770334087349);
INSERT INTO "Staff" VALUES ('cmla37g72008vwls0dxvipfr9','Field Worker 15','FIELD_WORKER','ELECTRICIAN','+20108888115',NULL,'EGP','ON_LEAVE',NULL,'cml9xi5j60015wlw8sj8qysq5',0,1770334087358,1770334087358);
INSERT INTO "StaffAdvance" VALUES ('cml9xi75o00dxwlw85kzahxfz','cml9xi6bh007fwlw8e3erk984',2701.45533635765,1768428000000,'PENDING','Employee loan',NULL,1770324511165,1770324511165);
INSERT INTO "StaffAdvance" VALUES ('cml9xi75x00dzwlw8021ueppw','cml9xi6bs007hwlw8wqnnlf5q',2932.61461076001,1768428000000,'PENDING','Employee loan',NULL,1770324511173,1770324511173);
INSERT INTO "StaffAdvance" VALUES ('cml9xi76600e1wlw8zpnvlmua','cml9xi6c2007jwlw8o8jb0qoj',2119.7148875959,1768428000000,'PENDING','Employee loan',NULL,1770324511183,1770324511183);
INSERT INTO "StaffAdvance" VALUES ('cml9xi76f00e3wlw86n7svl0p','cml9xi6cb007lwlw8c8zlp6cu',1438.29756983595,1768428000000,'PENDING','Employee loan',NULL,1770324511192,1770324511192);
INSERT INTO "StaffAdvance" VALUES ('cml9xi76m00e5wlw8zoe5uk76','cml9xi6cl007nwlw8o0731eyl',2129.79773416598,1768428000000,'PENDING','Employee loan',NULL,1770324511199,1770324511199);
INSERT INTO "StaffAdvance" VALUES ('cml9xi76u00e7wlw8huji4hp5','cml9xi6cu007pwlw88y131mk1',2216.30355188161,1767996000000,'DEDUCTED','Deducted from salary','cml9xi75d00djwlw896amgzuv',1770324511206,1770324511206);
INSERT INTO "StaffAdvance" VALUES ('cml9xi77000e9wlw8o4a6gvw5','cml9xi6d2007rwlw8dm4jspxj',2045.14733851918,1767996000000,'DEDUCTED','Deducted from salary','cml9xi75d00djwlw896amgzuv',1770324511212,1770324511212);
INSERT INTO "StaffAdvance" VALUES ('cml9xi77600ebwlw8repmm8x2','cml9xi6da007twlw8bg28beki',3043.49591644029,1767996000000,'DEDUCTED','Deducted from salary','cml9xi75d00djwlw896amgzuv',1770324511219,1770324511219);
INSERT INTO "StaffAdvance" VALUES ('cmla37gse00ejwls0wson0rad','cml9xi6bh007fwlw8e3erk984',2423.62334344641,1768428000000,'PENDING','Employee loan',NULL,1770334088126,1770334088126);
INSERT INTO "StaffAdvance" VALUES ('cmla37gsl00elwls0fnld6dnq','cml9xi6bs007hwlw8wqnnlf5q',1836.72742098071,1768428000000,'PENDING','Employee loan',NULL,1770334088133,1770334088133);
INSERT INTO "StaffAdvance" VALUES ('cmla37gsr00enwls0dygiqrzu','cml9xi6c2007jwlw8o8jb0qoj',2701.07245874705,1768428000000,'PENDING','Employee loan',NULL,1770334088139,1770334088139);
INSERT INTO "StaffAdvance" VALUES ('cmla37gsy00epwls0ohvqv8ko','cml9xi6cb007lwlw8c8zlp6cu',1486.41098747501,1768428000000,'PENDING','Employee loan',NULL,1770334088146,1770334088146);
INSERT INTO "StaffAdvance" VALUES ('cmla37gt500erwls0wjtsby3s','cml9xi6cl007nwlw8o0731eyl',2029.24713888257,1768428000000,'PENDING','Employee loan',NULL,1770334088154,1770334088154);
INSERT INTO "StaffAdvance" VALUES ('cmla37gtd00etwls0xu954xbz','cml9xi6cu007pwlw88y131mk1',1936.98923809583,1767996000000,'DEDUCTED','Deducted from salary','cmla37gs600dtwls060yhah8e',1770334088162,1770334088162);
INSERT INTO "StaffAdvance" VALUES ('cmla37gtl00evwls0jlwgu0se','cml9xi6d2007rwlw8dm4jspxj',2087.98538894193,1767996000000,'DEDUCTED','Deducted from salary','cmla37gs600dtwls060yhah8e',1770334088169,1770334088169);
INSERT INTO "StaffAdvance" VALUES ('cmla37gts00exwls06oh31g9z','cml9xi6da007twlw8bg28beki',3066.36139487075,1767996000000,'DEDUCTED','Deducted from salary','cmla37gs600dtwls060yhah8e',1770334088176,1770334088176);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6le009rwlw8n45uuv5k','cml9xi6bh007fwlw8e3erk984','cml9xi5gy000jwlw8xx1bd4hh',1770324510435,'Assigned to City Center Mall',1770324510435,1770324510435);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6lm009twlw8tpn788vr','cml9xi6bs007hwlw8wqnnlf5q','cml9xi5gy000jwlw8xx1bd4hh',1770324510443,'Assigned to City Center Mall',1770324510443,1770324510443);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6lt009vwlw8ksuuy8x5','cml9xi6c2007jwlw8o8jb0qoj','cml9xi5h7000lwlw808i5ibr2',1770324510450,'Assigned to Al-Tayeb Tower',1770324510450,1770324510450);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6m1009xwlw8ajeuy6qf','cml9xi6cb007lwlw8c8zlp6cu','cml9xi5gy000jwlw8xx1bd4hh',1770324510457,'Assigned to City Center Mall',1770324510457,1770324510457);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6m9009zwlw8vn7c3yvu','cml9xi6cl007nwlw8o0731eyl','cml9xi5gy000jwlw8xx1bd4hh',1770324510466,'Assigned to City Center Mall',1770324510466,1770324510466);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6mg00a1wlw8svntps6a','cml9xi6cu007pwlw88y131mk1','cml9xi5gi000fwlw83bvg87et',1770324510473,'Assigned to Green Hills Compound',1770324510473,1770324510473);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6mp00a3wlw84sxzxhm5','cml9xi6d2007rwlw8dm4jspxj','cml9xi5gq000hwlw8olknv25d',1770324510482,'Assigned to Care Pharmacy Chain',1770324510482,1770324510482);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6my00a5wlw8jfm7ubun','cml9xi6da007twlw8bg28beki','cml9xi5h7000lwlw808i5ibr2',1770324510490,'Assigned to Al-Tayeb Tower',1770324510490,1770324510490);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6n600a7wlw81br7yh94','cml9xi6dj007vwlw88fyirgrd','cml9xi5gq000hwlw8olknv25d',1770324510498,'Assigned to Care Pharmacy Chain',1770324510498,1770324510498);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6ne00a9wlw8wga3dcm4','cml9xi6ds007xwlw8jj86g3t0','cml9xi5h7000lwlw808i5ibr2',1770324510506,'Assigned to Al-Tayeb Tower',1770324510506,1770324510506);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6nn00abwlw8rsztw1bp','cml9xi6e4007zwlw82m302tdm','cml9xi5gi000fwlw83bvg87et',1770324510516,'Sara managing Green Hills Compound',1770324510516,1770324510516);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6nx00adwlw8zkabfr9s','cml9xi6ee0081wlw8cclq4mdx','cml9xi5gi000fwlw83bvg87et',1770324510525,'Mohamed managing Green Hills Compound',1770324510525,1770324510525);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6oe00afwlw8edm21pec','cml9xi6e4007zwlw82m302tdm','cml9xi5gq000hwlw8olknv25d',1770324510543,'Sara managing Care Pharmacy Chain',1770324510543,1770324510543);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6om00ahwlw8nwcy2qad','cml9xi6ee0081wlw8cclq4mdx','cml9xi5gq000hwlw8olknv25d',1770324510551,'Mohamed managing Care Pharmacy Chain',1770324510551,1770324510551);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6p200ajwlw823hzfv3h','cml9xi6e4007zwlw82m302tdm','cml9xi5gy000jwlw8xx1bd4hh',1770324510566,'Sara managing City Center Mall',1770324510566,1770324510566);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6pa00alwlw8gbvu3u6v','cml9xi6ee0081wlw8cclq4mdx','cml9xi5gy000jwlw8xx1bd4hh',1770324510574,'Mohamed managing City Center Mall',1770324510574,1770324510574);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6pi00anwlw8hmnm8d0p','cml9xi6e4007zwlw82m302tdm','cml9xi5h7000lwlw808i5ibr2',1770324510583,'Sara managing Al-Tayeb Tower',1770324510583,1770324510583);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6pp00apwlw8icsddh8i','cml9xi6ee0081wlw8cclq4mdx','cml9xi5h7000lwlw808i5ibr2',1770324510589,'Mohamed managing Al-Tayeb Tower',1770324510589,1770324510589);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6px00arwlw8ju5kv5vo','cml9xi6e4007zwlw82m302tdm','cml9xi5he000nwlw8qckmgokc',1770324510597,'Sara managing Red Sea Resort',1770324510597,1770324510597);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6q600atwlw8636q9pk2','cml9xi6ee0081wlw8cclq4mdx','cml9xi5he000nwlw8qckmgokc',1770324510607,'Mohamed managing Red Sea Resort',1770324510607,1770324510607);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6qg00avwlw83junk2u0','cml9xi6eo0083wlw8phxm9esb','cml9xi5gq000hwlw8olknv25d',1770324510617,'Field worker assigned to Care Pharmacy Chain',1770324510617,1770324510617);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6qp00axwlw83ztsyuou','cml9xi6ew0085wlw8krmv31tj','cml9xi5he000nwlw8qckmgokc',1770324510626,'Field worker assigned to Red Sea Resort',1770324510626,1770324510626);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6qy00azwlw8bd6kps8c','cml9xi6f30087wlw83l9g3ckl','cml9xi5gq000hwlw8olknv25d',1770324510634,'Field worker assigned to Care Pharmacy Chain',1770324510634,1770324510634);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6r800b1wlw88nk3ozge','cml9xi6fc0089wlw87dgglkmr','cml9xi5gy000jwlw8xx1bd4hh',1770324510645,'Field worker assigned to City Center Mall',1770324510645,1770324510645);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6ri00b3wlw8ian8ozv0','cml9xi6fl008bwlw89btl489h','cml9xi5gq000hwlw8olknv25d',1770324510655,'Field worker assigned to Care Pharmacy Chain',1770324510655,1770324510655);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6rt00b5wlw8609ewm6k','cml9xi6ft008dwlw8qhcenfoo','cml9xi5gy000jwlw8xx1bd4hh',1770324510665,'Field worker assigned to City Center Mall',1770324510665,1770324510665);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6s700b7wlw87l6b4ne3','cml9xi6g1008fwlw84w0pggts','cml9xi5gq000hwlw8olknv25d',1770324510679,'Field worker assigned to Care Pharmacy Chain',1770324510679,1770324510679);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6si00b9wlw8blqiwg96','cml9xi6gb008hwlw80xgfoprz','cml9xi5h7000lwlw808i5ibr2',1770324510690,'Field worker assigned to Al-Tayeb Tower',1770324510690,1770324510690);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6su00bbwlw8vrn8idyj','cml9xi6gk008jwlw8j8202kas','cml9xi5gy000jwlw8xx1bd4hh',1770324510702,'Field worker assigned to City Center Mall',1770324510702,1770324510702);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6t700bdwlw8kd3emh3b','cml9xi6gv008lwlw89b85yqe2','cml9xi5gi000fwlw83bvg87et',1770324510716,'Field worker assigned to Green Hills Compound',1770324510716,1770324510716);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6tt00bfwlw82g70xobj','cml9xi6h3008nwlw8x6oq9udh','cml9xi5h7000lwlw808i5ibr2',1770324510738,'Field worker assigned to Al-Tayeb Tower',1770324510738,1770324510738);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6u600bhwlw897249q27','cml9xi6hc008pwlw88n66v54p','cml9xi5gq000hwlw8olknv25d',1770324510751,'Field worker assigned to Care Pharmacy Chain',1770324510751,1770324510751);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6ui00bjwlw8yj62ul3m','cml9xi6hk008rwlw8fky1cucw','cml9xi5gy000jwlw8xx1bd4hh',1770324510762,'Field worker assigned to City Center Mall',1770324510762,1770324510762);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6uv00blwlw8izl635d4','cml9xi6hs008twlw8c4qo7wfu','cml9xi5gq000hwlw8olknv25d',1770324510775,'Field worker assigned to Care Pharmacy Chain',1770324510775,1770324510775);
INSERT INTO "StaffProjectAssignment" VALUES ('cml9xi6v900bnwlw83s4uqtuf','cml9xi6i0008vwlw8k1p8koel','cml9xi5gq000hwlw8olknv25d',1770324510789,'Field worker assigned to Care Pharmacy Chain',1770324510789,1770324510789);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gbf009rwls02imtik3h','cmla37g18007fwls0lkxgfdeu','cml9xi5gq000hwlw8olknv25d',1770334087515,'Assigned to Care Pharmacy Chain',1770334087515,1770334087515);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gbn009twls0ymaq7dsq','cmla37g1g007hwls0mior4ngj','cml9xi5gy000jwlw8xx1bd4hh',1770334087523,'Assigned to City Center Mall',1770334087523,1770334087523);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gbu009vwls0nnd6r6oq','cmla37g1p007jwls05zomeiue','cml9xi5h7000lwlw808i5ibr2',1770334087531,'Assigned to Al-Tayeb Tower',1770334087531,1770334087531);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gc3009xwls0xs3biveu','cmla37g1w007lwls09xvmziho','cml9xi5gy000jwlw8xx1bd4hh',1770334087539,'Assigned to City Center Mall',1770334087539,1770334087539);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gcb009zwls069lzoxel','cmla37g27007nwls0ncm6zu7m','cml9xi5he000nwlw8qckmgokc',1770334087547,'Assigned to Red Sea Resort',1770334087547,1770334087547);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gci00a1wls0npckdhak','cmla37g2e007pwls0iwahkz6v','cml9xi5gy000jwlw8xx1bd4hh',1770334087554,'Assigned to City Center Mall',1770334087554,1770334087554);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gco00a3wls09z1q6vxe','cmla37g2l007rwls0c0b4cu6x','cml9xi5he000nwlw8qckmgokc',1770334087560,'Assigned to Red Sea Resort',1770334087560,1770334087560);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gcu00a5wls0c8nmijaf','cmla37g2t007twls0dlka1kuv','cml9xi5gq000hwlw8olknv25d',1770334087566,'Assigned to Care Pharmacy Chain',1770334087566,1770334087566);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gd000a7wls0jq72ks7u','cmla37g31007vwls0f8imggd4','cml9xi5gi000fwlw83bvg87et',1770334087572,'Assigned to Green Hills Compound',1770334087572,1770334087572);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gd600a9wls0ja5ybzco','cmla37g39007xwls0yyti64xd','cml9xi5h7000lwlw808i5ibr2',1770334087579,'Assigned to Al-Tayeb Tower',1770334087579,1770334087579);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gdf00abwls0urv4sagh','cmla37g3h007zwls0dv57o8u2','cml9xi5gi000fwlw83bvg87et',1770334087587,'Sara managing Green Hills Compound',1770334087587,1770334087587);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gdn00adwls02n8575zp','cmla37g3q0081wls0pkx8qec3','cml9xi5gi000fwlw83bvg87et',1770334087596,'Mohamed managing Green Hills Compound',1770334087596,1770334087596);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gdv00afwls0fl9oq6po','cmla37g3h007zwls0dv57o8u2','cml9xi5gq000hwlw8olknv25d',1770334087604,'Sara managing Care Pharmacy Chain',1770334087604,1770334087604);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ge300ahwls0f2gf8l09','cmla37g3q0081wls0pkx8qec3','cml9xi5gq000hwlw8olknv25d',1770334087611,'Mohamed managing Care Pharmacy Chain',1770334087611,1770334087611);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gec00ajwls0gqj8disz','cmla37g3h007zwls0dv57o8u2','cml9xi5gy000jwlw8xx1bd4hh',1770334087621,'Sara managing City Center Mall',1770334087621,1770334087621);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gel00alwls0waalftgh','cmla37g3q0081wls0pkx8qec3','cml9xi5gy000jwlw8xx1bd4hh',1770334087629,'Mohamed managing City Center Mall',1770334087629,1770334087629);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ges00anwls00r7fjvl6','cmla37g3h007zwls0dv57o8u2','cml9xi5h7000lwlw808i5ibr2',1770334087637,'Sara managing Al-Tayeb Tower',1770334087637,1770334087637);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gez00apwls0g6g4mymy','cmla37g3q0081wls0pkx8qec3','cml9xi5h7000lwlw808i5ibr2',1770334087644,'Mohamed managing Al-Tayeb Tower',1770334087644,1770334087644);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gf900arwls03avw6ute','cmla37g3h007zwls0dv57o8u2','cml9xi5he000nwlw8qckmgokc',1770334087654,'Sara managing Red Sea Resort',1770334087654,1770334087654);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gfh00atwls0eeddirjj','cmla37g3q0081wls0pkx8qec3','cml9xi5he000nwlw8qckmgokc',1770334087661,'Mohamed managing Red Sea Resort',1770334087661,1770334087661);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gfp00avwls0t42vs9ux','cmla37g3y0083wls06cs5v2yg','cml9xi5gy000jwlw8xx1bd4hh',1770334087669,'Field worker assigned to City Center Mall',1770334087669,1770334087669);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gfw00axwls0sqcqvbym','cmla37g460085wls0qczr3v72','cml9xi5he000nwlw8qckmgokc',1770334087677,'Field worker assigned to Red Sea Resort',1770334087677,1770334087677);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gg400azwls0u2xknp9o','cmla37g4e0087wls0p64ug10h','cml9xi5h7000lwlw808i5ibr2',1770334087684,'Field worker assigned to Al-Tayeb Tower',1770334087684,1770334087684);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ggb00b1wls0hzt9d47n','cmla37g4m0089wls03q1qephd','cml9xi5he000nwlw8qckmgokc',1770334087691,'Field worker assigned to Red Sea Resort',1770334087691,1770334087691);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ggk00b3wls0eyxmgsff','cmla37g4v008bwls0b0sb47vb','cml9xi5gy000jwlw8xx1bd4hh',1770334087700,'Field worker assigned to City Center Mall',1770334087700,1770334087700);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ggr00b5wls0xelcj8sd','cmla37g52008dwls0iufn2mar','cml9xi5gi000fwlw83bvg87et',1770334087708,'Field worker assigned to Green Hills Compound',1770334087708,1770334087708);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ggz00b7wls03y8ap4ti','cmla37g59008fwls0t91cflwf','cml9xi5h7000lwlw808i5ibr2',1770334087715,'Field worker assigned to Al-Tayeb Tower',1770334087715,1770334087715);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gh600b9wls00p2zuokm','cmla37g5g008hwls0qfhmb2u0','cml9xi5he000nwlw8qckmgokc',1770334087723,'Field worker assigned to Red Sea Resort',1770334087723,1770334087723);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ghf00bbwls082f78vh3','cmla37g5o008jwls0cf41nzhv','cml9xi5gq000hwlw8olknv25d',1770334087732,'Field worker assigned to Care Pharmacy Chain',1770334087732,1770334087732);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37ghq00bdwls021daco7o','cmla37g5z008lwls0nzym7fzy','cml9xi5he000nwlw8qckmgokc',1770334087742,'Field worker assigned to Red Sea Resort',1770334087742,1770334087742);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gi000bfwls0zb7v65yz','cmla37g67008nwls0usleg426','cml9xi5he000nwlw8qckmgokc',1770334087752,'Field worker assigned to Red Sea Resort',1770334087752,1770334087752);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gi800bhwls08hsnrg03','cmla37g6e008pwls0lpavajc3','cml9xi5gy000jwlw8xx1bd4hh',1770334087760,'Field worker assigned to City Center Mall',1770334087760,1770334087760);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gif00bjwls0yloafh48','cmla37g6k008rwls029l1y8mp','cml9xi5he000nwlw8qckmgokc',1770334087768,'Field worker assigned to Red Sea Resort',1770334087768,1770334087768);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37gin00blwls0skfj6ej1','cmla37g6t008twls0kcysgn71','cml9xi5gy000jwlw8xx1bd4hh',1770334087776,'Field worker assigned to City Center Mall',1770334087776,1770334087776);
INSERT INTO "StaffProjectAssignment" VALUES ('cmla37giv00bnwls0ppznzvt9','cmla37g72008vwls0dxvipfr9','cml9xi5gy000jwlw8xx1bd4hh',1770334087783,'Field worker assigned to City Center Mall',1770334087783,1770334087783);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6i7008xwlw8kjhgfdq7','cml9xi6eo0083wlw8phxm9esb','cml9xi5it0011wlw8jlcuxq6r','Work task for CARPENTER',474.406837378203,1768164510318,0,1770324510319,1770324510319);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6if008zwlw8ovvnsh88','cml9xi6eo0083wlw8phxm9esb','cml9xi5in000zwlw8jji4tbz6','Work task for CARPENTER',362.31075018024,1769978910326,0,1770324510328,1770324510328);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6in0091wlw8c85k68ep','cml9xi6eo0083wlw8phxm9esb','cml9xi5it0011wlw8jlcuxq6r','Work task for CARPENTER',858.301051635073,1768596510334,0,1770324510336,1770324510336);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6iv0093wlw87jka5zf9','cml9xi6ew0085wlw8krmv31tj','cml9xi5i9000vwlw8f1j14dmc','Work task for PAINTER',592.373832966637,1767818910343,1,1770324510344,1770324510344);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6j20095wlw840cnx52p','cml9xi6ew0085wlw8krmv31tj','cml9xi5jd0017wlw8bpznvjhc','Work task for PAINTER',542.006825809508,1768078110349,1,1770324510351,1770324510351);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6ja0097wlw82p80fuqn','cml9xi6ew0085wlw8krmv31tj','cml9xi5hn000pwlw82o33iaof','Work task for PAINTER',618.284089704337,1770324510357,1,1770324510358,1770324510358);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6jh0099wlw8bf7kbols','cml9xi6f30087wlw83l9g3ckl','cml9xi5hv000rwlw8bvm5a9n4','Work task for PAINTER',789.999365906251,1769460510364,1,1770324510365,1770324510365);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6jo009bwlw8ns65mfqm','cml9xi6f30087wlw83l9g3ckl','cml9xi5jd0017wlw8bpznvjhc','Work task for PAINTER',718.655566339682,1768769310371,0,1770324510372,1770324510372);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6jv009dwlw8tr503qfr','cml9xi6f30087wlw83l9g3ckl','cml9xi5j60015wlw8sj8qysq5','Work task for PAINTER',873.60844736184,1769028510379,0,1770324510380,1770324510380);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6k4009fwlw8ko1k899l','cml9xi6fc0089wlw87dgglkmr','cml9xi5i9000vwlw8f1j14dmc','Work task for CARPENTER',523.182058442376,1769028510387,1,1770324510388,1770324510388);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6kb009hwlw82lcegur8','cml9xi6fc0089wlw87dgglkmr','cml9xi5jd0017wlw8bpznvjhc','Work task for CARPENTER',443.752649263952,1769374110394,1,1770324510396,1770324510396);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6kk009jwlw81fb6pyti','cml9xi6fc0089wlw87dgglkmr','cml9xi5j00013wlw8q6vr2xd0','Work task for CARPENTER',494.320921867848,1769374110403,1,1770324510404,1770324510404);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6kr009lwlw8w8copygs','cml9xi6fl008bwlw89btl489h','cml9xi5it0011wlw8jlcuxq6r','Work task for GENERAL WORKER',575.234661005469,1769719710410,0,1770324510412,1770324510412);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6kz009nwlw89vw350ec','cml9xi6fl008bwlw89btl489h','cml9xi5in000zwlw8jji4tbz6','Work task for GENERAL WORKER',379.263050134616,1769978910419,1,1770324510420,1770324510420);
INSERT INTO "StaffWorkLog" VALUES ('cml9xi6l7009pwlw858to4xjq','cml9xi6fl008bwlw89btl489h','cml9xi5in000zwlw8jji4tbz6','Work task for GENERAL WORKER',527.321204654969,1769114910426,0,1770324510427,1770324510427);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g7a008xwls0y32d7n3e','cmla37g3y0083wls06cs5v2yg','cml9xi5it0011wlw8jlcuxq6r','Work task for ELECTRICIAN',210.865453731996,1769815687365,0,1770334087367,1770334087367);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g7j008zwls05pprz8xf','cmla37g3y0083wls06cs5v2yg','cml9xi5i9000vwlw8f1j14dmc','Work task for ELECTRICIAN',978.877501013108,1769902087374,0,1770334087375,1770334087375);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g7p0091wls0278t1lsy','cmla37g3y0083wls06cs5v2yg','cml9xi5i9000vwlw8f1j14dmc','Work task for ELECTRICIAN',432.634851515438,1769988487381,1,1770334087382,1770334087382);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g8i0093wls0khl303iq','cmla37g460085wls0qczr3v72','cml9xi5j60015wlw8sj8qysq5','Work task for PLUMBER',660.262392610433,1768951687409,0,1770334087411,1770334087411);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g8t0095wls0jciw070o','cmla37g460085wls0qczr3v72','cml9xi5i9000vwlw8f1j14dmc','Work task for PLUMBER',986.511510770922,1769470087420,0,1770334087422,1770334087422);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g940097wls0cq9qyzh7','cmla37g460085wls0qczr3v72','cml9xi5j00013wlw8q6vr2xd0','Work task for PLUMBER',447.932321753128,1769383687431,0,1770334087432,1770334087432);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g9d0099wls0bvni6wbi','cmla37g4e0087wls0p64ug10h','cml9xi5i1000twlw8l2qne4w9','Work task for GENERAL WORKER',243.252538784684,1768951687440,1,1770334087441,1770334087441);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g9n009bwls0gxgbgxmm','cmla37g4e0087wls0p64ug10h','cml9xi5j00013wlw8q6vr2xd0','Work task for GENERAL WORKER',961.717504915484,1768433287450,1,1770334087451,1770334087451);
INSERT INTO "StaffWorkLog" VALUES ('cmla37g9w009dwls069zj3qsr','cmla37g4e0087wls0p64ug10h','cml9xi5in000zwlw8jji4tbz6','Work task for GENERAL WORKER',749.805447533483,1768260487459,0,1770334087460,1770334087460);
INSERT INTO "StaffWorkLog" VALUES ('cmla37ga5009fwls0vh3kge1o','cmla37g4m0089wls03q1qephd','cml9xi5it0011wlw8jlcuxq6r','Work task for GENERAL WORKER',936.02853421935,1768260487468,1,1770334087469,1770334087469);
INSERT INTO "StaffWorkLog" VALUES ('cmla37gae009hwls086qsdnhv','cmla37g4m0089wls03q1qephd','cml9xi5j60015wlw8sj8qysq5','Work task for GENERAL WORKER',489.385757994495,1770161287477,0,1770334087478,1770334087478);
INSERT INTO "StaffWorkLog" VALUES ('cmla37gan009jwls0ec6tuftk','cmla37g4m0089wls03q1qephd','cml9xi5in000zwlw8jji4tbz6','Work task for GENERAL WORKER',799.610948065028,1769556487486,1,1770334087487,1770334087487);
INSERT INTO "StaffWorkLog" VALUES ('cmla37gav009lwls0vmce981h','cmla37g4v008bwls0b0sb47vb','cml9xi5i1000twlw8l2qne4w9','Work task for PAINTER',850.627461604939,1769038087494,0,1770334087495,1770334087495);
INSERT INTO "StaffWorkLog" VALUES ('cmla37gb1009nwls0zrqr4cuk','cmla37g4v008bwls0b0sb47vb','cml9xi5j00013wlw8q6vr2xd0','Work task for PAINTER',246.488632915767,1769210887501,0,1770334087502,1770334087502);
INSERT INTO "StaffWorkLog" VALUES ('cmla37gb8009pwls07ehz57gi','cmla37g4v008bwls0b0sb47vb','cml9xi5j60015wlw8sj8qysq5','Work task for PAINTER',587.082599379361,1768692487507,0,1770334087509,1770334087509);
INSERT INTO "Technician" VALUES ('cml9xi6vk00bpwlw8yzv3r4z9','محمود النجار','+201088881001',NULL,'cml9xi5fe0009wlw8qg76ol1k','DAILY',NULL,150.0,NULL,'EGP',NULL,1770324510800,1770324510800);
INSERT INTO "Technician" VALUES ('cml9xi6vu00brwlw83z062gnr','علي السباك','+201088881002',NULL,'cml9xi5fn000awlw825qxvaoc','DAILY',NULL,160.0,NULL,'EGP',NULL,1770324510810,1770324510810);
INSERT INTO "Technician" VALUES ('cml9xi6w700btwlw8w8tthxj8','أحمد الكهربائي','+201088881003',NULL,'cml9xi5fw000bwlw88542qxr3','PER_JOB',NULL,NULL,250.0,'EGP',NULL,1770324510823,1770324510823);
INSERT INTO "Technician" VALUES ('cml9xi6wg00bvwlw81hc3mu9x','عمر الحداد','+201088881004',NULL,'cml9xi5g4000cwlw8rwfqhf0t','DAILY',NULL,140.0,NULL,'EGP',NULL,1770324510832,1770324510832);
INSERT INTO "Technician" VALUES ('cml9xi6wo00bxwlw85shcmypi','فاروق الدهاش','+201088881005',NULL,'cml9xi5gb000dwlw86on6ijms','DAILY',NULL,120.0,NULL,'EGP',NULL,1770324510840,1770324510840);
INSERT INTO "Technician" VALUES ('cml9xi6wv00bzwlw8qs4m0yb1','محمد النجار الثاني','+201088881006',NULL,'cml9xi5fe0009wlw8qg76ol1k','MONTHLY',3500.0,NULL,NULL,'EGP',NULL,1770324510848,1770324510848);
INSERT INTO "Technician" VALUES ('cml9xi6xe00c1wlw8o3gjguy7','سالم السباك الثاني','+201088881007',NULL,'cml9xi5fn000awlw825qxvaoc','PER_JOB',NULL,NULL,300.0,'EGP',NULL,1770324510867,1770324510867);
INSERT INTO "Technician" VALUES ('cml9xi6xm00c3wlw85k43ewa0','خالد الكهربائي الثاني','+201088881008',NULL,'cml9xi5fw000bwlw88542qxr3','MONTHLY',4000.0,NULL,NULL,'EGP',NULL,1770324510874,1770324510874);
INSERT INTO "Technician" VALUES ('cml9xi6xv00c5wlw8x3dlyfv9','جمال الحداد الثاني','+201088881009',NULL,'cml9xi5g4000cwlw8rwfqhf0t','DAILY',NULL,130.0,NULL,'EGP',NULL,1770324510883,1770324510883);
INSERT INTO "Technician" VALUES ('cml9xi6yc00c7wlw8rnkl70hm','كريم الدهاش الثاني','+201088881010',NULL,'cml9xi5gb000dwlw86on6ijms','PER_JOB',NULL,NULL,200.0,'EGP',NULL,1770324510901,1770324510901);
INSERT INTO "Technician" VALUES ('cmla37gj400bpwls0ob523ik7','محمود النجار','+201088881001',NULL,'cml9xi5fe0009wlw8qg76ol1k','DAILY',NULL,150.0,NULL,'EGP',NULL,1770334087793,1770334087793);
INSERT INTO "Technician" VALUES ('cmla37gjd00brwls0ab6flrvn','علي السباك','+201088881002',NULL,'cml9xi5fn000awlw825qxvaoc','DAILY',NULL,160.0,NULL,'EGP',NULL,1770334087802,1770334087802);
INSERT INTO "Technician" VALUES ('cmla37gjk00btwls0ttoi2wes','أحمد الكهربائي','+201088881003',NULL,'cml9xi5fw000bwlw88542qxr3','PER_JOB',NULL,NULL,250.0,'EGP',NULL,1770334087809,1770334087809);
INSERT INTO "Technician" VALUES ('cmla37gjt00bvwls0uanm92jx','عمر الحداد','+201088881004',NULL,'cml9xi5g4000cwlw8rwfqhf0t','DAILY',NULL,140.0,NULL,'EGP',NULL,1770334087817,1770334087817);
INSERT INTO "Technician" VALUES ('cmla37gk100bxwls005t9m2xg','فاروق الدهاش','+201088881005',NULL,'cml9xi5gb000dwlw86on6ijms','DAILY',NULL,120.0,NULL,'EGP',NULL,1770334087825,1770334087825);
INSERT INTO "Technician" VALUES ('cmla37gk800bzwls07equc5ze','محمد النجار الثاني','+201088881006',NULL,'cml9xi5fe0009wlw8qg76ol1k','MONTHLY',3500.0,NULL,NULL,'EGP',NULL,1770334087833,1770334087833);
INSERT INTO "Technician" VALUES ('cmla37gkg00c1wls0w3uzyxa1','سالم السباك الثاني','+201088881007',NULL,'cml9xi5fn000awlw825qxvaoc','PER_JOB',NULL,NULL,300.0,'EGP',NULL,1770334087840,1770334087840);
INSERT INTO "Technician" VALUES ('cmla37gl400c3wls0ayimck7q','خالد الكهربائي الثاني','+201088881008',NULL,'cml9xi5fw000bwlw88542qxr3','MONTHLY',4000.0,NULL,NULL,'EGP',NULL,1770334087865,1770334087865);
INSERT INTO "Technician" VALUES ('cmla37glc00c5wls0aveqt393','جمال الحداد الثاني','+201088881009',NULL,'cml9xi5g4000cwlw8rwfqhf0t','DAILY',NULL,130.0,NULL,'EGP',NULL,1770334087872,1770334087872);
INSERT INTO "Technician" VALUES ('cmla37glj00c7wls0ogiid5zr','كريم الدهاش الثاني','+201088881010',NULL,'cml9xi5gb000dwlw86on6ijms','PER_JOB',NULL,NULL,200.0,'EGP',NULL,1770334087879,1770334087879);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi73i00d3wlw81pyqw7s7','cml9xi6xv00c5wlw8x3dlyfv9',4488.72472762873,'Emergency call payment',1770324511086);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi73o00d5wlw8zzel0ebx','cml9xi6yc00c7wlw8rnkl70hm',4506.91331085457,'Payment for completed work batch',1770324511093);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi73w00d7wlw8lcijneht','cml9xi6w700btwlw8w8tthxj8',3795.77395453408,'Emergency call payment',1770324511100);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi74300d9wlw8f99h5c2t','cml9xi6wv00bzwlw8qs4m0yb1',3504.6509894121,'Payment for completed work batch',1770324511108);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi74b00dbwlw8kepi3d5m','cml9xi6wo00bxwlw85shcmypi',4587.51675601679,'Emergency call payment',1770324511116);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi74i00ddwlw8vzvc2baq','cml9xi6wg00bvwlw81hc3mu9x',4481.69830611545,'Payment for completed work batch',1770324511123);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi74r00dfwlw8kqzjghgq','cml9xi6yc00c7wlw8rnkl70hm',4862.07119722818,'Emergency call payment',1770324511132);
INSERT INTO "TechnicianPayment" VALUES ('cml9xi75000dhwlw807b68y2b','cml9xi6vu00brwlw83z062gnr',3247.3711629931,'Payment for completed work batch',1770324511140);
INSERT INTO "TechnicianPayment" VALUES ('cml9y6gyq0003wl3k93wwdpqd','cml9xi6vk00bpwlw8yzv3r4z9',500.0,'شباك',1770325643615);
INSERT INTO "TechnicianPayment" VALUES ('cmla20fuk0002wl7846tjxcz3','cml9xi6xe00c1wlw8o3gjguy7',833.18,NULL,1770332080662);
INSERT INTO "TechnicianPayment" VALUES ('cmla22k4j0004wl78pycrbamd','cml9xi6vu00brwlw83z062gnr',687.91,NULL,1770332179552);
INSERT INTO "TechnicianPayment" VALUES ('cmla256nf0006wl788hv2rp3j','cml9xi6wv00bzwlw8qs4m0yb1',406.0,NULL,1770332302057);
INSERT INTO "TechnicianPayment" VALUES ('cmla37gql00ddwls0irudae5s','cmla37gjt00bvwls0uanm92jx',3046.73402699839,'Emergency call payment',1770334088062);
INSERT INTO "TechnicianPayment" VALUES ('cmla37gqs00dfwls0gr55nfwc','cmla37gl400c3wls0ayimck7q',4026.41873363588,'Payment for completed work batch',1770334088069);
INSERT INTO "TechnicianPayment" VALUES ('cmla37gqy00dhwls0gnm47pua','cmla37glc00c5wls0aveqt393',4570.37080972553,'Emergency call payment',1770334088075);
INSERT INTO "TechnicianPayment" VALUES ('cmla37gr500djwls0d7iay8ss','cmla37gl400c3wls0ayimck7q',3499.22163334123,'Payment for completed work batch',1770334088082);
INSERT INTO "TechnicianPayment" VALUES ('cmla37grc00dlwls0bsrcj2rl','cmla37gjt00bvwls0uanm92jx',4616.00818397924,'Emergency call payment',1770334088089);
INSERT INTO "TechnicianPayment" VALUES ('cmla37grk00dnwls0zrxpcpn1','cmla37gjt00bvwls0uanm92jx',3652.8436553989,'Payment for completed work batch',1770334088097);
INSERT INTO "TechnicianPayment" VALUES ('cmla37grr00dpwls0bzriubx9','cmla37gjk00btwls0ttoi2wes',3946.91071251734,'Emergency call payment',1770334088103);
INSERT INTO "TechnicianPayment" VALUES ('cmla37grx00drwls0y5ac9ci7','cmla37gjt00bvwls0uanm92jx',4922.40473112352,'Payment for completed work batch',1770334088109);
INSERT INTO "TechnicianPayment" VALUES ('cmldhfb7y0003wlpoakf0gmx2','cmla37glc00c5wls0aveqt393',2220.0,'تجربة كده',1770539367308);
INSERT INTO "TechnicianPayment" VALUES ('cmldhg8z50009wlpoa05boh8j','cmla37gk100bxwls005t9m2xg',1110.0,'صلح الماسورة',1770539411055);
INSERT INTO "TechnicianSpecialty" VALUES ('cml9xi5fe0009wlw8qg76ol1k','نجار',1770324508922,1770324508922);
INSERT INTO "TechnicianSpecialty" VALUES ('cml9xi5fn000awlw825qxvaoc','سباك',1770324508932,1770324508932);
INSERT INTO "TechnicianSpecialty" VALUES ('cml9xi5fw000bwlw88542qxr3','كهربائي',1770324508940,1770324508940);
INSERT INTO "TechnicianSpecialty" VALUES ('cml9xi5g4000cwlw8rwfqhf0t','حداد',1770324508948,1770324508948);
INSERT INTO "TechnicianSpecialty" VALUES ('cml9xi5gb000dwlw86on6ijms','دهاش',1770324508956,1770324508956);
INSERT INTO "TechnicianWork" VALUES ('cml9xi6ym00c9wlw8p0gu3cu1','cml9xi6xv00c5wlw8x3dlyfv9','cml9xi5j60015wlw8sj8qysq5','HVAC system checkup',508.969256149551,'PENDING',0,1770324510910,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi6z600cdwlw8sqf8ootr','cml9xi6wo00bxwlw85shcmypi','cml9xi5if000xwlw8y30jc3aw','Electrical panel servicing',686.089182087254,'PENDING',0,1770324510930,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi6zf00cfwlw851xn1lbl','cml9xi6wv00bzwlw8qs4m0yb1','cml9xi5in000zwlw8jji4tbz6','HVAC system checkup',405.575951721254,'PENDING',1,1770324510939,NULL,NULL,1770332302057);
INSERT INTO "TechnicianWork" VALUES ('cml9xi70500chwlw8xq3vv3f3','cml9xi6xm00c3wlw85k43ewa0','cml9xi5i9000vwlw8f1j14dmc','Emergency lighting repair',496.262076618507,'PENDING',0,1770324510966,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi70v00cjwlw855ipg1wl','cml9xi6wg00bvwlw81hc3mu9x','cml9xi5it0011wlw8jlcuxq6r','Water pump maintenance',401.231895557684,'PENDING',0,1770324510991,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi71200clwlw8wf5shvpu','cml9xi6wv00bzwlw8qs4m0yb1','cml9xi5jd0017wlw8bpznvjhc','Lock replacement',612.604771998407,'PENDING',0,1770324510998,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi71j00cnwlw8l3pq0ifm','cml9xi6xm00c3wlw85k43ewa0','cml9xi5it0011wlw8jlcuxq6r','Water pump maintenance',929.477886439238,'PENDING',0,1770324511016,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi71u00cpwlw8v336e7li','cml9xi6vu00brwlw83z062gnr','cml9xi5in000zwlw8jji4tbz6','AC unit repair',687.906318316119,'PENDING',1,1770324511026,NULL,NULL,1770332179552);
INSERT INTO "TechnicianWork" VALUES ('cml9xi72300crwlw8bwebj76a','cml9xi6yc00c7wlw8rnkl70hm','cml9xi5hv000rwlw8bvm5a9n4','Emergency lighting repair',775.104880253187,'PENDING',0,1770324511035,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi72e00ctwlw8mofwi19e','cml9xi6xv00c5wlw8x3dlyfv9','cml9xi5hn000pwlw82o33iaof','Lock replacement',321.358432021076,'PENDING',0,1770324511046,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi72q00cvwlw8uaikxrwu','cml9xi6xv00c5wlw8x3dlyfv9','cml9xi5i9000vwlw8f1j14dmc','AC unit repair',466.29111435782,'PENDING',0,1770324511058,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi72x00cxwlw8bv1emswc','cml9xi6wv00bzwlw8qs4m0yb1','cml9xi5if000xwlw8y30jc3aw','Emergency lighting repair',375.82276935643,'PENDING',0,1770324511066,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi73500czwlw829463phx','cml9xi6vu00brwlw83z062gnr','cml9xi5j00013wlw8q6vr2xd0','Plumbing leak repair',361.317128464686,'PENDING',0,1770324511073,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cml9xi73b00d1wlw8ay3efoek','cml9xi6vk00bpwlw8yzv3r4z9','cml9xi5hn000pwlw82o33iaof','شباك',500.0,'COMPLETED',0,1770324511079,1770325628378,1770325643595,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gm500c9wls0ovy7akq1','cmla37gj400bpwls0ob523ik7','cml9xi5it0011wlw8jlcuxq6r','Plumbing leak repair',238.696867203917,'PENDING',0,1770334087901,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gme00cbwls00xljk7wl','cmla37gjd00brwls0ab6flrvn','cml9xi5jd0017wlw8bpznvjhc','Elevator motor replacement',930.913544490298,'PENDING',0,1770334087910,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gmy00cdwls0qcc16bc9','cmla37gjk00btwls0ttoi2wes','cml9xi5i1000twlw8l2qne4w9','Elevator motor replacement',722.286281161556,'PENDING',0,1770334087930,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gn500cfwls01vjw26re','cmla37gjt00bvwls0uanm92jx','cml9xi5hv000rwlw8bvm5a9n4','Lock replacement',421.559129112931,'PENDING',0,1770334087938,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gne00chwls0ghoqsvv7','cmla37gk100bxwls005t9m2xg','cml9xi5hn000pwlw82o33iaof','Elevator motor replacement',997.191131171072,'PENDING',0,1770334087946,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gnk00cjwls08u04c2yw','cmla37gk800bzwls07equc5ze','cml9xi5j00013wlw8q6vr2xd0','AC unit repair',605.941021232133,'PENDING',0,1770334087952,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gnr00clwls0wq5986eu','cmla37gkg00c1wls0w3uzyxa1','cml9xi5if000xwlw8y30jc3aw','Lock replacement',796.591118353479,'PENDING',0,1770334087959,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gny00cnwls0qzwhhzmo','cmla37gl400c3wls0ayimck7q','cml9xi5jd0017wlw8bpznvjhc','Electrical panel servicing',986.97113190975,'PENDING',0,1770334087966,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37go400cpwls0rfc8vhp9','cmla37glc00c5wls0aveqt393','cml9xi5in000zwlw8jji4tbz6','Emergency lighting repair',672.76792451951,'PENDING',0,1770334087972,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37goh00crwls0yni2rhsa','cmla37glj00c7wls0ogiid5zr','cml9xi5i9000vwlw8f1j14dmc','AC unit repair',349.337803725324,'PENDING',0,1770334087986,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37goo00ctwls0l4va1ek8','cmla37gj400bpwls0ob523ik7','cml9xi5it0011wlw8jlcuxq6r','Electrical panel servicing',687.881386979013,'PENDING',0,1770334087992,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gov00cvwls02t2vx9sy','cmla37glj00c7wls0ogiid5zr','cml9xi5it0011wlw8jlcuxq6r','AC unit repair',867.613896534875,'PENDING',0,1770334087999,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gp100cxwls0snuu43tp','cmla37gk100bxwls005t9m2xg','cml9xi5i1000twlw8l2qne4w9','HVAC system checkup',759.180746166655,'PENDING',0,1770334088005,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gp800czwls0jgkqvjit','cmla37gl400c3wls0ayimck7q','cml9xi5j00013wlw8q6vr2xd0','Water pump maintenance',438.181769625747,'PENDING',0,1770334088013,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gpg00d1wls061m5c3a0','cmla37glc00c5wls0aveqt393','cml9xi5j60015wlw8sj8qysq5','AC unit repair',561.787754515663,'PENDING',0,1770334088020,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gpn00d3wls0crstjinz','cmla37gjt00bvwls0uanm92jx','cml9xi5hv000rwlw8bvm5a9n4','Emergency lighting repair',778.343308558585,'PENDING',0,1770334088027,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmla37gpz00d7wls01e0z13kl','cmla37gjd00brwls0ab6flrvn','cml9xi5j60015wlw8sj8qysq5','Plumbing leak repair',602.373995709321,'PENDING',0,1770334088040,NULL,NULL,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmldhew5p0001wlpo13ll4i1c','cmla37glc00c5wls0aveqt393','cml9xi5hv000rwlw8bvm5a9n4','تجربة كده',2220.0,'COMPLETED',0,1770539347779,1770539356229,1770539367288,NULL);
INSERT INTO "TechnicianWork" VALUES ('cmldhfxz10007wlpowfse7hd8','cmla37gk100bxwls005t9m2xg','cml9xi5hv000rwlw8bvm5a9n4','صلح الماسورة',1110.0,'COMPLETED',0,1770539396795,1770539401613,1770539411040,NULL);
INSERT INTO "Ticket" VALUES ('cml9xi5zp0055wlw87qd6et9d','Garden needs maintenance','Garden needs maintenance','NEW','High',NULL,1770324509653,1770324509653,NULL,'cml9xi5vi0047wlw86zaygtkb','cml9xi5j00013wlw8q6vr2xd0','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi5zw0057wlw86v6bsqdz','Common area needs cleaning','Common area needs cleaning','NEW','Urgent',NULL,1770324509660,1770324509660,NULL,'cml9xi5vr0049wlw85nmv49iy','cml9xi5i1000twlw8l2qne4w9','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi6020059wlw8sc4h1ol1','Common area needs cleaning','Common area needs cleaning','NEW','Normal',NULL,1770324509667,1770324509667,NULL,'cml9xi5si003pwlw8iazizh6p','cml9xi5i1000twlw8l2qne4w9','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi609005bwlw8o1ujftdq','AC unit not cooling','AC unit not cooling','NEW','Low',NULL,1770324509673,1770324509673,NULL,'cml9xi5sb003nwlw8wndp6l9m','cml9xi5jd0017wlw8bpznvjhc','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi60g005dwlw89q7ygo25','Garden needs maintenance','Garden needs maintenance','NEW','Low',NULL,1770324509681,1770324509681,NULL,'cml9xi5v20043wlw86vcipxv6','cml9xi5j60015wlw8sj8qysq5','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi60o005fwlw8d0ry9wgp','Parking gate malfunction','Parking gate malfunction','DONE','Urgent','Issue has been resolved successfully',1770324509688,1770324509688,1770324509686,'cml9xi5t7003vwlw8383i9y31','cml9xi5j60015wlw8sj8qysq5','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi60u005hwlw8b18x4so3','Garden needs maintenance','Garden needs maintenance','NEW','Low',NULL,1770324509695,1770324509695,NULL,'cml9xi5v20043wlw86vcipxv6','cml9xi5j60015wlw8sj8qysq5','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi612005jwlw852819fhz','AC unit not cooling','AC unit not cooling','NEW','Urgent',NULL,1770324509702,1770324509702,NULL,'cml9xi5uk003zwlw8h6e9zg8g','cml9xi5if000xwlw8y30jc3aw','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi619005lwlw86iatx3v4','AC unit not cooling','AC unit not cooling','IN_PROGRESS','Urgent',NULL,1770324509709,1770324509709,NULL,'cml9xi5t7003vwlw8383i9y31','cml9xi5j60015wlw8sj8qysq5','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi61f005nwlw89ot4npxk','Elevator not working properly','Elevator not working properly','DONE','Urgent','Issue has been resolved successfully',1770324509716,1770324509716,1770324509715,'cml9xi5q20037wlw8352qym7y','cml9xi5hn000pwlw82o33iaof','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi61n005pwlw8byb587tm','Common area needs cleaning','Common area needs cleaning','NEW','Normal',NULL,1770324509723,1770324509723,NULL,'cml9xi5va0045wlw8f28amgc6','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi61u005rwlw8f9eimhy2','Garden needs maintenance','Garden needs maintenance','NEW','High',NULL,1770324509731,1770324509731,NULL,'cml9xi5va0045wlw8f28amgc6','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi621005twlw8gbdik40p','Parking gate malfunction','Parking gate malfunction','NEW','Normal',NULL,1770324509737,1770324509737,NULL,'cml9xi5q20037wlw8352qym7y','cml9xi5hn000pwlw82o33iaof','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cml9xi627005vwlw8g86boe9o','AC unit not cooling','AC unit not cooling','IN_PROGRESS','Urgent',NULL,1770324509744,1770324509744,NULL,'cml9xi5r5003hwlw84wzk6v3v','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cml9xi62e005xwlw8y7cdc6nd','Water leakage in bathroom','Water leakage in bathroom','NEW','Low',NULL,1770324509750,1770324509750,NULL,'cml9xi5v20043wlw86vcipxv6','cml9xi5j60015wlw8sj8qysq5','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37fsv0055wls0gycoo7y2','Common area needs cleaning','Common area needs cleaning','NEW','High',NULL,1770334086847,1770334086847,NULL,'cmla35yld0043wle0sksvszvl','cml9xi5it0011wlw8jlcuxq6r','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37ft40057wls0j40uis02','Elevator not working properly','Elevator not working properly','DONE','Urgent','Issue has been resolved successfully',1770334086857,1770334086857,1770334086854,'cmla35yll0045wle0ovilrz04','cml9xi5j00013wlw8q6vr2xd0','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37ftc0059wls0nw9qiu2u','Elevator not working properly','Elevator not working properly','IN_PROGRESS','High',NULL,1770334086865,1770334086865,NULL,'cmla35yll0045wle0ovilrz04','cml9xi5j00013wlw8q6vr2xd0','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37ftj005bwls0xa2govtr','Elevator not working properly','Elevator not working properly','NEW','High',NULL,1770334086872,1770334086872,NULL,'cmla35yid003bwle0rwhis576','cml9xi5it0011wlw8jlcuxq6r','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37ftr005dwls0wbr77rst','AC unit not cooling','AC unit not cooling','DONE','Normal','Issue has been resolved successfully',1770334086880,1770334086880,1770334086878,'cmla35yld0043wle0sksvszvl','cml9xi5it0011wlw8jlcuxq6r','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37ftz005fwls0fdmk9aft','Garden needs maintenance','Garden needs maintenance','NEW','High',NULL,1770334086888,1770334086888,NULL,'cmla35yjb003jwle0wfnkpyz9','cml9xi5it0011wlw8jlcuxq6r','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37fua005hwls0o5y2k5if','Garden needs maintenance','Garden needs maintenance','DONE','Low','Issue has been resolved successfully',1770334086899,1770334086899,1770334086897,'cmla35ynw004twle0c3vwyo4m','cml9xi5hn000pwlw82o33iaof','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37fuk005jwls02ydm32od','AC unit not cooling','AC unit not cooling','DONE','Normal','Issue has been resolved successfully',1770334086908,1770334086908,1770334086907,'cmla35ynj004pwle0l2ruaobj','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37fus005lwls0sr2eqro3','Elevator not working properly','Elevator not working properly','DONE','Low','Issue has been resolved successfully',1770334086916,1770334086916,1770334086915,'cmla35ykd003twle0uassg83s','cml9xi5it0011wlw8jlcuxq6r','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37fuy005nwls0377ry6ww','Elevator not working properly','Elevator not working properly','DONE','Urgent','Issue has been resolved successfully',1770334086923,1770334086923,1770334086921,'cmla35ykr003xwle08bpga6tn','cml9xi5it0011wlw8jlcuxq6r','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37fv5005pwls0l1ikkjrq','Water leakage in bathroom','Water leakage in bathroom','DONE','Urgent','Issue has been resolved successfully',1770334086930,1770334086930,1770334086929,'cmla35yid003bwle0rwhis576','cml9xi5it0011wlw8jlcuxq6r','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37fvc005rwls0imbvh830','AC unit not cooling','AC unit not cooling','NEW','Urgent',NULL,1770334086937,1770334086937,NULL,'cmla35yjv003pwle04vfq6ikv','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37fvj005twls0g78bummf','Garden needs maintenance','Garden needs maintenance','IN_PROGRESS','High',NULL,1770334086943,1770334086943,NULL,'cmla35yms004hwle0wiasufze','cml9xi5j60015wlw8sj8qysq5','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "Ticket" VALUES ('cmla37fvp005vwls036u38yvz','Elevator not working properly','Elevator not working properly','DONE','Urgent','Issue has been resolved successfully',1770334086950,1770334086950,1770334086949,'cmla35ynw004twle0c3vwyo4m','cml9xi5hn000pwlw82o33iaof','cml9xi5dz0002wlw8emdz9tye');
INSERT INTO "Ticket" VALUES ('cmla37fvv005xwls06qpjgtji','AC unit not cooling','AC unit not cooling','IN_PROGRESS','Urgent',NULL,1770334086956,1770334086956,NULL,'cmla35yjv003pwle04vfq6ikv','cml9xi5hv000rwlw8bvm5a9n4','cml9xi5e70003wlw86ntjlgh4');
INSERT INTO "UnitExpense" VALUES ('cml9xi65q006twlw83lrivjdq-exp-1','cml9xi5in000zwlw8jji4tbz6',NULL,1769719709879,'تصليح كهرباء - صيانة وحدة سكنية',547.459920796778,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi65q006twlw83lrivjdq',NULL,1770324509881,1770324509881);
INSERT INTO "UnitExpense" VALUES ('cml9xi65q006twlw83lrivjdq-exp-2','cml9xi5in000zwlw8jji4tbz6',NULL,1770065309889,'تصليح الأنابيب والسباكة',426.744074925335,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi65q006twlw83lrivjdq',NULL,1770324509890,1770324509890);
INSERT INTO "UnitExpense" VALUES ('cml9xi66t006vwlw8benxncss-exp-1','cml9xi5it0011wlw8jlcuxq6r',NULL,1769719709918,'تصليح كهرباء - صيانة وحدة سكنية',455.329355973259,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi66t006vwlw8benxncss',NULL,1770324509919,1770324509919);
INSERT INTO "UnitExpense" VALUES ('cml9xi66t006vwlw8benxncss-exp-2','cml9xi5it0011wlw8jlcuxq6r',NULL,1770065309927,'تصليح الأنابيب والسباكة',413.168073715009,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi66t006vwlw8benxncss',NULL,1770324509928,1770324509928);
INSERT INTO "UnitExpense" VALUES ('cml9xi67u006xwlw8pcs3w8m3-exp-1','cml9xi5j00013wlw8q6vr2xd0',NULL,1769719709954,'تصليح كهرباء - صيانة وحدة سكنية',534.163166757322,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi67u006xwlw8pcs3w8m3',NULL,1770324509956,1770324509956);
INSERT INTO "UnitExpense" VALUES ('cml9xi67u006xwlw8pcs3w8m3-exp-2','cml9xi5j00013wlw8q6vr2xd0',NULL,1770065309963,'تصليح الأنابيب والسباكة',425.736014132461,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cml9xi67u006xwlw8pcs3w8m3',NULL,1770324509964,1770324509964);
INSERT INTO "UnitExpense" VALUES ('cml9xi690006zwlw878wk1lj3','cml9xi5hv000rwlw8bvm5a9n4',NULL,1770324509987,'Electric box maintenance',469.631735937783,'TECHNICIAN_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770324509988,1770324509988);
INSERT INTO "UnitExpense" VALUES ('cml9xi69a0071wlw8w3zlb9v2','cml9xi5i1000twlw8l2qne4w9',NULL,1770324509997,'Cleaning supplies purchase',363.420845925756,'ELECTRICITY','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770324509998,1770324509998);
INSERT INTO "UnitExpense" VALUES ('cml9xi69j0073wlw83vc8zk3v','cml9xi5j60015wlw8sj8qysq5',NULL,1770324510006,'Emergency light bulb replacement',263.045978471215,'OTHER','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770324510008,1770324510008);
INSERT INTO "UnitExpense" VALUES ('cml9xi69t0075wlw8fu6sb56v','cml9xi5j60015wlw8sj8qysq5',NULL,1770324510016,'Minor plumbing repair',279.763846554091,'TECHNICIAN_WORK','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770324510017,1770324510017);
INSERT INTO "UnitExpense" VALUES ('cml9xi6a10077wlw8q4ryfc6s','cml9xi5hn000pwlw82o33iaof',NULL,1770324510024,'Electric box maintenance',514.186857035415,'STAFF_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770324510025,1770324510025);
INSERT INTO "UnitExpense" VALUES ('cml9xi6a90079wlw85bcrsrl1','cml9xi5if000xwlw8y30jc3aw',NULL,1770324510032,'Minor plumbing repair',246.156578710666,'ELECTRICITY','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770324510034,1770324510034);
INSERT INTO "UnitExpense" VALUES ('cml9xi6aj007bwlw8tq5ncuje','cml9xi5i9000vwlw8f1j14dmc',NULL,1770324510042,'Electric box maintenance',111.63819768606,'STAFF_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770324510044,1770324510044);
INSERT INTO "UnitExpense" VALUES ('cml9xi6b7007dwlw8d0j6tyio','cml9xi5it0011wlw8jlcuxq6r',NULL,1770324510066,'Electric box maintenance',402.842552720166,'ELECTRICITY','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770324510067,1770324510067);
INSERT INTO "UnitExpense" VALUES ('cml9y6p7c0009wl3kb5lutgzi','cml9xi5hn000pwlw82o33iaof',NULL,1770325654296,'شباك',500.0,'OTHER','cml9xi5da0000wlw8xaybqxue',NULL,NULL,0,'cml9y6p6w0007wl3kehvmp2zv',NULL,1770325654296,1770325654296);
INSERT INTO "UnitExpense" VALUES ('cmla37fz5006zwls04dxmjlx4','cml9xi5hv000rwlw8bvm5a9n4',NULL,1770334087072,'Cleaning supplies purchase',489.980006498934,'STAFF_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770334087073,1770334087073);
INSERT INTO "UnitExpense" VALUES ('cmla37fzi0071wls0b8ved9xd','cml9xi5hn000pwlw82o33iaof',NULL,1770334087085,'Minor plumbing repair',455.710068960164,'ELECTRICITY','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770334087086,1770334087086);
INSERT INTO "UnitExpense" VALUES ('cmla37fzr0073wls0xtx1na4x','cml9xi5hn000pwlw82o33iaof',NULL,1770334087094,'Cleaning supplies purchase',583.039381097954,'ELECTRICITY','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770334087095,1770334087095);
INSERT INTO "UnitExpense" VALUES ('cmla37fzz0075wls0qrr8eysv','cml9xi5it0011wlw8jlcuxq6r',NULL,1770334087103,'Electric box maintenance',238.917496589258,'STAFF_WORK','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770334087104,1770334087104);
INSERT INTO "UnitExpense" VALUES ('cmla37g090077wls0qx8k84zu','cml9xi5if000xwlw8y30jc3aw',NULL,1770334087112,'Emergency light bulb replacement',485.813155730298,'STAFF_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770334087113,1770334087113);
INSERT INTO "UnitExpense" VALUES ('cmla37g0h0079wls02u47nioi','cml9xi5hv000rwlw8bvm5a9n4',NULL,1770334087120,'Emergency light bulb replacement',191.7167563095,'OTHER','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770334087122,1770334087122);
INSERT INTO "UnitExpense" VALUES ('cmla37g0q007bwls05cc29hrb','cml9xi5j60015wlw8sj8qysq5',NULL,1770334087129,'Minor plumbing repair',130.090318620971,'STAFF_WORK','cml9xi5e70003wlw86ntjlgh4',NULL,NULL,0,NULL,NULL,1770334087131,1770334087131);
INSERT INTO "UnitExpense" VALUES ('cmla37g0z007dwls0g1imkrxs','cml9xi5hn000pwlw82o33iaof',NULL,1770334087139,'Emergency light bulb replacement',238.76149232608,'OTHER','cml9xi5dz0002wlw8emdz9tye',NULL,NULL,0,NULL,NULL,1770334087140,1770334087140);
INSERT INTO "UnitExpense" VALUES ('cmldhlbsj0003wlecbacbxcdu','cml9xi5hv000rwlw8bvm5a9n4',NULL,1770539647987,'صلح الماسورة',1110.0,'OTHER','cml9xi5dr0001wlw8dasnvjd0',NULL,NULL,0,'cmldhlbs50001wlecedj2sk07',NULL,1770539647987,1770539647987);
INSERT INTO "User" VALUES ('cml9xi5da0000wlw8xaybqxue','admin@company.com','System Administrator','$2b$10$IeHVWjqHuYHshKEMYlIyV./auG5PiIUqiPVLFxnFBwgmNqdBbmad.',NULL,'ADMIN',0,1770324508846,1770324508846);
INSERT INTO "User" VALUES ('cml9xi5dr0001wlw8dasnvjd0','accountant@company.com','Ahmed Accountant','$2b$10$IeHVWjqHuYHshKEMYlIyV./auG5PiIUqiPVLFxnFBwgmNqdBbmad.',NULL,'ACCOUNTANT',0,1770324508864,1770324508864);
INSERT INTO "User" VALUES ('cml9xi5dz0002wlw8emdz9tye','pm1@company.com','Mohamed Project Manager','$2b$10$IeHVWjqHuYHshKEMYlIyV./auG5PiIUqiPVLFxnFBwgmNqdBbmad.',NULL,'PROJECT_MANAGER',0,1770324508871,1770541416057);
INSERT INTO "User" VALUES ('cml9xi5e70003wlw86ntjlgh4','pm2@company.com','Sara Project Manager','$2b$10$IeHVWjqHuYHshKEMYlIyV./auG5PiIUqiPVLFxnFBwgmNqdBbmad.',NULL,'PROJECT_MANAGER',0,1770324508879,1770324508879);
CREATE UNIQUE INDEX IF NOT EXISTS "AccountingNote_convertedToExpenseId_key" ON "AccountingNote" (
	"convertedToExpenseId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_unitId_invoiceNumber_key" ON "Invoice" (
	"unitId",
	"invoiceNumber"
);
CREATE UNIQUE INDEX IF NOT EXISTS "N8nApiKey_key_key" ON "N8nApiKey" (
	"key"
);
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalExpense_convertedFromNoteId_key" ON "OperationalExpense" (
	"convertedFromNoteId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalUnit_projectId_code_key" ON "OperationalUnit" (
	"projectId",
	"code"
);
CREATE UNIQUE INDEX IF NOT EXISTS "OwnerAssociation_unitId_key" ON "OwnerAssociation" (
	"unitId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAssignment_userId_projectId_key" ON "ProjectAssignment" (
	"userId",
	"projectId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectElement_projectId_name_key" ON "ProjectElement" (
	"projectId",
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectType_name_key" ON "ProjectType" (
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_name_key" ON "Project" (
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "Resident_whatsappPhone_key" ON "Resident" (
	"whatsappPhone"
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProjectAssignment_staffId_projectId_key" ON "StaffProjectAssignment" (
	"staffId",
	"projectId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffUnitAssignment_staffId_unitId_key" ON "StaffUnitAssignment" (
	"staffId",
	"unitId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "TechnicianSpecialty_name_key" ON "TechnicianSpecialty" (
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "UnitExpense_staffWorkLogId_key" ON "UnitExpense" (
	"staffWorkLogId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "UnitExpense_technicianWorkId_key" ON "UnitExpense" (
	"technicianWorkId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" (
	"email"
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_whatsappPhone_key" ON "User" (
	"whatsappPhone"
);
COMMIT;
