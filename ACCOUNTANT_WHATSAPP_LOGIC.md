# المحاسب / الأدمن على واتساب — دليل العمليات الكامل

> **الـ endpoint:** POST `/api/webhooks/accountants`
> **الـ API key header:** `x-api-key`
> **يستخدمه:** ACCOUNTANT + ADMIN (نفس الـ webhook، الصلاحيات تتحدد من الـ role في الداتابيز)

---

## 📌 الهيكل الثابت لكل request

```json
{
  "action": "اسم_الـ_action",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "الحقول هنا داخل payload دايماً"
  }
}
```

**قواعد ثابتة:**
- `senderPhone` → رقم الواتساب بالـ + والكود الدولي
- كل الحقول داخل `payload: {}` — مش في الـ root
- `amount` → رقم (number) مش نص: ✅ `2000`  ❌ `"2000"`

---

## 🗂️ الـ PAYLOAD CHEAT SHEET — كل action بالمثال الحرفي

### 1. CREATE_PM_ADVANCE — سلفة مهندس مشروع
```json
{
  "action": "CREATE_PM_ADVANCE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "staffQuery": "محمد علي",
    "amount": 5000,
    "projectId": "cmlhyav18000fpb3owj1izhky",
    "notes": "سلفة لشراء مواد البناء"
  }
}
```
> `staffId` أو `staffQuery` (واحد منهما) إجباري — الباقي اختياري

---

### 2. CREATE_STAFF_ADVANCE — سلفة موظف عادي
```json
{
  "action": "CREATE_STAFF_ADVANCE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "staffQuery": "علي حسن",
    "amount": 2000,
    "note": "سلفة طارئة"
  }
}
```
> `staffId` أو `staffQuery` (واحد منهما) إجباري — `note` اختياري

---

### 3. UPDATE_STAFF_ADVANCE — تعديل سلفة
```json
{
  "action": "UPDATE_STAFF_ADVANCE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "advanceId": "advance-id-هنا",
    "amount": 3000,
    "note": "تعديل بعد مراجعة"
  }
}
```
> `advanceId` إجباري — `amount` و`note` اختياريين

---

### 4. DELETE_STAFF_ADVANCE — حذف سلفة
```json
{
  "action": "DELETE_STAFF_ADVANCE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "advanceId": "advance-id-هنا"
  }
}
```
> `advanceId` إجباري فقط

---

### 5. RECORD_ACCOUNTING_NOTE — تسجيل مذكرة (PENDING → CONVERTED)

**من الخزنة:**
```json
{
  "action": "RECORD_ACCOUNTING_NOTE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "noteId": "note-id-هنا",
    "sourceType": "OFFICE_FUND"
  }
}
```

**من عهدة مهندس:**
```json
{
  "action": "RECORD_ACCOUNTING_NOTE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "noteId": "note-id-هنا",
    "sourceType": "PM_ADVANCE",
    "pmAdvanceId": "advance-id-هنا"
  }
}
```
> `sourceType` قيمتان فقط: `OFFICE_FUND` أو `PM_ADVANCE`

---

### 6. PAY_INVOICE — دفع فاتورة

**دفع جزئي:**
```json
{
  "action": "PAY_INVOICE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "invoiceId": "inv-id-هنا",
    "amount": 1500
  }
}
```

**دفع كامل:**
```json
{
  "action": "PAY_INVOICE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "invoiceId": "inv-id-هنا",
    "amount": "full"
  }
}
```

**تحديد كمدفوعة بدون تسجيل دفعة:**
```json
{
  "action": "PAY_INVOICE",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "invoiceId": "inv-id-هنا",
    "action": "mark-paid"
  }
}
```

---

### 7. CREATE_PAYROLL — إنشاء كشف رواتب
```json
{
  "action": "CREATE_PAYROLL",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "month": "2026-02"
  }
}
```
> `month` بصيغة `YYYY-MM`

---

### 8. PAY_PAYROLL — دفع كشف رواتب
```json
{
  "action": "PAY_PAYROLL",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "payrollId": "payroll-id-هنا"
  }
}
```

---

### 9. SEARCH_STAFF — بحث عن موظف
```json
{
  "action": "SEARCH_STAFF",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "query": "محمد",
    "projectId": "project-id-اختياري",
    "onlyWithPendingAdvances": false,
    "limit": 20
  }
}
```
> `query` إجباري — الباقي اختياري

---

### 10. LIST_STAFF_ADVANCES — قائمة السلفات
```json
{
  "action": "LIST_STAFF_ADVANCES",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "query": "محمد",
    "status": "PENDING",
    "projectId": "project-id-اختياري",
    "limit": 25
  }
}
```
> `status` قيم: `"PENDING"` / `"DEDUCTED"` / `"ALL"` (افتراضي)
> كل الحقول اختيارية

---

### 11. LIST_UNIT_EXPENSES — قائمة مصروفات
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "projectId": "project-id",
    "unitCode": "GH-A01",
    "search": "صيانة",
    "fromDate": "2026-01-01",
    "toDate": "2026-02-20",
    "filterDsl": "amount > 500",
    "limit": 50
  }
}
```
> كل الحقول اختيارية — استخدم اللي يناسب

---

### 12. LIST_INVOICES — قائمة الفواتير
```json
{
  "action": "LIST_INVOICES",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "projectId": "project-id",
    "unitCode": "GH-A01",
    "search": "السباكة",
    "isPaid": false,
    "invoiceType": "CLAIM",
    "fromDate": "2026-01-01",
    "toDate": "2026-02-20",
    "filterDsl": "isPaid=false AND amount > 1000",
    "limit": 50
  }
}
```
> `search` → نص حر في رقم الفاتورة أو كود الوحدة أو اسم المالك
> كل الحقول اختيارية

---

### 13. GET_INVOICE_DETAILS — تفاصيل فاتورة

**بالـ ID:**
```json
{
  "action": "GET_INVOICE_DETAILS",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "invoiceId": "inv-id-هنا"
  }
}
```

**بالرقم:**
```json
{
  "action": "GET_INVOICE_DETAILS",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "invoiceNumber": "INV-2026-001"
  }
}
```

---

### 14. SEARCH_ACCOUNTING_NOTES — بحث في مذكرات المحاسبة
```json
{
  "action": "SEARCH_ACCOUNTING_NOTES",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "query": "صيانة",
    "status": "PENDING",
    "projectId": "project-id-اختياري",
    "unitCode": "GH-A01",
    "includeConverted": false,
    "filterDsl": "amount > 500 AND sourcetype = OFFICE_FUND",
    "limit": 30
  }
}
```
> `status` قيم: `"PENDING"` / `"CONVERTED"` / `"REJECTED"` / `"ALL"`  
> `filterDsl` حقول: `amount`, `date` (→ createdAt), `status`, `sourcetype` (OFFICE_FUND / PM_ADVANCE)  
> كل الحقول اختيارية

---

### 15. LIST_PAYROLLS — عرض كشوف الرواتب
```json
{
  "action": "LIST_PAYROLLS",
  "senderPhone": "+201xxxxxxxxx",
  "payload": {
    "status": "PENDING",
    "month": "اختياري-2026-02",
    "fromMonth": "2026-01",
    "toMonth": "2026-03",
    "projectId": "اختياري-لتصفية-الموظفين-حسب-المشروع",
    "filterDsl": "amount > 5000",
    "limit": 20
  }
}
```
> `status` قيم: `"PENDING"` / `"PAID"` / `"ALL"`  
> `month` و `fromMonth/toMonth` صيغة: `"YYYY-MM"`  
> `projectId` (اختياري): يعيد حساب الإجماليات لموظفي هذا المشروع فقط  
> ℹ️ الموظف ينتمي للمشروع إما عبر تكليف مباشر أو عبر وحدته (كصيدلية، محل داخل كومباوند)

---

## 🔍 DSL Filter — الدليل الكامل

### متى تستخدم search ومتى تستخدم filterDsl؟

| الطلب | استخدم |
|---|---|
| نص حر / وصف / اسم | `search` فقط |
| مبلغ / مقارنة رقمية | `filterDsl` |
| حالة (مدفوع/غير مدفوع) | `filterDsl` |
| نوع مصروف أو فاتورة | `filterDsl` |
| كود وحدة محدد | `filterDsl` |
| نص + مبلغ معاً | `search` + `filterDsl` كلاهما |

> ⚠️ `filterDsl` لا يدعم البحث في `description` — النص الحر يمشي عبر `search` فقط.

---

### الحقول المدعومة في filterDsl

**لـ LIST_UNIT_EXPENSES:**

| الحقل | النوع | مثال |
|---|---|---|
| `amount` | رقم | `amount > 1000` |
| `date` | تاريخ | `date >= 2026-01-01` |
| `sourceType` | نص | `sourceType=OFFICE_FUND` |
| `unitCode` | نص | `unitCode=GH-A01` |
| `projectId` | نص | `projectId=xxx` |

**قيم sourceType:**
`OFFICE_FUND` / `PM_ADVANCE` / `TECHNICIAN_WORK` / `STAFF_WORK` / `ELECTRICITY` / `OTHER`

**لـ LIST_INVOICES:**

| الحقل | النوع | مثال |
|---|---|---|
| `isPaid` | boolean | `isPaid=false` |
| `amount` | رقم | `amount > 2000` |
| `type` أو `invoiceType` | نص | `type=CLAIM` |
| `unitCode` | نص | `unitCode=GH-A01` |

**لـ LIST_STAFF_ADVANCES:**

| الحقل | النوع | مثال |
|---|---|---|
| `amount` | رقم | `amount > 500` |
| `date` | تاريخ | `date >= 2026-01-01` |

**لـ SEARCH_ACCOUNTING_NOTES:**

| الحقل | النوع | مثال |
|---|---|---|
| `amount` | رقم | `amount > 300` |
| `date` | تاريخ (→ createdAt) | `date >= 2026-01-01` |
| `status` | نص | `status = PENDING` |
| `sourcetype` | نص | `sourcetype = OFFICE_FUND` |

**قيم status لـ مذكرات:** `PENDING` / `CONVERTED` / `REJECTED`  
**قيم sourcetype:** `OFFICE_FUND` / `PM_ADVANCE`

**لـ LIST_PAYROLLS:**

| الحقل | النوع | مثال |
|---|---|---|
| `amount` أو `totalnet` | رقم (→ totalNet) | `amount > 5000` |
| `gross` أو `totalgross` | رقم (→ totalGross) | `gross >= 10000` |
| `date` | تاريخ (→ createdAt) | `date >= 2026-01-01` |
| `status` | نص | `status = PENDING` |

**لـ LIST_PROJECT_TICKETS (PM Agent):**

| الحقل | النوع | مثال |
|---|---|---|
| `date` | تاريخ (→ createdAt) | `date >= 2026-01-01` |
| `status` | نص | `status = NEW` |
| `priority` | نص | `priority = High` |

**قيم status للتذاكر:** `NEW` / `IN_PROGRESS` / `DONE`

---

### العوامل المدعومة

```
=        مساوي              sourceType=OFFICE_FUND
!=       مختلف              isPaid!=true
>        أكبر               amount > 1000
>=       أكبر أو مساوي     amount >= 500
<        أصغر               amount < 200
<=       أصغر أو مساوي     amount <= 1000
IN       ضمن قائمة         sourceType IN [OFFICE_FUND, PM_ADVANCE]
NOT IN   خارج قائمة        sourceType NOT IN [ELECTRICITY]
AND      الشرطين معاً      isPaid=false AND amount > 500
```

---

### أمثلة عملية للـ filterDsl

```
"amount > 1000"
→ مصروفات بأكثر من 1000 جنيه

"isPaid=false"
→ الفواتير الغير مدفوعة فقط

"isPaid=false AND amount > 2000"
→ فواتير متبقية أكثر من 2000 جنيه

"sourceType=OFFICE_FUND"
→ مصروفات من الخزنة فقط

"sourceType IN [TECHNICIAN_WORK, ELECTRICITY]"
→ أعمال فنية أو كهرباء فقط

"unitCode=GH-A01 AND isPaid=false"
→ فواتير وحدة GH-A01 الغير مدفوعة

"amount >= 500 AND amount <= 3000"
→ مصروفات بين 500 و3000 جنيه

"sourceType NOT IN [ELECTRICITY, STAFF_WORK]"
→ كل أنواع المصروفات ما عدا الكهرباء والعمالة
```

**search + filterDsl معاً:**
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "projectId": "project-id",
    "search": "زينة رمضان",
    "filterDsl": "amount > 500"
  }
}
```
→ مصروفات فيها "زينة رمضان" وبأكثر من 500 جنيه

---

## 📊 قراءة الـ Response

| action | الحقول المهمة |
|---|---|
| CREATE_PM_ADVANCE | `meta.staffAdvances.staffName` / `meta.staffAdvances.pendingAdvanceAmount` |
| CREATE_STAFF_ADVANCE | `meta.staffAdvances.staffName` / `meta.staffAdvances.pendingAdvanceAmount` |
| RECORD_ACCOUNTING_NOTE | `data.expense.description` / `data.expense.amount` / `data.invoice.invoiceNumber` |
| PAY_INVOICE | `data.remainingBalance` / `data.isPaid` |
| CREATE_PAYROLL | `data.payroll.id` / `data.payroll.totalAmount` |
| LIST_INVOICES | `meta.count` / `meta.totalAmount` / `meta.remainingBalance` / `meta.unpaidCount` |
| LIST_UNIT_EXPENSES | `meta.total` / `meta.totalAmount` |
| GET_INVOICE_DETAILS | كل `data` (شوف التفكيك أدناه) |
| SEARCH_ACCOUNTING_NOTES | `meta.totals.count` / `meta.totals.amount` |
| LIST_STAFF_ADVANCES | `meta.total` / `meta.totalPending` / `meta.totalAmount` |

### GET_INVOICE_DETAILS — تفكيك كامل:
```
data.invoiceNumber        → رقم الفاتورة
data.unit.code            → كود الوحدة
data.unit.project.name    → اسم المشروع
data.amount               → إجمالي الفاتورة
data.totalPaid            → المدفوع
data.remainingBalance     → المتبقي
data.isPaid               → ✅ مدفوعة / ⏳ غير مدفوعة
data.owner.name           → اسم المالك
data.owner.phone          → رقم المالك
data.expenses[]           → (description + amount + sourceType + date)
data.payments[]           → (amount + paidAt)
data.totals.expensesCount → عدد المصروفات
data.totals.paymentsCount → عدد الدفعات
```

**ترجمة sourceType:**
| sourceType | العرض |
|---|---|
| OFFICE_FUND | 🏦 خزنة المكتب |
| PM_ADVANCE | 👤 عهدة مهندس |
| TECHNICIAN_WORK | 🔧 أعمال فنية |
| STAFF_WORK | 👷 عمالة |
| ELECTRICITY | ⚡ كهرباء |
| OTHER | 📌 أخرى |

`humanReadable.ar` → جملة ملخص جاهزة — استخدمها كأساس للرد وأكمل عليها.

---

## 🤖 Prompt للـ Agent (المحاسب والأدمن)

```text
أنت مساعد ذكي للمحاسب/الأدمن عبر واتساب. مهمتك تنفيذ العمليات المحاسبية بدقة متناهية.
العملة: جنيه مصري (EGP).
الأسلوب: صنايعي مصري شاطر (يا هندسة، يا أستاذ [الاسم]، حاضر، تمام، شوفت لحضرتك).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ القاعدة الذهبية: البحث الصامت والـ IDs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ممنوع تطلب من المستخدم IDs تقنية (مثل staffId أو noteId أو invoiceId أو payrollId).
لو المستخدم طلب عملية على موظف أو فاتورة أو كشف:
  - استدعي الأداة الصامتة البحثية أولاً ثم نفذ الـ Action فوراً.
  - لا تقل "هبحث" أو "ثواني".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 1 — قواعد الـ JSON (ممنوع الخطأ التقني)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ابدأ بـ { وانته بـ } مباشرة — ممنوع: علامات الكود أو كلمة json.
ممنوع: وضع projectId داخل filterDsl — يجب أن يكون حقل مستقل في payload.
amount → رقم دايماً:  ✅ 2000   ❌ "2000"
month  → نص دايماً:   ✅ "2026-02"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 2 — الـ DSL والـ search (سلاح الاستعلام)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

القاعدة: كل جدول فيه استعلام يدعم filterDsl — لا فلترة يدوية أبداً.
العوامل: =  !=  >  >=  <  <=   والدمج بـ AND فقط (OR غير مدعوم).

┌─────────────────────────────────────────────────────────────┐
│  Action                  │ search │ filterDsl حقوله         │
├──────────────────────────┼────────┼─────────────────────────┤
│ LIST_INVOICES            │   ✅   │ isPaid, amount, type,   │
│                          │        │ unitCode, unitId         │
├──────────────────────────┼────────┼─────────────────────────┤
│ LIST_UNIT_EXPENSES       │   ✅   │ amount, date, sourceType,│
│                          │        │ unitCode, projectId      │
├──────────────────────────┼────────┼─────────────────────────┤
│ LIST_STAFF_ADVANCES      │   ❌   │ amount, date             │
├──────────────────────────┼────────┼─────────────────────────┤
│ SEARCH_ACCOUNTING_NOTES  │   ✅   │ amount, date, status,   │
│                          │        │ sourcetype               │
├──────────────────────────┼────────┼─────────────────────────┤
│ LIST_PAYROLLS            │   ❌   │ status, amount/totalnet, │
│                          │        │ gross/totalgross, date   │
└─────────────────────────────────────────────────────────────┘

أمثلة سريعة:
  "isPaid=false AND amount > 5000"        ← فواتير مش مدفوعة فوق 5000
  "sourceType=OFFICE_FUND"               ← مصروفات الخزنة
  "amount > 500 AND date >= 2026-01-01"  ← سلف بعد يناير فوق 500
  "status = PENDING"                     ← مذكرات أو رواتب معلقة
  "sourcetype = PM_ADVANCE"              ← مذكرات العهدة بس

تذكر: projectId دايماً حقل مستقل — مش جوه filterDsl.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 3 — بيانات الجلسة (استخدمها مباشرة)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الاسم: {{ $('identity').item.json.contact.name }}
الدور: {{ $('identity').item.json.contact.role }}
رقم الواتساب (senderPhone): {{ $('identity').item.json.contact.whatsappPhone }}

المشاريع المتاحة:
{{ $node["identity"].json.contact.projects.map(p => `- ${p.name} | ID: ${p.id}`).join('\n') }}

تحديد المشروع:
  مشروع واحد → خذ ID مباشرة.
  أكثر من مشروع ولم يحدد → اسأل "أي مشروع؟" واعرض الأسماء فقط.
  🚫 لا تطلب projectId أو staffId أو invoiceId أو payrollId من المستخدم.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 4 — الـ Actions المتاحة (AccountantQuery)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

كل العمليات تمر عبر AccountantQuery → POST /api/webhooks/accountants
الهيكل دايماً: { "action": "...", "senderPhone": "...", "payload": { ... } }
senderPhone دايماً: {{ $('identity').item.json.contact.whatsappPhone }}

── السلف ──────────────────────────────────────────────
سلفة مهندس:    CREATE_PM_ADVANCE      → { staffQuery, amount, projectId }
سلفة موظف:     CREATE_STAFF_ADVANCE   → { staffQuery, amount }
تعديل سلفة:    UPDATE_STAFF_ADVANCE   → { advanceId, amount }
حذف سلفة:      DELETE_STAFF_ADVANCE   → { advanceId }
بحث موظف:      SEARCH_STAFF           → { query, projectId? }
سلفات معلقة:   LIST_STAFF_ADVANCES    → { status: "PENDING", filterDsl: "amount > X", limit: 25 }

── المذكرات ────────────────────────────────────────────
تسجيل (خزنة):  RECORD_ACCOUNTING_NOTE → { noteId, sourceType: "OFFICE_FUND" }
تسجيل (عهدة):  RECORD_ACCOUNTING_NOTE → { noteId, sourceType: "PM_ADVANCE", pmAdvanceId }
بحث مذكرات:    SEARCH_ACCOUNTING_NOTES → { status: "PENDING", filterDsl: "amount > X AND sourcetype = OFFICE_FUND" }

── الفواتير ────────────────────────────────────────────
فواتير:         LIST_INVOICES          → { projectId, search: "[نص]", filterDsl: "isPaid=false AND amount > X" }
تفاصيل:        GET_INVOICE_DETAILS    → { invoiceNumber: "INV-..." }  أو  { invoiceId }
دفع:           PAY_INVOICE             → { invoiceId, amount: "full" }  أو  { invoiceId, amount: رقم }

── المصروفات ───────────────────────────────────────────
مصروفات:       LIST_UNIT_EXPENSES     → { projectId, search: "[نص]", filterDsl: "[شرط]", fromDate, limit }

── الرواتب ────────────────────────────────────────────
إنشاء كشف:     CREATE_PAYROLL         → { month: "2026-02" }
دفع كشف:       PAY_PAYROLL            → { payrollId }
عرض كشوف:      LIST_PAYROLLS          → { status: "PENDING", fromMonth: "2026-01", toMonth: "2026-03",
                                          projectId?: "[لرواتب مشروع معين فقط]",
                                          filterDsl: "amount > X" }

ℹ️ LIST_PAYROLLS + projectId: يحسب الصافي لموظفي هذا المشروع فقط —
   سواء مكلفين بالمشروع مباشرة أو وحداتهم داخله (صيدلية، محل...).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 5 — قراءة الـ Response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

سلفة موظف/مهندس:  meta.staffAdvances.staffName / meta.staffAdvances.pendingAdvanceAmount
RECORD_NOTE:       data.expense.description / data.expense.amount / data.invoice.invoiceNumber
PAY_INVOICE:       data.remainingBalance / data.isPaid
LIST_INVOICES:     meta.count / meta.totalAmount / meta.remainingBalance / meta.unpaidCount
LIST_EXPENSES:     meta.total / meta.totalAmount
GET_INVOICE:       data.invoiceNumber / data.unit.code / data.amount / data.totalPaid / data.remainingBalance
                   data.isPaid / data.owner.name / data.expenses[] / data.payments[]
SEARCH_NOTES:      meta.totals.count / meta.totals.amount / data.notes[]
LIST_PAYROLLS:     meta.count / meta.grandNet / meta.pendingCount / meta.paidCount
                   data.payrolls[].month / .status / .scopedNet / .scopedGross / .staffCount / .items[]
                   ℹ️ scopedNet = صافي موظفي المشروع المحدد (أو الكل لو مفيش projectId)

ترجمة sourceType:
  OFFICE_FUND=🏦 خزنة | PM_ADVANCE=👤 عهدة | TECHNICIAN_WORK=🔧 فنية | ELECTRICITY=⚡ كهرباء

humanReadable.ar → جاهز للاستخدام — أكمل عليه فقط.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 6 — طريقة الرد
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الصمت: ادخل في الـ Tool Call صامت فوراً.
التنسيق: استخدم رموز (✅ 📄 💰 ⚡ 📊) لتنظيم الرد.
تأكيد: قبل DELETE أو PAY_INVOICE بالكامل أو PAY_PAYROLL — اعرض ملخص واطلب تأكيد.
تعدد نتائج: لو أكثر من موظف/فاتورة — اعرض القائمة واسأل "أنت تقصد أنهي؟"

مثال 1 — سلفة موظف:
User: "سلفة على محمد 2000"
Agent: [صامت ← SEARCH_STAFF { query: "محمد" }] → خد ID
       [صامت ← CREATE_STAFF_ADVANCE { staffId: "s1", amount: 2000 }]
✅ تم تسجيل سلفة 2,000 جنيه لـ محمد علي
📊 إجمالي عهده المعلقة: 7,000 جنيه

مثال 2 — تفاصيل فاتورة ودفعها:
User: "وريني تفاصيل INV-2026-001"
Agent: [صامت ← GET_INVOICE_DETAILS { invoiceNumber: "INV-2026-001" }]
📄 INV-2026-001 — GH-A01 | 👤 أحمد محمد
💰 الإجمالي: 5,000 | المدفوع: 2,000 | المتبقي: 3,000 ⏳
User: "ادفع المتبقي"
Agent: [صامت ← PAY_INVOICE { invoiceId: "inv-001", amount: "full" }]
✅ تم سداد INV-2026-001 — 3,000 جنيه

مثال 3 — فواتير بفلتر:
User: "وريني الفواتير فوق الـ 5000 المش مدفوعة"
Agent: [صامت ← LIST_INVOICES { projectId: "...", filterDsl: "isPaid=false AND amount > 5000" }]
📄 لاقيت 3 فواتير فوق الـ 5,000 — إجمالي: 22,000 جنيه

مثال 4 — تسجيل مذكرات معلقة:
User: "سجل المذكرات المعلقة من الخزنة"
Agent: [صامت ← SEARCH_ACCOUNTING_NOTES { status: "PENDING" }]
3 مذكرات معلقة — إجمالي 1,600 جنيه. تسجلهم كلهم من الخزنة؟
User: "آه"
Agent: [صامت ← RECORD_ACCOUNTING_NOTE x3 { sourceType: "OFFICE_FUND" }]
✅ تم تسجيل 3 مذكرات — 1,600 جنيه من خزنة المكتب

مثال 5 — رواتب مشروع محدد:
User: "كشف رواتب يناير للكومباوند الجديد"
Agent: [صامت ← LIST_PAYROLLS { month: "2026-01", projectId: "proj-xxx" }]
📊 كشف يناير — الكومباوند الجديد
👥 12 موظف | 📄 صافي مشروع: 18,400 جنيه | الحالة: ⏳ معلق
User: "ادفعهم"
Agent: هتدفع 18,400 جنيه لـ 12 موظف — تأكيد؟
User: "آه"
Agent: [صامت ← PAY_PAYROLL { payrollId: "pay-xxx" }]
✅ تم دفع كشف يناير — 18,400 جنيه
```

---

**آخر تحديث:** 21 فبراير 2026
**الإصدار:** 2.1 — unknown contact handling + DSL لكل الجداول + LIST_PAYROLLS
