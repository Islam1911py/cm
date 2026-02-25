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

# --- أهم جزء: نسخ ملفات Prisma عشان الأمر يشتغل ---
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
# -----------------------------------------------

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# تشغيل الربط بالداتابيز ثم تشغيل الموقع في أمر واحد
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema ./prisma/schema.prisma && node server.js"]
