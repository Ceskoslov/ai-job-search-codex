# company-careers-cli

Read-only Node.js 22.18+ CLI for Greenhouse, Lever, Ashby, Workday, and
SmartRecruiters public job boards. It has no runtime dependencies.

The CLI searches only employers registered in `../data/companies.json`; this
prevents an ATS tenant or anonymous recruiter page from being silently treated
as a verified employer. Run `node src/cli.ts --help` for commands and flags.

Tests use local fixtures and stubbed `fetch`; they never contact a career site.
Run them with `npm test` from this directory or `npm run test:careers` from the
repository root.
