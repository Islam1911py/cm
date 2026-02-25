import type { Prisma } from "@prisma/client"

export const EXPENSE_SOURCE_TYPES = [
  "TECHNICIAN_WORK",
  "STAFF_WORK",
  "ELECTRICITY",
  "OTHER"
] as const

export type ExpenseSourceType = (typeof EXPENSE_SOURCE_TYPES)[number]

export const SOURCE_TYPE_KEYWORDS: Array<{ type: ExpenseSourceType; keywords: string[] }> = [
  {
    type: "TECHNICIAN_WORK",
    keywords: ["technician", "tech", "صيانة", "صيانه", "فني", "الفني", "فنين"]
  },
  {
    type: "STAFF_WORK",
    keywords: ["staff", "عامل", "عمالة", "عماله", "موظف", "موظفين"]
  },
  {
    type: "ELECTRICITY",
    keywords: ["electricity", "electric", "كهرباء", "كهربا", "الكهرباء", "شحن", "شحنه", "شحنات"]
  },
  {
    type: "OTHER",
    keywords: [
      "other",
      "misc",
      "general",
      "زينة",
      "زينه",
      "الزينه",
      "ديكور",
      "ديكورات",
      "trash",
      "garbage",
      "waste",
      "bin",
      "bins",
      "صندوق",
      "صناديق",
      "زبالة",
      "زباله",
      "قمامة",
      "قمامه",
      "حاوية",
      "حاويات"
    ]
  }
]

export type SearchKeywordGroup = {
  label: string
  terms: string[]
}

export const SEARCH_KEYWORD_GROUPS: SearchKeywordGroup[] = [
  {
    label: "DECORATION",
    terms: [
      "زينة",
      "زينه",
      "الزينه",
      "ديكور",
      "ديكورات",
      "decor",
      "decoration",
      "ornament",
      "ornaments"
    ]
  },
  {
    label: "WASTE_BINS",
    terms: [
      "صندوق",
      "صناديق",
      "صندوق زبالة",
      "صناديق زبالة",
      "زبالة",
      "زباله",
      "قمامة",
      "قمامه",
      "حاوية",
      "حاويات",
      "سلة",
      "سلل",
      "trash",
      "trashcan",
      "trash can",
      "garbage",
      "garbage can",
      "garbage bin",
      "bin",
      "bins",
      "waste",
      "waste bin",
      "dumpster"
    ]
  }
]

export const SEARCH_STOP_WORDS = new Set(
  [
    "ايه",
    "اي",
    "ايش",
    "هو",
    "هي",
    "هم",
    "هن",
    "احنا",
    "انا",
    "انت",
    "انتي",
    "انتو",
    "ال",
    "على",
    "عن",
    "في",
    "من",
    "ما",
    "ايوه",
    "لا",
    "مش",
    "كام",
    "كم",
    "ليه",
    "اللي",
    "was",
    "were",
    "what",
    "did",
    "how",
    "much",
    "many",
    "the",
    "a",
    "an",
    "and",
    "or",
    "we",
    "us",
    "for",
    "on",
    "to",
    "of"
  ]
)

export function normalizeArabic(text: string) {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
}

export function normalizeSearchText(text: string) {
  if (!text) {
    return ""
  }

  const lower = text.toLowerCase().trim()
  const withoutPunctuation = lower.replace(/[^\p{L}\p{N}\s]+/gu, " ")
  const normalizedArabic = normalizeArabic(withoutPunctuation)

  return normalizedArabic.replace(/\s+/g, " ").trim()
}

const SEARCH_KEYWORD_GROUP_LOOKUP = new Map<string, SearchKeywordGroup>()

for (const group of SEARCH_KEYWORD_GROUPS) {
  for (const term of group.terms) {
    const normalized = normalizeSearchText(term)
    if (normalized && !SEARCH_KEYWORD_GROUP_LOOKUP.has(normalized)) {
      SEARCH_KEYWORD_GROUP_LOOKUP.set(normalized, group)
    }
  }
}

export function expandSearchToken(token: string) {
  const normalized = normalizeSearchText(token)
  if (!normalized) {
    return [] as string[]
  }

  const expansions = new Set<string>()
  const group = SEARCH_KEYWORD_GROUP_LOOKUP.get(normalized)

  const baseForms = new Set<string>([token, normalized])

  const arabicVariants = new Set<string>()

  for (const form of baseForms) {
    for (const variant of generateArabicVariants(form)) {
      arabicVariants.add(variant)
    }
  }

  for (const variant of arabicVariants) {
    expansions.add(variant)
  }

  if (group) {
    for (const term of group.terms) {
      const normalizedTerm = normalizeSearchText(term)
      if (normalizedTerm) {
        for (const variant of generateArabicVariants(term)) {
          expansions.add(variant)
        }
        for (const variant of generateArabicVariants(normalizedTerm)) {
          expansions.add(variant)
        }
      }
    }
  }

  return Array.from(expansions).filter(Boolean)
}

function generateArabicVariants(text: string) {
  const variants = new Set<string>()

  if (!text) {
    return variants
  }

  const replacementMap: Record<string, string[]> = {
    ا: ["أ", "إ", "آ", "ٱ"],
    أ: ["ا", "إ", "آ", "ٱ"],
    إ: ["ا", "أ", "آ", "ٱ"],
    آ: ["ا", "أ", "إ", "ٱ"],
    ٱ: ["ا", "أ", "إ", "آ"],
    ه: ["ة"],
    ة: ["ه"],
    ي: ["ى", "ئ"],
    ى: ["ي"],
    ئ: ["ي"],
    و: ["ؤ"],
    ؤ: ["و"],
    ض: ["ظ"],
    ظ: ["ض"]
  }

  const queue: string[] = [text]

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current || variants.has(current)) {
      continue
    }

    variants.add(current)

    const chars = Array.from(current)

    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index]
      const replacements = replacementMap[char]

      if (!replacements || replacements.length === 0) {
        continue
      }

      for (const replacement of replacements) {
        const nextChars = [...chars]
        nextChars[index] = replacement
        const candidate = nextChars.join("")
        if (!variants.has(candidate)) {
          queue.push(candidate)
        }
      }
    }
  }

  return variants
}

type LogicalSplitResult = {
  conditions: string[]
  connectors: string[]
}

function splitLogicalExpressions(input: string): LogicalSplitResult {
  const conditions: string[] = []
  const connectors: string[] = []

  let buffer = ""
  let index = 0
  let inQuote: string | null = null

  while (index < input.length) {
    const char = input[index]

    if (char === "\"" || char === "'") {
      if (inQuote === char) {
        inQuote = null
      } else if (!inQuote) {
        inQuote = char
      }
      buffer += char
      index += 1
      continue
    }

    if (!inQuote) {
      const remaining = input.slice(index)

      const match = /^(AND|OR)(?![A-Z])/i.exec(remaining)
      if (match) {
        const trimmed = buffer.trim()
        if (trimmed) {
          conditions.push(trimmed)
        }
        connectors.push(match[1].toUpperCase())
        buffer = ""
        index += match[0].length
        continue
      }
    }

    buffer += char
    index += 1
  }

  const trailing = buffer.trim()
  if (trailing) {
    conditions.push(trailing)
  }

  return { conditions, connectors }
}

function parseValueToken(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { value: null, type: "unknown" as const }
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unquoted = trimmed.slice(1, -1)
    return { value: unquoted, type: "string" as const }
  }

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric)) {
    return { value: numeric, type: "number" as const }
  }

  return { value: trimmed, type: "string" as const }
}

function parseListValues(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    return { values: [] as Array<string | number>, error: "List value must be enclosed in parentheses" }
  }

  const inner = trimmed.slice(1, -1)
  const results: Array<string | number> = []
  let buffer = ""
  let inQuote: string | null = null

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]

    if (char === "\"" || char === "'") {
      if (inQuote === char) {
        inQuote = null
      } else if (!inQuote) {
        inQuote = char
      }
      buffer += char
      continue
    }

    if (!inQuote && char === ",") {
      const parsed = parseValueToken(buffer)
      if (parsed.value === null) {
        return { values: [], error: "Empty value inside list" }
      }
      results.push(parsed.value)
      buffer = ""
      continue
    }

    buffer += char
  }

  const parsed = parseValueToken(buffer)
  if (parsed.value === null) {
    return { values: [], error: "Empty value inside list" }
  }
  results.push(parsed.value)

  return { values: results, error: null }
}

type ClauseBuildResult = {
  clause?: Prisma.UnitExpenseWhereInput
  error?: string
}

type InvoiceClauseBuildResult = {
  clause?: Prisma.InvoiceWhereInput
  error?: string
}

function buildClause(field: string, operator: string, rawValue: string): ClauseBuildResult {
  const op = operator.toUpperCase()
  const normalizedField = field.trim().toLowerCase()
  const { value, type } = parseValueToken(rawValue)

  if (value === null) {
    return { error: `Missing value for ${field}` }
  }

  const createNumericFilter = (column: keyof Prisma.UnitExpenseWhereInput) => {
    if (type !== "number") {
      return { error: `${field} expects a numeric value` }
    }

    switch (op) {
      case "=":
        return { clause: { [column]: value } as Prisma.UnitExpenseWhereInput }
      case "!=":
        return { clause: { NOT: { [column]: value } } }
      case ">":
        return { clause: { [column]: { gt: value } as any } }
      case ">=":
        return { clause: { [column]: { gte: value } as any } }
      case "<":
        return { clause: { [column]: { lt: value } as any } }
      case "<=":
        return { clause: { [column]: { lte: value } as any } }
      default:
        return { error: `Operator ${operator} is not supported for ${field}` }
    }
  }

  const createStringFilter = (
    accessor: (value: string, operator: string) => Prisma.UnitExpenseWhereInput | null,
    allowArray = false
  ) => {
    if (op === "IN" || op === "NOT IN") {
      if (!allowArray) {
        return { error: `Operator ${operator} is not supported for ${field}` }
      }
      const { values, error } = parseListValues(rawValue)
      if (error) {
        return { error }
      }
      if (values.some((item) => typeof item !== "string")) {
        return { error: `${field} IN expects string values` }
      }
      return accessor(JSON.stringify(values), op) ? { clause: accessor(JSON.stringify(values), op) as any } : { error: `Operator ${operator} is not supported for ${field}` }
    }

    if (type !== "string") {
      return { error: `${field} expects a string value` }
    }

    const clause = accessor(String(value), op)
    if (!clause) {
      return { error: `Operator ${operator} is not supported for ${field}` }
    }

    return { clause }
  }

  switch (normalizedField) {
    case "amount":
      return createNumericFilter("amount")
    case "date":
      return createStringFilter((val, operatorToken) => {
        const dateValue = new Date(val)
        if (Number.isNaN(dateValue.getTime())) {
          return null
        }
        const column = "date"
        switch (operatorToken) {
          case "=":
            return { [column]: dateValue }
          case "!=":
            return { NOT: { [column]: dateValue } }
          case ">":
            return { [column]: { gt: dateValue } }
          case ">=":
            return { [column]: { gte: dateValue } }
          case "<":
            return { [column]: { lt: dateValue } }
          case "<=":
            return { [column]: { lte: dateValue } }
          default:
            return null
        }
      })
    case "sourcetype":
      return createStringFilter((val, operatorToken) => {
        const normalizedValue = val.toUpperCase()
        const mapping: Prisma.UnitExpenseWhereInput = {}
        switch (operatorToken) {
          case "=":
            mapping.sourceType = normalizedValue as any
            return mapping
          case "!=":
            return { NOT: { sourceType: normalizedValue as any } }
          case "IN": {
            const parsed = JSON.parse(val) as string[]
            return { sourceType: { in: parsed.map((item) => item.toUpperCase()) as any } }
          }
          case "NOT IN": {
            const parsed = JSON.parse(val) as string[]
            return { sourceType: { notIn: parsed.map((item) => item.toUpperCase()) as any } }
          }
          default:
            return null
        }
      }, true)
    case "projectid":
    case "project":
      return createStringFilter((val, operatorToken) => {
        switch (operatorToken) {
          case "=":
            return { unit: { projectId: val } }
          case "!=":
            return { NOT: { unit: { projectId: val } } }
          case "IN": {
            const parsed = JSON.parse(val) as string[]
            return { unit: { projectId: { in: parsed } } }
          }
          case "NOT IN": {
            const parsed = JSON.parse(val) as string[]
            return { unit: { projectId: { notIn: parsed } } }
          }
          default:
            return null
        }
      }, true)
    case "projectname":
      return createStringFilter((val, operatorToken) => {
        const base = { unit: { project: { name: { equals: val, mode: "insensitive" as const } } } }
        switch (operatorToken) {
          case "=":
            return base
          case "!=":
            return { NOT: base }
          default:
            return null
        }
      })
    case "unitcode":
      return createStringFilter((val, operatorToken) => {
        const base = { unit: { code: { equals: val, mode: "insensitive" as const } } }
        switch (operatorToken) {
          case "=":
            return base
          case "!=":
            return { NOT: base }
          default:
            return null
        }
      })
    default:
      return { error: `Field ${field} is not supported in DSL filters` }
  }
}

export function parseInvoiceFilterDsl(input: string | null | undefined): {
  where?: Prisma.InvoiceWhereInput
  errors: string[]
} {
  if (!input) {
    return { errors: [] }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { errors: [] }
  }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)
  const errors: string[] = []

  if (connectors.some((connector) => connector === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.InvoiceWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>|IN|NOT\s+IN)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)

    if (!match) {
      errors.push(`Unable to parse condition: ${condition}`)
      continue
    }

    const field = match[1]
    const rawOperator = match[2].replace(/\s+/g, " ").toUpperCase()
    const rawValue = match[3]

    const { clause, error } = buildInvoiceClause(field, rawOperator, rawValue)
    if (error) {
      errors.push(error)
      continue
    }
    if (clause) {
      clauses.push(clause)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }

  if (clauses.length === 1) {
    return { errors, where: clauses[0] }
  }

  return { errors, where: { AND: clauses } }
}

function buildInvoiceClause(field: string, operator: string, rawValue: string): InvoiceClauseBuildResult {
  const op = operator.toUpperCase()
  const normalizedField = field.trim().toLowerCase()
  const { value, type } = parseValueToken(rawValue)

  if (value === null) {
    return { error: `Missing value for ${field}` }
  }

  const createBooleanFilter = (column: string) => {
    if (value === "true" || value === "false") {
      const boolValue = value === "true"
      switch (op) {
        case "=":
          return { clause: { [column]: boolValue } as any }
        case "!=":
          return { clause: { [column]: !boolValue } as any }
        default:
          return { error: `Operator ${operator} is not supported for boolean field ${field}` }
      }
    }
    return { error: `${field} expects true or false` }
  }

  const createNumericFilter = (column: keyof Prisma.InvoiceWhereInput) => {
    if (type !== "number") {
      return { error: `${field} expects a numeric value` }
    }
    switch (op) {
      case "=": return { clause: { [column]: value } as Prisma.InvoiceWhereInput }
      case "!=": return { clause: { NOT: { [column]: value } } as Prisma.InvoiceWhereInput }
      case ">": return { clause: { [column]: { gt: value } } as any }
      case ">=": return { clause: { [column]: { gte: value } } as any }
      case "<": return { clause: { [column]: { lt: value } } as any }
      case "<=": return { clause: { [column]: { lte: value } } as any }
      default: return { error: `Operator ${operator} is not supported for ${field}` }
    }
  }

  const createStringFilter = (
    accessor: (value: string, operator: string) => Prisma.InvoiceWhereInput | null,
    allowArray = false
  ) => {
    if (op === "IN" || op === "NOT IN") {
      if (!allowArray) {
        return { error: `Operator ${operator} is not supported for ${field}` }
      }
      const { values, error } = parseListValues(rawValue)
      if (error) {
        return { error }
      }
      const clause = accessor(JSON.stringify(values), op)
      return clause ? { clause } : { error: `Operator ${operator} is not supported for ${field}` }
    }

    if (type !== "string") {
      return { error: `${field} expects a string value` }
    }

    const clause = accessor(String(value), op)
    if (!clause) {
      return { error: `Operator ${operator} is not supported for ${field}` }
    }

    return { clause }
  }

  switch (normalizedField) {
    case "amount":
      return createNumericFilter("amount")
    case "ispaid":
      return createBooleanFilter("isPaid")
    case "type":
    case "invoicetype":
      return createStringFilter((val, operatorToken) => {
        const normalizedValue = val.toUpperCase()
        const mapping: Prisma.InvoiceWhereInput = {}
        switch (operatorToken) {
          case "=":
            mapping.type = normalizedValue as any
            return mapping
          case "!=":
            return { NOT: { type: normalizedValue as any } }
          case "IN": {
            const parsed = JSON.parse(val) as string[]
            return { type: { in: parsed.map((item) => item.toUpperCase()) as any } }
          }
          case "NOT IN": {
            const parsed = JSON.parse(val) as string[]
            return { type: { notIn: parsed.map((item) => item.toUpperCase()) as any } }
          }
          default:
            return null
        }
      }, true)
    case "projectid":
    case "project":
      return createStringFilter((val, operatorToken) => {
        switch (operatorToken) {
          case "=":
            return { unit: { projectId: val } }
          case "!=":
            return { NOT: { unit: { projectId: val } } }
          case "IN": {
            const parsed = JSON.parse(val) as string[]
            return { unit: { projectId: { in: parsed } } }
          }
          case "NOT IN": {
            const parsed = JSON.parse(val) as string[]
            return { unit: { projectId: { notIn: parsed } } }
          }
          default:
            return null
        }
      }, true)
    case "projectname":
      return createStringFilter((val, operatorToken) => {
        const base = { unit: { project: { name: { equals: val, mode: "insensitive" as const } } } }
        switch (operatorToken) {
          case "=":
            return base
          case "!=":
            return { NOT: base }
          default:
            return null
        }
      })
    case "unitcode":
      return createStringFilter((val, operatorToken) => {
        const base = { unit: { code: { equals: val, mode: "insensitive" as const } } }
        switch (operatorToken) {
          case "=":
            return base
          case "!=":
            return { NOT: base }
          default:
            return null
        }
      })
    case "unitid":
      return createStringFilter((val, operatorToken) => {
        switch (operatorToken) {
          case "=":
            return { unitId: val }
          case "!=":
            return { NOT: { unitId: val } }
          case "IN": {
            const parsed = JSON.parse(val) as string[]
            return { unitId: { in: parsed } }
          }
          case "NOT IN": {
            const parsed = JSON.parse(val) as string[]
            return { unitId: { notIn: parsed } }
          }
          default:
            return null
        }
      }, true)
    default:
      return { error: `Field ${field} is not supported in Invoice DSL filters` }
  }
}

export function parseExpenseFilterDsl(input: string | null | undefined): {
  where?: Prisma.UnitExpenseWhereInput
  errors: string[]
} {
  if (!input) {
    return { errors: [] }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { errors: [] }
  }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)

  const errors: string[] = []

  if (connectors.some((connector) => connector === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.UnitExpenseWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>|IN|NOT\s+IN)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)

    if (!match) {
      errors.push(`Unable to parse condition: ${condition}`)
      continue
    }

    const field = match[1]
    const rawOperator = match[2].replace(/\s+/g, " ").toUpperCase()
    const value = match[3]

    const { clause, error } = buildClause(field, rawOperator, value)
    if (error) {
      errors.push(error)
      continue
    }
    if (clause) {
      clauses.push(clause)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }

  if (clauses.length === 1) {
    return { errors, where: clauses[0] }
  }

  return { errors, where: { AND: clauses } }
}

type DescriptionFilter = {
  description?: {
    contains: string
    mode: "insensitive"
  }
  OR?: DescriptionFilter[]
  AND?: DescriptionFilter[]
}

export function buildDescriptionFilter(tokens: string[]): DescriptionFilter | null {
  const clauses: DescriptionFilter[] = []

  for (const token of tokens) {
    const expansions = expandSearchToken(token)
    if (expansions.length === 0) {
      continue
    }

    const expansionClauses = Array.from(new Set(expansions)).map((phrase) => ({
      description: {
        contains: phrase,
        mode: "insensitive" as const
      }
    }))

    if (expansionClauses.length === 1) {
      clauses.push(expansionClauses[0])
    } else {
      clauses.push({ OR: expansionClauses })
    }
  }

  if (clauses.length === 0) {
    return null
  }

  if (clauses.length === 1) {
    return clauses[0]
  }

  return { AND: clauses }
}

export type ExpenseSearchAnalysis = {
  normalizedSearch: string | null
  matchedSourceTypes: Set<ExpenseSourceType>
  descriptionTokens: string[]
  descriptionSummary: string | null
  tokenVariants: Map<string, string[]>
}

export function analyzeExpenseSearch(rawSearchTerm: string): ExpenseSearchAnalysis {
  const normalizedSearch = normalizeSearchText(rawSearchTerm)
  const matchedSourceTypes = new Set<ExpenseSourceType>()
  const descriptionTokens: string[] = []
  const tokenVariants = new Map<string, string[]>()

  if (!normalizedSearch) {
    return {
      normalizedSearch: null,
      matchedSourceTypes,
      descriptionTokens,
      descriptionSummary: null,
      tokenVariants
    }
  }

  const tokens = normalizedSearch.split(" ").filter(Boolean)

  for (const rawToken of rawSearchTerm
    .split(/\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    const normalized = normalizeSearchText(rawToken)
    if (!normalized) {
      continue
    }

    const variants = tokenVariants.get(normalized)
    if (variants) {
      variants.push(rawToken)
    } else {
      tokenVariants.set(normalized, [rawToken])
    }
  }

  const remainingTokens: string[] = []
  const seenTokens = new Set<string>()

  for (const token of tokens) {
    if (!token || SEARCH_STOP_WORDS.has(token)) {
      continue
    }

    const bareToken = token.startsWith("ال") && token.length > 2 ? token.slice(2) : token
    const matchedEntry = SOURCE_TYPE_KEYWORDS.find((entry) =>
      entry.keywords.some((keyword) => {
        const normalizedKeyword = normalizeSearchText(keyword)
        if (!normalizedKeyword) {
          return false
        }

        const bareKeyword =
          normalizedKeyword.startsWith("ال") && normalizedKeyword.length > 2
            ? normalizedKeyword.slice(2)
            : normalizedKeyword

        return (
          normalizedKeyword === token ||
          normalizedKeyword === bareToken ||
          bareKeyword === token ||
          bareKeyword === bareToken
        )
      })
    )

    if (matchedEntry) {
      matchedSourceTypes.add(matchedEntry.type)
    }

    if (!seenTokens.has(token)) {
      remainingTokens.push(token)
      seenTokens.add(token)
    }
  }

  const descriptionTokenSet = new Set<string>(remainingTokens)

  for (const token of remainingTokens) {
    const variants = tokenVariants.get(token)
    if (!variants) {
      continue
    }

    for (const variant of variants) {
      if (variant) {
        descriptionTokenSet.add(variant)
        descriptionTokenSet.add(variant.toLowerCase())
      }
    }
  }

  if (remainingTokens.length > 1) {
    const normalizedPhrase = remainingTokens.join(" ")
    descriptionTokenSet.add(normalizedPhrase)

    const rawPhrase = remainingTokens
      .map((token) => {
        const variants = tokenVariants.get(token)
        return variants?.[0] ?? token
      })
      .join(" ")

    if (rawPhrase) {
      descriptionTokenSet.add(rawPhrase)
      descriptionTokenSet.add(rawPhrase.toLowerCase())
    }
  }

  const tokensForFilter = Array.from(descriptionTokenSet).filter(Boolean)
  const descriptionSummary = tokensForFilter.join(", ").trim() || null

  return {
    normalizedSearch,
    matchedSourceTypes,
    descriptionTokens: tokensForFilter,
    descriptionSummary,
    tokenVariants
  }
}

export function parseStaffAdvanceFilterDsl(input: string | null | undefined): {
  where?: Prisma.StaffAdvanceWhereInput
  errors: string[]
} {
  if (!input) return { errors: [] }
  const trimmed = input.trim()
  if (!trimmed) return { errors: [] }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)
  const errors: string[] = []

  if (connectors.some((c) => c === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.StaffAdvanceWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)
    if (!match) {
      errors.push(`Unable to parse condition: ${condition}`)
      continue
    }

    const field = match[1].trim().toLowerCase()
    const op = match[2].toUpperCase()
    const rawValue = match[3].trim()
    const { value, type } = parseValueToken(rawValue)

    if (value === null) {
      errors.push(`Missing value for ${field}`)
      continue
    }

    if (field === "amount") {
      if (type !== "number") { errors.push(`amount expects a numeric value`); continue }
      const numVal = value as number
      switch (op) {
        case "=":  clauses.push({ amount: numVal }); break
        case "!=": clauses.push({ NOT: { amount: numVal } }); break
        case ">": clauses.push({ amount: { gt: numVal } } as any); break
        case ">=": clauses.push({ amount: { gte: numVal } } as any); break
        case "<":  clauses.push({ amount: { lt: numVal } } as any); break
        case "<=": clauses.push({ amount: { lte: numVal } } as any); break
        default: errors.push(`Operator ${op} not supported for amount`)
      }
    } else if (field === "date") {
      const dateValue = new Date(String(value))
      if (Number.isNaN(dateValue.getTime())) { errors.push(`Invalid date: ${rawValue}`); continue }
      switch (op) {
        case ">": clauses.push({ date: { gt: dateValue } } as any); break
        case ">=": clauses.push({ date: { gte: dateValue } } as any); break
        case "<":  clauses.push({ date: { lt: dateValue } } as any); break
        case "<=": clauses.push({ date: { lte: dateValue } } as any); break
        case "=":  clauses.push({ date: dateValue } as any); break
        default: errors.push(`Operator ${op} not supported for date`)
      }
    } else {
      errors.push(`Field ${field} is not supported in StaffAdvance DSL filters`)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }
  return { errors, where: clauses.length === 1 ? clauses[0] : { AND: clauses } }
}

// ─── AccountingNote DSL ───────────────────────────────────────────────────────
// Supported fields: amount, date (→ createdAt), status, sourcetype
export function parseAccountingNoteFilterDsl(input: string | null | undefined): {
  where?: Prisma.AccountingNoteWhereInput
  errors: string[]
} {
  if (!input) return { errors: [] }
  const trimmed = input.trim()
  if (!trimmed) return { errors: [] }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)
  const errors: string[] = []

  if (connectors.some((c) => c === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.AccountingNoteWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)
    if (!match) { errors.push(`Unable to parse condition: ${condition}`); continue }

    const field = match[1].trim().toLowerCase()
    const op = match[2].toUpperCase()
    const rawValue = match[3].trim()
    const { value, type } = parseValueToken(rawValue)

    if (value === null) { errors.push(`Missing value for ${field}`); continue }

    if (field === "amount") {
      if (type !== "number") { errors.push(`amount expects a numeric value`); continue }
      const numVal = value as number
      switch (op) {
        case "=": clauses.push({ amount: numVal }); break
        case "!=": clauses.push({ NOT: { amount: numVal } }); break
        case ">": clauses.push({ amount: { gt: numVal } } as any); break
        case ">=": clauses.push({ amount: { gte: numVal } } as any); break
        case "<": clauses.push({ amount: { lt: numVal } } as any); break
        case "<=": clauses.push({ amount: { lte: numVal } } as any); break
        default: errors.push(`Operator ${op} not supported for amount`)
      }
    } else if (field === "date") {
      const dateValue = new Date(String(value))
      if (Number.isNaN(dateValue.getTime())) { errors.push(`Invalid date: ${rawValue}`); continue }
      switch (op) {
        case ">": clauses.push({ createdAt: { gt: dateValue } } as any); break
        case ">=": clauses.push({ createdAt: { gte: dateValue } } as any); break
        case "<": clauses.push({ createdAt: { lt: dateValue } } as any); break
        case "<=": clauses.push({ createdAt: { lte: dateValue } } as any); break
        case "=": clauses.push({ createdAt: dateValue } as any); break
        default: errors.push(`Operator ${op} not supported for date`)
      }
    } else if (field === "status") {
      if (op !== "=" && op !== "!=") { errors.push(`Operator ${op} not supported for status`); continue }
      const statusVal = String(value).toUpperCase()
      const validStatuses = ["PENDING", "CONVERTED", "REJECTED"]
      if (!validStatuses.includes(statusVal)) {
        errors.push(`Invalid status: ${value}. Valid: ${validStatuses.join(", ")}`); continue
      }
      if (op === "=") clauses.push({ status: statusVal as any })
      else clauses.push({ NOT: { status: statusVal as any } })
    } else if (field === "sourcetype") {
      if (op !== "=" && op !== "!=") { errors.push(`Operator ${op} not supported for sourcetype`); continue }
      const sourceVal = String(value).toUpperCase()
      const validSources = ["OFFICE_FUND", "PM_ADVANCE"]
      if (!validSources.includes(sourceVal)) {
        errors.push(`Invalid sourceType: ${value}. Valid: ${validSources.join(", ")}`); continue
      }
      if (op === "=") clauses.push({ sourceType: sourceVal as any })
      else clauses.push({ NOT: { sourceType: sourceVal as any } })
    } else {
      errors.push(`Field ${field} is not supported in AccountingNote DSL filters`)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }
  return { errors, where: clauses.length === 1 ? clauses[0] : { AND: clauses } }
}

// ─── Ticket DSL ───────────────────────────────────────────────────────────────
// Supported fields: date (→ createdAt), status, priority
export function parseTicketFilterDsl(input: string | null | undefined): {
  where?: Prisma.TicketWhereInput
  errors: string[]
} {
  if (!input) return { errors: [] }
  const trimmed = input.trim()
  if (!trimmed) return { errors: [] }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)
  const errors: string[] = []

  if (connectors.some((c) => c === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.TicketWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)
    if (!match) { errors.push(`Unable to parse condition: ${condition}`); continue }

    const field = match[1].trim().toLowerCase()
    const op = match[2].toUpperCase()
    const rawValue = match[3].trim()
    const { value } = parseValueToken(rawValue)

    if (value === null) { errors.push(`Missing value for ${field}`); continue }

    if (field === "date") {
      const dateValue = new Date(String(value))
      if (Number.isNaN(dateValue.getTime())) { errors.push(`Invalid date: ${rawValue}`); continue }
      switch (op) {
        case ">": clauses.push({ createdAt: { gt: dateValue } } as any); break
        case ">=": clauses.push({ createdAt: { gte: dateValue } } as any); break
        case "<": clauses.push({ createdAt: { lt: dateValue } } as any); break
        case "<=": clauses.push({ createdAt: { lte: dateValue } } as any); break
        case "=": clauses.push({ createdAt: dateValue } as any); break
        default: errors.push(`Operator ${op} not supported for date`)
      }
    } else if (field === "status") {
      if (op !== "=" && op !== "!=") { errors.push(`Operator ${op} not supported for status`); continue }
      const statusVal = String(value).toUpperCase()
      const validStatuses = ["NEW", "IN_PROGRESS", "DONE"]
      if (!validStatuses.includes(statusVal)) {
        errors.push(`Invalid status: ${value}. Valid: ${validStatuses.join(", ")}`); continue
      }
      if (op === "=") clauses.push({ status: statusVal as any })
      else clauses.push({ NOT: { status: statusVal as any } })
    } else if (field === "priority") {
      if (op !== "=" && op !== "!=") { errors.push(`Operator ${op} not supported for priority`); continue }
      const priorityVal = String(value)
      if (op === "=") clauses.push({ priority: { equals: priorityVal, mode: "insensitive" } as any })
      else clauses.push({ NOT: { priority: { equals: priorityVal, mode: "insensitive" } as any } })
    } else {
      errors.push(`Field ${field} is not supported in Ticket DSL filters`)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }
  return { errors, where: clauses.length === 1 ? clauses[0] : { AND: clauses } }
}

// ─── Payroll DSL ────────────────────────────────────────────────────────────
// Supported fields: status, date (→ createdAt), amount/totalnet (→ totalNet), gross/totalgross (→ totalGross)
export function parsePayrollFilterDsl(input: string | null | undefined): {
  where?: Prisma.PayrollWhereInput
  errors: string[]
} {
  if (!input) return { errors: [] }
  const trimmed = input.trim()
  if (!trimmed) return { errors: [] }

  const { conditions, connectors } = splitLogicalExpressions(trimmed)
  const errors: string[] = []

  if (connectors.some((c) => c === "OR")) {
    errors.push("OR operator is not supported yet")
  }

  const clauses: Prisma.PayrollWhereInput[] = []
  const conditionPattern = /^\s*([a-zA-Z_.]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i

  for (const condition of conditions) {
    const match = conditionPattern.exec(condition)
    if (!match) { errors.push(`Unable to parse condition: ${condition}`); continue }

    const field = match[1].trim().toLowerCase()
    const op = match[2].toUpperCase()
    const rawValue = match[3].trim()
    const { value, type } = parseValueToken(rawValue)

    if (value === null) { errors.push(`Missing value for ${field}`); continue }

    if (field === "amount" || field === "totalnet") {
      if (type !== "number") { errors.push(`${field} expects a numeric value`); continue }
      const numVal = value as number
      switch (op) {
        case "=":  clauses.push({ totalNet: numVal }); break
        case "!=": clauses.push({ NOT: { totalNet: numVal } }); break
        case ">":  clauses.push({ totalNet: { gt: numVal } } as any); break
        case ">=": clauses.push({ totalNet: { gte: numVal } } as any); break
        case "<":  clauses.push({ totalNet: { lt: numVal } } as any); break
        case "<=": clauses.push({ totalNet: { lte: numVal } } as any); break
        default: errors.push(`Operator ${op} not supported for ${field}`)
      }
    } else if (field === "gross" || field === "totalgross") {
      if (type !== "number") { errors.push(`${field} expects a numeric value`); continue }
      const numVal = value as number
      switch (op) {
        case "=":  clauses.push({ totalGross: numVal }); break
        case "!=": clauses.push({ NOT: { totalGross: numVal } }); break
        case ">":  clauses.push({ totalGross: { gt: numVal } } as any); break
        case ">=": clauses.push({ totalGross: { gte: numVal } } as any); break
        case "<":  clauses.push({ totalGross: { lt: numVal } } as any); break
        case "<=": clauses.push({ totalGross: { lte: numVal } } as any); break
        default: errors.push(`Operator ${op} not supported for ${field}`)
      }
    } else if (field === "date") {
      const dateValue = new Date(String(value))
      if (Number.isNaN(dateValue.getTime())) { errors.push(`Invalid date: ${rawValue}`); continue }
      switch (op) {
        case ">":  clauses.push({ createdAt: { gt: dateValue } } as any); break
        case ">=": clauses.push({ createdAt: { gte: dateValue } } as any); break
        case "<":  clauses.push({ createdAt: { lt: dateValue } } as any); break
        case "<=": clauses.push({ createdAt: { lte: dateValue } } as any); break
        case "=":  clauses.push({ createdAt: dateValue } as any); break
        default: errors.push(`Operator ${op} not supported for date`)
      }
    } else if (field === "status") {
      if (op !== "=" && op !== "!=") { errors.push(`Operator ${op} not supported for status`); continue }
      const statusVal = String(value).toUpperCase()
      const validStatuses = ["PENDING", "PAID"]
      if (!validStatuses.includes(statusVal)) {
        errors.push(`Invalid status: ${value}. Valid: ${validStatuses.join(", ")}`); continue
      }
      if (op === "=") clauses.push({ status: statusVal as any })
      else clauses.push({ NOT: { status: statusVal as any } })
    } else {
      errors.push(`Field ${field} is not supported in Payroll DSL filters`)
    }
  }

  if (errors.length > 0 || clauses.length === 0) {
    return { errors, where: clauses.length ? { AND: clauses } : undefined }
  }
  return { errors, where: clauses.length === 1 ? clauses[0] : { AND: clauses } }
}
