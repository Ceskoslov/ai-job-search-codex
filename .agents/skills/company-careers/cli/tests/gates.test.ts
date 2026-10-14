import assert from "node:assert/strict"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, test } from "node:test"
import { directEmployerGate } from "../src/commands/search.ts"
import { loadRegistry, selectCompanies } from "../src/registry.ts"
import { isFresh, matchesLocation, matchesQuery } from "../src/text.ts"
import type { SourceJob } from "../src/types.ts"

const registryPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/registry.json")
const registry = await loadRegistry(registryPath)
const company = registry.companies.find((item) => item.id === "acme-greenhouse")!
const baseJob: SourceJob = {
  id: "1",
  title: "Generative AI Engineer",
  location: "Tokyo, Japan",
  date: "2026-09-08",
  url: "https://greenhouse.example/jobs/1",
  description: "Build Python RAG services.",
  department: "Engineering",
  employmentType: "Full-time",
  remote: false,
  sourceEmployer: "Acme GH",
}

describe("direct-employer gate", () => {
  test("accepts a registered employer alias", () => assert.equal(directEmployerGate(baseJob, company), true))
  test("rejects a different employer reported by the ATS", () => assert.equal(directEmployerGate({ ...baseJob, sourceEmployer: "Other Corp" }, company), false))
  test("rejects anonymous-client language", () => assert.equal(directEmployerGate({ ...baseJob, description: "Our client is hiring an engineer." }, company), false))
  test("rejects staffing registry entries before any fetch", () => assert.throws(() => selectCompanies(registry, ["agency"]), /not a direct employer/))
})

describe("client-side filters", () => {
  test("requires every query token", () => {
    assert.equal(matchesQuery(baseJob, "Python RAG"), true)
    assert.equal(matchesQuery(baseJob, "Python Rust"), false)
  })
  test("matches location components and remote metadata", () => {
    assert.equal(matchesLocation(baseJob, "Tokyo, Japan"), true)
    assert.equal(matchesLocation({ ...baseJob, location: null, remote: true }, "Remote"), true)
  })
  test("a requested freshness window excludes unknown and stale dates", () => {
    const now = new Date("2026-09-09T12:00:00Z")
    assert.equal(isFresh("2026-09-08", 14, now), true)
    assert.equal(isFresh("2026-07-01", 14, now), false)
    assert.equal(isFresh(null, 14, now), false)
  })
})
