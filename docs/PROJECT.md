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
| shopping_list | Shopping items linked to recipes + inventory | Household members |
| inventory | Pantry inventory (in_stock, section: fresh/spices) | Household members |
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

### Key Columns Added (2026-03-18)

**inventory:**
- `in_stock` (boolean, default true) — whether item is currently in stock
- `section` (text, default 'fresh') — 'fresh' or 'spices', determines which tab the item lives in

**shopping_list:**
- `source_inventory_id` (uuid, FK to inventory.id) — links shopping items back to inventory for auto-sync

**household_members:**
- DELETE: `user_id = auth.uid() OR household_id = get_my_household_id()` — self-remove or owner removes

### Authentication

- **Primary**: Google OAuth
- **Google Cloud project**: "Thermomix App"
- **Client ID**: Found in Google Cloud Console → APIs & Services → Credentials
- **OAuth consent screen**: External, Testing mode, app name "My Thermomix"
- **Test users**: ayalaax@gmail.com
- **Callback URI**: `https://dwnuqwysyxmiayfsxofk.supabase.co/auth/v1/callback`
- **Site URL**: `https://recepies-mu.vercel.app`
- **Redirect URLs**: `https://recepies-mu.vercel.app/**`, `http://localhost:5173/**`

## Credentials & Environment Variables

### .env file (local, gitignored)
This file must exist at the project root for local development:
```
VITE_SUPABASE_URL=https://dwnuqwysyxmiayfsxofk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bnVxd3lzeXhtaWF5ZnN4b2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzUyOTksImV4cCI6MjA4OTIxMTI5OX0.oyrpsewRcfemW3kLQYzknglLI-9PvvDpnFmq5Qh5Mh0
```
Note: The anon key is a public key (safe to document). It only grants access allowed by RLS policies.

### Vercel Environment Variables
Set in Vercel project dashboard (Settings → Environment Variables):
- `ANTHROPIC_API_KEY` — Claude API key for recipe generation/editing/parsing. **Private.** If lost, generate a new one at console.anthropic.com.

### Google OAuth Credentials
Configured in two places:
1. **Google Cloud Console** (console.cloud.google.com → "Thermomix App" project):
   - Client ID and secret are in the OAuth 2.0 credentials section
   - Old secret `****GVJg` still exists (should be cleaned up)
2. **Supabase Auth** (Dashboard → Authentication → Providers → Google):
   - The same Client ID and secret from Google Cloud must be entered there
   - Callback URI: `https://dwnuqwysyxmiayfsxofk.supabase.co/auth/v1/callback`

### Supabase Dashboard Access
- **URL**: https://supabase.com/dashboard/project/dwnuqwysyxmiayfsxofk
- **Org**: ademas.ai
- **Login**: Use the Supabase account that owns the project
- **SQL Editor**: https://supabase.com/dashboard/project/dwnuqwysyxmiayfsxofk/sql/new

### Where to find/reset credentials if lost
| Credential | Where to get it |
|-----------|----------------|
| Supabase URL + anon key | Supabase Dashboard → Settings → API |
| Supabase service role key | Supabase Dashboard → Settings → API (keep secret!) |
| ANTHROPIC_API_KEY | console.anthropic.com → API Keys |
| Google OAuth Client ID | console.cloud.google.com → APIs & Services → Credentials |
| Google OAuth Client Secret | Same as above → edit the OAuth 2.0 client |
| Vercel env vars | vercel.com → Project → Settings → Environment Variables |

## Vercel

- **Project URL**: https://recepies-mu.vercel.app
- **Config** (`vercel.json`):
  - API routes: `/api/(.*)` → pass-through to serverless functions
  - All other routes: rewrite to `/` (SPA)
  - `generate-recipe.js`: 60-second max duration (safety margin for slow URL fetches)

## AI / Claude API

- **Model for generation**: `claude-sonnet-4-20250514` (no extended thinking — removed for speed)
- **Model for editing**: `claude-sonnet-4-20250514`
- **Model for inventory parsing**: `claude-haiku-4-5-20251001`
- **Input truncation**: Text input capped at 15000 chars, URL content at 12000 chars
- **Cost**: ~$0.01-0.03 per recipe generation (cheaper without thinking)
- **API key**: Stored in Vercel env vars

## Local Development

- **Node.js**: Installed via Homebrew at `/usr/local/bin`
- **Dev server**: `npm run dev` → Vite on `http://localhost:5173`
- **Build**: `npm run build`
- **`.npmrc`**: `legacy-peer-deps=true` (needed for Tailwind v4 + Vite 8)

## Task Board (Google Sheet + Apps Script API)

- **Sheet**: Recepies_App → https://docs.google.com/spreadsheets/d/1DOfub0rSA4pbwuVwT43OVPzrhBQUnIN1BKllFMZ9wZA
- **API URL**: `https://script.google.com/macros/s/AKfycbxsyeXkZ3ieFLWXJFrfBrLoYc-31glycOK_NcEEwQVkMajqGm_MxIVuAx4l3Rlj61ka/exec`
- **Purpose**: Shared task board between Claude.ai (phone) and Claude Code (Mac)
- **Note**: POST requests return a 302 redirect — extract the redirect URL and GET it for the JSON response

### API Endpoints
| Method | Params | Action |
|--------|--------|--------|
| GET | `?action=list` | List all tasks |
| GET | `?action=list&status=pending` | List pending tasks |
| GET | `?action=get&id=3` | Get single task |
| POST | `{"action":"add","task":"...","priority":"...","notes":"..."}` | Add task |
| POST | `{"action":"update","id":3,"status":"done"}` | Update task |
| POST | `{"action":"delete","id":3}` | Delete task |

## Legacy

- `legacy/` folder contains 3 original static HTML recipes (Mediterranean Lentil Soup, Spiced Vegetable Lentil Soup, Vegetarian Pho)
- These were the initial prototype before the React PWA
- Not yet migrated into the database
