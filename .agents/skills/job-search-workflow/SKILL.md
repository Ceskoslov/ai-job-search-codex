---
name: job-search-workflow
description: Manage the local job-search workspace with Codex or another Agent Skills client. Use for profile setup, LinkedIn or official-careers job discovery, fit ranking, CV and cover-letter drafting, application outcomes, interview preparation, and local reports.
---

# Job Search Workflow

Use the repository root as the working directory. Read `AGENTS.md` first, then route the request to the canonical specification below. These files are shared with Claude Code so the workflow stays consistent across agents.

| User intent | Read and follow |
|---|---|
| Initialize or update profile | `.claude/commands/setup.md` |
| Search LinkedIn or official career pages | `.claude/skills/job-scraper/SKILL.md` and its `search-queries.md` |
| Rank saved jobs | `.claude/commands/rank.md` |
| Evaluate or draft for one job | `.claude/commands/apply.md` and `.claude/skills/job-application-assistant/SKILL.md` |
| Prepare for an interview | `.claude/commands/interview.md` |
| Record progress or draft a follow-up | `.claude/commands/outcome.md` |
| Analyze skill gaps | `.claude/skills/upskill/SKILL.md` |
| Generate an offline dashboard | `.claude/commands/html-report.md` |
| Add a future portal | `.claude/commands/add-portal.md` |

Treat Claude-specific tool names in those files as capability names: map file reads and edits, web access, questions, and reviewer agents to the tools available in the current host. Treat `$ARGUMENTS` as the user's text following the requested operation. A slash command is an alias for intent, not a requirement of the host UI.

The candidate sources are `CLAUDE.md`, `.claude/skills/job-application-assistant/01-candidate-profile.md`, and `cv/main_example.tex`. Do not invent facts. When a confirmed new fact is used, update the candidate profile as required by the canonical workflow.

LinkedIn is the only installed portal CLI. Use Node.js:

```bash
npm run jobs -- search -q "<role>" -l "<location>" --jobage 14 --limit 20 --format json
npm run jobs -- detail <id-or-url> --format plain
```

Use `--dry-run` during configuration or tests; it validates and prints the request URL without contacting LinkedIn. Live search is personal-use only and should be low volume.

Before any application submission, message or email send, document upload, external sync, or paid API use, present the exact target and artifacts and obtain explicit authorization. Drafting and local record updates do not authorize those external actions.
