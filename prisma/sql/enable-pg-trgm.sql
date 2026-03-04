-- تشغيل مرة واحدة بعد db push (أو يدوياً على الـ DB).
-- مطلوب لـ findProjectSmart: مطابقة تقريبية على slug (كرمة/كارما/karma).
--
-- من الطرفية (استخدم رابط الداتابيز من .env):
--   psql "$DATABASE_URL" -f prisma/sql/enable-pg-trgm.sql
-- أو من Prisma (إن وُجد):
--   npx prisma db execute --file prisma/sql/enable-pg-trgm.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Project_slug_gin_trgm"
  ON "Project" USING gin (slug gin_trgm_ops)
  WHERE slug IS NOT NULL;
