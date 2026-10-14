#!/usr/bin/env -S node

import { runDetail } from "./commands/detail.ts"
import { runSearch } from "./commands/search.ts"
import { loadRegistry } from "./registry.ts"

interface Flags {
  _: string[]
  [key: string]: string | boolean | string[]
}

function addFlag(flags: Flags, key: string, value: string | boolean): void {
  const current = flags[key]
  if (current === undefined) flags[key] = value
  else if (Array.isArray(current)) current.push(String(value))
  else flags[key] = [String(current), String(value)]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const aliases: Record<string, string> = { q: "query", l: "location", n: "limit" }
  const booleans = new Set(["dry-run", "help", "h"])
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (!arg.startsWith("-")) {
      flags._.push(arg)
      continue
    }
    const key = aliases[arg.replace(/^-+/, "")] ?? arg.replace(/^-+/, "")
    if (booleans.has(key)) {
      addFlag(flags, key, true)
      continue
    }
    const next = argv[index + 1]
    if (next === undefined || next.startsWith("-")) addFlag(flags, key, true)
    else {
      addFlag(flags, key, next)
      index++
    }
  }
  return flags
}

function one(flags: Flags, name: string): string | undefined {
  const value = flags[name]
  return typeof value === "string" ? value : undefined
}

function many(flags: Flags, name: string): string[] {
  const value = flags[name]
  if (Array.isArray(value)) return value
  return typeof value === "string" ? [value] : []
}

function positiveInteger(flags: Flags, name: string, fallback?: number): number | undefined {
  const raw = flags[name]
  if (raw === undefined) return fallback
  const value = typeof raw === "string" ? Number(raw.trim()) : Number.NaN
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a whole number of at least 1`)
  return value
}

const HELP = `company-careers — search verified employers' public ATS boards

USAGE
  node src/cli.ts search -l <location> [--company <id> ... | --group <name>] [flags]
  node src/cli.ts detail <id-or-url> --company <id> [--format json|plain] [--dry-run]
  node src/cli.ts companies [--format json|table] [--registry <path>]

SEARCH FLAGS
  --location, -l <text>   Required location filter
  --query, -q <text>      Keywords; every word must match title/description metadata
  --jobage <days>         Keep only postings with a known date inside this window
  --limit, -n <n>         Maximum emitted results; default 50
  --company <id>          Registered employer id; repeatable
  --group <name>          Registered company group, normally target
  --format <format>       json (default), table, or plain
  --registry <path>       Alternate registry, primarily for tests
  --dry-run               Validate and print exact requests without network access

Only registered direct employers are fetched. The CLI never applies or uploads.
`

const KNOWN: Record<string, Set<string>> = {
  search: new Set(["location", "query", "jobage", "limit", "company", "group", "format", "registry", "dry-run", "help", "h"]),
  detail: new Set(["company", "format", "registry", "dry-run", "help", "h"]),
  companies: new Set(["format", "registry", "help", "h"]),
}

function validateKnown(flags: Flags, command: string): void {
  const known = KNOWN[command]
  if (!known) throw new Error(`unknown command: ${command}`)
  for (const key of Object.keys(flags)) if (key !== "_" && !known.has(key)) throw new Error(`unknown flag --${key} for '${command}'`)
}

async function runCompanies(flags: Flags): Promise<number> {
  const registry = await loadRegistry(one(flags, "registry"))
  const rows = registry.companies.map((company) => ({
    id: company.id,
    name: company.name,
    provider: company.provider,
    enabled: company.enabled,
    employerType: company.employerType,
    groups: company.groups,
  }))
  if ((one(flags, "format") ?? "table") === "json") process.stdout.write(JSON.stringify({ companies: rows }, null, 2) + "\n")
  else {
    const header = `${"ID".padEnd(24)} ${"PROVIDER".padEnd(18)} ${"STATUS".padEnd(10)} NAME`
    const body = rows.map((row) => `${row.id.slice(0, 24).padEnd(24)} ${row.provider.padEnd(18)} ${(row.enabled ? "enabled" : "disabled").padEnd(10)} ${row.name}`)
    process.stdout.write([header, "-".repeat(header.length), ...body].join("\n") + "\n")
  }
  return 0
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const command = flags._[0]
  if (!command || flags.help || flags.h) {
    process.stdout.write(HELP)
    return flags.help || flags.h ? 0 : 1
  }
  try {
    validateKnown(flags, command)
    if (command === "search") {
      const location = one(flags, "location")
      if (!location) throw new Error("search requires --location/-l")
      const format = one(flags, "format") ?? "json"
      if (!["json", "table", "plain"].includes(format)) throw new Error("--format must be json, table, or plain")
      return runSearch({
        query: one(flags, "query"),
        location,
        jobage: positiveInteger(flags, "jobage"),
        limit: positiveInteger(flags, "limit", 50) as number,
        companyIds: many(flags, "company"),
        group: one(flags, "group"),
        format: format as "json" | "table" | "plain",
        registryPath: one(flags, "registry"),
        dryRun: flags["dry-run"] === true,
      })
    }
    if (command === "detail") {
      const input = flags._[1]
      const companyIds = many(flags, "company")
      if (!input) throw new Error("detail requires an id or URL")
      if (companyIds.length !== 1) throw new Error("detail requires exactly one --company <id>")
      const format = one(flags, "format") ?? "json"
      if (!["json", "plain"].includes(format)) throw new Error("detail --format must be json or plain")
      return runDetail({ input, companyId: companyIds[0], format: format as "json" | "plain", registryPath: one(flags, "registry"), dryRun: flags["dry-run"] === true })
    }
    return runCompanies(flags)
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error), code: "BAD_ARG" }) + "\n")
    return 1
  }
}

function flushOutput(): Promise<void> {
  return Promise.all([
    new Promise<void>((resolve) => process.stdout.write("", resolve)),
    new Promise<void>((resolve) => process.stderr.write("", resolve)),
  ]).then(() => undefined)
}

main().then(async (code) => {
  await flushOutput()
  process.exitCode = code
}).catch(async (error) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error), code: "INTERNAL_ERROR" }) + "\n")
  await flushOutput()
  process.exitCode = 1
})
