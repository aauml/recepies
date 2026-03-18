# Project — Thermomix App

## Overview

Personal Thermomix TM6 recipe management Progressive Web App (PWA). Allows users to generate recipes from text/URLs/YouTube/photos using AI, cook step-by-step, manage shopping lists and pantry inventory, and share everything with household members.

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.2.4 |
| Routing | React Router DOM | 7.13.1 |
| Styling | Tailwind CSS v4 | 4.2.1 |
| Build | Vite | 8.0.0 |
| Backend/DB | Supabase (PostgreSQL + Auth) | JS client 2.99.1 |
| Hosting | Vercel | Free plan |
| AI | Claude API (Anthropic) | Sonnet 4 |
| Auth | Google OAuth via Supabase | — |

## Repository

- **GitHub**: github.com/aauml/recepies
- **Branch**: main (single branch)
- **Deploy**: Auto-deploy on push to main via Vercel

## Supabase

- **Organization**: ademas.ai
- **Project name**: Thermomix
- **Plan**: Free
- **Ref**: `dwnuqwysyxmiayfsxofk`
- **API URL**: `https://dwnuqwysyxmiayfsxofk.supabase.co`
- **Region**: AWS us-west-1
- **Dashboard**: https://supabase.com/dashboard/project/dwnuqwysyxmiayfsxofk

### Database Tables

| Table | Purpose | RLS Scope |
|-------|---------|-----------|
| profiles | User display name + avatar | Anyone reads, self updates |
| recipes | All recipe data (JSON columns) | Household members read/update/delete, self insert |
| cook_log | Cooking history with ratings | Household members |
| recipe_notes | Per-step notes on recipes | Household members |
| shopping_list | Shopping items linked to recipes | Household members |
| inventory | Pantry inventory items | Household members |
| households | Household groups | Members only |
| household_members | User-household relationships | Members only |
| household_invites | Email invites (pending/accepted/declined) | Involved parties |

### Key Database Functions

- `get_my_household_member_ids()` — Returns UUID[] of all users in caller's household. Used by RLS policies on recipes, shopping_list, inventory, cook_log, recipe_notes. SECURITY DEFINER.
- `get_my_household_id()` — Returns the household UUID for the current user. Used by household_members RLS.
- `handle_new_user()` — Trigger on auth.users INSERT. Auto-creates profile row with display_name and avatar_url from OAuth metadata.

### RLS Policies (Current State)

**recipes:**
- SELECT: `created_by = ANY(get_my_household_member_ids())` — see household recipes
- INSERT: `created_by = auth.uid()` — only self can create
- UPDATE: `created_by = ANY(get_my_household_member_ids())` — any household member can edit
- DELETE: `created_by = ANY(get_my_household_member_ids())` — any household member can delete

**shopping_list, inventory, cook_log, recipe_notes:**
- All operations: `user_id = ANY(get_my_household_member_ids())` — shared within household

**household_members:**
- DELETE: `user_id = auth.uid() OR household_id = get_my_household_id()` — self-remove or owner removes

### Authentication

- **Primary**: Google OAuth
- **Google Cloud project**: "Thermomix App"
- **Client ID**: `580392882951-65sn7r58obquer128saqaq8p932v8bc3.apps.googleusercontent.com`
- **OAuth consent screen**: External, Testing mode, app name "My Thermomix"
- **Test users**: ayalaax@gmail.com
- **Callback URI**: `https://dwnuqwysyxmiayfsxofk.supabase.co/auth/v1/callback`
- **Site URL**: `https://recepies-mu.vercel.app`
- **Redirect URLs**: `https://recepies-mu.vercel.app/**`, `http://localhost:5173/**`

## Vercel

- **Project URL**: https://recepies-mu.vercel.app
- **Config** (`vercel.json`):
  - API routes: `/api/(.*)` → pass-through to serverless functions
  - All other routes: rewrite to `/` (SPA)
  - `generate-recipe.js`: 60-second max duration (extended thinking)

### Environment Variables (Vercel)

- `ANTHROPIC_API_KEY` — Claude API key for recipe generation
- Supabase credentials are in frontend `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## AI / Claude API

- **Model for generation**: `claude-sonnet-4-20250514`
- **Model for editing**: `claude-sonnet-4-20250514`
- **Model for inventory parsing**: `claude-haiku-4-5-20251001`
- **Extended thinking**: Enabled for recipe generation (5000 token budget)
- **Cost**: ~$0.02-0.05 per recipe generation
- **API key**: Stored in Vercel env vars

## Local Development

- **Node.js**: Installed via Homebrew at `/usr/local/bin`
- **Dev server**: `npm run dev` → Vite on `http://localhost:5173`
- **Build**: `npm run build`
- **`.npmrc`**: `legacy-peer-deps=true` (needed for Tailwind v4 + Vite 8)

## Legacy

- `legacy/` folder contains 3 original static HTML recipes (Mediterranean Lentil Soup, Spiced Vegetable Lentil Soup, Vegetarian Pho)
- These were the initial prototype before the React PWA
- Not yet migrated into the database
