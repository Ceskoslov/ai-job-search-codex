# /add-portal - Add a job-site adapter

Use this workflow only when the user explicitly asks to add another job board or company
career site. The current installation intentionally contains LinkedIn only.

## 1. Establish scope and risk

Collect the public site URL, market/language, desired skill name, and a realistic test
query. Inspect robots.txt, terms, authentication requirements, and whether any API or
proxy is paid. Stop before implementation if login bypass, prohibited access, or cost is
required; explain the issue and obtain explicit direction.

Live reconnaissance is external access. A request to *build* an adapter does not by
itself authorize submitting applications, sending messages, uploading documents, or
incurring charges.

## 2. Use the Node-native reference

Read `.agents/skills/linkedin-search/` completely. Create:

```text
.agents/skills/<name>/
├── SKILL.md
├── url-reference.md
└── cli/
    ├── package.json
    ├── README.md
    ├── src/cli.ts
    ├── src/commands/search.ts
    ├── src/commands/detail.ts
    └── tests/
```

Requirements:

- Node.js 22.18+, ESM, native `fetch`, explicit `.ts` imports, zero runtime dependencies
  unless there is a documented need.
- Commands `search` and `detail`; JSON errors on stderr with exit code 1.
- Search output `{meta, results}` and result fields `id`, `title`, `company`, `location`,
  `date`, `url` (use `null`, never omit).
- Add `--dry-run` that prints the method/URL and performs no request.
- Honest User-Agent, bounded retries on 429/5xx, and low request volume.
- Credentials only through a named environment variable, never a flag or committed file.
  Disclose per-call costs before use.
- Search/detail adapters must not contain submission, messaging, login, or upload logic.

`package.json` should expose `node src/cli.ts`, a Node test command, `type: module`,
`engines.node >=22.18`, and no lifecycle scripts.

## 3. Verify safely

Run offline fixtures, argument-validation tests, and `--dry-run` first. A live search and
one detail request require explicit user authorization and must be bounded. Never make a
live request merely to satisfy CI.

## 4. Register

The scraper discovers `.agents/skills/*/SKILL.md`. Add the exact Node command to
`.claude/settings.json` only after reviewing it, mirror it in
`tools/security_guards.py`, and keep the default search strategy unchanged until the user
asks to enable the new site.

For a company career site, prefer a read-only parser for a user-provided posting URL.
Implement any future submission/upload component separately, disabled by default, with a
fresh confirmation immediately before every external write.
