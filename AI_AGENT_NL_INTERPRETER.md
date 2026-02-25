# AI Agent Natural Language Interpreter

## 🎯 Purpose
- Convert natural-language questions (Arabic/English mix) into actionable webhook calls.
- Help the n8n agent choose the correct API, HTTP method, and payload without hard-coded logic.
- Produce multiple ranked options so downstream workflows can pick the best fit or fall back gracefully.

---

## 🔐 Endpoint
- **Path:** `/api/webhooks/query/interpret`
- **Method:** `POST`
- **Auth:** Same n8n API key headers used for all webhooks (`X-API-KEY`).
- **Rate:** Lightweight heuristic logic, safe to call on every incoming AI prompt.

---

## 📥 Request Body
```json
{
  "question": "صرفنا كام كهربا على مشروع ياسمين؟",
  "projectName": "مشروع ياسمين",
  "role": "PROJECT_MANAGER"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `question` | string | ✅ | Natural-language prompt to interpret. |
| `projectName` | string | ❌ | Optional project hint if not mentioned inside the text. |
| `role` | "ADMIN" \| "ACCOUNTANT" \| "PROJECT_MANAGER" | ❌ | Overrides the API-key role. Defaults to key context role. |

---

## 📤 Response Structure (200 / 422)
```json
{
  "success": true,
  "question": "صرفنا كام كهربا على مشروع ياسمين؟",
  "role": "PROJECT_MANAGER",
  "projectMatch": { "id": "prj_123", "name": "مشروع ياسمين", "matchedBy": "question" },
  "range": "MONTH",
  "statuses": [],
  "limit": 5,
  "candidates": [
    {
      "id": "project-manager-last-expense",
      "confidence": 0.75,
      "role": "PROJECT_MANAGER",
      "description": "استعلام عن آخر المصروفات للمشروع مع إمكانية تصفية إضافية",
      "missingParameters": [],
      "searchTerms": ["مصروف", "كهرب"],
      "http": {
        "method": "GET",
        "endpoint": "/api/webhooks/query",
        "query": {
          "type": "LAST_EXPENSE",
          "projectId": "prj_123",
          "range": "MONTH"
        }
      },
      "requiredParameters": ["projectId"],
      "optionalParameters": ["range", "unit", "date"],
      "postProcess": [
        "تجميع النتائج التي تحتوي على كلمة كهربا/كهرباء في الوصف وحساب الإجمالي",
        "عرض الوحدة، الوصف، والقيمة لكل مصروف"
      ],
      "humanReadable": {
        "ar": "استخدم استعلام LAST_EXPENSE لسحب أحدث المصروفات للمشروع مشروع ياسمين. بعد استلام النتائج قم بتصفية البنود ذات الصلة بالسؤال ثم اعرض الإجمالي."
      }
    }
  ],
  "humanReadable": {
    "ar": "تم تحليل السؤال وتقديم 1 اختيار(ات) لاستعلامات مناسبة بناءً على المشروع مشروع ياسمين."
  },
  "suggestions": []
}
```

### Candidate Object
- `confidence`: 0 → 1 score used to sort suggestions.
- `http`: Ready-to-use instruction for the n8n HTTP Request node (method, endpoint, query/payload).
- `missingParameters`: Required fields still unresolved (placeholders). Prompt the user for these immediately.
- `searchTerms`: كلمات مفتاحية مقترحة لإعادة استخدامها في البحث أو الفلترة داخل الـworkflow.
- `requiredParameters`: Placeholders that must be supplied before executing.
- `optionalParameters`: Helpful extras if data exists.
- `postProcess`: Steps the AI should do after receiving the downstream webhook response.

`suggestions` may include a structured `data.missingParameters` array so the workflow can route follow-up prompts automatically.

When `success` is `false`, the array is empty and `suggestions` contains clarifying prompts for the agent to ask the user.

---

## 🧠 Detection Heuristics (v1)
- **Tickets:** كلمات مثل "شكوى", "بلاغ", "مشكلة", "صيانة", "سباكة", "كهرباء" → يستخدم `/api/webhooks/project-managers` مع `LIST_PROJECT_TICKETS`.
- إذا التقط السؤال كلمات موضوعية (سباكة، كهرباء، نظافة...) سيضيف `postProcess` خطوة للتركيز على هذا النوع من التذاكر ويملأ `searchTerms` بالقيم نفسها لتسهيل الفلترة.
- **Expenses:** "مصروف", "كهرب", "فاتورة" → uses `/api/webhooks/query?type=LAST_EXPENSE` with range filters.
- **Accounting:** Triggered for accountant role or words like "تحصيل", "دفعة" → `/api/webhooks/query?type=ACCOUNTING_DATA`.
- **Admin Summary:** For admin role or words like "ملخص", "status" → `/api/webhooks/query?type=ALL_DATA`.
- **Residents:** كلمات مثل "ساكن", "سكان", "residents" → `/api/webhooks/query?type=PROJECT_DATA` للحصول على عدد السكان وقائمة الأسماء.
- **Resident Contact:** إذا ظهر طلب رقم/تواصل الساكن مع ذكر الوحدة → `/api/webhooks/project-managers` مع `GET_RESIDENT_PHONE` ويطلب `unitCode` (يحاول استخراج الكود آليًا من النص مثل "شقة A3").
- **Range:** Detects today/week/month/overall keywords.
- **Statuses:** Maps "جديد", "مغلق" etc. to ticket statuses.
- **Limit:** Picks first number in the text (clamped to 25) for ticket pagination.
- **Projects:** Searches actual project names in the database; otherwise keeps `{{projectId}}` placeholder.

---

## 🤖 n8n Flow Tips
1. **Interpret:** Call `/api/webhooks/query/interpret` right after receiving the user message.
2. **Pick Candidate:** Use the highest-confidence candidate. If confidence < 0.55, or `suggestions` mention missing fields, ask the user for the required info first.
3. **Fill Parameters:** Replace placeholders (e.g. `{{projectId}}`, `{{pmPhone}}`). عندما يكتشف المفسر كود الوحدة من السؤال سيتم تضمينه تلقائيًا، وإلا سيظهر في `missingParameters`.
4. **Execute HTTP:** Perform the downstream webhook call exactly as defined in `http`.
5. **Post-Process:** Apply the listed steps to craft the final AI response (sums, filtering, etc.).
6. **Audit:** Interpretation attempts are logged with event `QUERY_INTERPRETED` for debugging.

---

## 🧪 Example Dialogue
1. User: "ايه وضع الشكاوي الاسبوع ده في مشروع المعراج؟"
2. Agent → Interpret endpoint → top candidate: `LIST_PROJECT_TICKETS` with `range=WEEK`.
3. Agent fills `projectId` (from projectMatch or context) + `senderPhone`.
4. Agent executes webhook, receives ticket list, filters by week if needed, then replies with summarized counts.

---

## 🔄 Forward Compatibility
- Keyword tables are defined at the top of the handler for easy tuning.
- Supports bilingual keywords; extend arrays to improve recall.
- Add new candidate builders for more intents (e.g. payments, residents) without changing the contract.
- Confidence scoring formula is centralized in each builder.

🎉 The interpreter is ready for production usage with the n8n AI agent. Update heuristics as new question patterns appear.
