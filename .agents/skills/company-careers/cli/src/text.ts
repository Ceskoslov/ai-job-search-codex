export function toDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  const date = typeof value === "number" ? new Date(value) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export function relativeWorkdayDate(value: unknown, now = new Date()): string | null {
  if (typeof value !== "string") return null
  const text = value.trim().toLowerCase()
  let days: number | null = null
  if (/posted\s+today/.test(text)) days = 0
  else if (/posted\s+yesterday/.test(text)) days = 1
  else {
    const match = text.match(/posted\s+(\d+)\s+days?\s+ago/)
    if (match) days = Number(match[1])
  }
  if (days === null) return toDate(value)
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function decodeEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  }
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const value = Number.parseInt(entity.slice(2), 16)
    return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : ""
  }
  if (entity.startsWith("#")) {
    const value = Number.parseInt(entity.slice(1), 10)
    return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : ""
  }
  return named[entity] ?? `&${entity};`
}

export function htmlToText(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null
  const text = value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([^;]+);/g, (_whole, entity: string) => decodeEntity(entity))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "")
}

export function hasAnonymousClientLanguage(title: string, description: string | null): boolean {
  const text = `${title}\n${description ?? ""}`
  return [
    /\b(?:confidential|unnamed) client\b/i,
    /\bour client\s+(?:is|has|seeks|requires|is looking|is hiring)\b/i,
    /\bon behalf of (?:a|an|our) client\b/i,
    /\bleading (?:global |international |technology |financial )?company\b.*\bclient\b/i,
  ].some((pattern) => pattern.test(text))
}

export function matchesQuery(job: SourceJob, query?: string): boolean {
  if (!query?.trim()) return true
  const haystack = [job.title, job.description, job.department, job.employmentType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean)
  return tokens.every((token) => haystack.includes(token))
}

export function matchesLocation(job: SourceJob, location: string): boolean {
  const wanted = location.toLowerCase().split(/[,|/]+/).map((part) => part.trim()).filter(Boolean)
  if (wanted.some((part) => part === "remote") && job.remote === true) return true
  const actual = (job.location ?? "").toLowerCase()
  return wanted.length > 0 && wanted.some((part) => actual.includes(part))
}

export function isFresh(date: string | null, jobage?: number, now = new Date()): boolean {
  if (jobage === undefined) return true
  if (!date) return false
  const timestamp = new Date(`${date}T00:00:00Z`).getTime()
  if (Number.isNaN(timestamp)) return false
  const cutoff = now.getTime() - jobage * 86_400_000
  return timestamp >= cutoff && timestamp <= now.getTime() + 86_400_000
}
