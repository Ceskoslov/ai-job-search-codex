# Official career-board URL reference

The CLI calls only fixed public ATS hosts, except Workday where it calls the
validated `*.myworkdayjobs.com` host from the registry. All requests are
read-only and use an honest `company-careers-cli/1.0` User-Agent.

| Provider | Registry value | Search endpoint |
|---|---|---|
| Greenhouse | `board_token` from the board URL | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` |
| Lever | site token from `jobs.lever.co/{token}` | `GET https://api.lever.co/v0/postings/{token}?mode=json` |
| Ashby | token from `jobs.ashbyhq.com/{token}` | `GET https://api.ashbyhq.com/posting-api/job-board/{token}` |
| SmartRecruiters | company identifier | `GET https://api.smartrecruiters.com/v1/companies/{token}/postings` |
| Workday | full public board URL | `POST https://{tenant}.wdN.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` |

Workday cannot be configured reliably from a company name alone. Preserve the
full public board URL, including locale and site, for example
`https://example.wd5.myworkdayjobs.com/en-US/External`.

Provider URLs are data-source endpoints, not proof of employer identity. Verify
the board from the employer's own `career_url`, then record both the corporate
domain and ATS board in `data/companies.json`. Do not register recruiter,
staffing, RPO, or anonymous-client boards as direct employers.

The top-level `groups` map is the single source for search groups. A minimal
Greenhouse registration looks like this:

```json
{
  "version": 1,
  "groups": { "target": ["example"] },
  "companies": [{
    "id": "example",
    "name": "Example Corporation",
    "aliases": [],
    "career_url": "https://example.com/careers",
    "corporate_domains": ["example.com"],
    "provider": "greenhouse",
    "board_token": "example",
    "employer_type": "direct",
    "enabled": true
  }]
}
```

If a company has a custom site instead of one of these ATS platforms, add a
separate provider with this fallback order: public JSON/XML, `JobPosting`
JSON-LD, sitemap, static HTML, and only then a bounded browser parser. Inspect
robots.txt and terms before any live reconnaissance.
