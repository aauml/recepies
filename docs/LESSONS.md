# Lessons Learned — Thermomix App

Hard-won knowledge from debugging, failures, and surprises. Read this before starting work to avoid repeating past mistakes.

---

## Environment & Tooling

### Local project is a git clone on Google Drive
- `~/My Drive/Thermomix App` is just a local clone of the GitHub repo, synced via Google Drive.
- **GitHub is the single source of truth.** If this folder is lost, just `git clone` the repo again anywhere.
- Nothing unique lives only locally — the `.env` file would need to be recreated, but values are in `docs/PROJECT.md`.

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

### Google Apps Script POST requests redirect
- **Problem**: POST to Apps Script web app URL returns a 302 redirect. `curl -L` follows the redirect but loses the POST body, resulting in "Page Not Found".
- **Solution**: Don't use `-L`. Instead, extract the `Location` header from the 302 response, then do a separate GET to that URL to receive the JSON response.
- **Example**: `curl -s -X POST "$URL" -H "Content-Type: application/json" -d '...' -D - -o /dev/null 2>/dev/null | grep -i location` → then `curl -s "$REDIRECT_URL"`

---

## Supabase & RLS

### Supabase .delete() silently fails when RLS blocks
- **Problem**: When RLS prevents a DELETE, Supabase returns `{ error: null, data: null }` — no error! The delete just doesn't happen.
- **Solution**: Always use `{ count: 'exact' }` option: `supabase.from('table').delete({ count: 'exact' }).eq('id', id)` then check `if (count === 0)` to detect blocked deletes.
- **This applies to all tables with RLS** — not just recipes.

### Inventory items should never be deleted — use in_stock toggle
- **Design decision**: Inventory items are persistent templates. The X button sets `in_stock = false` and clears quantity, but does NOT delete from the database.
- **Why**: Over time the inventory grows into a complete template of everything the household buys. Greyed-out items become quick-add targets during the next count.
- **Spice lifecycle**: active → tap cart → greyed + on shopping list → buy → check off → auto-reactivated in inventory.

### AI fuzzy matching for inventory — normalize and depluralize
- **Problem**: When user dictates "3 onions", the AI creates a new item instead of matching existing "Onion".
- **Solution**: Normalize both names: lowercase, trim, remove trailing 's' for plurals. Match against existing items before inserting new ones.
- **Edge case**: More complex plurals (potatoes→potato) need smarter matching. Could enhance by passing existing item names to the AI prompt.

### Don't auto-sync inventory — let the user decide
- **Design decision**: Originally spice items auto-reactivated in inventory when checked off the shopping list. This was changed to require explicit "Add to inventory" action.
- **Why**: Auto-sync can create phantom inventory (item checked off but not actually put away). The user should decide when something enters inventory.
- **Pattern**: Purchased items stay in a Purchased section until user explicitly taps "Add to inventory".

### Recipe-to-shopping comparison prevents over-buying
- **Design decision**: Instead of blindly adding all recipe ingredients to the shopping list, show a comparison screen with inventory quantities.
- **Why**: Users complained about buying items they already had. The comparison lets them skip in-stock items with one tap.
- **Important**: Don't try to auto-calculate "need" amounts by subtracting inventory. Units are incompatible (recipe says "3 cloves", inventory says "1 head"). Just show both and let the user decide.

### Backfill section based on category has edge cases
- **Problem**: Items like "Bay leaves" had `category=other` but should be in `section=spices`. The automatic backfill only moved `category IN ('spices', 'pantry')`.
- **Solution**: After migration, manually fix miscategorized items. Consider having the AI assign section when adding new items.

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

### Shopping list copy should be human-friendly
- **Problem**: Copied shopping list included prep instructions ("Potatoes, quartered", "Carrots, grated") which are irrelevant for a grocery list shared via WhatsApp.
- **Solution**: Strip prep words (quartered, cubed, grated, chopped, sliced, minced, peeled, diced, etc.) using regex on the item name before adding to clipboard text. Also format as "quantity name" not "name - quantity" for cleaner reading.
- **Pattern**: Prep instructions come after a comma in ingredient names. The regex matches `, followed by prep word` and strips everything after.

### Safe area insets for iPhone
- Use `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)` for the notch and home indicator.
- `min-h-dvh` instead of `min-h-screen` for proper mobile viewport.
- TabBar needs bottom safe area padding.
- AppHeader needs top safe area padding.

### Wake lock for cooking mode
- CookingMode.jsx uses the Screen Wake Lock API to prevent screen sleep during cooking.
- Must be requested in response to a user gesture.
- Release on component unmount.

### Clipboard paste on iPhone requires onPaste handler
- **Problem**: Copying an image or document on iPhone and pasting into a textarea does nothing by default — the browser only pastes text.
- **Solution**: Add `onPaste` event handler that checks `e.clipboardData.items` for files (`kind === 'file'`). Images get read as base64, documents as text. Only `preventDefault()` when files are found — regular text paste still works.
- **Pattern**: Always handle paste events explicitly when you want to accept non-text clipboard content.

### AI section auto-detection for inventory items
- **Pattern**: When building an AI-powered categorizer, include clear section definitions with examples in the system prompt. The AI reliably maps "toilet paper" → household, "cucumbers" → fresh, "cumin" → spices.
- **Lesson**: Don't hard-code the section from the active tab — let the AI decide per item. Keep manual add as a simple fallback for edge cases.
- **Lesson**: Exclude preparation instructions ("quartered", "diced") from inventory item names — they don't belong in a stock tracker.

### Extended thinking adds latency without quality gain for structured JSON
- **Problem**: Recipe generation was slow (30-40s). Extended thinking (5000 token budget) added 10-20s.
- **Solution**: Removed `thinking: { type: 'enabled', budget_tokens: 5000 }` from the API call. Recipe quality is the same — Claude Sonnet generates good structured JSON without needing to "think first."
- **Pattern**: Only use extended thinking when the task genuinely benefits from reasoning (complex logic, math). For structured output generation, it's overhead.

### Long text input can exceed API/body limits
- **Problem**: Pasting a full recipe text into the input field caused errors — the request body was too large.
- **Solution**: Truncate text input to 15000 characters with `.slice(0, 15000)`. URLs already had truncation (12000 for HTML, 15000 for transcripts), but raw text didn't.
- **Pattern**: Always truncate user input before sending to AI APIs.

### Supabase auth state
- Use `onAuthStateChange` listener in AuthContext to stay synced.
- Don't rely on `getSession()` alone — it can be stale.

---

## Vercel

### Serverless function timeout
- Default timeout is 10 seconds on free plan.
- Recipe generation (without extended thinking) typically takes 10-20 seconds, but URL fetches can be slow.
- Set `maxDuration: 60` in `vercel.json` for the generate-recipe function as safety margin.
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
