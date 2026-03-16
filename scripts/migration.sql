-- ============================================
-- Thermomix App — Database Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RECIPES
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

-- 3. COOK LOG
CREATE TABLE IF NOT EXISTS cook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  cooked_at TIMESTAMPTZ DEFAULT now(),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  bowl_mode INT DEFAULT 1
);

-- 4. RECIPE NOTES
CREATE TABLE IF NOT EXISTS recipe_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  step_index INT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SHOPPING LIST
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

-- 6. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  item_name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Recipes (shared — anyone can read/add/edit)
CREATE POLICY "recipes_select" ON recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipes_insert" ON recipes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "recipes_update" ON recipes FOR UPDATE TO authenticated USING (true);

-- Cook log (per-user)
CREATE POLICY "cook_log_select" ON cook_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cook_log_insert" ON cook_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cook_log_update" ON cook_log FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cook_log_delete" ON cook_log FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Recipe notes (per-user)
CREATE POLICY "recipe_notes_select" ON recipe_notes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "recipe_notes_insert" ON recipe_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_notes_update" ON recipe_notes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "recipe_notes_delete" ON recipe_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Shopping list (per-user)
CREATE POLICY "shopping_list_select" ON shopping_list FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "shopping_list_insert" ON shopping_list FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "shopping_list_update" ON shopping_list FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "shopping_list_delete" ON shopping_list FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Inventory (per-user)
CREATE POLICY "inventory_select" ON inventory FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "inventory_insert" ON inventory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "inventory_update" ON inventory FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "inventory_delete" ON inventory FOR DELETE TO authenticated USING (user_id = auth.uid());
