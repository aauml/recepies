import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iqqxhsbztanzpgesjwni.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SQL = `
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  servings_1bowl TEXT,
  servings_2bowl TEXT,
  time_1bowl TEXT,
  time_2bowl TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  source_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  thumbnail_emoji TEXT DEFAULT '🍽',
  ingredients_1bowl JSONB,
  ingredients_2bowl JSONB,
  steps_1bowl JSONB,
  steps_2bowl JSONB,
  nutrition JSONB,
  insulin_load INT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cook log
CREATE TABLE IF NOT EXISTS cook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  cooked_at TIMESTAMPTZ DEFAULT now(),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  bowl_mode INT DEFAULT 1
);

-- Recipe notes
CREATE TABLE IF NOT EXISTS recipe_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  step_index INT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shopping list
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  item_name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  checked BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  item_name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
`

// supabase-js doesn't support raw SQL, so we test connectivity
// and inform user to run SQL in the dashboard
async function main() {
  console.log('Testing Supabase connection...')

  // Try to read from a table to test connectivity
  const { error } = await supabase.from('profiles').select('id').limit(1)

  if (error && error.code === '42P01') {
    console.log('Connection works but tables do not exist yet.')
    console.log('Please run the SQL in the Supabase SQL Editor.')
  } else if (error) {
    console.log('Connection error:', error.message)
  } else {
    console.log('Connection OK and profiles table exists!')
  }
}

main()
