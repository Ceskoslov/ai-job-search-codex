import { buildSearchPlan, fetchCompanyJobs } from "../providers.ts"
import { loadRegistry, selectCompanies } from "../registry.ts"
import { hasAnonymousClientLanguage, isFresh, matchesLocation, matchesQuery, normalizeName } from "../text.ts"
import type { CompanyConfig, SearchOptions, SourceJob } from "../types.ts"

export interface SearchResult {
  id: string
  title: string
  company: string
  location: string | null
  date: string | null
  url: string
  description: string | null
  department: string | null
  employmentType: string | null
  remote: boolean | null
  provider: CompanyConfig["provider"]
  portal: "company-careers"
  source: "official_ats_api"
  employerVerified: true
}

function employerMatches(job: SourceJob, company: CompanyConfig): boolean {
  if (!job.sourceEmployer) return true
  const allowed = [company.name, ...company.aliases].map(normalizeName)
  return allowed.includes(normalizeName(job.sourceEmployer))
}

export function directEmployerGate(job: SourceJob, company: CompanyConfig): boolean {
  return company.employerType === "direct" && employerMatches(job, company) && !hasAnonymousClientLanguage(job.title, job.description)
}

function normalizeResult(job: SourceJob, company: CompanyConfig): SearchResult {
  return {
    id: job.id,
    title: job.title,
    company: company.name,
    location: job.location,
    date: job.date,
    url: job.url,
    description: job.description,
    department: job.department,
    employmentType: job.employmentType,
    remote: job.remote,
    provider: company.provider,
    portal: "company-careers",
    source: "official_ats_api",
    employerVerified: true,
  }
}

function renderTable(results: SearchResult[]): string {
  if (results.length === 0) return "No results."
  const header = `${"DATE".padEnd(12)} ${"COMPANY".padEnd(24)} ${"TITLE".padEnd(48)} LOCATION`
  const rows = results.map((job) => `${(job.date ?? "—").padEnd(12)} ${job.company.slice(0, 24).padEnd(24)} ${job.title.slice(0, 48).padEnd(48)} ${job.location ?? "—"}`)
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

function renderPlain(results: SearchResult[]): string {
  return results.map((job) => `${job.title}\n  ${job.company} · ${job.location ?? "—"} · ${job.date ?? "—"}\n  ${job.provider} · verified direct employer\n  ${job.url}`).join("\n\n")
}

export async function runSearch(options: SearchOptions): Promise<number> {
  try {
    const registry = await loadRegistry(options.registryPath)
    const companies = selectCompanies(registry, options.companyIds, options.group)
    if (options.dryRun) {
      const requests = companies.map((company) => buildSearchPlan(company, options.query ?? ""))
      process.stdout.write(JSON.stringify({ dryRun: true, requests }, null, 2) + "\n")
      return 0
    }

    const results: SearchResult[] = []
    const errors: Array<{ company: string; error: string }> = []
    let filteredIntermediary = 0
    let filteredLocation = 0
    let filteredQuery = 0
    let filteredFreshness = 0
    const fetchCap = Math.max(100, options.limit * 4)

    // Sequential by company to avoid bursts across shared ATS services.
    for (const company of companies) {
      try {
        const jobs = await fetchCompanyJobs(company, options.query ?? "", fetchCap)
        for (const job of jobs) {
          if (!directEmployerGate(job, company)) {
            filteredIntermediary++
            continue
          }
          if (!matchesQuery(job, options.query)) {
            filteredQuery++
            continue
          }
          if (!matchesLocation(job, options.location)) {
            filteredLocation++
            continue
          }
          if (!isFresh(job.date, options.jobage)) {
            filteredFreshness++
            continue
          }
          results.push(normalizeResult(job, company))
        }
      } catch (error) {
        errors.push({ company: company.id, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const unique = new Map<string, SearchResult>()
    for (const result of results) {
      const key = result.url || `${normalizeName(result.company)}:${normalizeName(result.title)}`
      if (!unique.has(key)) unique.set(key, result)
    }
    const sorted = [...unique.values()]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.company.localeCompare(b.company) || a.title.localeCompare(b.title))
      .slice(0, options.limit)

    if (options.format === "table") process.stdout.write(renderTable(sorted) + "\n")
    else if (options.format === "plain") process.stdout.write(renderPlain(sorted) + (sorted.length ? "\n" : ""))
    else {
      process.stdout.write(JSON.stringify({
        meta: {
          count: sorted.length,
          companies: companies.map((company) => company.id),
          filteredIntermediary,
          filteredLocation,
          filteredQuery,
          filteredFreshness,
          errors,
        },
        results: sorted,
      }, null, 2) + "\n")
    }
    return errors.length === companies.length ? 1 : 0
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error), code: "SEARCH_FAILED" }) + "\n")
    return 1
  }
}
