# Changelog — Thermomix App

All notable changes, decisions, and work sessions documented here.

---

## 2026-03-18

### Redesign out-of-stock inventory items with three action buttons
- **Changed**: Out-of-stock items now have three separate 40x40 buttons: restock (green ✓), shop (🛒), delete (red ✕)
- **Added**: `restockItem()` function — moves item to in-stock and removes from shopping list if linked
- **Fixed**: Delete button now works on greyed-out items (was broken before)
- **Fixed**: Shopping cart button and delete button no longer overlap — proper spacing with gaps
- **Commit**: `80932c9`

### Paste support for images and documents in AddRecipe
- **Added**: `onPaste` handler on the textarea — pasting a copied image from clipboard adds it to photo previews, pasting a document adds its text to the input field
- **Changed**: Placeholder text updated to mention pasting
- **Commit**: `0daa18d`

### Allow all household members to edit and delete any household recipe
- **Changed**: RLS policies `recipes_update` and `recipes_delete` now use `get_my_household_member_ids()` — any household member can edit/delete any recipe in the household
- **Changed**: Removed `isCreator` check in RecipeDetail.jsx — Edit and Delete buttons show for all household members
- **Commit**: `ec30f49`

### Fix shopping Have/Need toggle, strip all quantities from inventory
- **Fixed**: Shopping list Have/Need is now a tappable toggle button (was a static div)
- **Changed**: All quantities removed from inventory — items are name-only status trackers
- **Changed**: Fresh count reset also clears linked shopping list entries and deselects items
- **Commit**: `3d16b4e`

### Inventory/Shopping sync overhaul
- **Changed**: Inventory out-of-stock items are now toggleable — tap to add to shopping, tap again to remove
- **Changed**: State syncs with actual `shopping_list` table via `source_inventory_id`, persists across sessions
- **Changed**: Shopping list inventory column → simple Have/Need indicator (no amounts to enter)
- **Changed**: Adding from shopping to inventory no longer copies quantities
- **Removed**: Inventory quantity editing from shopping list rows
- **Commit**: `9b83aba`

### Inventory out-of-stock UX + Shopping "Add all to inventory"
- **Changed**: Out-of-stock items now have a cart icon that turns accent color when added to shopping (stays visible, no timeout)
- **Added**: Delete (x) button on out-of-stock items to permanently remove them
- **Added**: "All to inventory" button in Shopping List Purchased section — moves all checked items to inventory at once
- **Commit**: `799b938`

### Inventory: AI quick-add auto-detects section
- **Changed**: AI quick-add now assigns items to the correct tab automatically (fresh/spices/household) based on what the item is
- **Changed**: Manual add simplified to just name + button, adds to active tab as fallback
- **Changed**: API prompt updated to exclude preparation instructions (no "quartered", "diced", etc.)
- **Commit**: `c558a90`

### Paste support for images and documents in AddRecipe
- **Added**: `onPaste` handler — pasting images from clipboard adds to photo previews, documents add text to input
- **Commit**: `0daa18d`

### All household members can edit/delete any recipe
- **Changed**: RLS policies `recipes_update` and `recipes_delete` now use `get_my_household_member_ids()` — any household member can edit/delete
- **Changed**: Removed `isCreator` check in RecipeDetail.jsx — Edit/Delete buttons show for everyone
- **Commit**: `ec30f49`

### Recipe-to-shopping comparison screen
- **Added**: When adding recipe ingredients to shopping list, a modal shows each ingredient with Need/Have columns
- **Added**: Items in stock are pre-marked as Skip, user can toggle any row
- **Added**: Only non-skipped items get added to shopping list
- **Commit**: `a44bf19`

### Inventory + Shopping List redesign (phase 2)
- **Changed**: Greyed-out inventory items no longer reactivate on tap — tap now adds to shopping list
- **Changed**: Shopping list check-off no longer auto-reactivates spice inventory items
- **Added**: "Add to inventory" button on each purchased shopping list item — reactivates linked inventory item or creates new one
- **Added**: Household tab in inventory for non-food items (toilet paper, soap, etc.) — `section='household'`
- **Commit**: `b399221`

### Inventory overhaul: tabs, stock states, fresh count, shopping cart integration
- **DB Migration**: Added `in_stock` (boolean), `section` (text: 'fresh'/'spices') columns to `inventory`, `source_inventory_id` (FK) to `shopping_list`
- **Added**: Fresh / Spices & Pantry tab navigation with item counts
- **Added**: In Stock / Not in Stock sections — items toggle between states, never deleted
- **Added**: X button marks items out of stock (clears qty), tapping grey item reactivates it
- **Added**: Cart icon on out-of-stock items (and active spice items) adds to shopping list with `source_inventory_id` link
- **Added**: "Start Fresh Count" button on Fresh tab — greys all fresh items for re-counting
- **Added**: AI fuzzy matching — dictated items match existing inventory before creating new ones (normalize names, depluralize)
- **Changed**: AI quick-add collapsed by default, manual add always visible
- **Added**: Auto-reactivate spice inventory items when checked off shopping list (purchased)
- **Migration script**: `scripts/migration-inventory-v2.sql`
- **Commits**: `39680a1`, `354768e`

### Allow all household members to edit and delete any recipe
- **Changed**: RLS policies `recipes_update` and `recipes_delete` now use `get_my_household_member_ids()` — any household member can edit/delete any household recipe
- **Changed**: Removed `isCreator` check in RecipeDetail.jsx — Edit and Delete buttons show for all household members
- **Commit**: `ec30f49`

### Paste support for images and documents in AddRecipe
- **Added**: `onPaste` handler on the textarea — pasting a copied image from clipboard adds it to photo previews, pasting a document adds its text to the input field
- **Changed**: Placeholder text updated to mention pasting
- **Commit**: `0daa18d`

### Speed up recipe generation, fix text paste error, add document upload
- **Fixed**: Removed extended thinking from Claude API call — was adding 10-20 seconds per recipe. Quality is the same without it.
- **Fixed**: Long text paste error — added 15000 char truncation on text input to prevent API/body size limits
- **Added**: Document upload (.pdf, .doc, .txt) in AddRecipe — documents are read as text and appended to the input field
- **Changed**: Upload button now says "Add photos or documents" and removed `capture` attribute so file picker shows gallery + camera on iPhone
- **Note**: Multiple photo upload was already working — no change needed
- **Commit**: `2de3121`

### Reusable project bootstrap skill
- **Created**: `docs/SKILL-project-bootstrap.md` — a complete template for setting up the same documentation + task board system on any new project
- **Self-improving**: Includes a meta-lessons section and self-improvement protocol that grows with each project
- **Commit**: `e639957`

### Strip prep instructions from copied shopping list
- **Changed**: When copying shopping list, remove prep words like "quartered", "cubed", "grated", "chopped", "sliced", "minced", "peeled", etc. from item names. "Potatoes, quartered" copies as just "Potatoes".
- **Commit**: `92f7eff`

### Shopping list copy: toast + WhatsApp-friendly format (Task #1)
- **Added**: Toast notification "Copied to clipboard" shown for 2 seconds after copying
- **Changed**: Copied text format from "name - quantity" to "quantity name" (e.g. "400g pasta", "1 bunch cilantro") — cleaner for WhatsApp pasting
- **Source**: First task from the Google Sheet task board (created via Claude.ai)
- **Commit**: `46cce4d`

---

## 2026-03-17

### Task board system (Google Sheet + Apps Script API)
- **Created**: Google Sheet "Recepies_App" with Apps Script web API for task management
- **Purpose**: Shared task board between Claude.ai (phone/web) and Claude Code (Mac)
- **API**: GET/POST endpoints for list, add, update, delete tasks
- **Sheet ID**: `1DOfub0rSA4pbwuVwT43OVPzrhBQUnIN1BKllFMZ9wZA`
- **Deployed**: Web app with "Anyone" access

### Project documentation system created
- **Created**: `CLAUDE.md` + `docs/` with 6 files (PROJECT, ARCHITECTURE, CHANGELOG, LESSONS, RULES, plus Apps Script and Claude.ai instructions)
- **Purpose**: Account-independent knowledge base — any Claude session reads it automatically
- **Commit**: `20256a8`, `fc57575`

### Household recipe permissions opened up
- **Changed**: All household members can now edit and delete any recipe in the household (not just the creator)
- **RLS**: Updated `recipes_update` and `recipes_delete` policies to use `get_my_household_member_ids()`
- **UI**: Removed `isCreator` check in RecipeDetail.jsx — Edit and Delete buttons show for all household members
- **Commit**: `ec30f49`

---

## 2026-03-16

### YouTube recipe generation fixed
- **Problem**: Generating recipe from YouTube URL returned "Could not parse recipe from AI response"
- **Root cause**: YouTube blocked the bot User-Agent, returning page title "- YouTube" with no content. AI received no useful info and returned a text explanation instead of JSON. Parser couldn't find JSON braces.
- **Fix**: Added oEmbed API (`youtube.com/oembed?url=...&format=json`) for reliable title extraction. Changed User-Agent to real browser string. When AI returns text instead of JSON, show the actual AI message to user instead of generic error.
- **Commit**: `00c21ba`

### Recipe delete verified and creator-only buttons
- **Problem**: Delete button existed but count check wasn't working properly in all cases
- **Fix**: Added `{ count: 'exact' }` to Supabase delete call. Added `isCreator` check to conditionally show Edit/Delete buttons (later removed on 2026-03-17 when permissions were opened to all household members).
- **Commit**: `543f4fd`

### Recipe delete support and household-scoped visibility
- **Problem**: No DELETE RLS policy existed on recipes table. Supabase silently blocked all deletes (returned `{ error: null }`). Also, recipes were visible to ALL users (`USING (true)`).
- **Fix**: Added `recipes_delete` RLS policy with `USING (created_by = auth.uid())`. Changed `recipes_select` to `USING (created_by = ANY(get_my_household_member_ids()))`. Changed `recipes_insert` to `WITH CHECK (created_by = auth.uid())`. Changed `recipes_update` to `USING (created_by = auth.uid())`.
- **Data isolation verified**: When user Aa was removed from household, their recipes disappeared from other members' views. When re-added, recipes reappeared.
- **Commit**: `0281dda`

### Household invite accept/decline fixed
- **Problem**: Accept/decline invite buttons weren't working. RLS on `household_members` DELETE had infinite recursion (self-referencing subquery).
- **Fix**: Changed `hm_delete` policy to `USING (user_id = auth.uid() OR household_id = get_my_household_id())`. Fixed error handling in `acceptInvite` and `declineInvite` in HouseholdContext.jsx.
- **Commit**: `ca121f3`

### Cancel invite and improved household delete
- Added cancel button for outgoing invites
- Improved deleteHousehold to properly clean up members and invites
- **Commit**: `1202a85`

### Household invite display fixes
- Fixed "You're Invited" section to only show incoming invites (not outgoing)
- Fixed household members display and outgoing invites rendering
- **Commits**: `ac7b126`, `162e9d3`

### Simplified household sharing
- Changed from invite codes to simple email-based sharing
- Enter an email address to share your household
- **Commit**: `066c319`

### Household creation, profile, and photo upload
- Fixed household creation flow
- Fixed profile display name save
- Fixed shop button on recipes
- Added photo upload for recipe generation
- **Commit**: `399cc61`

### Household sharing system
- Added full household sharing infrastructure
- HouseholdContext with create, invite, accept, decline, leave, remove
- Profile menu with user info, household, diet link
- InviteBanner component for pending invites
- **Commit**: `1c44c8c`

### Mobile optimization for iPhone Safari
- Safe area insets for notch and home indicator
- Touch optimizations (no tap highlight, proper button sizing)
- Full-height layouts using dvh units
- **Commit**: `b36e460`

### Extended thinking for AI recipes
- Enabled extended thinking in Claude API calls (5000 token budget)
- Fixed URL hallucination in recipe sources (AI was inventing URLs)
- Consistent AppHeader component across all pages
- **Commit**: `5152440`

### Shopping list visual redesign
- Visual-first display with category emoji grouping
- Per-row inventory math (have/need quantities)
- Fixed source URL hallucination in AI-generated recipes
- **Commit**: `6bb3aad`

### Shopping inventory column, AI recipe editor, measurements
- Added inventory column to shopping list
- AI recipe editor (inline modification via Claude)
- Delete recipe functionality (initial)
- Consistent measurement display across app
- **Commit**: `652a4be`

### Measurement badges, shopping tabs, AI inventory
- MeasurementBadges component (metric/imperial/visual estimates)
- Shopping list tabs (by ingredient vs by recipe)
- AI inventory parsing (natural language to structured items)
- App logo (ThermomixJar SVG)
- **Commit**: `6247afe`

### Shopping from recipe, inventory integration, portions
- Add-to-shopping-list from recipe detail
- Inventory integration with shopping (shows what you already have)
- Portion estimates for common ingredients
- Enhanced cooking mode editor
- **Commit**: `4379dc5`

### Simplified AddRecipe
- Removed manual recipe form (AI-only generation now)
- Removed appliance selector (defaults to Thermomix TM6)
- **Commit**: `3746e92`

---

## 2026-03-15

### AI recipe generation with Claude API
- Added Vercel serverless function calling Claude API
- Support for text, URL, and YouTube link input
- Structured JSON output matching database schema
- `.npmrc` with `legacy-peer-deps=true` for Vercel build compatibility
- **Commits**: `d790b6a`, `4dfa728`

### React PWA conversion
- Replaced static HTML site with Vite + React PWA
- Supabase integration for auth and data
- Google OAuth sign-in
- Full recipe CRUD
- Tailwind CSS v4 styling
- **Commit**: `6fe8bc3`

---

## 2026-03-03

### Design system and multi-recipe
- Unified design system v2: Thermomix jar icon, color-coded bowls (teal/copper)
- Timeline bars with 3 segments
- 1-bowl / 2-bowl toggle on all recipes
- Added Vegetarian Pho Chay recipe
- **Commits**: `38f7a02`, `efd395c`, `ca7348e`, `4108331`

---

## 2026-03-02

### Initial project
- Created index page and first recipe (Mediterranean Lentil Soup)
- Static HTML with TM6 two-bowl double batch support
- README with project description
- **Commits**: `d0e408b`, `5103660`
