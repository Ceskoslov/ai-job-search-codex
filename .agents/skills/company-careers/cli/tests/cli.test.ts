import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, test } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, "../src/cli.ts")
const registry = join(here, "fixtures/registry.json")

async function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const child = spawn(process.execPath, [cli, ...args], { env, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }))
  })
}

describe("CLI validation and dry-run safety", () => {
  test("help exits successfully", async () => {
    const result = await run(["--help"])
    assert.equal(result.code, 0)
    assert.match(result.stdout, /company-careers/)
  })

  test("search dry-run prints five requests and performs no fetch", async () => {
    const result = await run(["search", "-l", "Tokyo, Japan", "-q", "AI Engineer", "--group", "target", "--registry", registry, "--dry-run"])
    assert.equal(result.code, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.dryRun, true)
    assert.equal(output.requests.length, 5)
    assert.equal(output.requests.find((item: { provider: string }) => item.provider === "workday").method, "POST")
  })

  test("detail dry-run is bound to one registered company", async () => {
    const url = "https://acme.wd5.myworkdayjobs.com/en-US/External/job/Tokyo/LLM-Engineer_R101"
    const result = await run(["detail", url, "--company", "acme-workday", "--registry", registry, "--dry-run"])
    assert.equal(result.code, 0, result.stderr)
    assert.match(JSON.parse(result.stdout).request.url, /\/wday\/cxs\/acme\/External\/job\//)
  })

  test("unknown flags fail loudly as JSON", async () => {
    const result = await run(["searchbogus", "--nope", "x"])
    assert.equal(result.code, 1)
    assert.equal(JSON.parse(result.stderr).code, "BAD_ARG")
  })

  test("missing location fails before network access", async () => {
    const result = await run(["search", "--group", "target", "--registry", registry])
    assert.equal(result.code, 1)
    assert.match(JSON.parse(result.stderr).error, /location/)
  })

  test("companies command lists the local registry", async () => {
    const result = await run(["companies", "--registry", registry, "--format", "json"])
    assert.equal(result.code, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).companies.length, 6)
  })
})
