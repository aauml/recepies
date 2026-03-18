# Rules — Thermomix App

User preferences, coding conventions, and constraints that must be followed in all work.

---

## User Profile

- **Name**: Arturo
- **Role**: Non-technical product owner. Does not write code — all development via Claude.
- **Primary device**: iPhone with Safari
- **Email**: ayalaax@gmail.com
- **Diet**: Vegetarian (no meat, no fish, no gelatin. Eggs and dairy are OK.)

## Hard Rules

1. **All UI text in English** — no Spanish, no other languages in the interface
2. **Vegetarian only** — all AI-generated recipes must be vegetarian by default. No meat, fish, or gelatin. Eggs and dairy are acceptable.
3. **Free tier only** — stay within Vercel free plan and Supabase free plan limits. Do not suggest paid features or services.
4. **iPhone Safari first** — all layouts and interactions must work perfectly on iPhone Safari. Test with safe area insets, dvh units, touch interactions.
5. **No manual code from user** — the user will never write or edit code directly. All changes are made by Claude through the code tools.

## Coding Conventions

### Frontend
- **React functional components** with hooks (no class components)
- **Tailwind CSS v4** for all styling (no inline styles, no CSS modules)
- **Theme colors** defined in `@theme` block in `src/index.css` — use semantic names (`warm-bg`, `accent`, `warm-text`, etc.)
- **No external UI libraries** — all components are custom-built with Tailwind
- **State management** via React Context (AuthContext, HouseholdContext) — no Redux or other state libs
- **Supabase client** imported from `src/lib/supabase.js`

### API Functions
- **Vercel serverless functions** in `api/` directory
- **Claude API** via `@anthropic-ai/sdk` package
- **Always return JSON** responses with proper error handling
- **Recipe generation** uses Claude Sonnet 4 (no extended thinking — removed for speed)
- **System prompts** must include vegetarian constraint and source URL rules

### Database
- **RLS on everything** — never disable RLS
- **Household scoping** via `get_my_household_member_ids()` function
- **Always check for missing policies** — all four operations (SELECT, INSERT, UPDATE, DELETE) must have policies
- **Use `{ count: 'exact' }` on delete** to verify the delete actually happened

### Recipe Data Schema
All recipes must follow this exact JSON structure:
```json
{
  "title": "string",
  "description": "string",
  "servings_1bowl": "string",
  "servings_2bowl": "string",
  "time_1bowl": "string",
  "time_2bowl": "string",
  "tags": ["string"],
  "thumbnail_emoji": "string",
  "source_urls": ["string (only user-provided URLs, never invented)"],
  "ingredients_1bowl": [{ "group": "string", "items": [{ "name": "string", "qty": "string", "unit": "string", "category": "string", "estimate": "string" }] }],
  "ingredients_2bowl": "same structure, quantities doubled",
  "steps_1bowl": [{ "action": "string", "detail": "string", "temp": "string", "speed": "string", "time": "string", "reverse": "boolean", "accessories": ["string"], "ingredients": [{ "name": "string", "qty": "string" }], "note": "string" }],
  "steps_2bowl": "same structure, quantities doubled",
  "nutrition": { "calories": "string", "protein": "string", "carbs": "string", "fat": "string", "fiber": "string" },
  "insulin_load": "number 1-5"
}
```

### Thermomix TM6 Constraints
- Speed: 1-10 or Turbo
- Temperature: 37°C to Varoma (~120°C)
- Max bowl capacity: 2.2L (~1.5L when heating)
- Speed ≤4 when using butterfly whisk
- Speed ≤6 at Varoma temperature
- Reverse mode: slower mixing, for delicate ingredients
- Accessories: butterfly whisk, steaming basket, Varoma, spatula

### Shopping List Copy Rules
- Copied text must be WhatsApp-friendly: plain text, one item per line
- Format: "quantity name" (e.g. "400g pasta"), not "name - quantity"
- Strip prep instructions (quartered, cubed, grated, chopped, sliced, etc.) — only the ingredient name matters for shopping
- Skip items fully covered by inventory
- Show toast confirmation after copy

## Workflow Rules

1. **Read docs first** — always read `docs/` files before starting work
2. **Update ALL relevant docs** — after any work, update CHANGELOG, LESSONS, and any other docs that changed (PROJECT, ARCHITECTURE, RULES). Don't wait to be asked.
3. **Mark tasks done** — if the work came from the Google Sheet task board, mark it done via the API
4. **Supabase via browser** — use Chrome MCP for all Supabase dashboard operations (SQL Editor, table view, auth settings). CLI DNS fails.
5. **npm via /tmp** — use `/tmp` worktree for any npm operations. The "My Drive" path with spaces breaks npm.
6. **Commit and push** — after completing work, commit to main and push. Vercel auto-deploys.
7. **Test on live** — after deploy, verify changes on https://recepies-mu.vercel.app
