const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g
const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{Nd}\s]/gu
const MULTIPLE_SPACES_REGEX = /\s+/g

const ARABIC_CHAR_REPLACEMENTS: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ى": "ي",
  "ئ": "ي",
  "ؤ": "و",
  "ة": "ه",
  "گ": "ك",
  "پ": "ب",
  "چ": "ج",
  "ڤ": "ف",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9"
}

const TATWEEL_CHAR = /\u0640/g

export type TokenMatch = {
  queryToken: string
  candidateToken: string
  score: number
}

export type NameScore = {
  score: number
  normalizedQuery: string
  normalizedCandidate: string
  matches: TokenMatch[]
}

export function normalizeNameValue(value: string | null | undefined): string {
  if (!value) {
    return ""
  }

  let normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ""
  }

  normalized = normalized.normalize("NFKD").replace(ARABIC_DIACRITICS_REGEX, "")
  normalized = normalized.replace(TATWEEL_CHAR, "")

  let buffer = ""
  for (const char of normalized) {
    buffer += ARABIC_CHAR_REPLACEMENTS[char] ?? char
  }

  buffer = buffer.replace(NON_ALPHANUMERIC_REGEX, " ")
  buffer = buffer.replace(MULTIPLE_SPACES_REGEX, " ").trim()

  return buffer
}

export function tokenizeName(value: string | null | undefined): string[] {
  const normalized = normalizeNameValue(value)
  if (!normalized) {
    return []
  }
  return normalized.split(" ").filter(Boolean)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return b.length
  }
  if (b.length === 0) {
    return a.length
  }

  const matrix: number[][] = []
  const aLength = a.length
  const bLength = b.length

  for (let i = 0; i <= bLength; i += 1) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= aLength; j += 1) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= bLength; i += 1) {
    const bChar = b.charAt(i - 1)
    for (let j = 1; j <= aLength; j += 1) {
      const aChar = a.charAt(j - 1)
      if (aChar === bChar) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        )
      }
    }
  }

  return matrix[bLength][aLength]
}

function tokenSimilarity(queryToken: string, candidateToken: string): number {
  if (!queryToken || !candidateToken) {
    return 0
  }

  if (candidateToken.startsWith(queryToken)) {
    return 1
  }

  const distance = levenshteinDistance(queryToken, candidateToken)
  const maxLength = Math.max(queryToken.length, candidateToken.length)
  if (maxLength === 0) {
    return 0
  }

  const rawScore = 1 - distance / maxLength
  return Math.max(0, rawScore)
}

export function scoreNameMatch(query: string, candidate: string): NameScore {
  const normalizedQuery = normalizeNameValue(query)
  const normalizedCandidate = normalizeNameValue(candidate)

  if (!normalizedQuery || !normalizedCandidate) {
    return {
      score: 0,
      normalizedQuery,
      normalizedCandidate,
      matches: []
    }
  }

  const queryTokens = tokenizeName(normalizedQuery)
  const candidateTokens = tokenizeName(normalizedCandidate)

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return {
      score: normalizedCandidate.includes(normalizedQuery) ? 0.6 : 0,
      normalizedQuery,
      normalizedCandidate,
      matches: []
    }
  }

  const matches: TokenMatch[] = []
  let accumulatedScore = 0

  for (const queryToken of queryTokens) {
    let bestScore = 0
    let bestCandidate = candidateTokens[0]

    for (const candidateToken of candidateTokens) {
      const similarity = tokenSimilarity(queryToken, candidateToken)
      if (similarity > bestScore) {
        bestScore = similarity
        bestCandidate = candidateToken
      }
    }

    if (bestScore === 0 && normalizedCandidate.includes(queryToken)) {
      bestScore = 0.5
      bestCandidate = queryToken
    }

    matches.push({
      queryToken,
      candidateToken: bestCandidate ?? "",
      score: Number(bestScore.toFixed(4))
    })

    accumulatedScore += bestScore
  }

  const averageScore = accumulatedScore / queryTokens.length
  const includesBonus = normalizedCandidate.includes(normalizedQuery) ? 0.1 : 0
  const finalScore = Math.min(1, averageScore + includesBonus)

  return {
    score: Number(finalScore.toFixed(4)),
    normalizedQuery,
    normalizedCandidate,
    matches
  }
}

export function buildNameSearchSummary(candidate: string, query: string) {
  const score = scoreNameMatch(query, candidate)
  return {
    score: score.score,
    matches: score.matches
  }
}
