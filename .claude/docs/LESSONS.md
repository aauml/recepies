# Lessons Learned — Thermomix App

Hard-won knowledge from debugging, failures, and surprises. Read this before starting work to avoid repeating past mistakes.

---

## Environment & Tooling

### Local project is a git clone on Google Drive
- `~/My Drive/Thermomix App` is just a local clone of the GitHub repo, synced via Google Drive.
- **GitHub is the single source of truth.** If this folder is lost, just `git clone` the repo again anywhere.
- Nothing unique lives only locally — the `.env` file would need to be recreated, but values are in `.claude/docs/PROJECT.md`.

### npm fails in "My Drive" path
- **Problem**: The project lives in `~/My Drive/Thermomix App` (Google Drive). The spaces in the path cause npm commands to fail.
- **Workaround**: Use a `/tmp` worktree for any npm operations (install, build).
- **Vercel builds work fine** — Vercel clones the repo to its own path.

### DNS to supabase.co fails from CLI
- **Problem**: `curl`, `supabase CLI`, and other CLI tools cannot resolve `supabase.co` from this machine.
- **Workaround**: Use Chrome MCP (browser automation) to access the Supabase dashboard and SQL Editor for all database operations.
- **The Supabase JS client works fine** from the browser and from Vercel functions — only CLI DNS is affected.

### Tailwind CSS v4 is different
- **No `tailwind.config.js`** — Tailwind v4 uses `@theme` block inside CSS (`src/index.css`)
- **Plugin**: `@tailwindcss/vite` is the correct plugin for Vite integration
- **Peer deps**: Required `--legacy-peer-deps` when installing with Vite 8

### Node.js location
- Installed via Homebrew at `/usr/local/bin`
- This matters when scripts need to reference the node binary path

---

## Supabase & RLS

### Supabase .delete() silently fails when RLS blocks
- **Problem**: When RLS prevents a DELETE, Supabase returns `{ error: null, data: null }` — no error! The delete just doesn't happen.
- **Solution**: Always use `{ count: 'exact' }` option: `supabase.from('table').delete({ count: 'exact' }).eq('id', id)` then check `if (count === 0)` to detect blocked deletes.
- **This applies to all tables with RLS** — not just recipes.

### RLS self-referencing subqueries cause infinite recursion
- **Problem**: A DELETE policy on `household_members` that queried `household_members` in its own USING clause caused infinite recursion.
- **Solution**: Use helper functions (`get_my_household_id()`, `get_my_household_member_ids()`) that are `SECURITY DEFINER` to avoid the circular dependency. These functions bypass RLS.

### Missing RLS policies = silent access denial
- **Problem**: If a table has RLS enabled but no policy for a specific operation (e.g., DELETE), all attempts to perform that operation silently fail with no error.
- **Solution**: Always verify that all four operations (SELECT, INSERT, UPDATE, DELETE) have policies when RLS is enabled. Check with: `SELECT * FROM pg_policies WHERE tablename = 'your_table';`

### SECURITY DEFINER functions
- Functions like `get_my_household_member_ids()` must be `SECURITY DEFINER` so they can query `household_members` without being blocked by RLS on that table.
- Mark them `STABLE` for query optimization (they don't modify data).

### RLS policy changes take effect immediately
- No restart or deploy needed. Changed a policy in SQL Editor? It's live instantly.
- Be careful with policy changes on production data.

### Duplicate household data
- User can end up as owner of multiple households if creation logic runs twice or error handling doesn't prevent it.
- Always check for existing household membership before creating a new one.
- Cleanup: DELETE from households and household_members for the duplicate.

---

## YouTube / URL Recipe Generation

### YouTube blocks bot User-Agents
- **Problem**: Fetching YouTube pages with a generic or bot User-Agent returns minimal HTML with title "- YouTube" and no useful content.
- **Solution**: Use YouTube oEmbed API (`youtube.com/oembed?url=...&format=json`) for reliable title extraction. Also set a real browser User-Agent string for any direct page fetches.

### AI returns text instead of JSON
- **Problem**: When the AI doesn't have enough information to generate a recipe (e.g., YouTube title was "- YouTube"), it returns a text explanation like "I cannot generate a recipe..." instead of JSON.
- **Solution**: The parser looks for `{` in the response. If not found, show the AI's actual text message to the user (first 300 chars) instead of a generic "Could not parse" error.

### Source URL hallucination
- **Problem**: Claude would sometimes invent URLs that don't exist when generating the `source_urls` field.
- **Solution**: System prompt now explicitly says: "source_urls: ONLY include URLs the user provided. NEVER invent or guess URLs."

---

## Frontend / React

### Safe area insets for iPhone
- Use `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)` for the notch and home indicator.
- `min-h-dvh` instead of `min-h-screen` for proper mobile viewport.
- TabBar needs bottom safe area padding.
- AppHeader needs top safe area padding.

### Wake lock for cooking mode
- CookingMode.jsx uses the Screen Wake Lock API to prevent screen sleep during cooking.
- Must be requested in response to a user gesture.
- Release on component unmount.

### Supabase auth state
- Use `onAuthStateChange` listener in AuthContext to stay synced.
- Don't rely on `getSession()` alone — it can be stale.

---

## Vercel

### Serverless function timeout
- Default timeout is 10 seconds on free plan.
- Recipe generation with extended thinking needs up to 60 seconds.
- Set `maxDuration: 60` in `vercel.json` for the generate-recipe function.
- Free plan allows up to 60 seconds max.

### Environment variables
- `ANTHROPIC_API_KEY` must be set in Vercel project settings, not in `.env`.
- `.env` is for frontend Supabase credentials only (VITE_ prefixed).

---

## General Patterns

### Recipe JSON schema is complex
- Recipes have parallel 1-bowl and 2-bowl versions: `ingredients_1bowl`/`ingredients_2bowl`, `steps_1bowl`/`steps_2bowl`, `servings_1bowl`/`servings_2bowl`, `time_1bowl`/`time_2bowl`.
- Ingredients are grouped: `[{ group: "Base", items: [{ name, qty, unit, category, estimate }] }]`
- Steps have Thermomix-specific fields: `{ action, detail, temp, speed, time, reverse, accessories, ingredients, note }`
- Both the generate and edit API prompts must enforce this exact schema.

### Household scoping is automatic via RLS
- Once `get_my_household_member_ids()` is used in a policy, all queries are automatically scoped.
- No frontend code changes needed — just `supabase.from('recipes').select('*')` returns only household recipes.
- When a user leaves a household, their data immediately becomes invisible to former household members (and vice versa).
