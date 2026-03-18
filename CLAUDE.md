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

## After Any Work

- Update `.claude/docs/CHANGELOG.md` with what was done
- If you learned something new/surprising, add it to `.claude/docs/LESSONS.md`
