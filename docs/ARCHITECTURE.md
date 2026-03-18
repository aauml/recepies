# Architecture — Thermomix App

## System Diagram

```
User (iPhone Safari)
    │
    ▼
┌─────────────────────────────────┐
│  Vercel (recepies-mu.vercel.app)│
│                                 │
│  ┌───────────────┐              │
│  │ Vite + React  │ ← SPA       │
│  │ (static build)│              │
│  └───────┬───────┘              │
│          │                      │
│  ┌───────▼───────────────┐      │
│  │ Serverless Functions  │      │
│  │ /api/generate-recipe  │──────┼──► Claude API (Anthropic)
│  │ /api/edit-recipe      │──────┼──► Claude API
│  │ /api/parse-inventory  │──────┼──► Claude API
│  └───────────────────────┘      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Supabase                       │
│  (dwnuqwysyxmiayfsxofk)        │
│                                 │
│  ┌──────────┐  ┌──────────────┐ │
│  │ Auth     │  │ PostgreSQL   │ │
│  │ (Google  │  │ + RLS        │ │
│  │  OAuth)  │  │              │ │
│  └──────────┘  └──────────────┘ │
└─────────────────────────────────┘
```

## Frontend Structure

```
src/
├── main.jsx                    # Entry point, renders App
├── App.jsx                     # Router + Auth + Household providers
├── index.css                   # Tailwind v4 theme (@theme block)
│
├── contexts/
│   ├── AuthContext.jsx          # Google OAuth, user state
│   └── HouseholdContext.jsx     # Household members, invites, sharing
│
├── lib/
│   ├── supabase.js              # Supabase client init
│   └── portions.jsx             # Measurement conversion + visual estimates
│
├── components/
│   ├── AppHeader.jsx            # Reusable page header with TM6 logo
│   ├── TabBar.jsx               # Bottom nav (Recipes, Shopping, Inventory, History)
│   ├── ProfileMenu.jsx          # Bottom sheet: name edit, household, diet, logout
│   ├── InviteBanner.jsx         # Pending household invite accept/decline banner
│   └── ThermomixJar.jsx         # SVG Thermomix blender icon
│
└── pages/
    ├── Login.jsx                # Google OAuth + email login/signup
    ├── Recipes.jsx              # Recipe list with search + tag filter
    ├── AddRecipe.jsx            # AI recipe generation (text/URL/YouTube/photos/documents)
    ├── RecipeDetail.jsx         # Full recipe view + AI edit + delete
    ├── EditRecipe.jsx           # Manual recipe editor (all fields)
    ├── CookingMode.jsx          # Step-by-step dark cooking UI + wake lock
    ├── ShoppingList.jsx         # Shopping list with inventory matching + WhatsApp copy
    ├── Inventory.jsx            # Inventory with Fresh/Spices tabs, in-stock/out-of-stock toggle, cart, fresh count
    ├── History.jsx              # Cook log with ratings
    ├── Household.jsx            # Household management + invites
    └── DietPreferences.jsx      # Dietary toggles (vegetarian, vegan, etc.)
```

## Routes

| Path | Page | Tab Bar | Description |
|------|------|---------|-------------|
| `/` | redirect | — | Redirects to /recipes |
| `/recipes` | Recipes | Yes | Recipe list |
| `/recipes/new` | AddRecipe | Yes | AI recipe creation |
| `/recipes/:id` | RecipeDetail | Yes | View recipe + edit/delete |
| `/recipes/:id/edit` | EditRecipe | Yes | Manual recipe editor |
| `/recipes/:id/cook` | CookingMode | **No** | Full-screen cooking |
| `/shopping` | ShoppingList | Yes | Shopping list |
| `/inventory` | Inventory | Yes | Pantry tracker |
| `/history` | History | Yes | Cook history |
| `/household` | Household | Yes | Household sharing |
| `/diet` | DietPreferences | Yes | Diet settings |

## API Endpoints (Vercel Serverless)

### POST /api/generate-recipe
- **Input**: `{ input: string (max 15000 chars), images?: base64[], appliance?: string }`
- **Process**: Detects URL/YouTube/text → fetches content → Claude generates structured recipe
- **YouTube handling**: oEmbed API for title, HTML fetch for captions
- **Output**: Full recipe JSON (title, description, ingredients_1bowl/2bowl, steps_1bowl/2bowl, nutrition, etc.)
- **Model**: Claude Sonnet 4 (no extended thinking)
- **Timeout**: 60 seconds

### POST /api/edit-recipe
- **Input**: `{ recipe: object, instruction: string }`
- **Process**: Claude modifies existing recipe based on instruction
- **Output**: Updated recipe JSON (data fields only, no DB metadata)
- **Model**: Claude Sonnet 4

### POST /api/parse-inventory
- **Input**: `{ text: string }`
- **Process**: Claude Haiku parses natural language into structured items
- **Output**: `{ items: [{ name, quantity, category }] }`
- **Model**: Claude Haiku 4.5

## Data Flow

### Recipe Generation
```
User enters text/URL/YouTube link
    → AddRecipe.jsx calls POST /api/generate-recipe
    → Serverless function fetches URL content (if applicable)
    → Claude API generates structured JSON recipe
    → Preview shown to user
    → User clicks Save
    → Supabase INSERT into recipes (created_by = user.id)
    → Navigate to recipe detail
```

### Recipe Editing (AI)
```
User types instruction in RecipeDetail.jsx
    → POST /api/edit-recipe with full recipe + instruction
    → Claude modifies recipe
    → Supabase UPDATE recipes WHERE id = recipe.id
    → UI refreshes with updated data
```

### Household Sharing
```
Owner creates household (or auto-created on first invite)
    → Owner invites by email
    → Invited user sees InviteBanner on Recipes page
    → Accept: join household, leave old one
    → RLS function get_my_household_member_ids() returns all member UUIDs
    → All queries automatically scoped to household via RLS
    → Recipes, shopping, inventory, cook_log, notes: all shared
```

### Cooking Mode
```
User taps "Cook this recipe" on RecipeDetail
    → CookingMode.jsx loads with dark theme
    → Wake lock activated (screen stays on)
    → Step-by-step navigation with swipe
    → Speed/temp/time displayed in circular rings
    → On finish: rate (1-5 stars) + optional feedback
    → Cook log entry saved to Supabase
```

## Styling System

Tailwind CSS v4 with custom theme defined in `src/index.css` using `@theme` block:

### Color Palette
- **Warm theme** (default): cream bg (#f5f0e8), terracotta accent (#b8622e), teal green (#2e7d6f), dark brown text (#2c2420)
- **Dark theme** (cooking mode): dark bg (#1a1a1a), green accent (#4CAF50), high contrast
- **Bowl 1**: teal (#2e7d6f)
- **Bowl 2**: copper/orange-red (#c0562b)

### Key Design Patterns
- Safe area insets for iPhone notch/home indicator
- No tap highlight on iOS
- Hidden scrollbars
- Slide-up animations for modals
- Bottom sheet pattern for ProfileMenu
- Circular progress rings in CookingMode

## Authentication Flow

```
Login.jsx
    → signInWithGoogle() (Supabase Auth)
    → Google OAuth consent screen
    → Redirect to Supabase callback
    → Supabase creates auth.users entry
    → handle_new_user() trigger creates profiles row
    → AuthContext.jsx detects onAuthStateChange
    → user state set → app renders
```

## Measurement System (portions.jsx)

Converts between three measurement formats:
1. **Metric** (primary): grams, ml
2. **Imperial**: oz, lbs, cups, fl oz, tsp, tbsp
3. **Visual estimates**: "1 medium onion", "2 cloves garlic", etc.

The ESTIMATES array maps ~40 common ingredient names to typical weights. MeasurementBadges component renders inline badges in recipe views.
