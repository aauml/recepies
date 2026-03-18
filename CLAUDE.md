# Thermomix App — Claude Instructions

**MANDATORY: Read all files in `.claude/docs/` before starting any work.**

## Quick Reference

- **App**: Personal Thermomix TM6 recipe management PWA
- **Live URL**: https://recepies-mu.vercel.app
- **Repo**: github.com/aauml/recepies
- **Stack**: Vite 8 + React 19 + Tailwind CSS v4 + Supabase + Vercel

## Before You Code

1. Read `.claude/docs/PROJECT.md` — services, credentials, config
2. Read `.claude/docs/ARCHITECTURE.md` — how everything connects
3. Read `.claude/docs/RULES.md` — user preferences and constraints
4. Read `.claude/docs/LESSONS.md` — known gotchas and past failures
5. Check `.claude/docs/CHANGELOG.md` — what was done and when

## Critical Constraints

- **User does not write code** — all changes are made via Claude
- **Vegetarian only** — no meat, fish, gelatin. Eggs and dairy OK
- **iPhone Safari** is the primary target device
- **Free tier only** — Vercel and Supabase free plans
- **npm commands fail** in "My Drive" path (spaces) — use `/tmp` worktree
- **DNS to supabase.co fails** from CLI — use Chrome MCP for Supabase dashboard/SQL
- **All UI in English**

## Task Board (Google Sheet API)

When the user says "check tasks" or "work on tasks", fetch pending tasks from the API:

```
GET https://script.google.com/macros/s/AKfycbxsyeXkZ3ieFLWXJFrfBrLoYc-31glycOK_NcEEwQVkMajqGm_MxIVuAx4l3Rlj61ka/exec?action=list&status=pending
```

After completing a task, mark it done:

```
POST https://script.google.com/macros/s/AKfycbxsyeXkZ3ieFLWXJFrfBrLoYc-31glycOK_NcEEwQVkMajqGm_MxIVuAx4l3Rlj61ka/exec
{"action": "update", "id": <ID>, "status": "done", "notes": "commit <hash>"}
```

The API URL will be set in `.claude/docs/PROJECT.md` once deployed.

## After Any Work

- Update `.claude/docs/CHANGELOG.md` with what was done
- If you learned something new/surprising, add it to `.claude/docs/LESSONS.md`
- Mark completed tasks as "done" in the Task Board
