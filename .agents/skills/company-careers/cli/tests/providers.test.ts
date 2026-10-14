import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, test } from "node:test"
import {
  buildDetailPlan,
  buildSearchPlan,
  normalizeAshby,
  normalizeGreenhouse,
  normalizeLever,
  normalizeSmartRecruiters,
  normalizeWorkday,
} from "../src/providers.ts"
import { loadRegistry } from "../src/registry.ts"

const here = dirname(fileURLToPath(import.meta.url))
const registryPath = join(here, "fixtures/registry.json")
const responses = JSON.parse(await readFile(join(here, "fixtures/provider-responses.json"), "utf8"))
const registry = await loadRegistry(registryPath)
const company = (id: string) => registry.companies.find((item) => item.id === id)!

test("company groups are derived from the top-level registry map", () => {
  assert.deepEqual(company("acme-greenhouse").groups, ["target"])
})

describe("provider request plans", () => {
  test("uses only fixed HTTPS ATS hosts", () => {
    assert.equal(new URL(buildSearchPlan(company("acme-greenhouse")).url).hostname, "boards-api.greenhouse.io")
    assert.equal(new URL(buildSearchPlan(company("acme-lever")).url).hostname, "api.lever.co")
    assert.equal(new URL(buildSearchPlan(company("acme-ashby")).url).hostname, "api.ashbyhq.com")
    assert.equal(new URL(buildSearchPlan(company("acme-smart")).url).hostname, "api.smartrecruiters.com")
  })

  test("builds a bounded Workday POST plan from the registered board URL", () => {
    const plan = buildSearchPlan(company("acme-workday"), "AI Engineer")
    assert.equal(plan.method, "POST")
    assert.equal(plan.url, "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs")
    assert.deepEqual(plan.body, { appliedFacets: {}, limit: 20, offset: 0, searchText: "AI Engineer" })
  })

  test("Workday detail never fetches the supplied URL directly", () => {
    const supplied = "https://acme.wd5.myworkdayjobs.com/en-US/External/job/Tokyo/LLM-Engineer_R101"
    const plan = buildDetailPlan(company("acme-workday"), supplied)
    assert.equal(plan.url, "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Tokyo/LLM-Engineer_R101")
  })
})

describe("provider normalization contract", () => {
  test("normalizes Greenhouse", () => {
    const [job] = normalizeGreenhouse(responses.greenhouse)
    assert.deepEqual([job.id, job.title, job.location, job.date], ["101", "AI Engineer", "Tokyo, Japan", "2026-09-01"])
    assert.match(job.description!, /RAG systems & AI agents/)
    assert.equal(job.sourceEmployer, "Acme Greenhouse")
  })

  test("normalizes Lever", () => {
    const [job] = normalizeLever(responses.lever)
    assert.equal(job.id, "lever-101")
    assert.equal(job.location, "Tokyo, Japan")
    assert.equal(job.employmentType, "Full-time")
  })

  test("normalizes Ashby", () => {
    const [job] = normalizeAshby(responses.ashby)
    assert.equal(job.id, "ashby-101")
    assert.equal(job.date, "2026-09-02")
    assert.equal(job.remote, false)
  })

  test("normalizes SmartRecruiters", () => {
    const [job] = normalizeSmartRecruiters(responses.smartrecruiters, company("acme-smart"))
    assert.equal(job.title, "Generative AI Engineer")
    assert.equal(job.location, "Tokyo, Japan")
    assert.equal(job.sourceEmployer, "Acme Smart")
  })

  test("normalizes Workday relative dates without treating 30+ as exact", () => {
    const now = new Date("2026-09-09T12:00:00Z")
    const [job] = normalizeWorkday(responses.workday, company("acme-workday"), now)
    assert.equal(job.id, "R101")
    assert.equal(job.date, "2026-09-07")
    assert.equal(job.url, "https://acme.wd5.myworkdayjobs.com/en-US/External/job/Tokyo/LLM-Engineer_R101")
  })
})
