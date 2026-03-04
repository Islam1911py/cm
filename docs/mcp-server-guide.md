# كيف تعمل MCP لـ lastcmds

## الفكرة باختصار

- تعمل **سيرفر MCP** (بروسيس منفصل) يعرّف **Tools** (أدوات).
- Cursor (أو أي عميل MCP) يتصل بالسيرفر ويستدعي الأدوات من المحادثة.
- السيرفر ممكن يستدعي **API تطبيقك** (مثلاً `http://localhost:3000/api/...`) أو يتصل بالداتابيز مباشرة لو في نفس الريبو.

---

## الخطوة 1: مشروع السيرفر

افتح مجلد جديد جنب المشروع (أو جواه):

```bash
mkdir mcp-server
cd mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node
```

---

## الخطوة 2: إعداد TypeScript

**`mcp-server/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true
  },
  "include": ["src/**/*"]
}
```

---

## الخطوة 3: كود السيرفر (يستدعي API تطبيقك)

**`mcp-server/src/index.ts`:**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// استيراد الـ schemas لتعريف الأدوات واستدعائها (تحقق من مسار التصدير في إصدارك)
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.LASTCMDS_API ?? "http://localhost:3000";

const server = new Server(
  { name: "lastcmds-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_projects",
      description: "List all active projects (مشاريع) from lastcmds.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "find_project",
      description: "Find project by name or slug (e.g. جرين هيلز، green hills). Returns id, name, slug.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "اسم المشروع أو الـ slug" },
        },
        required: ["projectName"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_projects") {
    const res = await fetch(`${BASE_URL}/api/projects`);
    if (!res.ok)
      return { content: [{ type: "text", text: `API error: ${res.status}` }], isError: true };
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  if (name === "find_project" && args && typeof args === "object" && "projectName" in args) {
    const projectName = String((args as { projectName: string }).projectName);
    const res = await fetch(
      `${BASE_URL}/api/projects?search=${encodeURIComponent(projectName)}`
    );
    if (!res.ok)
      return { content: [{ type: "text", text: `API error: ${res.status}` }], isError: true };
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("lastcmds MCP server running on stdio");
```

**ملاحظة:** مسار استيراد `ListToolsRequestSchema` و `CallToolRequestSchema` قد يختلف حسب إصدار الـ SDK (راجع [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)). إن لم تجدهما، استخدم أسماء الطلبات كـ strings حسب وثائق الإصدار (مثل `"tools/list"` و `"tools/call"`).

الـ API الحالي قد لا يدعم `?search=`؛ يمكنك إضافة endpoint للبحث بالاسم أو استدعاء منطق `findProjectBySlugOrName` من سكربت يصل للـ db. المهم أن السيرفر **يستدعي تطبيقك** (أو الـ db) من هنا.

---

## الخطوة 4: تشغيل السيرفر

```bash
cd mcp-server
npx tsx src/index.ts
```

السيرفر يشتغل على **stdio** (مدخل/مخرج قياسي). العميل (Cursor) هو اللي يفتح البروسيس ويرسل ويستقبل عبر stdio.

---

## الخطوة 5: ربط Cursor بالسيرفر

في Cursor: **Settings → MCP** (أو في ملف إعدادات MCP):

إضافة سيرفر بـ **stdio** يعني تعطي Cursor أمر التشغيل؛ هو يطلق البروسيس ويمدّ الـ stdin/stdout.

مثال إعداد (حسب واجهة Cursor/محررك):

```json
{
  "mcpServers": {
    "lastcmds": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "C:\\Users\\USER\\Desktop\\lastcmds-main\\mcp-server",
      "env": {
        "LASTCMDS_API": "http://localhost:3000"
      }
    }
  }
}
```

لو الـ API محتاج تسجيل دخول، إما:
- تعمل API key في تطبيقك وتبعت الـ key في الـ header من السيرفر، أو
- تضع session cookie في الـ env (للتجربة فقط).

---

## توسيع الأدوات

تقدر تضيف tools زي:

- **إنشاء مشروع**: استدعاء `POST /api/projects` من السيرفر (بعد إضافة auth).
- **بحث مصروفات**: استدعاء endpoint يلف على `expense-search` أو API تعمله أنت.
- **resolve وحدة**: استدعاء endpoint يستخدم `resolveUnit` أو يعيد نتيجة جاهزة.

الفكرة: الـ MCP يعرّف الـ tool ووصفها؛ التنفيذ الفعلي يكون بـ `fetch` لـ API تطبيقك أو باستدعاء دوال من كود مشترك لو السيرفر داخل نفس الريبو ويستورد من `@/lib`.

---

## ملخص

| الخطوة | الإجراء |
|--------|---------|
| 1 | مشروع Node منفصل + `@modelcontextprotocol/sdk` |
| 2 | سيرفر MCP يعرّف **tools** (مثل list_projects, find_project) |
| 3 | تنفيذ كل tool بـ **fetch** لـ `http://localhost:3000/api/...` (أو استدعاء db من سكربت مشترك) |
| 4 | تشغيل السيرفر بـ `tsx src/index.ts` (stdio) |
| 5 | إضافة السيرفر في إعدادات MCP في Cursor مع `command` و `args` و `cwd` و `env` |

بعد الربط، تقدر من الشات تسأل: "اعرض المشاريع" أو "دور على مشروع جرين هيلز" والـ AI يستدعي الـ tools دي.
