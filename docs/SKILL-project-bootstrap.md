---
name: project-bootstrap
description: "Reusable skill to set up a self-documenting project knowledge system. Creates CLAUDE.md, docs/, Google Sheet task board, and Claude.ai Project instructions. Use this when starting any new project."
---

# Project Bootstrap Skill

Use this skill to set up a complete, self-documenting, account-independent project knowledge system for any new project. Run it once at the start, and the system maintains itself from there.

## What It Creates

```
project-root/
├── CLAUDE.md                              ← Entry point (auto-loaded every session)
└── docs/
    ├── PROJECT.md                         ← Stack, services, credentials, config
    ├── ARCHITECTURE.md                    ← System diagram, files, routes, data flows
    ├── CHANGELOG.md                       ← Running log of all changes
    ├── LESSONS.md                         ← Gotchas, workarounds, failures
    ├── RULES.md                           ← User preferences, coding conventions
    ├── claude-ai-project-instructions.md  ← Instructions for Claude.ai chat Project
    └── thermomix-tasks-appscript.js       ← Google Apps Script for task board API
```

## Step 1: Gather Project Info

Before creating any files, research the project thoroughly:

1. **Read the codebase** — scan all files, understand the stack, framework, patterns
2. **Read git history** — `git log --oneline --all` to understand the full timeline
3. **Identify services** — database, auth, hosting, APIs, third-party integrations
4. **Find credentials** — `.env` files, config files, environment variables
5. **Ask the user** about:
   - Their role and technical level
   - Primary device/browser target
   - Budget constraints (free tier only?)
   - Dietary/content preferences (if relevant to the app)
   - Any known pain points or workarounds

## Step 2: Create CLAUDE.md

This is the entry point. Claude Code reads it automatically every session. Keep it under 80 lines.

**Template:**

```markdown
# [Project Name] — Claude Instructions

**MANDATORY: Read all files in `docs/` before starting any work.**

## Quick Reference

- **App**: [one-line description]
- **Live URL**: [deployment URL]
- **Repo**: [github URL]
- **Stack**: [key technologies]

## Before You Code

1. Read `docs/PROJECT.md` — services, credentials, config
2. Read `docs/ARCHITECTURE.md` — how everything connects
3. Read `docs/RULES.md` — user preferences and constraints
4. Read `docs/LESSONS.md` — known gotchas and past failures
5. Check `docs/CHANGELOG.md` — what was done and when

## Critical Constraints

- [List the hard constraints — things that MUST always be true]
- [e.g. "User does not write code", "Free tier only", "Spanish UI"]

## Task Board (Google Sheet API)

When the user says "check tasks" or "work on tasks", fetch pending tasks:

GET [APPS_SCRIPT_URL]?action=list&status=pending

After completing a task, mark it done:

POST [APPS_SCRIPT_URL]
{"action": "update", "id": <ID>, "status": "done", "notes": "commit <hash>"}

Note: POST returns 302 redirect — extract Location header, GET that URL for JSON response.

## After ANY Work — Mandatory Checklist

**YOU MUST complete this checklist after every task. No exceptions.**

- [ ] `docs/CHANGELOG.md` — Add entry: date, what was done, why, commit hash
- [ ] `docs/LESSONS.md` — Add entry if anything surprising or tricky was discovered
- [ ] `docs/PROJECT.md` — Update if services, credentials, config, or APIs changed
- [ ] `docs/ARCHITECTURE.md` — Update if files, routes, components, or data flows changed
- [ ] `docs/RULES.md` — Update if new conventions or constraints were established
- [ ] **Task Board** — If work came from the Google Sheet, mark task as "done" via API
- [ ] **Commit docs** — Stage and push all doc updates

Skip a file only if genuinely nothing changed for it. When in doubt, update it.
```

## Step 3: Create docs/PROJECT.md

Include ALL of these sections (fill in from research):

- **Overview** — what the project is
- **Stack** — table of all technologies with versions
- **Repository** — GitHub URL, branch strategy, deploy pipeline
- **Services** — each external service with:
  - Project/org name
  - Dashboard URL
  - Region
  - Plan/tier
  - Tables/resources
  - Key functions or policies
- **Credentials & Environment Variables**
  - `.env` file contents (public keys are safe to include)
  - Where each private credential lives (dashboard URLs, not the actual secrets)
  - "Where to find/reset if lost" table
- **Local Development** — how to run locally, known path issues, tooling
- **Task Board** — Google Sheet URL, API URL, endpoint reference table

## Step 4: Create docs/ARCHITECTURE.md

Include ALL of these:

- **System diagram** — ASCII art showing how components connect
- **Frontend structure** — full file tree with one-line descriptions
- **Routes table** — path, page, tab bar visibility, description
- **API endpoints** — method, input, process, output, model, timeout
- **Data flows** — step-by-step for each major feature (use ASCII arrows)
- **Styling system** — theme colors, design patterns
- **Auth flow** — step-by-step from login to session

## Step 5: Create docs/CHANGELOG.md

Start with the full git history. Format:

```markdown
# Changelog — [Project Name]

All notable changes, decisions, and work sessions documented here.

---

## YYYY-MM-DD

### [What was done]
- **Changed/Added/Fixed**: Description
- **Why**: Motivation or root cause
- **Commit**: `abc1234`
```

## Step 6: Create docs/LESSONS.md

Group by category. Format:

```markdown
# Lessons Learned — [Project Name]

Hard-won knowledge from debugging, failures, and surprises.

---

## [Category]

### [Problem title]
- **Problem**: What went wrong or was surprising
- **Solution**: How it was fixed or worked around
- **Pattern**: When to watch for this in the future
```

## Step 7: Create docs/RULES.md

Include ALL of these:

- **User Profile** — name, role, technical level, diet, language
- **Hard Rules** — non-negotiable constraints
- **Coding Conventions** — framework patterns, state management, styling
- **Data Schema** — key data structures with exact field types
- **Domain Constraints** — business rules specific to the project
- **Workflow Rules** — numbered list of what to do before/during/after work

## Step 8: Set Up Google Sheet Task Board

1. Create a Google Sheet named after the project
2. Rename first tab to "Tasks"
3. Add headers: ID | Task | Status | Priority | Notes | Added | Completed
4. Open Extensions → Apps Script
5. Paste the Apps Script code (see template below)
6. Deploy → New Deployment → Web App → Execute as Me → Anyone
7. Authorize when prompted
8. Copy the deployment URL
9. Update CLAUDE.md and docs/PROJECT.md with the URL

**Apps Script template**: Use the code from `docs/thermomix-tasks-appscript.js` — it's generic and works for any project.

## Step 9: Create Claude.ai Project Instructions

Create `docs/claude-ai-project-instructions.md` with:

- Project context (stack, repo, live URL)
- User profile
- Task API URL and usage (GET list, POST add/update/delete)
- Rules for writing tasks (clear, actionable, include "why")
- Project constraints (include in task notes when relevant)
- Architecture context (so it writes better task descriptions)
- Example conversations showing the flow

The user pastes this into their Claude.ai Project's Custom Instructions field.

## Step 10: Set Up Memory (Claude Code)

Create a memory file at `~/.claude/projects/[project-path]/memory/feedback_always_log.md`:

```markdown
---
name: Always log decisions and lessons
description: After every task, update ALL relevant docs — not just CHANGELOG
type: feedback
---

After completing ANY work, update ALL relevant files automatically.
Check: CHANGELOG, LESSONS, PROJECT, ARCHITECTURE, RULES, Task Board, memory.
Never wait to be asked. This is mandatory.
```

Update `MEMORY.md` to point to the docs:

```markdown
# [Project Name] - Project Memory

## Primary Knowledge Base
All project details are in `docs/` (in the repo, account-independent).
See CLAUDE.md for the full file list.

## Behavioral Instructions
- [Link to feedback files]
```

## Self-Improvement Protocol

This system gets better over time. After every project that uses it:

1. **Review what was missing** — Did a future session lack context? Add it to the template.
2. **Review what was stale** — Did outdated docs cause confusion? Improve the update checklist.
3. **Review what was noisy** — Did unnecessary docs slow things down? Trim the template.
4. **Update this skill file** — Add new sections, examples, or patterns discovered.

### Meta-Lessons (update this list as you learn)

- Google Drive hides dotfiles — use `docs/` not `.claude/docs/`
- Google Apps Script POST returns 302 redirect — must follow redirect URL with GET for JSON response
- GitHub push protection blocks OAuth credentials — reference credential locations, don't include actual values
- Supabase `.delete()` silently fails on RLS block — always use `{ count: 'exact' }`
- YouTube blocks bot User-Agents — use oEmbed API for reliable metadata
- Keep CLAUDE.md under 80 lines — it's loaded every session, so brevity matters
- CHANGELOG should include commit hashes — makes it easy to trace changes
- LESSONS should include the pattern — not just problem/solution, but "when to watch for this"

## Verification

After setup is complete, verify:

1. `CLAUDE.md` exists at project root and references all docs
2. All 5 doc files exist in `docs/` with populated content
3. Google Sheet has correct headers in separate columns
4. Apps Script is deployed and API responds to GET ?action=list
5. Claude.ai Project instructions file has the real API URL (not placeholder)
6. Memory files point to the repo docs as primary knowledge base
7. A fresh `claude` session in the project folder shows full context
