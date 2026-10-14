import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { CompanyConfig, CompanyRegistry, ProviderName } from "./types.ts"

const PROVIDERS = new Set<ProviderName>(["greenhouse", "lever", "ashby", "workday", "smartrecruiters"])
const DEFAULT_REGISTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/companies.json")

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`)
  return value.trim()
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw new Error(`${field} must be an array of non-empty strings`)
  }
  return value.map((item) => item.trim())
}

function httpsUrl(value: unknown, field: string): string {
  const text = nonEmptyString(value, field)
  const url = new URL(text)
  if (url.protocol !== "https:") throw new Error(`${field} must use https`)
  return url.toString()
}

function corporateDomains(value: unknown, field: string): string[] {
  return stringArray(value, field).map((raw) => {
    const domain = raw.toLowerCase().replace(/\.$/, "")
    const parsed = new URL(`https://${domain}`)
    if (parsed.hostname !== domain || parsed.port || parsed.pathname !== "/" || parsed.username || parsed.password) {
      throw new Error(`${field} entries must be bare DNS names`)
    }
    return domain
  })
}

function parseCompany(raw: unknown, index: number): CompanyConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`companies[${index}] must be an object`)
  const item = raw as Record<string, unknown>
  const provider = nonEmptyString(item.provider, `companies[${index}].provider`) as ProviderName
  if (!PROVIDERS.has(provider)) throw new Error(`companies[${index}].provider is unsupported: ${provider}`)
  const employerType = nonEmptyString(item.employer_type, `companies[${index}].employer_type`) as CompanyConfig["employerType"]
  if (!["direct", "staffing", "recruiting", "job_board"].includes(employerType)) {
    throw new Error(`companies[${index}].employer_type is unsupported: ${employerType}`)
  }
  const boardToken = item.board_token === undefined || item.board_token === null ? null : nonEmptyString(item.board_token, `companies[${index}].board_token`)
  const boardUrl = item.board_url === undefined || item.board_url === null ? null : httpsUrl(item.board_url, `companies[${index}].board_url`)
  const careerUrl = httpsUrl(item.career_url, `companies[${index}].career_url`)
  const domains = corporateDomains(item.corporate_domains, `companies[${index}].corporate_domains`)
  const careerHost = new URL(careerUrl).hostname.toLowerCase()
  if (!domains.some((domain) => careerHost === domain || careerHost.endsWith(`.${domain}`))) {
    throw new Error(`companies[${index}].career_url must be on a listed corporate domain`)
  }
  if (provider === "workday") {
    if (!boardUrl) throw new Error(`companies[${index}].board_url is required for Workday`)
    const host = new URL(boardUrl).hostname.toLowerCase()
    if (!host.endsWith(".myworkdayjobs.com")) throw new Error(`companies[${index}].board_url must be a myworkdayjobs.com URL`)
  } else if (!boardToken) {
    throw new Error(`companies[${index}].board_token is required for ${provider}`)
  }
  return {
    id: nonEmptyString(item.id, `companies[${index}].id`),
    name: nonEmptyString(item.name, `companies[${index}].name`),
    aliases: item.aliases === undefined ? [] : stringArray(item.aliases, `companies[${index}].aliases`),
    careerUrl,
    corporateDomains: domains,
    provider,
    boardToken,
    boardUrl,
    employerType,
    enabled: item.enabled !== false,
    // Derived from the top-level groups map after all ids are validated.
    groups: [],
  }
}

export async function loadRegistry(path = DEFAULT_REGISTRY): Promise<CompanyRegistry> {
  const raw = JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>
  if (raw.version !== 1) throw new Error(`registry version must be 1`)
  if (!raw.groups || typeof raw.groups !== "object" || Array.isArray(raw.groups)) throw new Error("registry groups must be an object")
  if (!Array.isArray(raw.companies)) throw new Error("registry companies must be an array")
  const groups: Record<string, string[]> = {}
  for (const [name, ids] of Object.entries(raw.groups as Record<string, unknown>)) groups[name] = stringArray(ids, `groups.${name}`)
  const companies = raw.companies.map(parseCompany)
  const ids = new Set<string>()
  for (const company of companies) {
    if (ids.has(company.id)) throw new Error(`duplicate company id: ${company.id}`)
    ids.add(company.id)
  }
  for (const [group, members] of Object.entries(groups)) {
    for (const id of members) if (!ids.has(id)) throw new Error(`group ${group} references unknown company: ${id}`)
  }
  for (const company of companies) {
    company.groups = Object.entries(groups)
      .filter(([, members]) => members.includes(company.id))
      .map(([name]) => name)
  }
  return { version: 1, groups, companies }
}

export function selectCompanies(registry: CompanyRegistry, ids: string[], group?: string): CompanyConfig[] {
  const selectedIds = new Set(ids)
  if (group) {
    const members = registry.groups[group]
    if (!members) throw new Error(`unknown company group: ${group}`)
    for (const id of members) selectedIds.add(id)
  }
  if (selectedIds.size === 0) throw new Error("select at least one --company or a non-empty --group")
  const byId = new Map(registry.companies.map((company) => [company.id, company]))
  const selected: CompanyConfig[] = []
  for (const id of selectedIds) {
    const company = byId.get(id)
    if (!company) throw new Error(`unknown company id: ${id}`)
    if (!company.enabled) continue
    if (company.employerType !== "direct") throw new Error(`company ${id} is not a direct employer and cannot be searched`)
    selected.push(company)
  }
  if (selected.length === 0) throw new Error("no enabled direct employers were selected")
  return selected
}
