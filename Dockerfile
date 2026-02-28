# 1. مرحلة التبعيات
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# تثبيت النسخة 6 المضمونة وتوليد الـ Client
RUN npm install prisma@6 @prisma/client@6
RUN npx prisma generate

# 2. مرحلة البناء
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. مرحلة التشغيل النهائية
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# نسخ ملفات Next.js Standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# --- Prisma + سكربت إصلاح التكرارات (يُشغّل في CMD قبل db push) ---
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
# -----------------------------------------------

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ١) إصلاح تكرارات (projectId, invoiceNumber) إن وُجدت  ٢) تطبيق الـ schema  ٣) تشغيل السيرفر
CMD ["sh", "-c", "node prisma/scripts/fix-invoice-duplicates.js && ./node_modules/.bin/prisma db push --schema ./prisma/schema.prisma --accept-data-loss && node server.js"]
