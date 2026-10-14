const USER_AGENT = "company-careers-cli/1.0 (+local read-only job search)"

export async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const retries = 3
  let delay = 500
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      // ATS API calls are pinned to reviewed hosts. Do not let an HTTP redirect
      // silently turn that allowlist into an arbitrary outbound request.
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === retries) throw new Error(`request failed: ${response.status} ${response.statusText}`)
      const retryAfter = Number(response.headers.get("retry-after"))
      const wait = Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1000, 10_000) : delay
      await new Promise((resolveDelay) => setTimeout(resolveDelay, wait))
      delay = Math.min(delay * 2, 8_000)
      continue
    }
    if (!response.ok) throw new Error(`request failed: ${response.status} ${response.statusText}`)
    return response.json()
  }
  throw new Error("request failed after retries")
}
