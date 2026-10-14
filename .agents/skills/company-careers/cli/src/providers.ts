import { requestJson } from "./http.ts"
import { htmlToText, relativeWorkdayDate, toDate } from "./text.ts"
import type { CompanyConfig, RequestPlan, SourceJob } from "./types.ts"

type JsonObject = Record<string, unknown>

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function token(company: CompanyConfig): string {
  if (!company.boardToken) throw new Error(`${company.id} has no board_token`)
  return encodeURIComponent(company.boardToken)
}

interface WorkdayBoard {
  origin: string
  tenant: string
  site: string
  locale: string
  boardUrl: string
  apiUrl: string
}

function workdayBoard(company: CompanyConfig): WorkdayBoard {
  if (!company.boardUrl) throw new Error(`${company.id} has no board_url`)
  const url = new URL(company.boardUrl)
  if (url.protocol !== "https:" || !url.hostname.toLowerCase().endsWith(".myworkdayjobs.com")) {
    throw new Error(`${company.id} has an invalid Workday board_url`)
  }
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 2) throw new Error(`${company.id} Workday board_url must include locale and site`)
  const tenant = url.hostname.split(".")[0]
  const site = parts.at(-1) as string
  const locale = parts.at(-2) as string
  const origin = url.origin
  return {
    origin,
    tenant,
    site,
    locale,
    boardUrl: `${origin}/${locale}/${site}`,
    apiUrl: `${origin}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`,
  }
}

export function buildSearchPlan(company: CompanyConfig, query = ""): RequestPlan {
  if (company.provider === "greenhouse") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://boards-api.greenhouse.io/v1/boards/${token(company)}/jobs?content=true` }
  }
  if (company.provider === "lever") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://api.lever.co/v0/postings/${token(company)}?mode=json` }
  }
  if (company.provider === "ashby") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://api.ashbyhq.com/posting-api/job-board/${token(company)}?includeCompensation=true` }
  }
  if (company.provider === "smartrecruiters") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://api.smartrecruiters.com/v1/companies/${token(company)}/postings?limit=100&offset=0` }
  }
  const board = workdayBoard(company)
  return {
    company: company.id,
    provider: company.provider,
    method: "POST",
    url: board.apiUrl,
    body: { appliedFacets: {}, limit: 20, offset: 0, searchText: query },
  }
}

export function normalizeGreenhouse(payload: unknown): SourceJob[] {
  return array(record(payload).jobs).map((raw) => {
    const job = record(raw)
    const location = record(job.location)
    return {
      id: String(job.id ?? ""),
      title: text(job.title) ?? "(untitled)",
      location: text(location.name),
      date: toDate(job.first_published),
      url: text(job.absolute_url) ?? "",
      description: htmlToText(job.content),
      department: array(job.departments).map((item) => text(record(item).name)).filter(Boolean).join(", ") || null,
      employmentType: null,
      remote: null,
      sourceEmployer: text(job.company_name),
    }
  }).filter((job) => job.id && job.url)
}

export function normalizeLever(payload: unknown): SourceJob[] {
  return array(payload).map((raw) => {
    const job = record(raw)
    const categories = record(job.categories)
    const workplace = text(job.workplaceType)?.toLowerCase() ?? ""
    return {
      id: text(job.id) ?? "",
      title: text(job.text) ?? "(untitled)",
      location: text(categories.location) ?? (array(categories.allLocations).map(text).filter(Boolean).join(", ") || null),
      date: toDate(job.createdAt),
      url: text(job.hostedUrl) ?? "",
      description: text(job.descriptionPlain) ?? htmlToText(job.description),
      department: text(categories.department) ?? text(categories.team),
      employmentType: text(categories.commitment),
      remote: workplace ? workplace === "remote" : null,
      sourceEmployer: null,
    }
  }).filter((job) => job.id && job.url)
}

export function normalizeAshby(payload: unknown): SourceJob[] {
  return array(record(payload).jobs).map((raw) => {
    const job = record(raw)
    return {
      id: text(job.id) ?? text(job.jobUrl)?.split("/").filter(Boolean).at(-1) ?? "",
      title: text(job.title) ?? "(untitled)",
      location: text(job.location) ?? (array(job.secondaryLocations).map((item) => text(record(item).location) ?? text(item)).filter(Boolean).join(", ") || null),
      date: toDate(job.publishedAt),
      url: text(job.jobUrl) ?? "",
      description: text(job.descriptionPlain) ?? htmlToText(job.descriptionHtml) ?? htmlToText(job.description),
      department: text(job.department) ?? text(job.team),
      employmentType: text(job.employmentType),
      remote: boolean(job.isRemote),
      sourceEmployer: null,
    }
  }).filter((job) => job.id && job.url)
}

export function normalizeSmartRecruiters(payload: unknown, company: CompanyConfig): SourceJob[] {
  const root = record(payload)
  const rows = Array.isArray(payload) ? payload : array(root.content)
  return rows.map((raw) => {
    const job = record(raw)
    const location = record(job.location)
    const sourceCompany = record(job.company)
    const id = text(job.id) ?? text(job.uuid) ?? ""
    const locationText = [text(location.city), text(location.region), text(location.country)].filter(Boolean).join(", ") || text(job.location)
    return {
      id,
      title: text(job.name) ?? text(job.title) ?? "(untitled)",
      location: locationText,
      date: toDate(job.releasedDate),
      url: text(job.ref) ?? `https://jobs.smartrecruiters.com/${encodeURIComponent(company.boardToken ?? "")}/${encodeURIComponent(id)}`,
      description: smartRecruitersDescription(job),
      department: text(record(job.department).label) ?? text(job.department),
      employmentType: text(record(job.typeOfEmployment).label) ?? text(job.typeOfEmployment),
      remote: boolean(job.remote),
      sourceEmployer: text(sourceCompany.name),
    }
  }).filter((job) => job.id && job.url)
}

function smartRecruitersDescription(job: JsonObject): string | null {
  const jobAd = record(job.jobAd)
  const sections = record(jobAd.sections)
  const parts = ["jobDescription", "qualifications", "additionalInformation"]
    .map((key) => htmlToText(record(sections[key]).text))
    .filter(Boolean)
  return parts.join("\n\n") || htmlToText(job.description)
}

export function normalizeWorkday(payload: unknown, company: CompanyConfig, now = new Date()): SourceJob[] {
  const board = workdayBoard(company)
  return array(record(payload).jobPostings).map((raw) => {
    const job = record(raw)
    const externalPath = text(job.externalPath)
    const id = text(job.bulletFields && array(job.bulletFields).at(-1)) ?? externalPath?.split("/").filter(Boolean).at(-1) ?? ""
    return {
      id,
      title: text(job.title) ?? "(untitled)",
      location: text(job.locationsText) ?? text(job.location),
      date: relativeWorkdayDate(job.postedOn, now),
      url: externalPath ? `${board.boardUrl}${externalPath.startsWith("/") ? "" : "/"}${externalPath}` : "",
      description: null,
      department: text(job.jobFamily),
      employmentType: text(job.timeType),
      remote: null,
      sourceEmployer: null,
      externalPath,
    }
  }).filter((job) => job.id && job.url)
}

export async function fetchCompanyJobs(company: CompanyConfig, query: string, cap: number): Promise<SourceJob[]> {
  const plan = buildSearchPlan(company, query)
  if (company.provider === "greenhouse") return normalizeGreenhouse(await requestJson(plan.url))
  if (company.provider === "lever") return normalizeLever(await requestJson(plan.url))
  if (company.provider === "ashby") return normalizeAshby(await requestJson(plan.url))
  if (company.provider === "smartrecruiters") {
    const jobs: SourceJob[] = []
    for (let offset = 0; offset < Math.max(cap, 100); offset += 100) {
      const url = `https://api.smartrecruiters.com/v1/companies/${token(company)}/postings?limit=100&offset=${offset}`
      const payload = await requestJson(url)
      const page = normalizeSmartRecruiters(payload, company)
      jobs.push(...page)
      const total = Number(record(payload).totalFound)
      if (page.length === 0 || (Number.isFinite(total) && jobs.length >= total) || jobs.length >= cap) break
    }
    return jobs
  }
  const board = workdayBoard(company)
  const jobs: SourceJob[] = []
  for (let offset = 0; offset < Math.max(cap, 20); offset += 20) {
    const body = { appliedFacets: {}, limit: 20, offset, searchText: query }
    const payload = await requestJson(board.apiUrl, { method: "POST", body: JSON.stringify(body) })
    const page = normalizeWorkday(payload, company)
    jobs.push(...page)
    const total = Number(record(payload).total)
    if (page.length === 0 || (Number.isFinite(total) && jobs.length >= total) || jobs.length >= cap) break
  }
  return jobs
}

function idFromInput(input: string): string {
  try {
    const url = new URL(input)
    return url.searchParams.get("gh_jid") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? ""
  } catch {
    return input.trim()
  }
}

function workdayExternalPath(input: string): string {
  try {
    const pathname = new URL(input).pathname
    const marker = pathname.indexOf("/job/")
    if (marker !== -1) return pathname.slice(marker)
  } catch {
    // Raw external path is handled below.
  }
  if (input.startsWith("/job/")) return input
  throw new Error("Workday detail requires a registered posting URL or /job/... external path")
}

export function buildDetailPlan(company: CompanyConfig, input: string): RequestPlan {
  const id = encodeURIComponent(idFromInput(input))
  if (!id) throw new Error("detail requires a posting id or URL")
  if (company.provider === "greenhouse") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://boards-api.greenhouse.io/v1/boards/${token(company)}/jobs/${id}` }
  }
  if (company.provider === "lever") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://api.lever.co/v0/postings/${token(company)}/${id}?mode=json` }
  }
  if (company.provider === "ashby") return buildSearchPlan(company)
  if (company.provider === "smartrecruiters") {
    return { company: company.id, provider: company.provider, method: "GET", url: `https://api.smartrecruiters.com/v1/companies/${token(company)}/postings/${id}` }
  }
  const board = workdayBoard(company)
  const externalPath = workdayExternalPath(input)
  return { company: company.id, provider: company.provider, method: "GET", url: `${board.origin}/wday/cxs/${encodeURIComponent(board.tenant)}/${encodeURIComponent(board.site)}${externalPath}` }
}

export async function fetchCompanyJob(company: CompanyConfig, input: string): Promise<SourceJob | null> {
  const plan = buildDetailPlan(company, input)
  const payload = await requestJson(plan.url, plan.method === "POST" ? { method: "POST", body: JSON.stringify(plan.body) } : {})
  const id = idFromInput(input)
  if (company.provider === "greenhouse") return normalizeGreenhouse({ jobs: [payload] })[0] ?? null
  if (company.provider === "lever") return normalizeLever([payload])[0] ?? null
  if (company.provider === "ashby") {
    const jobs = normalizeAshby(payload)
    return jobs.find((job) => job.id === id || job.url === input || job.url.endsWith(`/${id}`)) ?? null
  }
  if (company.provider === "smartrecruiters") return normalizeSmartRecruiters([payload], company)[0] ?? null
  const info = record(record(payload).jobPostingInfo)
  const board = workdayBoard(company)
  const externalPath = workdayExternalPath(input)
  return {
    id: text(info.jobReqId) ?? id,
    title: text(info.title) ?? "(untitled)",
    location: text(info.location),
    // Workday's startDate is the employment start date, not publication time.
    date: relativeWorkdayDate(info.postedOn),
    url: text(info.externalUrl) ?? `${board.boardUrl}${externalPath}`,
    description: htmlToText(info.jobDescription),
    department: text(info.jobFamily),
    employmentType: text(info.timeType),
    remote: null,
    sourceEmployer: null,
    externalPath,
  }
}
