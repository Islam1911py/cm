-- فحص تكرارات (projectId, invoiceNumber) قبل تطبيق الـ migration
-- تشغيل يدوي في أي عميل PostgreSQL متصل بنفس الداتابيز (psql أو GUI)

-- 1) عدد الأزواج المكررة (حيث projectId ليس null)
SELECT "projectId", "invoiceNumber", COUNT(*) AS count
FROM "Invoice"
WHERE "projectId" IS NOT NULL
GROUP BY "projectId", "invoiceNumber"
HAVING COUNT(*) > 1;

-- 2) تفاصيل الصفوف المكررة (للمراجعة)
SELECT i.id, i."projectId", i."invoiceNumber", i."unitId", i.type, i.amount, i."issuedAt"
FROM "Invoice" i
INNER JOIN (
  SELECT "projectId", "invoiceNumber"
  FROM "Invoice"
  WHERE "projectId" IS NOT NULL
  GROUP BY "projectId", "invoiceNumber"
  HAVING COUNT(*) > 1
) d ON i."projectId" = d."projectId" AND i."invoiceNumber" = d."invoiceNumber"
ORDER BY i."projectId", i."invoiceNumber", i.id;
