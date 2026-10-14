import { buildDetailPlan, fetchCompanyJob } from "../providers.ts"
import { loadRegistry, selectCompanies } from "../registry.ts"
import { directEmployerGate } from "./search.ts"
import type { DetailOptions } from "../types.ts"

export async function runDetail(options: DetailOptions): Promise<number> {
  try {
    const registry = await loadRegistry(options.registryPath)
    const [company] = selectCompanies(registry, [options.companyId])
    const plan = buildDetailPlan(company, options.input)
    if (options.dryRun) {
      process.stdout.write(JSON.stringify({ dryRun: true, request: plan }, null, 2) + "\n")
      return 0
    }
    const job = await fetchCompanyJob(company, options.input)
    if (!job) {
      process.stderr.write(JSON.stringify({ error: "posting not found on the registered employer board", code: "NOT_FOUND" }) + "\n")
      return 1
    }
    if (!directEmployerGate(job, company)) {
      process.stderr.write(JSON.stringify({ error: "posting failed the direct-employer gate", code: "INTERMEDIARY_OR_UNVERIFIED_EMPLOYER" }) + "\n")
      return 1
    }
    const result = {
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
      isActive: true,
      provider: company.provider,
      portal: "company-careers",
      source: "official_ats_api",
      employerVerified: true,
    }
    if (options.format === "plain") {
      const lines = [
        result.title,
        `${result.company} · ${result.location ?? "—"}`,
        `Provider: ${result.provider}`,
        `Posted: ${result.date ?? "unknown"}`,
        "Status: ACTIVE / PUBLISHED",
        "",
        result.description ?? "(no description)",
        "",
        `URL: ${result.url}`,
      ]
      process.stdout.write(lines.join("\n") + "\n")
    } else process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    return 0
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error), code: "DETAIL_FAILED" }) + "\n")
    return 1
  }
}
