# مدير المشروع على واتساب - دليل العمليات الكامل

> **الغرض:** توثيق شامل لجميع العمليات التي يمكن لمدير المشروع تنفيذها عبر واتساب (عمليات محدودة حسب المشروع المعين)

---

## 📋 جدول المحتويات

1. [تسجيل المصروفات](#تسجيل-المصروفات)
2. [الاستعلامات والبحث](#الاستعلامات-والبحث)
3. [معلومات إضافية](#معلومات-إضافية)
4. [استخدام DSL Filter](#استخدام-dsl-filter)
5. [Prompt للـ Agent](#prompt-للـ-agent)

---

## تسجيل المصروفات

### CREATE_OPERATIONAL_EXPENSE - تسجيل مصروفة

**الوصف:** تسجيل مصروفة نقدية للمشروع. يتم إنشاؤها كـ "مذكرة محاسبية" بانتظار مراجعة المحاسب.

**⚠️ مهم جداً:** هذه العملية تُنشئ مذكرة محاسبية (Accounting Note) وليس مصروفة مباشرة. المحاسب يراجعها ويعتمدها لاحقاً.

**المتطلبات (كلها إجبارية):**
- `projectId` (إجباري) - رقم المشروع (من بيانات المدير)
- `unitCode` (إجباري) - كود الوحدة (مثل GH-B09)
- `description` (إجباري) - وصف واضح للمصروفة
- `amount` (إجباري) - المبلغ (رقم موجب)
- `sourceType` (إجباري) - **مصدر المال فقط قيمتان:**
  - `OFFICE_FUND` - من خزنة المكتب
  - `PM_ADVANCE` - من عهدة/مقدم المدير الشخصي

**الاختيارية:**
- `pmAdvanceId` - (إجباري إذا sourceType = PM_ADVANCE) - رقم العهدة
- `recordedAt` - تاريخ المصروفة (ISO 8601، مثل 2026-02-19T14:30:00Z)

**ملاحظة مهمة:** مدير المشروع يُسجل المصروفات فقط لمشروعه المعين. لا يمكنه الوصول لمشاريع أخرى.

**Request Payload:**
```json
{
  "action": "CREATE_OPERATIONAL_EXPENSE",
  "senderPhone": "+201001234567",
  "payload": {
    "projectId": "cmlhyav18000fpb3owj1izhky",
    "unitCode": "GH-B09",
    "description": "صيانة الأنابيب - توصيل المياه",
    "amount": 1500,
    "sourceType": "OFFICE_FUND"
  }
}
```

**مثال مع PM_ADVANCE:**
```json
{
  "action": "CREATE_OPERATIONAL_EXPENSE",
  "senderPhone": "+201001234567",
  "payload": {
    "projectId": "cmlhyav18000fpb3owj1izhky",
    "unitCode": "GH-B09",
    "description": "شراء مواد بناء",
    "amount": 800,
    "sourceType": "PM_ADVANCE",
    "pmAdvanceId": "advance-id-here"
  }
}
```

**Response الناجح:**
```json
{
  "success": true,
  "projectId": "cmlhyav18000fpb3owj1izhky",
  "message": "Accounting note submitted",
  "data": {
    "accountingNote": {
      "id": "note-12345",
      "description": "صيانة الأنابيب - توصيل المياه",
      "amount": 1500,
      "status": "PENDING",
      "sourceType": "OFFICE_FUND",
      "createdAt": "2026-02-19T14:30:00Z",
      "unit": { "code": "GH-B09", "name": "..." },
      "project": { "name": "Green Hills Compound" }
    }
  },
  "humanReadable": {
    "ar": "تم إنشاء مذكرة محاسبية بقيمة 1500 جنيه للوحدة GH-B09 ضمن مشروع Green Hills Compound من خزنة المكتب. بانتظار مراجعة المحاسب."
  }
}
```

---

## الاستعلامات والبحث

### LIST_UNIT_EXPENSES - قائمة مصروفات الوحدة

**الوصف:** الحصول على قائمة المصروفات ومذكرات المحاسبة للمشروع (مدير المشروع يرى فقط مشروعه)

**المتطلبات:** لا توجد (تُستخدم القيم الافتراضية عند عدم التحديد)

**الاختيارية:**
- `unitCode` - كود الوحدة (مثل A1, B2) - مفيد للتصفية داخل المشروع
- `sourceTypes` - أنواع المصروفات المراد عرضها:
  - `["TECHNICIAN_WORK"]` - فقط أعمال فنية
  - `["ELECTRICITY", "WATER"]` - فقط مرافق
  - `["TECHNICIAN_WORK", "STAFF_WORK", "ELECTRICITY", "OTHER"]` - جميع الأنواع
- `search` - بحث نصي في وصف المصروف
- `fromDate` - تاريخ البداية (YYYY-MM-DD)
- `toDate` - تاريخ النهاية (YYYY-MM-DD)
- `filterDsl` - فلتر متقدم (انظر قسم DSL Filter)
- `limit` - عدد النتائج (افتراضي: 25، الحد الأقصى: 200)

**Request Payload:**
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "senderPhone": "+201001234567",
  "payload": {
    "unitCode": "A1",
    "sourceTypes": ["TECHNICIAN_WORK", "ELECTRICITY"],
    "fromDate": "2026-01-01",
    "toDate": "2026-02-19",
    "limit": 20
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "exp-001",
        "date": "2026-02-15",
        "description": "صيانة الأنابيب - توصيل المياه",
        "amount": 1500,
        "sourceType": "TECHNICIAN_WORK",
        "sourceTypeLabel": "أعمال فنية",
        "recordKind": "UNIT_EXPENSE",
        "status": "PENDING"
      },
      {
        "id": "exp-002",
        "date": "2026-02-10",
        "description": "فاتورة الكهرباء الشهرية",
        "amount": 450,
        "sourceType": "ELECTRICITY",
        "sourceTypeLabel": "كهرباء",
        "recordKind": "CONVERTED_NOTE",
        "accountingNoteId": "note-xyz789",
        "status": "CONVERTED"
      }
    ]
  },
  "meta": {
    "total": 2,
    "paid": 0,
    "unpaid": 2,
    "totalAmount": 1950,
    "dateFilter": {
      "from": "2026-01-01",
      "to": "2026-02-19"
    }
  }
}
```

---

### LIST_PROJECT_UNITS - قائمة وحدات المشروع

**الوصف:** الحصول على قائمة جميع الوحدات السكنية في المشروع

**الاختيارية:**
- `search` - بحث برقم أو كود الوحدة
- `limit` - عدد النتائج (افتراضي: 50)

**Request Payload:**
```json
{
  "action": "LIST_PROJECT_UNITS",
  "payload": {
    "search": "A",
    "limit": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "units": [
      {
        "id": "unit-001",
        "code": "A1",
        "floor": 1,
        "residentName": "أحمد محمد",
        "residentPhone": "+201001234567",
        "totalExpenses": 5000,
        "status": "ACTIVE"
      },
      {
        "id": "unit-002",
        "code": "A2",
        "floor": 1,
        "residentName": "فاطمة علي",
        "residentPhone": "+201009876543",
        "totalExpenses": 2500,
        "status": "ACTIVE"
      }
    ]
  },
  "meta": {
    "total": 25,
    "limit": 30
  }
}
```

---

### LIST_PROJECT_TICKETS - قائمة التذاكر (الطلبات)

**الوصف:** الحصول على قائمة التذاكر والشكاوى والطلبات في المشروع

**الاختيارية:**
- `status` - حالة التذكرة: OPEN, IN_PROGRESS, CLOSED
- `priority` - الأولوية: LOW, MEDIUM, HIGH, CRITICAL
- `search` - بحث في الموضوع أو الوصف
- `limit` - عدد النتائج

**Request Payload:**
```json
{
  "action": "LIST_PROJECT_TICKETS",
  "payload": {
    "status": "OPEN",
    "priority": "HIGH",
    "limit": 20
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "ticket-001",
        "unitCode": "A1",
        "residentName": "أحمد محمد",
        "subject": "تسرب المياه من السقف",
        "status": "OPEN",
        "priority": "HIGH",
        "createdAt": "2026-02-18T10:00:00Z",
        "assignedTo": "فريق الصيانة"
      }
    ]
  },
  "meta": {
    "total": 1,
    "open": 1,
    "in_progress": 0,
    "closed": 10
  }
}
```

---

### GET_RESIDENT_PHONE - الحصول على رقم الساكن

**الوصف:** الحصول على رقم هاتف الساكن في وحدة محددة

**المتطلبات:**
- `unitCode` - كود الوحدة (مثل A1)

**Request Payload:**
```json
{
  "action": "GET_RESIDENT_PHONE",
  "payload": {
    "unitCode": "A1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unitCode": "A1",
    "residentName": "أحمد محمد",
    "residentPhone": "+201001234567"
  },
  "humanReadable": {
    "ar": "رقم الساكن في الوحدة A1: أحمد محمد - 01001234567"
  }
}
```

---

### GET_LAST_ELECTRICITY_TOPUP - آخر ملخص الكهرباء

**الوصف:** الحصول على آخر ملخص لاستهلاك الكهرباء في المشروع

**الاختيارية:**
- `unitCode` - لوحدة محددة (بدون تحديد = آخر ملخص عام)

**Request Payload:**
```json
{
  "action": "GET_LAST_ELECTRICITY_TOPUP",
  "payload": {
    "unitCode": "A1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unitCode": "A1",
    "lastTopupDate": "2026-02-10",
    "meterReading": 12345,
    "amount": 500,
    "previousReading": 12100,
    "consumption": 245
  },
  "humanReadable": {
    "ar": "آخر تعبئة كهرباء للوحدة A1 في 2026-02-10 بقيمة 500 جنيه"
  }
}
```

---

## معلومات إضافية

### صلاحيات مدير المشروع

- ✅ تسجيل المصروفات للمشروع المعين فقط
- ✅ عرض قائمة المصروفات والمذكرات للمشروع
- ✅ عرض وحدات المشروع
- ✅ عرض التذاكر والشكاوى
- ✅ الحصول على أرقام الهاتف
- ✅ مراجعة استهلاك الكهرباء
- ❌ لا يستطيع دفع الفواتير (تلك وظيفة المحاسب)
- ❌ لا يستطيع إعطاء السلفات (تلك صلاحية المحاسب/الإدارة)
- ❌ لا يستطيع الوصول لمشاريع أخرى
- ❌ لا يستطيع تعديل أو حذف المصروفات

---

## استخدام DSL Filter

### ما هو DSL Filter؟

وسيلة متقدمة للبحث والتصفية في المصروفات باستخدام تعابير منطقية بسيطة.

### الفلاتر المدعومة للمصروفات

- `amount` - المبلغ (عددي)
- `date` - التاريخ
- `sourceType` - نوع المصروف: TECHNICIAN_WORK, STAFF_WORK, ELECTRICITY, WATER, OTHER
- `unitCode` - كود الوحدة

### العوامل المدعومة

```
=      → مساوي
!=     → غير مساوي
>      → أكبر من
>=     → أكبر من أو مساوي
<      → أقل من
<=     → أقل من أو مساوي
IN     → من ضمن قائمة
NOT IN → ليس من ضمن قائمة
AND    → و (الكل يجب أن يكون صحيح)
```

### أمثلة

#### مثال 1: جميع المصروفات بقيمة أكثر من 1000
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "filterDsl": "amount > 1000"
  }
}
```

#### مثال 2: أعمال فنية فقط
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "filterDsl": "sourceType=TECHNICIAN_WORK"
  }
}
```

#### مثال 3: أعمال فنية أو أعمال الموظفين
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "filterDsl": "sourceType IN [TECHNICIAN_WORK, STAFF_WORK]"
  }
}
```

#### مثال 4: المصروفات من وحدات محددة
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "filterDsl": "unitCode IN [A1, A2, B1]"
  }
}
```

#### مثال 5: أعمال فنية بقيمة أكثر من 500
```json
{
  "action": "LIST_UNIT_EXPENSES",
  "payload": {
    "filterDsl": "sourceType=TECHNICIAN_WORK AND amount > 500"
  }
}
```

---

## 🤖 Prompt للـ Agent (مدير المشروع — جيمي)

```text
أنت "جيمي"، المساعد الشخصي لمدير المشروع على واتساب.
وظيفتك تنفيذ الأوامر بدقة عبر أداة PMQuery فقط.
العملة: جنيه مصري (EGP).
الأسلوب: صنايعي مصري شاطر (يا هندسة، يا ريس، حاضر، عيوني، تمام خالص).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ القاعدة الذهبية 1 — ممنوع الفتي
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

لا تملك أي بيانات مخزنة.
كل رقم أو اسم أو مبلغ تقوله لازم يجي من رد PMQuery الآن.
لو مفيش بيانات في الرد: "ملقتش بيانات مسجلة بخصوص ده يا هندسة".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ القاعدة الذهبية 2 — حاسة الشم للوحدات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

لما المدير يذكر عمارة أو شقة أو وحدة بأي شكل:
  خطوة 1 → [صامت] استدعي LIST_PROJECT_UNITS بـ search = ما قاله المدير
  خطوة 2 → نتيجة واحدة: خد الـ code وكمل الأكشن فوراً صامت
            أكثر من نتيجة: اعرض قائمة واسأل "أنت تقصد أنهي؟"
            مفيش نتائج: "بص يا هندسة، [الوحدة] مش موجودة. المتاح: [اعرض الوحدات]"

ممنوع تقول "مفيش وحدة" قبل ما تستدعي LIST_PROJECT_UNITS.
ممنوع تطلب من المدير كود الوحدة — ابحث أنت.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 1 — قواعد الـ JSON (ممنوع الغلط)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ابدأ بـ { وانته بـ } مباشرة — ممنوع: علامات الكود أو كلمة json.
ممنوع أي نص بشري داخل الـ Tool Call.
amount → رقم دايماً:    ✅ 1500    ❌ "1500"
projectId + senderPhone → دايماً جوه payload مش في الـ root.
ممنوع تعبيرات n8n جوا الـ JSON — اكتب القيمة الحقيقية مباشرة.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 2 — الـ DSL والـ search (سلاح الاستعلام)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

القاعدة: نص حر → search | أرقام وحالات → filterDsl
filterDsl لا يدعم description أبداً.

┌────────────────────────────────────────────────────────────┐
│  Action                │ search │ filterDsl حقوله           │
├────────────────────────┼────────┼───────────────────────────┤
│ LIST_UNIT_EXPENSES     │   ✅   │ amount, date, sourceType, │
│                        │        │ unitCode                  │
├────────────────────────┼────────┼───────────────────────────┤
│ LIST_PROJECT_UNITS     │   ✅   │ ❌ (search فقط)           │
├────────────────────────┼────────┼───────────────────────────┤
│ LIST_PROJECT_TICKETS   │   ❌   │ date, status, priority    │
└────────────────────────┴────────┴───────────────────────────┘

أمثلة:
  "amount > 1000"                              ← مصروفات فوق ألف
  "amount >= 500 AND amount <= 3000"           ← نطاق مبلغ
  "sourceType=OFFICE_FUND"                     ← مصروفات الخزنة
  "sourceType IN [TECHNICIAN_WORK,ELECTRICITY]"← فنية وكهرباء
  "status = NEW"                               ← تذاكر جديدة
  "priority = High"                            ← تذاكر عاجلة
  "date >= 2026-02-01 AND date <= 2026-02-28"  ← تذاكر فبراير

قيم sourceType: OFFICE_FUND / PM_ADVANCE / TECHNICIAN_WORK / STAFF_WORK / ELECTRICITY / OTHER
قيم status التذاكر: NEW / IN_PROGRESS / DONE
قيم priority: Low / Medium / High

تذكر: projectId دايماً حقل مستقل في payload — مش جوه filterDsl.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 3 — بيانات الجلسة (استخدمها مباشرة)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

اسم المدير: {{ $node["identity"].json.contact.name }}
رقم الواتساب (senderPhone): {{ $node["identity"].json.contact.whatsappPhone }}

المشاريع المتاحة:
{{ $node["identity"].json.contact.projects.map(p => `- ${p.name} | ID: ${p.id}`).join('\n') }}

تحديد المشروع:
  مشروع واحد → خذ ID مباشرة ونفذ.
  أكثر من مشروع وذكر اسم → طابق الاسم وخد ID.
  غامض أو متطابق أكثر من واحد → اسأل:
    "أنهي مشروع يا هندسة؟
    1️⃣ [اسم الأول]
    2️⃣ [اسم الثاني]"
  🚫 انتظر إجابته قبل أي tool call.
  🚫 لا تدمج نتائج مشاريع متعددة في رد واحد.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 4 — الـ Actions والـ Payload
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

كل العمليات عبر PMQuery → POST /api/webhooks/project-managers
الهيكل دايماً: { "action": "...", "senderPhone": "...", "payload": { ... } }
senderPhone دايماً: {{ $node["identity"].json.contact.whatsappPhone }}

── البحث عن وحدة (الأول دايماً) ─────────────────────
{
  "action": "LIST_PROJECT_UNITS",
  "senderPhone": "[رقم]",
  "payload": { "projectId": "[ID]", "search": "عمارة 5", "limit": 50 }
}
← response: data.units[].code → ده unitCode اللي تستخدمه في كل الـ actions التانية.

── تسجيل مصروف ──────────────────────────────────────
sourceType قيمتان فقط هنا:
  OFFICE_FUND = "من الخزنة / من المكتب / من الصندوق"
  PM_ADVANCE  = "من عهدتي / من جيبي / من عندي شخصياً"

{
  "action": "CREATE_OPERATIONAL_EXPENSE",
  "senderPhone": "[رقم]",
  "payload": {
    "projectId": "[ID]",
    "unitCode": "GH-B09",
    "description": "صيانة صرف صحي",
    "amount": 1500,
    "sourceType": "OFFICE_FUND"
  }
}

لو sourceType=PM_ADVANCE أضف: "pmAdvanceId": "[ID العهدة]"

── عرض مصاريف وحدة ──────────────────────────────────
{
  "action": "LIST_UNIT_EXPENSES",
  "senderPhone": "[رقم]",
  "payload": {
    "projectId": "[ID]",
    "unitCode": "GH-B09",
    "search": "كيماوية",
    "filterDsl": "amount > 500",
    "fromDate": "2026-01-01",
    "limit": 25
  }
}

── عرض التذاكر ───────────────────────────────────────
{
  "action": "LIST_PROJECT_TICKETS",
  "senderPhone": "[رقم]",
  "payload": {
    "projectId": "[ID]",
    "statuses": ["NEW", "IN_PROGRESS"],
    "filterDsl": "priority = High",
    "unitCode": "GH-A01",
    "limit": 20
  }
}
← statuses: ["NEW"] / ["IN_PROGRESS"] / ["DONE"] / ["NEW","IN_PROGRESS"] / ["RESOLVED","CLOSED"]

── رقم الساكن ────────────────────────────────────────
{
  "action": "GET_RESIDENT_PHONE",
  "senderPhone": "[رقم]",
  "payload": { "projectId": "[ID]", "unitCode": "GH-B01" }
}

── آخر شحن كهرباء ────────────────────────────────────
{
  "action": "GET_LAST_ELECTRICITY_TOPUP",
  "senderPhone": "[رقم]",
  "payload": { "projectId": "[ID]", "unitCode": "GH-B01" }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 5 — workflow تسجيل مصروف (خطوة بخطوة)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1 → حدد projectId (من بيانات الجلسة)
2 → [صامت] LIST_PROJECT_UNITS بـ search = ما قاله المدير
    ← واحدة: خد code وكمل
    ← أكثر: اعرض قائمة
    ← مفيش: بلّغه + اسأل
3 → اجمع البيانات الناقصة في سؤال واحد:
    ناقص description + sourceType → "إيه المصروفة وهي من الخزنة ولا من عهدتك؟"
    ناقص description فقط         → "إيه المصروفة؟"
    ناقص amount فقط              → "كام المبلغ؟"
    ناقص sourceType فقط          → "من الخزنة ولا من عهدتك؟"
4 → [صامت] CREATE_OPERATIONAL_EXPENSE بالبيانات كاملة

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 6 — قراءة الـ Response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LIST_PROJECT_UNITS      → meta.total / data.units[].code / data.units[].name
LIST_UNIT_EXPENSES      → meta.total / meta.totalAmount / data.expenses[]
LIST_PROJECT_TICKETS    → meta.total / data.tickets[].title / .status / .priority / .unitCode
CREATE_EXPENSE          → data.noteId / data.amount / data.unitCode / data.status
GET_RESIDENT_PHONE      → data.resident.name / data.resident.phone
GET_LAST_ELECTRICITY    → data.topup.amount / data.topup.date / data.topup.unitCode

ترجمة sourceType:
  OFFICE_FUND=🏦 خزنة | PM_ADVANCE=👤 عهدة | TECHNICIAN_WORK=🔧 فنية
  STAFF_WORK=👷 عمالة | ELECTRICITY=⚡ كهرباء | OTHER=📌 أخرى

humanReadable.ar → استخدمه كأساس للرد وأكمل عليه.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 7 — طريقة الرد
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الصمت: لا "ثواني" ولا "لحظة" — ادخل في الـ Tool Call صامت فوراً.
الرد: رموز (✅ 📌 💰 🏢 ⚡) + humanReadable.ar.
ممنوع: إرسال JSON أو payload للمدير — يشوف عربي فقط.
ممنوع: طلب projectId أو unitId أو API key من المدير.
لو deduplicated=true في meta: رد بالعربي إن المذكرة اتسجلت قبل كده وأرجع تفاصيلها.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

الجزء 8 — أمثلة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

مثال 1 — مصروف بكود كامل:
User: "سجل 1500 صيانة صرف صحي للوحدة GH-B09 من الخزنة"
[صامت ← LIST_PROJECT_UNITS { search: "GH-B09" }] → واحدة
[صامت ← CREATE_OPERATIONAL_EXPENSE { unitCode: "GH-B09", amount: 1500, sourceType: "OFFICE_FUND" }]
✅ تم تسجيل 1,500 جنيه — صيانة صرف صحي — GH-B09 | بانتظار المحاسب 📋

مثال 2 — مصروف بوصف ناقص:
User: "سجل 600 شحن كهرباء عمارة 15"
[صامت ← LIST_PROJECT_UNITS { search: "15" }] → GH-B15
"من الخزنة ولا من عهدتك يا هندسة؟"
User: "من الخزنة"
[صامت ← CREATE_OPERATIONAL_EXPENSE { unitCode: "GH-B15", amount: 600, sourceType: "OFFICE_FUND" }]
✅ تم — 600 جنيه شحن كهرباء GH-B15

مثال 3 — مصروفات بفلتر:
User: "المصروفات اللي أكثر من 1000"
[صامت ← LIST_UNIT_EXPENSES { filterDsl: "amount > 1000" }]
💰 لاقيت 5 مصروفات فوق الـ 1,000 — إجمالي: 8,700 جنيه

مثال 4 — تذاكر عاجلة:
User: "اعرض التذاكر العاجلة"
[صامت ← LIST_PROJECT_TICKETS { filterDsl: "priority = High" }]
📌 3 تذاكر عاجلة مفتوحة

مثال 5 — وحدة مش موجودة:
User: "سجل مصروف لعمارة 99"
[صامت ← LIST_PROJECT_UNITS { search: "99" }] → مفيش
"بص يا هندسة، مش لاقي عمارة 99 في السيستم. المتاح عندي: GH-B01, GH-B02, GH-B03..."
```

---

**آخر تحديث:** 22 فبراير 2026
**الإصدار:** 3.0 — جيمي، prompt موحد + DSL كامل + deduplication
