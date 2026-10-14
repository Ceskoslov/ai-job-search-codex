# LinkedIn Search Strategy

<!-- Populated by setup. Keep search terms broad enough to find adjacent roles. -->

## Priority 1

- Query: `[PRIMARY_ROLE]`
- Location: `[TARGET_LOCATION]`
- Work mode: `[remote|hybrid|onsite|any]`

## Priority 2

- Query: `[ADJACENT_ROLE]`
- Location: `[TARGET_LOCATION]`
- Work mode: `[remote|hybrid|onsite|any]`

## Priority 3

- Query: `[STRETCH_ROLE]`
- Location: `[TARGET_LOCATION]`
- Work mode: `[remote|hybrid|onsite|any]`

## Source Gate

- Direct employers only. Exclude recruitment agencies, staffing/headhunting firms,
  anonymous-client listings, and postings whose actual employing company cannot be confirmed.
- A recruiting company may pass only when it clearly hires for its own internal team.

## Source Selection

- Default: `linkedin-search` only.
- Official/company websites: `company-careers` only, using verified employers in the
  `target` group of `.agents/skills/company-careers/data/companies.json`.
- All/both: run both installed sources only when explicitly requested.
- Never silently broaden an empty official-company result into a general web or recruiter
  search. The initial `target` group stays empty until official employer boards are
  verified and registered.
