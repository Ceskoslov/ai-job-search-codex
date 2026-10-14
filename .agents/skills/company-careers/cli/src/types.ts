export type ProviderName = "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters"

export interface CompanyConfig {
  id: string
  name: string
  aliases: string[]
  careerUrl: string
  corporateDomains: string[]
  provider: ProviderName
  boardToken: string | null
  boardUrl: string | null
  employerType: "direct" | "staffing" | "recruiting" | "job_board"
  enabled: boolean
  groups: string[]
}

export interface CompanyRegistry {
  version: number
  groups: Record<string, string[]>
  companies: CompanyConfig[]
}

export interface RequestPlan {
  company: string
  provider: ProviderName
  method: "GET" | "POST"
  url: string
  body?: Record<string, unknown>
}

export interface SourceJob {
  id: string
  title: string
  location: string | null
  date: string | null
  url: string
  description: string | null
  department: string | null
  employmentType: string | null
  remote: boolean | null
  sourceEmployer: string | null
  externalPath?: string | null
}

export interface SearchOptions {
  query?: string
  location: string
  jobage?: number
  limit: number
  companyIds: string[]
  group?: string
  format: "json" | "table" | "plain"
  registryPath?: string
  dryRun?: boolean
}

export interface DetailOptions {
  input: string
  companyId: string
  format: "json" | "plain"
  registryPath?: string
  dryRun?: boolean
}
