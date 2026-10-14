import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { requestJson } from "../src/http.ts"

const originalFetch = globalThis.fetch
const originalSetTimeout = globalThis.setTimeout

afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.setTimeout = originalSetTimeout
})

describe("request wrapper", () => {
  test("passes a timeout signal and honest user agent", async () => {
    let init: RequestInit | undefined
    globalThis.fetch = (async (_input, options) => {
      init = options
      return new Response('{"ok":true}', { status: 200 })
    }) as typeof fetch
    await requestJson("https://api.lever.co/test")
    assert.ok(init?.signal instanceof AbortSignal)
    assert.equal(init?.redirect, "error")
    assert.match(new Headers(init?.headers).get("User-Agent") ?? "", /company-careers-cli/)
  })

  test("backs off on 429 and retries", async () => {
    let calls = 0
    globalThis.setTimeout = ((callback: () => void) => originalSetTimeout(callback, 0)) as typeof setTimeout
    globalThis.fetch = (async () => {
      calls++
      return calls === 1 ? new Response("", { status: 429 }) : new Response('{"ok":true}', { status: 200 })
    }) as typeof fetch
    assert.deepEqual(await requestJson("https://api.lever.co/test"), { ok: true })
    assert.equal(calls, 2)
  })
})
