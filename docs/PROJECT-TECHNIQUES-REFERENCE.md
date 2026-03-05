# مرجع تقنيات المشروع — كل ما استخدمناه (باك اند، بحث، API، داتا، ردود)

هذا الملف مرجع **للمشروع الحالي** ولأي مشروع مشابه لاحقًا. يضم كل التقنيات والأساليب والتفاصيل الصغيرة حتى لا نعيد الاختراع من الصفر.

---

## ١ — الستاك والبنية التحتية

| التقنية | الاستخدام |
|---------|-----------|
| **Next.js** (App Router) | تطبيق ويب + API routes تحت `src/app/api/` |
| **Prisma** | ORM مع PostgreSQL؛ الموديلات في `prisma/schema.prisma` |
| **PostgreSQL** | الداتابيز؛ مطلوب امتداد `pg_trgm` للبحث التقريبي على الـ slug |
| **NextAuth** | تسجيل دخول الداشبورد (أدمن، مدير مشروع، محاسب) |
| **TypeScript** | كامل المشروع؛ مسارات `@/*` → `./src/*` في tsconfig |
| **n8n** | أتمتة الواتساب (ويب هوكات، identity، تولز) — البوت يستدعي الـ API وليس العكس |
| **tsx** | تشغيل سكربتات TS (مثل backfill) بدون compile مسبق |

- **تشغيل محلي:** `npm run dev` (منفذ 3000).
- **بناء للإنتاج:** `npm run build` ثم `node .next/standalone/server.js` (أو استضافة مثل Coolify على VPS).
- **سكربتات الداتا:** تشغيل من جذر المشروع؛ في الـ container قد لا يكون `src/` موجودًا → استخدم ملفات داخل `prisma/scripts` فقط (انظر backfill الـ slug).

---

## ٢ — الداتابيز (Schema + إضافات)

### ٢.١ حقول الـ slug

- **Project:** `slug String? @unique` — ناتج من الاسم (عربي/إنجليزي → تطبيع لاتيني)، يُملأ عند الإنشاء أو بالـ backfill. **لا default عشوائي.**
- **OperationalUnit:** `slug String?` — تطبيع للبحث **داخل المشروع فقط** (ليس فريدًا globally). فهرس مركب: `@@index([projectId, slug])`.

### ٢.٢ امتداد pg_trgm والبحث التقريبي

- **الملف:** `prisma/sql/enable-pg-trgm.sql`
- **المحتوى:**
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  - `CREATE INDEX IF NOT EXISTS "Project_slug_gin_trgm" ON "Project" USING gin (slug gin_trgm_ops) WHERE slug IS NOT NULL;`
- **التشغيل (مرة واحدة بعد db push):**  
  `psql "$DATABASE_URL" -f prisma/sql/enable-pg-trgm.sql`  
  أو من Prisma: `npx prisma db execute --file prisma/sql/enable-pg-trgm.sql`
- **الاستخدام:** دالة `findProjectSmart` في `src/lib/project-slug.ts` — مطابقة تقريبية على `slug` (مثل كرمة/كارما/karma). لو الـ extension غير مفعّل يُستخدم fallback (Levenshtein في Node).

### ٢.٣ مفاتيح API للبوت (n8n)

- **الجداول:** `N8nApiKey`, `N8nWebhookLog`
- **N8nApiKey:** `key` (فريد)، `role` (RESIDENT | ACCOUNTANT | ADMIN | PROJECT_MANAGER)، `projectId` (اختياري لربط المفتاح بمشروع واحد)، `rateLimit` (مثلاً 100 طلب/دقيقة)، `requestCount`, `lastResetAt`, `isActive`.
- **N8nWebhookLog:** تسجيل الطلبات (apiKeyId، endpoint، statusCode، requestBody، responseBody، إلخ) للتدقيق والتصحيح.

### ٢.٤ سكربتات Backfill

- **Backfill slug المشاريع:** `npm run db:backfill-project-slug` → يشغّل `tsx prisma/scripts/backfill-project-slug.ts`.
- **اعتماد السكربت في الـ container:** السكربت **لا** يستورد من `@/lib/project-slug` ولا من `../../src/...` لأن مجلد `src/` قد يكون غير موجود في صورة الـ deploy. بدلاً من ذلك:
  - يوجد ملف `prisma/scripts/slug-for-backfill.ts` ينسخ منطق `projectSlugForCreate` (وعمليات التطبيع + strip أنواع الأماكن) بدون استيراد من `src/`.
  - `backfill-project-slug.ts` يستورد من `./slug-for-backfill`.
- **مزامنة:** عند تغيير منطق الـ slug في `src/lib/project-slug.ts` (مثل إضافة نوع مكان)، حدّث `slug-for-backfill.ts` يدويًا.

---

## ٣ — المصادقة على الويب هوكات (n8n)

- **المصدر:** `src/lib/n8n-auth.ts`
- **الطريقة:** هيدر `x-api-key`؛ البحث في `N8nApiKey` عن `key`، التحقق من `isActive`، وتطبيق **rate limiting** (عدد الطلبات في الدقيقة، مع reset بعد مرور دقيقة).
- **النتيجة:** `{ valid: boolean, context?: { apiKey, keyId, role, projectId? }, error?: string }`.
- **الأدوار:** `RESIDENT` | `ACCOUNTANT` | `ADMIN` | `PROJECT_MANAGER`. كل ويب هوك يتحقق من الدور المسموح (مثلاً resolve-unit للساكن فقط، accountants للمحاسب/أدمن).

---

## ٤ — عقد استجابة الويب هوك (ما يطلع للعميل في الشات)

### ٤.١ دائماً HTTP 200

- **السبب:** n8n يوقف الـ workflow إذا استلم status غير 2xx، فيفقد البوت الوصول لـ body.
- **التنفيذ:** `WEBHOOK_ALWAYS_OK = 200`؛ كل ردود الويب هوك ترجع `NextResponse.json(body, { status: WEBHOOK_ALWAYS_OK })`.
- **النتيجة الفعلية (نجاح/فشل)** تكون داخل **body**: `success: true | false`، `error`، `humanReadable`، `code`، إلخ.

### ٤.٢ شكل الرد الموحّد للبوت

- **دوال مساعدة:** `src/lib/webhook-response.ts`
  - **botFail(messageAr, code?, options?):** يرجع `{ success: false, error: code ?? "ERROR", humanReadable: { ar: messageAr }, code?, suggestions?, details? }`.
  - **botSuccess(data, messageAr?):** يرجع `{ ...data, success: true, humanReadable?: { ar: messageAr } }`.
- **الحقول المشتركة في الرد:**
  - **humanReadable.ar** (string): رسالة عربية للعرض في الشات — **مصدر للمعنى وليس للنقل الحرفي**؛ البرومبت يطلب من الـ AI أن يفهم المضمون ويصيغ بكلامه (انظر دليل الأسلوب).
  - **suggestions** (array اختياري): خطوات مقترحة (مثل "تأكد من projectId"، "راجع قائمة الأكشنز") — تُعرض كـ "تقدر تعمل كذا" بشكل طبيعي.
  - **code** (string اختياري): للـ branching والـ logging في n8n (مثل UNAUTHORIZED، MISSING_FIELDS، NOT_FOUND، INTERNAL_ERROR).

### ٤.٣ أكواد الخطأ الشائعة (للـ branching / logging)

| code | معنى تقريبي |
|------|-------------|
| UNAUTHORIZED | مفتاح API غير صالح |
| FORBIDDEN | الطلب لهذا الدور فقط |
| INVALID_JSON | البادي ليس JSON صحيح |
| MISSING_FIELDS | نقص حقول مطلوبة |
| UNSUPPORTED_ACTION | أكشن غير مدعوم |
| NOT_FOUND / PM_NOT_FOUND / ACCOUNTANT_NOT_FOUND | المورد أو المستخدم غير موجود |
| INTERNAL_ERROR | خطأ من السيرفر |

---

## ٥ — طرق البحث (Search)

### ٥.١ بحث المشروع (اسم → مشروع واحد)

- **المصدر:** `src/lib/project-slug.ts`
- **الدالة الرئيسية:** `findProjectBySlugOrName(db, projectName)`.

**المراحل بالترتيب:**

1. **تطابق slug بالضبط:** من الاسم المُدخل يُحسب slug عبر `projectNameToMatchSlug`؛ بحث في DB بـ `where: { slug: inputSlug }`.
2. **Fallback name contains:** بحث بـ `name: { contains: normalizedInput, mode: "insensitive" }` (مع تطبيع كاف فارسي → عربي، ه/ة).
3. **مطابقة بالـ slug المحسوب من الاسم:** جلب كل المشاريع ومقارنة `projectNameToMatchSlug(p.name) === inputSlug`؛ لو وُجد مشروع وكان `slug` في DB null يتم تحديثه في الخلفية بـ `projectSlugForCreate(p.name)`.
4. **مطابقة تقريبية:** إن وُجدت دالة `findProjectSmart` (تعتمد على pg_trgm) تُستدعى؛ إن رجعت مرشحًا واحدًا أو فرق similarity واضح بين الأول والثاني يُعاد المشروع الأفضل. وإلا fallback إلى `findCloseProjects` (Levenshtein على الـ slug في Node).

**تطبيع الاسم → slug (للمطابقة):**

- **projectNameToMatchSlug(name):** تطبيع lookalikes (ک→ك)، تطبيع مرادفات نوع المكان (strong + weak)، تطبيع ه/ة، إزالة **Strong Place Types** فقط من النص (كومباوند، مشروع، محل، صيدلية، شاطئ، مستشفى، بركة، صواري، ريسيدنس، مول، هايبر، سوبر ماركت، فندق، مجمع، قرية، عقار، اوتلت، كلينيك، مركز طبي، جامعة، مدرسة، حضانة، نادي، فيلا، تاون هاوس، حديقة، مصنع، مكتب). ثم تحويل الحروف إلى لاتيني (جدول ARABIC_TO_LATIN) وأرقام عربية/فارسية إلى أرقام لاتينية، ومسافات تُبقى ثم تُجمّع.
- **Weak types** (سنتر، بلازا، ريزورت، لاند مارك، سيتي، مارينا، كورنيش، منطقة، برج): تطبيع فقط ولا تُزال من الاسم (لتجنب collision مثل "سيتي ستارز" ≠ "ستارز").
- **projectSlugForCreate(name):** نفس منطق projectNameToMatchSlug؛ لو الناتج فارغ يُستخدم fallback: `name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "project"`.

**دوال مساعدة:**

- **findProjectSmart(db, searchKey, options?):** استعلام خام `similarity(slug, searchKey)` مع `slug % searchKey` وحد أدنى similarity؛ يرجع مصفوفة مرشحين مع `sim`.
- **findCloseProjects(db, projectName, maxCandidates?, maxDistance?):** Fallback بدون pg_trgm — جلب مشاريع لها slug، حساب مسافة Levenshtein بين slug المُدخل وكل slug، وترشيح الأقرب ضمن maxDistance.

### ٥.٢ بحث الوحدة (داخل مشروع معيّن)

- **المصدر:** `src/lib/project-slug.ts` + `src/lib/resolve-unit.ts`
- **findUnitBySlugOrName(db, projectId, unitName):**
  1. حساب `unitNameToMatchSlug(unitName)` (إزالة أنواع الوحدات: عمارة، مبنى، بلوك، برج، وحدة؛ وتطبيع مرادفاتها ثم تحويل لاتيني/أرقام).
  2. تطابق `where: { projectId, slug: inputSlug }`.
  3. إن لم يُوجد: تطابق `name: { contains: unitName, mode: "insensitive" }` داخل نفس المشروع (مع حد أقصى نتائج لتجنب غموض).

- **resolveUnit(body):** المنطق الكامل لـ "الساكن قال كومباوند X وعمارة Y":
  1. **المشروع:** استدعاء `findProjectBySlugOrName(db, projectName)`؛ إن لم يُوجد استدعاء `findCloseProjects`؛ إن أكثر من مرشح واحد يُرجع `projectCandidates` + humanReadable "تقصد أي مشروع؟".
  2. **الوحدة (داخل المشروع):** أولاً بالـ code (unitCode أو buildingNumber) مع `projectId`؛ ثم `findUnitBySlugOrName`؛ ثم exact match على الاسم؛ ثم contains على الاسم؛ ثم نفس contains بعد تطبيع الأرقام العربية (`normalizeArabicNumerals`). إن وُجد أكثر من وحدة → خطأ multiple_matches.
  3. **لو المشروع موجود والوحدة غير موجودة:** جلب قائمة وحدات المشروع وإرجاع `availableUnits` + humanReadable "احنا بنغطي: … تقصد أي وحدة؟".
  4. **النتيجة الناجحة:** `success: true`، `project`، `unit`، `humanReadable.ar`، واختياري `needsConfirmation: true` إذا تم تحديد المشروع عبر fuzzy.

### ٥.٣ بحث المصروفات والفلترة (DSL)

- **المصدر:** `src/lib/expense-search.ts`
- **الدوال المستخدمة في الـ webhooks:**
  - **parseExpenseFilterDsl(input)** → `{ where?: Prisma.UnitExpenseWhereInput, errors: string[] }`
  - **parseInvoiceFilterDsl(input)** → نفس الشكل لـ Invoice
  - **parseStaffAdvanceFilterDsl**, **parseAccountingNoteFilterDsl**, **parsePayrollFilterDsl** — نفس الفكرة لسياقات مختلفة.
- **تحليل النص الحر (وصف):** `analyzeExpenseSearch`, `buildDescriptionFilter` — لربط كلمات البحث بوصف المصروف أو الحقول النصية.

---

## ٦ — صياغة الـ DSL (فلترة المصروفات، الفواتير، إلخ)

### ٦.١ الشكل العام لشرط واحد

- **النمط:** `field operator value` — يُفصل بين الشروط بكلمة **AND** (مثال: `amount > 500 AND date >= 2025-01-01`).
- **تقسيم التعبير:** الدالة `splitLogicalExpressions(input)` تقسم النص على AND/OR مع احترام علامات الاقتباس داخل القيم؛ **OR** غير مدعوم (يُرجع خطأ).
- **نمط شرط واحد (regex):** `^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>|IN|NOT\s+IN)\s*(.+)$` — أي حقل (أحرف، نقطة، شرطة سفلية)، ثم معامل، ثم قيمة.
- **القيم:** أرقام بدون اقتباس؛ نصوص إما بدون اقتباس أو داخل `"..."` أو `'...'`. القوائم للـ IN / NOT IN بصيغة `(val1, val2)` (أقواس وفواصل).

### ٦.٢ المعاملات (Operators)

- للمقارنة العددية والتاريخ: `=`, `!=`, `>`, `>=`, `<`, `<=`
- للنصوص والقوائم: `=`, `!=`, `IN`, `NOT IN`
- للقيم في IN: قوسين وأكثر من قيمة مفصولة بفاصلة، مثل `("A","B")`

### ٦.٣ حقول UnitExpense (مصروفات الوحدات)

- **amount** — رقم
- **date** — تاريخ (يُفسَّر كـ Date)
- **sourcetype** — نوع المصدر (مثل TECHNICIAN_WORK, STAFF_WORK, ELECTRICITY, OTHER)؛ مع IN/NOT IN قائمة قيم
- **projectid** / **project** — معرف المشروع
- **projectname** — اسم المشروع (equals فقط، case insensitive)
- **unitcode** — كود الوحدة (equals، case insensitive)

أمثلة: `amount > 500`, `date >= 2025-01-01`, `sourcetype = TECHNICIAN_WORK`, `projectid = "abc123"`.

### ٦.٤ حقول Invoice (الفواتير)

- تختلف قليلاً حسب السياق (مثلاً حقول الفاتورة مثل status، isPaid، إلخ). نفس آلية الشرط: `field operator value` وربط الشروط بـ AND.
- عند خطأ في الصياغة يُرجع الـ API **humanReadable.ar** مثل: "صيغة فلتر DSL غير صحيحة. مثال: amount > 500 أو status = PENDING".

### ٦.٥ تحليل النص الحر (search في الوصف)

- **analyzeExpenseSearch** يبني فلاتر من كلمات البحث على الحقول النصية (مثل وصف المصروف)؛ **buildDescriptionFilter** ينتج شرط Prisma للـ description. يُستخدم في LIST_UNIT_EXPENSES وواجهات المحاسب/مدير المشروع عند وجود معامل `search`.

---

## ٧ — قائمة ويب هوكات الـ API

| المسار | الطريقة | الدور | الوظيفة |
|--------|---------|-------|---------|
| `/api/webhooks/identity` | POST | أي مفتاح | تحديد هوية الرقم (USER / RESIDENT / UNREGISTERED) |
| `/api/webhooks/resolve-unit` | POST | RESIDENT | مطابقة مشروع + وحدة من كلام الساكن (RESOLVE_UNIT) |
| `/api/webhooks/tickets` | GET | RESIDENT | قائمة تذاكر الساكن (residentPhone) |
| `/api/webhooks/tickets` | POST | - | إنشاء تذكرة (يُستخدم من داخل resident Post) |
| `/api/webhooks/tickets/[id]` | GET | - | تفاصيل تذكرة |
| `/api/webhooks/tickets/[id]/notes` | POST | - | إضافة ملاحظة على التذكرة |
| `/api/webhooks/delivery-orders` | POST | RESIDENT | طلب توصيل (DELIVERY_ORDER) |
| `/api/webhooks/resident` | GET | RESIDENT | برومبت + تعريف الـ actions والتولز |
| `/api/webhooks/resident` | POST | RESIDENT | تنفيذ action (TICKET_CREATE، TICKET_LIST، TICKET_GET، RESOLVE_UNIT، DELIVERY_ORDER، IDENTITY) |
| `/api/webhooks/accountants` | POST | ACCOUNTANT / ADMIN | كل أكشنز المحاسب (انظر القائمة تحت) |
| `/api/webhooks/project-managers` | POST | PROJECT_MANAGER | كل أكشنز مدير المشروع (انظر القائمة تحت) |
| `/api/webhooks/query` | GET | حسب الدور | استعلامات موحّدة حسب الـ role (ساكن، محاسب، مدير مشروع) |
| `/api/webhooks/query/interpret` | POST | - | تفسير سؤال طبيعي وتوجيهه لـ endpoint المناسب |
| `/api/webhooks/accounting-notes` | POST | PM / ADMIN | إنشاء ملاحظة محاسبية من مدير المشروع |

---

## ٨ — الساكن (Resident): الأكشنز والتولز

- **الهوية:** لا تُحدد من داخل البرومبت؛ الـ **workflow (n8n)** يشغّل identity ويمرّر المتغيرات (مثل `contact.role`, `contact.phone`, `contact.unit`, `contact.unit.project`). البرومبت يطلب استخدام هذه المتغيرات فقط.
- **التولز المعرّفة للبوت:** **resident Get** (طلبات GET)، **resident Post** (طلبات POST).

| التول | الأكشن | متى يُستخدم | حقول أساسية |
|-------|--------|--------------|--------------|
| resident Get | TICKET_LIST | "شوف شكاواي"، "قائمة التذاكر" | residentPhone |
| resident Get | TICKET_GET | "حالة الشكوى رقم TICK-XXX" | residentPhone، ticketNumber |
| resident Post | RESOLVE_UNIT | تأكيد الوحدة قبل فتح الشكوى | projectName، unitName (أو unitCode / buildingNumber) |
| resident Post | TICKET_CREATE | تسجيل شكوى / فتح تذكرة | description + تحديد الوحدة (projectName، unitName، إلخ) |
| resident Post | DELIVERY_ORDER | طلب توصيل | residentPhone، unitCode، description، projectId (إن لزم) |

- **ملاحظة:** لا يطلب من الساكن "كود الوحدة" — يُسأل "في أي مكان (كومباوند/مشروع/محل/…) ورقم أو اسم العمارة؟" والذكاء في المطابقة على السيرفر (slug، تقريبي، أرقام عربية).
- **GET /api/webhooks/resident:** يرجع للعميل (البوت/n8n) قائمة جاهزة للعرض: `tool`, `description`, `prompt` (نص البرومبت المختصر)، `actions` (جدول الأكشنز مع whenToUse و payload و requiredRole)، `usage`. يُستخدم لبناء قائمة التولز أو البرومبت الكامل في الـ AI.

---

## ٩ — المحاسب (Accountant): الأكشنز

القائمة الثابتة: **ALLOWED_ACTIONS** في `src/app/api/webhooks/accountants/route.ts`:

- CREATE_PM_ADVANCE, CREATE_STAFF_ADVANCE, UPDATE_STAFF_ADVANCE, DELETE_STAFF_ADVANCE
- RECORD_ACCOUNTING_NOTE
- PAY_INVOICE, CREATE_PAYROLL, PAY_PAYROLL, LIST_PAYROLLS
- LIST_UNIT_EXPENSES, LIST_INVOICES, GET_INVOICE_DETAILS
- SEARCH_STAFF, LIST_STAFF_ADVANCES, SEARCH_ACCOUNTING_NOTES

كل أكشن له **ActionMap** (حقول الـ payload). الفلترة بالتواريخ وـ **filterDsl** مدعومة حيث يرد في الـ ActionMap (مثل LIST_UNIT_EXPENSES، LIST_INVOICES، LIST_PAYROLLS). الردود تحتوي **humanReadable** (أحيانًا ملخص عربي للمصروفات/الفواتير) و**suggestions** عند الحاجة.

---

## ١٠ — مدير المشروع (PM): الأكشنز

القائمة الثابتة: **ALLOWED_ACTIONS** في `src/app/api/webhooks/project-managers/route.ts`:

- CREATE_OPERATIONAL_EXPENSE
- GET_RESIDENT_PHONE, LIST_PROJECT_TICKETS, LIST_PROJECT_UNITS, LIST_UNIT_EXPENSES
- GET_LAST_ELECTRICITY_TOPUP
- CREATE_TECHNICIAN_WORK, LIST_TECHNICIAN_WORK, START_TECHNICIAN_WORK, COMPLETE_TECHNICIAN_WORK

يُطلب **senderPhone** (رقم واتساب المدير) ويتم حلّه إلى مدير مشروع مسجّل؛ إن لم يُوجد يُرجع **PM_NOT_FOUND**. كل أكشن له payload خاص في **ActionMap** و**handler** يرجع نفس عقد الرد (success، humanReadable، suggestions، إلخ).

---

## ١١ — الهوية (Identity)

- **المصدر:** `src/lib/identity-by-phone.ts`, `src/app/api/webhooks/identity/route.ts`
- **المدخل:** `phone` أو `senderPhone` أو `contact` أو `query` من الـ body.
- **المنطق:** بناء متغيرات الرقم (`buildPhoneVariants`) والبحث في:
  - **User** (أدمن، محاسب، مدير مشروع) — مطابقة whatsappPhone أو email؛ مع assignedProjects.
  - **Resident** — مطابقة phone؛ مع unit و project.
  - إن لم يُوجد أي منهما → **UNREGISTERED**.
- **شكل الرد:** `IdentityResponseBody`: `success`, `input`, `contact` (نوع: USER | RESIDENT | UNREGISTERED مع الحقول المناسبة)، `matchScore`، `humanReadable?`، `suggestions?`.

---

## ١٢ — الأسلوب والرد (ما يظهر في الشات)

- **المرجع:** `docs/tone-and-response-guide.md`
- **ممنوعات:** "جاري المعالجة"، "يرجى التأكد"، "تم تنفيذ طلبك بنجاح"، جمل فصحى رسمية — استبدالها بأسلوب مصري طبيعي (حضرتك، مظبوط؟، للأسف ملقيناش…، ممكن تتأكد من…؟).
- **humanReadable.ar و suggestions:** مصدر للمعلومة والخطوة التالية؛ **لا نقل حرفي** — افهم المضمون ثم صغّ الرد بكلامك.
- **رد واحد = لغة واحدة:** لو الساكن كتب بالإنجليزي → الرد كله إنجليزي؛ لو عربي → عربي (فصحى بسيط أو عامية مصرية مهذّبة). دعم **فرانكو** (عربي بحروف إنجليزي) كمدخل صحيح واستخراج الحقول منه.

---

## ١٣ — ملفات البرومبتات والوثائق

| الملف | الغرض |
|-------|--------|
| `docs/resident-agent-prompt.md` | برومبت مساعد الساكن (واتساب): الهوية من الورك فلو، التولز، الأكشنز، قراءة humanReadable، عدم النسخ الحرفي |
| `docs/accountant-agent-prompt.md` | برومبت المحاسب/الأدمن: الأكشنز، الفلترة، DSL |
| `docs/pm-agent-prompt.md` | برومبت مدير المشروع: الأكشنز، المشروع المعيّن، senderPhone |
| `docs/tone-and-response-guide.md` | دليل الأسلوب والرد الموحّد (ممنوعات، مرغوب، أمثلة رد وحش vs كويس، أكواد الخطأ) |
| `docs/mcp-server-guide.md` | (اختياري) كيفية عمل MCP لاستدعاء الـ API من Cursor — لا يُستخدم في مسار الساكن/المحاسب/PM العادي |

---

## ١٤ — ملخص سريع للمشروع الجديد

لو بدأت مشروعًا مشابهًا (بوت واتساب + داشبورد + سكان/وحدات/مصروفات):

1. **ويب هوكات:** دائماً 200، النتيجة في body مع `success`, `humanReadable.ar`, `code`, `suggestions`.
2. **المصادقة:** مفتاح API مرتبط بدور (وربما بمشروع) + rate limit.
3. **بحث المشروع/الوحدة:** slug موحّد من الاسم (عربي + إنجليزي)، إزالة أنواع الأماكن القوية فقط، مطابقة على مراحل (slug exact → name contains → slug محسوب → pg_trgm → Levenshtein).
4. **الداتا:** slug على Project (فريد) و Unit (داخل المشروع)، pg_trgm على Project.slug، backfill سكربتات مستقلة داخل `prisma/scripts` بدون استيراد من `src/`.
5. **الفلترة المتقدمة:** DSL بنمط `field operator value` و AND؛ حقول مختلفة لكل كيان (UnitExpense، Invoice، Payroll، إلخ).
6. **الهوية:** من الورك فلو (استدعاء identity مرة)، تمرير contact.role و contact.phone و contact.unit إلى البرومبت؛ لا تول IDENTITY داخل البرومبت.
7. **البرومبتات:** لغة واحدة لكل رد، فهم المضمون من humanReadable وعدم النسخ الحرفي، أسلوب مصري مهذّب حيث يناسب.

— انتهى المراجع —
تم إنشاء الملف المرجعي.
الملف: docs/PROJECT-TECHNIQUES-REFERENCE.md
محتوياته بإيجاز:
الستاك والبنية — Next.js، Prisma، PostgreSQL، NextAuth، n8n، tsx، وملاحظة الـ container (عدم الاعتماد على src/ في السكربتات).
الداتابيز — حقول slug (Project و Unit)، امتداد pg_trgm والـ index، جداول N8nApiKey و N8nWebhookLog، سكربتات الـ backfill وملف slug-for-backfill.
مصادقة الويب هوك — x-api-key، الأدوار، rate limiting.
عقد الاستجابة — دائماً 200، humanReadable.ar، suggestions، code، botFail / botSuccess، وأكواد الخطأ للـ branching.
طرق البحث:
المشروع: مراحل findProjectBySlugOrName (slug → name contains → slug محسوب → pg_trgm → Levenshtein)، تطبيع الاسم، Strong/Weak place types، projectSlugForCreate.
الوحدة: findUnitBySlugOrName، unitNameToMatchSlug، ومسار resolveUnit (مشروع → وحدة، مع projectCandidates و availableUnits).
المصروفات: دوال الـ DSL وربطها بالـ webhooks.
صياغة الـ DSL — نمط الشرط (field operator value)، AND (بدون OR)، المعاملات، حقول UnitExpense وملاحظة Invoice، وتحليل النص الحر (search).
قائمة ويب هوكات الـ API — جدول بالمسارات والأدوار والوظيفة.
الساكن — الأكشنز والتولز (Get/Post)، الهوية من الورك فلو، ورد GET (قائمة للعميل).
المحاسب — قائمة ALLOWED_ACTIONS وملخص الـ payload.
مدير المشروع — قائمة ALLOWED_ACTIONS وملخص الـ payload و senderPhone.
الهوية — مدخلات الـ body، منطق identifyContactByPhone، وشكل الرد (USER / RESIDENT / UNREGISTERED).
الأسلوب والرد — مرجع tone-and-response، ممنوعات، استخدام humanReadable و suggestions، ولغة واحدة لكل رد.
ملفات البرومبتات والوثائق — resident، accountant، pm، tone، mcp.
ملخص للمشروع الجديد — نقاط تُنسخ عند بداية مشروع مشابه.
يمكنك استخدام هذا الملف كمرجع عند بدء مشروع جديد: تفتحه وتقول "عايزين نعمل كذا وكذا" وتراجع الأقسام المناسبة بدل ما نعيد من الصفر.


الثابت	الفايدة
ويب هوك دايماً 200	n8n ما يقطعش الـ workflow؛ النتيجة كلها في الـ body (success / error / humanReadable).
humanReadable.ar + suggestions	الرد اللي يظهر في الشات؛ البوت يفهم المضمون ويصيغ بكلامه (بدون نسخ حرفي).
قوائم اختيارات (options)	لما يكون في أكثر من مرشح (مشاريع، وحدات)، الرد يرجع قائمة واضحة (مثلاً options: [{ projectId, projectName }]) أو نص "تقصد X ولا Y؟" عشان المستخدم يختار والطلب التالي ييجي محدد.
حل المشروع من الاسم (tiered search)	المستخدم يكتب اسم المشروع بأي صيغة (عربي، إنجليزي، غلطة إملاء) → مراحل: slug exact → name contains → slug محسوب → تقريبي (pg_trgm أو Levenshtein). نفس الفكرة تنفع لأي كيان "اسم" محتاج اختيار (مشروع، عميل، فرع، إلخ).
البحث داخل المشروع	بعد ما يتحدد المشروع، كل البحث (وحدات، مصروفات، تذاكر) يكون scoped بـ projectId عشان مفيش تداخل بين مشاريع.
DSL للفلترة	لما المحاسب أو الأدمن يحتاج فلتر مرن (مبلغ، تاريخ، حالة) بدون واجهة معقدة — نص من نوع amount > 500 AND date >= 2025-01-01 يتحول لـ where في الداتابيز.
