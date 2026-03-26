# Thermomix App — Backup & Restoration Guide

**Backup date**: 2026-03-25
**Status**: Supabase project paused to free up slot. App offline until restored.
**Backup file**: `thermomix_backup_2026-03-25.sql` (in this same folder)

---

## Where Does This Project Live?

The Thermomix app has components spread across 7 services. Here's the full map:

| Service | What | URL / Location | Status |
|---|---|---|---|
| **GitHub** | Source code (React + Vite) | github.com/aauml/recepies | Intact, no action needed |
| **Supabase** | PostgreSQL database + Auth | Project `dwnuqwysyxmiayfsxofk` | **PAUSED** (backed up here) |
| **Vercel** | Hosting + serverless functions | recepies-mu.vercel.app | Deployed but broken (no DB) |
| **Google Drive** | Local repo clone + this backup | Folder "Thermomix App" | Synced |
| **Google Cloud Console** | OAuth 2.0 credentials | Project "Thermomix App" | Active (no cost) |
| **Google Sheets** | Task board + Apps Script API | Sheet "Recepies_App" | Active |
| **Anthropic Console** | Claude API key | console.anthropic.com | Active (key in Vercel env) |

### Vercel Details

- **Team**: ayalaax-6763s-projects (`team_PCfVDieErgkV66bd9jvNg32g`)
- **Project ID**: `prj_hdvB05jX5V7xRPMQxPA7DTtYAkwX`
- **Framework**: Vite
- **Node**: 24.x
- **Domains**: `recepies-mu.vercel.app`, `recepies-ayalaax-6763s-projects.vercel.app`, `recepies-git-main-ayalaax-6763s-projects.vercel.app`
- **Last deployment**: `dpl_BxWh4gv3xNZQDwjQG68pTtJZknxy` (production, READY)
- **Env vars to update on restore**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (if new Supabase project)
- **Env var that stays**: `ANTHROPIC_API_KEY` (Claude API, independent of Supabase)

### Google Cloud Console (OAuth)

- **Project**: "Thermomix App"
- **OAuth consent screen**: External, Testing mode, app name "My Thermomix"
- **Test users**: ayalaax@gmail.com
- **Callback URI**: `https://dwnuqwysyxmiayfsxofk.supabase.co/auth/v1/callback` (update if new Supabase project)
- **Site URL**: `https://recepies-mu.vercel.app`

### Google Sheets Task Board

- **Sheet**: [Recepies_App](https://docs.google.com/spreadsheets/d/1DOfub0rSA4pbwuVwT43OVPzrhBQUnIN1BKllFMZ9wZA)
- **Apps Script API**: See "Task Board" section below

### Supabase Credentials (for .env on restore)

```
VITE_SUPABASE_URL=https://dwnuqwysyxmiayfsxofk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bnVxd3lzeXhtaWF5ZnN4b2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzUyOTksImV4cCI6MjA4OTIxMTI5OX0.oyrpsewRcfemW3kLQYzknglLI-9PvvDpnFmq5Qh5Mh0
```
(Anon key is public/safe. If restoring to a NEW project, these values change.)

### AI Models Used

| Endpoint | Model | Purpose |
|---|---|---|
| `/api/generate-recipe` | claude-sonnet-4-20250514 | Recipe generation from text/URL/YouTube/photo |
| `/api/edit-recipe` | claude-sonnet-4-20250514 | Inline recipe modification |
| `/api/parse-inventory` | claude-haiku-4-5-20251001 | Natural language → structured inventory items |

---

## What Is This App?

Personal Thermomix TM6 recipe management PWA. Users paste text, URLs, YouTube links, or photos, and Claude AI generates structured Thermomix recipes with step-by-step cooking mode. Includes household sharing, inventory tracking, and shopping lists.

**Live URL (offline while paused)**: https://recepies-mu.vercel.app
**Repo**: github.com/aauml/recepies (code is intact, only DB is down)

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Vite 8 + React 19 + Tailwind CSS v4 | SPA, iPhone Safari optimized |
| Backend | Vercel serverless functions | `/api/generate-recipe`, `/api/edit-recipe`, `/api/parse-inventory` |
| AI | Claude Sonnet 4 (Anthropic API) | Recipe generation, inventory parsing |
| Database | Supabase (PostgreSQL + Auth + RLS) | **This is what's backed up** |
| Auth | Google OAuth via Supabase | Users: Arturo, Art Cx, Rodolfo, Lisbeth |
| Hosting | Vercel free plan | Auto-deploy from `main` branch |

## What's in the Backup SQL

The file `thermomix_backup_2026-03-25.sql` contains **everything** needed to recreate the database:

1. **9 tables** (with DROP IF EXISTS, safe to run on fresh or existing DB):
   - `profiles` — 4 users
   - `households` — 2 households
   - `household_members` — 2 members
   - `household_invites` — 2 invites (both accepted)
   - `recipes` — 13 recipes with full JSONB (ingredients, steps, nutrition for 1-bowl and 2-bowl)
   - `inventory` — 58 pantry items (fresh, spices, household sections)
   - `cook_log` — 1 entry
   - `recipe_notes` — empty
   - `shopping_list` — 1 item

2. **3 helper functions**:
   - `get_my_household_id()` — returns user's household UUID
   - `get_my_household_member_ids()` — returns all household member UUIDs (used by RLS)
   - `handle_new_user()` — trigger that auto-creates profile on signup

3. **RLS policies** — 33 policies across all 9 tables, household-scoped

4. **All data** as INSERT statements

## How to Restore

### Option A: Restore the Paused Project (easiest)

1. Go to https://supabase.com/dashboard
2. Find the paused "Thermomix" project
3. Click "Restore" — data is still intact
4. App comes back online automatically, nothing else to change

### Option B: New Supabase Project

If the paused project is gone or you want a fresh start:

**Step 1 — Database:**
1. Create a new Supabase project (free tier, any region)
2. Go to SQL Editor in the dashboard
3. Paste the entire contents of `thermomix_backup_2026-03-25.sql` and run it
4. Create the auth trigger:
   ```sql
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

**Step 2 — Supabase Auth:**
5. Enable Google OAuth in Supabase (Authentication > Providers > Google)
6. Copy the Client ID and Secret from Google Cloud Console (see below)
7. Note the new callback URI: `https://<new-ref>.supabase.co/auth/v1/callback`

**Step 3 — Google Cloud Console:**
8. Go to console.cloud.google.com → project "Thermomix App" → APIs & Services → Credentials
9. Edit the OAuth 2.0 client
10. Update the Authorized redirect URI to the new Supabase callback URL
11. If in Testing mode, verify test users are still listed

**Step 4 — Vercel:**
12. Go to vercel.com → project "recepies" → Settings → Environment Variables
13. Update `VITE_SUPABASE_URL` → new project URL
14. Update `VITE_SUPABASE_ANON_KEY` → new anon key (find in Supabase Dashboard → Settings → API)
15. `ANTHROPIC_API_KEY` stays the same (not tied to Supabase)
16. Trigger a redeploy: go to Deployments → latest → Redeploy

**Step 5 — Code (if needed):**
17. Check `src/lib/supabase.js` — if credentials are hardcoded there instead of using env vars, update them
18. Push to GitHub → Vercel auto-deploys

**Step 6 — Verify:**
19. Open https://recepies-mu.vercel.app
20. Sign in with Google
21. Confirm recipes, inventory, and shopping list are visible
22. Test recipe generation (needs Claude API key working)

### Option C: Neon or Other PostgreSQL Host

1. Create a Neon free-tier project (or Railway, etc.)
2. Run the SQL backup against the new database
3. You'll lose Supabase Auth — need to implement auth separately (e.g., Clerk, Auth.js)
4. Update all Supabase client calls in the frontend to use a generic PostgreSQL client
5. Update Vercel env vars to point to the new DB
6. This is significantly more work — only do it if Supabase is no longer an option

## Important Configuration

### Environment Variables (Vercel)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + `.env` | Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel + `.env` | Supabase anonymous key |
| `ANTHROPIC_API_KEY` | Vercel only | Claude API for recipe generation |

### Google OAuth Setup

- Google Cloud Console project with OAuth 2.0 credentials
- Authorized redirect URI: `https://<supabase-ref>.supabase.co/auth/v1/callback`
- Scopes: email, profile

### Vercel Project

- Project name: `recepies`
- Connected to: `aauml/recepies` on GitHub
- Auto-deploy on push to `main`
- Serverless functions in `/api/` directory
- `maxDuration: 60` in `vercel.json` for recipe generation timeout

## Key Design Decisions

- **Vegetarian only** — all AI-generated recipes exclude meat, fish, gelatin. Eggs and dairy OK.
- **Household scoping** — all data (recipes, inventory, shopping) is shared within a household via RLS. No frontend filtering needed.
- **Inventory is persistent** — items are never deleted, just toggled in/out of stock. Over time it becomes a complete template of what the household buys.
- **No extended thinking** — Claude Sonnet generates structured JSON just as well without it, saving 10-20s per recipe.
- **iPhone Safari first** — safe area insets, dvh units, touch-optimized interactions.

## Known Gotchas (Read Before Working)

1. **npm fails in "My Drive" path** — spaces in the path break npm. Use `/tmp` worktree for any npm operations.
2. **Supabase CLI DNS fails** — use the Supabase dashboard (browser) for all SQL and auth operations.
3. **Supabase `.delete()` silently fails** when RLS blocks — always use `{ count: 'exact' }`.
4. **Google Apps Script POST returns 302** — extract the Location header, then GET that URL for the JSON response.
5. **YouTube blocks bot User-Agents** — use oEmbed API for title extraction.
6. **Auth users are in `auth.users`** — the backup only covers `public.*` tables. User accounts live in Supabase Auth and will need to be recreated or users will need to sign up again.

## Task Board

Google Sheet with Apps Script API for managing tasks between Claude sessions:

```
GET  https://script.google.com/macros/s/AKfycbxsyeXkZ3ieFLWXJFrfBrLoYc-31glycOK_NcEEwQVkMajqGm_MxIVuAx4l3Rlj61ka/exec?action=list&status=pending
POST https://script.google.com/macros/s/AKfycbxsyeXkZ3ieFLWXJFrfBrLoYc-31glycOK_NcEEwQVkMajqGm_MxIVuAx4l3Rlj61ka/exec
     {"action": "update", "id": <ID>, "status": "done", "notes": "..."}
```

## File Structure (Key Files)

```
/
├── api/
│   ├── generate-recipe.js      # Claude AI recipe generation
│   ├── edit-recipe.js          # Claude AI recipe editing
│   └── parse-inventory.js      # Claude AI inventory parsing
├── src/
│   ├── App.jsx                 # Router + Auth + Household providers
│   ├── contexts/
│   │   ├── AuthContext.jsx     # Google OAuth state
│   │   └── HouseholdContext.jsx # Household sharing logic
│   ├── lib/
│   │   └── supabase.js         # Supabase client init (UPDATE THIS on restore)
│   └── components/             # All UI components
├── docs/
│   ├── PROJECT.md              # Services, credentials, config
│   ├── ARCHITECTURE.md         # System diagram, file structure
│   ├── CHANGELOG.md            # Full development history
│   ├── LESSONS.md              # Known gotchas and patterns
│   └── RULES.md                # Coding conventions, constraints
├── thermomix_backup_2026-03-25.sql  # THIS BACKUP
└── THERMOMIX_BACKUP_README.md       # THIS FILE
```

## Development History (Summary)

| Date | Milestone |
|---|---|
| 2026-03-02 | Initial static HTML site, first recipe |
| 2026-03-03 | Design system, 1-bowl/2-bowl toggle |
| 2026-03-15 | React PWA conversion, Supabase, Claude AI generation |
| 2026-03-16 | Google OAuth, household sharing, shopping lists, inventory |
| 2026-03-17 | Task board, docs system, permission fixes |
| 2026-03-18 | Inventory overhaul, AI categorization, paste support, copy formatting |
| 2026-03-25 | **Project paused** — DB backed up, Supabase slot freed |

## Users at Time of Backup

| Name | Email | Role |
|---|---|---|
| Art Cx | ayalaax@gmail.com | Household owner (household 1) |
| Arturo | artcx@protonmail.com | Household owner (household 2) |
| Rodolfo Arpia | (Google OAuth) | User |
| Lisbeth | l.nelsonayala@yahoo.com | Household 2 member |
