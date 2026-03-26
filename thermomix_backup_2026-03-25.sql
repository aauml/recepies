-- Thermomix App Database Backup
-- Project: Thermomix
-- Project ID: dwnuqwysyxmiayfsxofk
-- Date: 2026-03-25
-- Generated SQL backup with all tables, functions, RLS policies and data

-- Drop existing tables if they exist (cascade to remove dependencies)
DROP TABLE IF EXISTS shopping_list CASCADE;
DROP TABLE IF EXISTS recipe_notes CASCADE;
DROP TABLE IF EXISTS cook_log CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS household_invites CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create tables in dependency order

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  diet_preferences jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Household',
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id),
  user_id uuid REFERENCES auth.users,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(household_id, user_id)
);

CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id),
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(household_id, email)
);

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  servings_1bowl text,
  servings_2bowl text,
  time_1bowl text,
  time_2bowl text,
  tags text[] DEFAULT '{}',
  source_urls text[] DEFAULT '{}',
  thumbnail_emoji text DEFAULT '🍽',
  ingredients_1bowl jsonb,
  ingredients_2bowl jsonb,
  steps_1bowl jsonb,
  steps_2bowl jsonb,
  nutrition jsonb,
  insulin_load integer,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  item_name text NOT NULL,
  quantity text,
  category text,
  updated_at timestamptz DEFAULT now(),
  in_stock boolean DEFAULT true,
  section text DEFAULT 'fresh'
);

CREATE TABLE public.cook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.recipes(id),
  user_id uuid REFERENCES auth.users,
  cooked_at timestamptz DEFAULT now(),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  bowl_mode integer DEFAULT 1
);

CREATE TABLE public.recipe_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.recipes(id),
  user_id uuid REFERENCES auth.users,
  step_index integer,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  item_name text NOT NULL,
  quantity text,
  category text,
  recipe_id uuid REFERENCES public.recipes(id),
  checked boolean DEFAULT false,
  added_at timestamptz DEFAULT now(),
  source_inventory_id uuid REFERENCES public.inventory(id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

-- Create helper functions

CREATE OR REPLACE FUNCTION public.get_my_household_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_household_member_ids()
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  hh_id UUID;
  member_ids UUID[];
BEGIN
  SELECT household_id INTO hh_id
  FROM public.household_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF hh_id IS NULL THEN
    RETURN ARRAY[auth.uid()];
  END IF;

  SELECT array_agg(user_id) INTO member_ids
  FROM public.household_members
  WHERE household_id = hh_id;

  RETURN member_ids;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- Row Level Security Policies

-- profiles policies
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- households policies
CREATE POLICY hh_select ON public.households
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR id = public.get_my_household_id());

CREATE POLICY hh_insert ON public.households
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY hh_update ON public.households
  FOR UPDATE
  TO authenticated
  USING (id = public.get_my_household_id() AND EXISTS(SELECT 1 FROM public.household_members WHERE user_id = auth.uid() AND household_id = public.get_my_household_id() AND role = 'owner'))
  WITH CHECK (id = public.get_my_household_id());

CREATE POLICY hh_delete ON public.households
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- household_members policies
CREATE POLICY hm_select ON public.household_members
  FOR SELECT
  TO authenticated
  USING (household_id = public.get_my_household_id());

CREATE POLICY hm_insert ON public.household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY hm_delete ON public.household_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR household_id = public.get_my_household_id());

-- household_invites policies
CREATE POLICY hi_select ON public.household_invites
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email') OR household_id = public.get_my_household_id());

CREATE POLICY hi_insert ON public.household_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY hi_update ON public.household_invites
  FOR UPDATE
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'))
  WITH CHECK (lower(email) = lower(auth.jwt()->>'email'));

CREATE POLICY hi_delete ON public.household_invites
  FOR DELETE
  TO authenticated
  USING (household_id = public.get_my_household_id());

-- recipes policies
CREATE POLICY recipes_select ON public.recipes
  FOR SELECT
  TO authenticated
  USING (created_by = ANY(public.get_my_household_member_ids()));

CREATE POLICY recipes_insert ON public.recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY recipes_update ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (created_by = ANY(public.get_my_household_member_ids()));

CREATE POLICY recipes_delete ON public.recipes
  FOR DELETE
  TO authenticated
  USING (created_by = ANY(public.get_my_household_member_ids()));

-- inventory policies
CREATE POLICY inventory_select ON public.inventory
  FOR SELECT
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY inventory_insert ON public.inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY inventory_update ON public.inventory
  FOR UPDATE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY inventory_delete ON public.inventory
  FOR DELETE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

-- cook_log policies
CREATE POLICY cook_log_select ON public.cook_log
  FOR SELECT
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY cook_log_insert ON public.cook_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cook_log_update ON public.cook_log
  FOR UPDATE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY cook_log_delete ON public.cook_log
  FOR DELETE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

-- recipe_notes policies
CREATE POLICY recipe_notes_select ON public.recipe_notes
  FOR SELECT
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY recipe_notes_insert ON public.recipe_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY recipe_notes_update ON public.recipe_notes
  FOR UPDATE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY recipe_notes_delete ON public.recipe_notes
  FOR DELETE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

-- shopping_list policies
CREATE POLICY shopping_list_select ON public.shopping_list
  FOR SELECT
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY shopping_list_insert ON public.shopping_list
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY shopping_list_update ON public.shopping_list
  FOR UPDATE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

CREATE POLICY shopping_list_delete ON public.shopping_list
  FOR DELETE
  TO authenticated
  USING (user_id = ANY(public.get_my_household_member_ids()));

-- Insert data

-- Profiles
INSERT INTO public.profiles (id, display_name, avatar_url, created_at, diet_preferences) VALUES (
  'b1411d00-ad6c-46dc-8cbf-87e4e08ddacb',
  'Art Cx',
  'https://lh3.googleusercontent.com/a/ACg8ocK0dHW-ShPVGvIkocvWLY2XrtjP8Y--HWmVtzF4Ia4SeeLR7tmL=s96-c',
  '2026-03-16T06:22:39.252713+00:00',
  '{}'::jsonb
);
INSERT INTO public.profiles (id, display_name, avatar_url, created_at, diet_preferences) VALUES (
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Arturo',
  NULL,
  '2026-03-16T06:30:47.490156+00:00',
  '{}'::jsonb
);
INSERT INTO public.profiles (id, display_name, avatar_url, created_at, diet_preferences) VALUES (
  'fc788715-6a89-4ef7-bf51-b72e662035e2',
  'Rodolfo Arpia',
  'https://lh3.googleusercontent.com/a/ACg8ocJbxJcBNicEhKUACyYyIzRiIYgjKOsePLIGMpB8TFDpRUy25usu=s96-c',
  '2026-03-17T02:55:20.28331+00:00',
  '{}'::jsonb
);
INSERT INTO public.profiles (id, display_name, avatar_url, created_at, diet_preferences) VALUES (
  'c20352a7-06af-4ac1-aa62-c5b52ca513a1',
  'l.nelsonayala@yahoo.com',
  NULL,
  '2026-03-18T04:13:11.1764+00:00',
  '{}'::jsonb
);

-- Households
INSERT INTO public.households (id, name, created_by, created_at) VALUES (
  '76ee156d-1b25-4f3e-ba85-71b03ed63603',
  'My Household',
  'b1411d00-ad6c-46dc-8cbf-87e4e08ddacb',
  '2026-03-16T18:41:12.225262+00:00'
);
INSERT INTO public.households (id, name, created_by, created_at) VALUES (
  '58b8fd19-cab0-45d8-9269-8a3665f8c90d',
  'My Household',
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-18T04:16:20.876567+00:00'
);

-- Household Members
INSERT INTO public.household_members (id, household_id, user_id, role, joined_at) VALUES (
  '8670d1d8-bea2-41fb-95e6-73e355e38b8b',
  '58b8fd19-cab0-45d8-9269-8a3665f8c90d',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'owner',
  '2026-03-18T04:16:21.219018+00:00'
);
INSERT INTO public.household_members (id, household_id, user_id, role, joined_at) VALUES (
  'ba9c1fc6-6360-4eb2-b259-b4b7c76f305c',
  '58b8fd19-cab0-45d8-9269-8a3665f8c90d',
  'c20352a7-06af-4ac1-aa62-c5b52ca513a1',
  'member',
  '2026-03-18T04:16:36.587402+00:00'
);

-- Household Invites
INSERT INTO public.household_invites (id, household_id, email, invited_by, status, created_at) VALUES (
  '5849c7a2-4607-4052-a65a-251a308ccfb8',
  '76ee156d-1b25-4f3e-ba85-71b03ed63603',
  'artcx@protonmail.com',
  'b1411d00-ad6c-46dc-8cbf-87e4e08ddacb',
  'accepted',
  '2026-03-16T18:57:50.806633+00:00'
);
INSERT INTO public.household_invites (id, household_id, email, invited_by, status, created_at) VALUES (
  'a34d94d4-0105-4907-a328-5a48c064f62f',
  '58b8fd19-cab0-45d8-9269-8a3665f8c90d',
  'l.nelsonayala@yahoo.com',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'accepted',
  '2026-03-18T04:16:23.217995+00:00'
);

-- Recipes
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '0cae68f1-6ad8-4bfe-98cf-2e636666f46b',
  'Hearty Lentil Chilli',
  'A rich, smoky vegetarian chilli packed with red lentils, kidney beans and pumpkin in a deeply flavourful tomato base.',
  '4',
  '8',
  '50 min',
  '85 min',
  ARRAY['main', 'vegan', 'meal-prep'],
  ARRAY['https://cookidoo.thermomix.com/recipes/recipe/en-US/r337067'],
  '🌶️',
  '[{"group": "Lentils", "items": [{"qty": "200", "name": "Dried red lentils", "unit": "g", "category": "pantry", "estimate": "1 cup"}, {"qty": "400", "name": "Water for soaking", "unit": "ml", "category": "water", "estimate": "1\u2154 cups"}]}, {"group": "Aromatics", "items": [{"qty": "160", "name": "Red onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "20", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "4 cloves"}, {"qty": "160", "name": "Red capsicum, quartered", "unit": "g", "category": "produce", "estimate": "1 large bell pepper"}, {"qty": "5", "name": "Chipotle chilli in adobo", "unit": "g", "category": "pantry", "estimate": "1 chilli"}]}, {"group": "Vegetables", "items": [{"qty": "300", "name": "Tomatoes, quartered", "unit": "g", "category": "produce", "estimate": "2 medium tomatoes"}, {"qty": "400", "name": "Pumpkin, cubed", "unit": "g", "category": "produce", "estimate": "2 cups cubed"}]}, {"group": "Spices & Base", "items": [{"qty": "20", "name": "Coconut oil", "unit": "g", "category": "pantry", "estimate": "1\u00bd tbsp"}, {"qty": "4", "name": "Ground cumin", "unit": "g", "category": "spices", "estimate": "2 tsp"}, {"qty": "2", "name": "Smoked paprika", "unit": "g", "category": "spices", "estimate": "1 tsp"}, {"qty": "2", "name": "Ground coriander", "unit": "g", "category": "spices", "estimate": "1 tsp"}, {"qty": "4", "name": "Cacao powder", "unit": "g", "category": "pantry", "estimate": "2 tsp"}, {"qty": "8", "name": "Vegetable stock paste", "unit": "g", "category": "pantry", "estimate": "1\u00bd tsp"}]}, {"group": "Finish", "items": [{"qty": "400", "name": "Kidney beans, drained", "unit": "g", "category": "pantry", "estimate": "1 can"}, {"qty": "10", "name": "Red wine vinegar", "unit": "ml", "category": "pantry", "estimate": "2 tsp"}, {"qty": "40", "name": "Lime juice", "unit": "ml", "category": "produce", "estimate": "2 limes"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1\u00bd tsp"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "spices", "estimate": "\u00bd tsp"}]}]'::jsonb,
  '[{"group": "Lentils", "items": [{"qty": "400", "name": "Dried red lentils", "unit": "g", "category": "pantry", "estimate": "2 cups"}, {"qty": "800", "name": "Water for soaking", "unit": "ml", "category": "water", "estimate": "3\u2153 cups"}]}, {"group": "Aromatics", "items": [{"qty": "320", "name": "Red onion, quartered", "unit": "g", "category": "produce", "estimate": "2 medium onions"}, {"qty": "40", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "8 cloves"}, {"qty": "320", "name": "Red capsicum, quartered", "unit": "g", "category": "produce", "estimate": "2 large bell peppers"}, {"qty": "10", "name": "Chipotle chilli in adobo", "unit": "g", "category": "pantry", "estimate": "2 chillies"}]}, {"group": "Vegetables", "items": [{"qty": "600", "name": "Tomatoes, quartered", "unit": "g", "category": "produce", "estimate": "4 medium tomatoes"}, {"qty": "800", "name": "Pumpkin, cubed", "unit": "g", "category": "produce", "estimate": "4 cups cubed"}]}, {"group": "Spices & Base", "items": [{"qty": "40", "name": "Coconut oil", "unit": "g", "category": "pantry", "estimate": "3 tbsp"}, {"qty": "8", "name": "Ground cumin", "unit": "g", "category": "spices", "estimate": "4 tsp"}, {"qty": "4", "name": "Smoked paprika", "unit": "g", "category": "spices", "estimate": "2 tsp"}, {"qty": "4", "name": "Ground coriander", "unit": "g", "category": "spices", "estimate": "2 tsp"}, {"qty": "8", "name": "Cacao powder", "unit": "g", "category": "pantry", "estimate": "4 tsp"}, {"qty": "16", "name": "Vegetable stock paste", "unit": "g", "category": "pantry", "estimate": "3 tsp"}]}, {"group": "Finish", "items": [{"qty": "800", "name": "Kidney beans, drained", "unit": "g", "category": "pantry", "estimate": "2 cans"}, {"qty": "20", "name": "Red wine vinegar", "unit": "ml", "category": "pantry", "estimate": "4 tsp"}, {"qty": "80", "name": "Lime juice", "unit": "ml", "category": "produce", "estimate": "4 limes"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}, {"qty": "4", "name": "Black pepper", "unit": "g", "category": "spices", "estimate": "1 tsp"}]}]'::jsonb,
  '[{"temp": "", "time": "10 min", "speed": null, "action": "Soak lentils", "detail": "Add red lentils and 400ml water to bowl. Let stand 10 minutes, then drain", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Red lentils"}, {"qty": "400ml", "name": "Water"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add garlic, onion, capsicum and chipotle to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "20g", "name": "Garlic"}, {"qty": "160g", "name": "Red onion"}, {"qty": "160g", "name": "Red capsicum"}, {"qty": "5g", "name": "Chipotle chilli"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add coconut oil and saut\u00e9 aromatics", "reverse": true, "accessories": [], "ingredients": [{"qty": "20g", "name": "Coconut oil"}]}, {"temp": "120\u00b0C", "time": "1 min", "speed": 1, "action": "Add spices", "detail": "Add cumin, paprika, coriander and cacao powder", "reverse": true, "accessories": [], "ingredients": [{"qty": "4g", "name": "Ground cumin"}, {"qty": "2g", "name": "Smoked paprika"}, {"qty": "2g", "name": "Ground coriander"}, {"qty": "4g", "name": "Cacao powder"}]}, {"temp": "100\u00b0C", "time": "25 min", "speed": 1, "action": "Add main ingredients", "detail": "Add drained lentils, tomatoes, pumpkin, stock paste and 300ml water", "reverse": true, "accessories": [], "ingredients": [{"qty": "200g", "name": "Soaked lentils"}, {"qty": "300g", "name": "Tomatoes"}, {"qty": "400g", "name": "Pumpkin"}, {"qty": "8g", "name": "Stock paste"}, {"qty": "300ml", "name": "Water"}]}, {"temp": "100\u00b0C", "time": "5 min", "speed": 1, "action": "Add beans", "detail": "Add kidney beans and cook to warm through", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Kidney beans"}]}, {"temp": "", "time": "10 sec", "speed": 2, "action": "Season and finish", "detail": "Add salt, pepper, vinegar and lime juice. Mix gently", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "10ml", "name": "Red wine vinegar"}, {"qty": "40ml", "name": "Lime juice"}]}]'::jsonb,
  '[{"temp": "", "time": "10 min", "speed": null, "action": "Soak lentils Bowl 1", "detail": "Add 200g red lentils and 400ml water to Bowl 1. Let stand 10 minutes, then drain and set aside", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Red lentils Bowl 1"}, {"qty": "400ml", "name": "Water"}]}, {"temp": "", "time": "10 min", "speed": null, "action": "Soak lentils Bowl 2", "detail": "Add remaining 200g red lentils and 400ml water to clean bowl. Let stand (start during Bowl 1 cooking)", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Red lentils Bowl 2"}, {"qty": "400ml", "name": "Water"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics Bowl 1", "detail": "Add half of garlic, onion, capsicum and chipotle to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "20g", "name": "Garlic"}, {"qty": "160g", "name": "Red onion"}, {"qty": "160g", "name": "Red capsicum"}, {"qty": "5g", "name": "Chipotle chilli"}]}, {"temp": "Various", "time": "34 min", "speed": 1, "action": "Cook Bowl 1", "detail": "Add 20g coconut oil, saut\u00e9 3 min 120\u00b0C speed 1 reverse. Add half the spices, cook 1 min same settings. Add Bowl 1 lentils, half tomatoes, half pumpkin, 8g stock paste, 300ml water. Cook 25 min 100\u00b0C speed 1 reverse. Add 400g kidney beans, cook 5 min same settings", "reverse": true, "accessories": [], "ingredients": [{"qty": "various", "name": "Bowl 1 complete"}]}, {"temp": "", "time": "3 min", "speed": 5, "action": "Transfer and prep Bowl 2", "detail": "Transfer Bowl 1 contents to serving dish. Clean bowl. Drain Bowl 2 lentils. Chop remaining aromatics 5 sec speed 5", "reverse": false, "accessories": [], "ingredients": [{"qty": "various", "name": "Remaining aromatics"}]}, {"temp": "Various", "time": "34 min", "speed": 1, "action": "Cook Bowl 2", "detail": "Add 20g coconut oil, saut\u00e9 3 min 120\u00b0C speed 1 reverse. Add remaining spices, cook 1 min same settings. Add Bowl 2 lentils, remaining tomatoes, pumpkin, 8g stock paste, 300ml water. Cook 25 min 100\u00b0C speed 1 reverse. Add 400g kidney beans, cook 5 min same settings", "reverse": true, "accessories": [], "ingredients": [{"qty": "various", "name": "Bowl 2 complete"}]}, {"temp": "", "time": "2 min", "speed": null, "action": "Combine and season", "detail": "Combine both batches. Season with salt, pepper, vinegar and lime juice to taste", "reverse": false, "accessories": [], "ingredients": [{"qty": "16g total", "name": "All seasonings"}]}]'::jsonb,
  '{"fat": "8g", "carbs": "50g", "fiber": "15g", "protein": "23g", "calories": 400}'::jsonb,
  3,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T08:04:09.098927+00:00',
  '2026-03-16T08:04:09.098927+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '6b48de07-a38f-441d-8acb-39cde904b9f6',
  'Classic Vegetable Soup',
  'A hearty, comforting soup packed with fresh vegetables in a rich vegetable broth.',
  '4-6',
  '8-12',
  '35 min',
  '60 min',
  ARRAY['soup', 'vegan', 'main'],
  ARRAY['https://www.budgetbytes.com/chunky-lentil-vegetable-soup/', 'https://www.cookieandkate.com/best-lentil-soup-recipe/', 'https://www.bbcgoodfood.com/recipes/spiced-root-vegetable-soup'],
  '🍲',
  '[{"group": "Aromatics", "items": [{"qty": "150", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "240", "name": "Carrots, chunked", "unit": "g", "category": "produce", "estimate": "2 medium carrots"}, {"qty": "120", "name": "Celery, chunked", "unit": "g", "category": "produce", "estimate": "2 stalks"}, {"qty": "15", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "3 cloves"}]}, {"group": "Main Ingredients", "items": [{"qty": "30", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "2 tablespoons"}, {"qty": "400", "name": "Diced tomatoes, canned", "unit": "g", "category": "pantry", "estimate": "1 can (14 oz)"}, {"qty": "800", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3.5 cups"}, {"qty": "360", "name": "Potatoes, chunked", "unit": "g", "category": "produce", "estimate": "2 medium potatoes"}, {"qty": "150", "name": "Green beans, trimmed", "unit": "g", "category": "produce", "estimate": "1 cup"}]}, {"group": "Seasonings", "items": [{"qty": "2", "name": "Dried thyme", "unit": "g", "category": "spices", "estimate": "1 teaspoon"}, {"qty": "2", "name": "Bay leaves", "unit": "pieces", "category": "spices", "estimate": "2 leaves"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 teaspoons"}, {"qty": "1", "name": "Black pepper", "unit": "g", "category": "spices", "estimate": "0.5 teaspoon"}]}]'::jsonb,
  '[{"group": "Aromatics", "items": [{"qty": "300", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "2 medium onions"}, {"qty": "480", "name": "Carrots, chunked", "unit": "g", "category": "produce", "estimate": "4 medium carrots"}, {"qty": "240", "name": "Celery, chunked", "unit": "g", "category": "produce", "estimate": "4 stalks"}, {"qty": "30", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "6 cloves"}]}, {"group": "Main Ingredients", "items": [{"qty": "60", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "4 tablespoons"}, {"qty": "800", "name": "Diced tomatoes, canned", "unit": "g", "category": "pantry", "estimate": "2 cans (14 oz each)"}, {"qty": "1600", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "7 cups"}, {"qty": "720", "name": "Potatoes, chunked", "unit": "g", "category": "produce", "estimate": "4 medium potatoes"}, {"qty": "300", "name": "Green beans, trimmed", "unit": "g", "category": "produce", "estimate": "2 cups"}]}, {"group": "Seasonings", "items": [{"qty": "4", "name": "Dried thyme", "unit": "g", "category": "spices", "estimate": "2 teaspoons"}, {"qty": "4", "name": "Bay leaves", "unit": "pieces", "category": "spices", "estimate": "4 leaves"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 teaspoons"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "spices", "estimate": "1 teaspoon"}]}]'::jsonb,
  '[{"note": "", "temp": "", "time": "8 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add onion, carrots, celery, and garlic to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "240g", "name": "Carrots"}, {"qty": "120g", "name": "Celery"}, {"qty": "15g", "name": "Garlic"}]}, {"note": "", "temp": "120\u00b0C", "time": "4 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add olive oil and saut\u00e9 vegetables", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Add tomatoes and seasonings", "detail": "Add diced tomatoes, thyme, and bay leaves", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Diced tomatoes"}, {"qty": "2g", "name": "Dried thyme"}, {"qty": "2 pieces", "name": "Bay leaves"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Add stock and potatoes", "detail": "Add vegetable stock and potato chunks", "reverse": true, "accessories": [], "ingredients": [{"qty": "800ml", "name": "Vegetable stock"}, {"qty": "360g", "name": "Potatoes"}]}, {"temp": "100\u00b0C", "time": "5 min", "speed": 1, "action": "Add green beans", "detail": "Add green beans and continue cooking", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Green beans"}]}, {"temp": "", "time": "10 sec", "speed": 2, "action": "Season and finish", "detail": "Remove bay leaves, add salt and pepper to taste", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}]'::jsonb,
  '[{"temp": "", "time": "8 sec", "speed": 5, "action": "Chop aromatics (Bowl 1)", "detail": "Add half the onion, carrots, celery, and garlic to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "240g", "name": "Carrots"}, {"qty": "120g", "name": "Celery"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "4 min", "speed": 1, "action": "Saut\u00e9 aromatics (Bowl 1)", "detail": "Add half the olive oil and saut\u00e9 vegetables", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Start Bowl 1 soup base", "detail": "Add half the tomatoes, thyme, bay leaves, stock, and potatoes", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Diced tomatoes"}, {"qty": "2g", "name": "Dried thyme"}, {"qty": "2 pieces", "name": "Bay leaves"}, {"qty": "800ml", "name": "Vegetable stock"}, {"qty": "360g", "name": "Potatoes"}]}, {"temp": "100\u00b0C", "time": "5 min", "speed": 1, "action": "Finish Bowl 1", "detail": "Add half the green beans, salt, and pepper", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Green beans"}, {"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}, {"temp": "", "time": "2 min", "speed": null, "action": "Transfer Bowl 1 and clean", "detail": "Transfer soup to serving pot, clean bowl thoroughly", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "varies", "time": "32 min", "speed": null, "action": "Repeat for Bowl 2", "detail": "Repeat all steps with remaining ingredients for second batch", "reverse": true, "accessories": [], "ingredients": [{"qty": "half portions", "name": "Remaining ingredients"}]}, {"temp": "", "time": "1 min", "speed": null, "action": "Combine and serve", "detail": "Combine both batches in large serving pot", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '{"fat": "7g", "carbs": "28g", "fiber": "6g", "protein": "6g", "calories": 185}'::jsonb,
  2,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T08:41:03.732092+00:00',
  '2026-03-16T08:46:49.766+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '13937c45-ea8b-4377-ae92-1b0f6595c9a9',
  'Classic Italian Minestrone Soup',
  'A hearty vegetable soup with beans, pasta, and aromatic herbs in a rich tomato base. Perfect comfort food for any season.',
  '4-6',
  '8-12',
  '50 min',
  '80 min',
  ARRAY['soup', 'main', 'vegan'],
  ARRAY['https://www.youtube.com/watch?v=ybMYHmw4-tA'],
  '🍲',
  '[{"group": "Aromatics", "items": [{"qty": "150", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "100", "name": "Celery stalks, cut in pieces", "unit": "g", "category": "produce", "estimate": "2 stalks"}, {"qty": "120", "name": "Carrots, cut in chunks", "unit": "g", "category": "produce", "estimate": "1 large carrot"}, {"qty": "15", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "3 cloves"}]}, {"group": "Base", "items": [{"qty": "30", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "2 tbsp"}, {"qty": "400", "name": "Canned crushed tomatoes", "unit": "g", "category": "pantry", "estimate": "1 can"}, {"qty": "800", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3.5 cups"}, {"qty": "400", "name": "Cannellini beans, drained", "unit": "g", "category": "pantry", "estimate": "1 can"}]}, {"group": "Vegetables & Pasta", "items": [{"qty": "200", "name": "Zucchini, diced", "unit": "g", "category": "produce", "estimate": "1 medium zucchini"}, {"qty": "150", "name": "Green beans, cut in pieces", "unit": "g", "category": "produce", "estimate": "1 cup"}, {"qty": "80", "name": "Small pasta (ditalini)", "unit": "g", "category": "pantry", "estimate": "1/2 cup"}]}, {"group": "Seasonings", "items": [{"qty": "20", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "1/4 cup packed"}, {"qty": "15", "name": "Fresh parsley", "unit": "g", "category": "produce", "estimate": "2 tbsp chopped"}, {"qty": "2", "name": "Bay leaves", "unit": "pieces", "category": "pantry", "estimate": "2 leaves"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 tsp"}, {"qty": "1", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1/4 tsp"}]}]'::jsonb,
  '[{"group": "Aromatics", "items": [{"qty": "300", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "2 medium onions"}, {"qty": "200", "name": "Celery stalks, cut in pieces", "unit": "g", "category": "produce", "estimate": "4 stalks"}, {"qty": "240", "name": "Carrots, cut in chunks", "unit": "g", "category": "produce", "estimate": "2 large carrots"}, {"qty": "30", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "6 cloves"}]}, {"group": "Base", "items": [{"qty": "60", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}, {"qty": "800", "name": "Canned crushed tomatoes", "unit": "g", "category": "pantry", "estimate": "2 cans"}, {"qty": "1600", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "7 cups"}, {"qty": "800", "name": "Cannellini beans, drained", "unit": "g", "category": "pantry", "estimate": "2 cans"}]}, {"group": "Vegetables & Pasta", "items": [{"qty": "400", "name": "Zucchini, diced", "unit": "g", "category": "produce", "estimate": "2 medium zucchini"}, {"qty": "300", "name": "Green beans, cut in pieces", "unit": "g", "category": "produce", "estimate": "2 cups"}, {"qty": "160", "name": "Small pasta (ditalini)", "unit": "g", "category": "pantry", "estimate": "1 cup"}]}, {"group": "Seasonings", "items": [{"qty": "40", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "1/2 cup packed"}, {"qty": "30", "name": "Fresh parsley", "unit": "g", "category": "produce", "estimate": "4 tbsp chopped"}, {"qty": "4", "name": "Bay leaves", "unit": "pieces", "category": "pantry", "estimate": "4 leaves"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1/2 tsp"}]}]'::jsonb,
  '[{"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add quartered onion, celery pieces, carrot chunks, and garlic cloves to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "100g", "name": "Celery"}, {"qty": "120g", "name": "Carrots"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add olive oil and saut\u00e9 chopped vegetables", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "100\u00b0C", "time": "20 min", "speed": 1, "action": "Add tomatoes and stock", "detail": "Add crushed tomatoes, vegetable stock, cannellini beans, and bay leaves", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Crushed tomatoes"}, {"qty": "800ml", "name": "Vegetable stock"}, {"qty": "400g", "name": "Cannellini beans"}, {"qty": "2 pieces", "name": "Bay leaves"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Add vegetables and pasta", "detail": "Add diced zucchini, green beans, and pasta. Continue cooking", "reverse": true, "accessories": [], "ingredients": [{"qty": "200g", "name": "Zucchini"}, {"qty": "150g", "name": "Green beans"}, {"qty": "80g", "name": "Pasta"}]}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Chop herbs", "detail": "Add fresh basil and parsley, chop briefly", "reverse": false, "accessories": [], "ingredients": [{"qty": "20g", "name": "Fresh basil"}, {"qty": "15g", "name": "Fresh parsley"}]}, {"temp": "", "time": "10 sec", "speed": 3, "action": "Season and finish", "detail": "Add salt and black pepper, stir to combine. Remove bay leaves before serving", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}]'::jsonb,
  '[{"temp": "", "time": "5 sec", "speed": 5, "action": "Chop all aromatics (Bowl 1)", "detail": "Add half the onion, celery, carrots, and garlic to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "100g", "name": "Celery"}, {"qty": "120g", "name": "Carrots"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start saut\u00e9 (Bowl 1)", "detail": "Add half the olive oil and begin saut\u00e9ing aromatics", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Prep Bowl 2 aromatics", "detail": "While Bowl 1 saut\u00e9s, chop remaining aromatics in Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "100g", "name": "Celery"}, {"qty": "120g", "name": "Carrots"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "100\u00b0C", "time": "20 min", "speed": 1, "action": "Add base to Bowl 1", "detail": "Add half the tomatoes, stock, beans, and bay leaves to Bowl 1", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Crushed tomatoes"}, {"qty": "800ml", "name": "Vegetable stock"}, {"qty": "400g", "name": "Cannellini beans"}, {"qty": "2 pieces", "name": "Bay leaves"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start Bowl 2 saut\u00e9", "detail": "During Bowl 1 cooking, saut\u00e9 Bowl 2 aromatics with remaining oil", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Add vegetables to Bowl 1", "detail": "Add half the zucchini, green beans, and pasta to Bowl 1", "reverse": true, "accessories": [], "ingredients": [{"qty": "200g", "name": "Zucchini"}, {"qty": "150g", "name": "Green beans"}, {"qty": "80g", "name": "Pasta"}]}, {"temp": "100\u00b0C", "time": "20 min", "speed": 1, "action": "Complete Bowl 2 base", "detail": "Add remaining tomatoes, stock, beans, and bay leaves to Bowl 2", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Crushed tomatoes"}, {"qty": "800ml", "name": "Vegetable stock"}, {"qty": "400g", "name": "Cannellini beans"}, {"qty": "2 pieces", "name": "Bay leaves"}]}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Finish Bowl 1", "detail": "Chop half the herbs in Bowl 1, add salt and pepper", "reverse": false, "accessories": [], "ingredients": [{"qty": "20g", "name": "Fresh basil"}, {"qty": "15g", "name": "Fresh parsley"}, {"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Complete Bowl 2", "detail": "Add remaining vegetables and pasta to Bowl 2, cook for 15 min, then finish with herbs and seasoning", "reverse": true, "accessories": [], "ingredients": [{"qty": "200g", "name": "Zucchini"}, {"qty": "150g", "name": "Green beans"}, {"qty": "80g", "name": "Pasta"}, {"qty": "20g", "name": "Fresh basil"}, {"qty": "15g", "name": "Fresh parsley"}, {"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}]'::jsonb,
  '{"fat": "6g", "carbs": "48g", "fiber": "12g", "protein": "12g", "calories": 285}'::jsonb,
  2,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T08:15:19.747434+00:00',
  '2026-03-18T21:18:08.933+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  'ae71a50e-aa38-4740-9b85-27020ae7ad6b',
  'Spicy Risotto with Spinach and Peas',
  'Creamy Italian risotto with fresh spinach, sweet peas, Parmesan cheese, and a spicy kick from red pepper flakes and jalapeños. Perfect comfort food that''s ready in 30 minutes.',
  '4',
  '8',
  '30 min',
  '55 min',
  ARRAY['main', 'vegetarian', 'spicy'],
  ARRAY['https://cookidoo.thermomix.com/recipes/recipe/en-US/r450684', 'https://www.seriouseats.com/spinach-pea-risotto-recipe', 'https://www.bbcgoodfood.com/recipes/spinach-pea-risotto'],
  '🌶️',
  '[{"group": "Base", "items": [{"qty": "60", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "2 oz piece"}, {"qty": "60", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1/2 medium onion"}, {"qty": "10", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "2 cloves"}, {"qty": "15", "name": "Fresh jalape\u00f1o, seeded and chopped", "unit": "g", "category": "produce", "estimate": "1 small jalape\u00f1o"}, {"qty": "30", "name": "Unsalted butter", "unit": "g", "category": "dairy", "estimate": "2 tablespoons"}, {"qty": "30", "name": "Extra virgin olive oil", "unit": "ml", "category": "pantry", "estimate": "2 tablespoons"}, {"qty": "2", "name": "Red pepper flakes", "unit": "g", "category": "pantry", "estimate": "1 teaspoon"}, {"qty": "280", "name": "Arborio rice", "unit": "g", "category": "pantry", "estimate": "1 1/3 cups"}, {"qty": "60", "name": "Dry white wine", "unit": "ml", "category": "pantry", "estimate": "1/4 cup"}, {"qty": "750", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3 cups"}, {"qty": "2", "name": "Vegetable stock cubes", "unit": "pieces", "category": "pantry", "estimate": "2 cubes"}, {"qty": "150", "name": "Fresh baby spinach, de-stemmed", "unit": "g", "category": "produce", "estimate": "5 oz bag"}, {"qty": "150", "name": "Frozen peas", "unit": "g", "category": "frozen", "estimate": "1 cup"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1 1/2 teaspoons"}, {"qty": "1", "name": "Cayenne pepper", "unit": "g", "category": "pantry", "estimate": "1/2 teaspoon"}]}]'::jsonb,
  '[{"group": "Base", "items": [{"qty": "120", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "4 oz piece"}, {"qty": "120", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "20", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "4 cloves"}, {"qty": "30", "name": "Fresh jalape\u00f1o, seeded and chopped", "unit": "g", "category": "produce", "estimate": "2 small jalape\u00f1os"}, {"qty": "60", "name": "Unsalted butter", "unit": "g", "category": "dairy", "estimate": "4 tablespoons"}, {"qty": "60", "name": "Extra virgin olive oil", "unit": "ml", "category": "pantry", "estimate": "4 tablespoons"}, {"qty": "4", "name": "Red pepper flakes", "unit": "g", "category": "pantry", "estimate": "2 teaspoons"}, {"qty": "560", "name": "Arborio rice", "unit": "g", "category": "pantry", "estimate": "2 2/3 cups"}, {"qty": "120", "name": "Dry white wine", "unit": "ml", "category": "pantry", "estimate": "1/2 cup"}, {"qty": "1500", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "6 cups"}, {"qty": "4", "name": "Vegetable stock cubes", "unit": "pieces", "category": "pantry", "estimate": "4 cubes"}, {"qty": "300", "name": "Fresh baby spinach, de-stemmed", "unit": "g", "category": "produce", "estimate": "10 oz bags"}, {"qty": "300", "name": "Frozen peas", "unit": "g", "category": "frozen", "estimate": "2 cups"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 teaspoons"}, {"qty": "2", "name": "Cayenne pepper", "unit": "g", "category": "pantry", "estimate": "1 teaspoon"}]}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 10, "action": "Grate Parmesan", "detail": "Add Parmesan cheese to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Remove cheese", "detail": "Transfer grated Parmesan to a bowl and set aside", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Chop aromatics", "detail": "Add quartered onion, garlic cloves, and jalape\u00f1o to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Onion"}, {"qty": "10g", "name": "Garlic"}, {"qty": "15g", "name": "Jalape\u00f1o"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add butter, olive oil, and red pepper flakes, cook aromatics", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Butter"}, {"qty": "30ml", "name": "Olive oil"}, {"qty": "2g", "name": "Red pepper flakes"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Toast rice", "detail": "Add arborio rice and toast with spiced aromatics", "reverse": true, "accessories": [], "ingredients": [{"qty": "280g", "name": "Arborio rice"}]}, {"note": "", "temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add wine", "detail": "Add white wine and cook until absorbed", "reverse": true, "accessories": [], "ingredients": [{"qty": "60ml", "name": "White wine"}]}, {"temp": "100\u00b0C", "time": "18 min", "speed": 1, "action": "Cook risotto", "detail": "Add vegetable stock and stock cubes, cook risotto", "reverse": true, "accessories": [], "ingredients": [{"qty": "750ml", "name": "Vegetable stock"}, {"qty": "2 pieces", "name": "Stock cubes"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add vegetables", "detail": "Add spinach and frozen peas, stir through", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Baby spinach"}, {"qty": "150g", "name": "Frozen peas"}]}, {"temp": "", "time": "30 sec", "speed": 2, "action": "Season and finish", "detail": "Add salt, cayenne pepper, and half the grated Parmesan, stir to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Cayenne pepper"}, {"qty": "30g", "name": "Grated Parmesan"}]}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 10, "action": "Grate Parmesan (Bowl 1)", "detail": "Add half the Parmesan cheese to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "10 sec", "speed": 10, "action": "Remove and repeat (Bowl 2)", "detail": "Transfer to bowl, swap bowls, grate remaining Parmesan", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Chop aromatics (Bowl 1)", "detail": "Swap to Bowl 1, add half the onion, garlic, and jalape\u00f1o", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Onion"}, {"qty": "10g", "name": "Garlic"}, {"qty": "15g", "name": "Jalape\u00f1o"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start risotto (Bowl 1)", "detail": "Add half the butter, oil, and red pepper flakes, saut\u00e9 aromatics", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Butter"}, {"qty": "30ml", "name": "Olive oil"}, {"qty": "2g", "name": "Red pepper flakes"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Toast rice (Bowl 1)", "detail": "Add half the arborio rice, toast", "reverse": true, "accessories": [], "ingredients": [{"qty": "280g", "name": "Arborio rice"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add wine (Bowl 1)", "detail": "Add half the wine, cook until absorbed", "reverse": true, "accessories": [], "ingredients": [{"qty": "60ml", "name": "White wine"}]}, {"temp": "100\u00b0C", "time": "18 min", "speed": 1, "action": "Cook risotto (Bowl 1)", "detail": "Add half the stock and 2 stock cubes", "reverse": true, "accessories": [], "ingredients": [{"qty": "750ml", "name": "Vegetable stock"}, {"qty": "2 pieces", "name": "Stock cubes"}]}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Prepare Bowl 2", "detail": "During Bowl 1 cook time, prep remaining onion, garlic, and jalape\u00f1o in Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Onion"}, {"qty": "10g", "name": "Garlic"}, {"qty": "15g", "name": "Jalape\u00f1o"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Finish Bowl 1", "detail": "Add half the spinach and peas to Bowl 1", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Baby spinach"}, {"qty": "150g", "name": "Frozen peas"}]}, {"temp": "", "time": "30 sec", "speed": 2, "action": "Season Bowl 1", "detail": "Add half the salt, cayenne, and Parmesan, transfer to serving bowls", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Cayenne pepper"}, {"qty": "60g", "name": "Grated Parmesan"}]}, {"temp": "varies", "time": "27 min", "speed": null, "action": "Complete Bowl 2", "detail": "Repeat saut\u00e9, toast, wine, stock, vegetables, and seasoning process for second batch", "reverse": true, "accessories": [], "ingredients": [{"qty": "as per Bowl 1", "name": "Remaining ingredients"}]}]'::jsonb,
  '{"fat": "17g", "carbs": "66g", "fiber": "5g", "protein": "13g", "calories": 481}'::jsonb,
  4,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T08:50:42.921569+00:00',
  '2026-03-16T09:07:43.342+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '89dc79d2-7fd7-4206-ae31-cb6b9ee858b2',
  'Creamy Mushroom Risotto',
  'Rich and creamy mushroom risotto with arborio rice, perfectly cooked to creamy perfection in the Thermomix.',
  '4-6',
  '8-12',
  '35 min',
  '65 min',
  ARRAY['main', 'vegetarian'],
  ARRAY['https://www.youtube.com/watch?v=4b2dh06eczM'],
  '🍄',
  '[{"group": "Base", "items": [{"qty": "150", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "15", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "3 cloves"}, {"qty": "30", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "2 tbsp"}]}, {"group": "Mushrooms & Rice", "items": [{"qty": "300", "name": "Mixed mushrooms, chopped", "unit": "g", "category": "produce", "estimate": "10 oz mixed mushrooms"}, {"qty": "320", "name": "Arborio rice", "unit": "g", "category": "pantry", "estimate": "1\u00bd cups"}, {"qty": "100", "name": "White wine", "unit": "ml", "category": "pantry", "estimate": "\u00bd cup"}]}, {"group": "Liquid & Finish", "items": [{"qty": "900", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3\u00be cups hot stock"}, {"qty": "40", "name": "Butter", "unit": "g", "category": "dairy", "estimate": "3 tbsp"}, {"qty": "80", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "\u00be cup grated"}, {"qty": "20", "name": "Fresh parsley, chopped", "unit": "g", "category": "produce", "estimate": "small bunch"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1\u00bd tsp"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "\u00bd tsp ground"}]}]'::jsonb,
  '[{"group": "Base", "items": [{"qty": "300", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "2 medium onions"}, {"qty": "30", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "6 cloves"}, {"qty": "60", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}]}, {"group": "Mushrooms & Rice", "items": [{"qty": "600", "name": "Mixed mushrooms, chopped", "unit": "g", "category": "produce", "estimate": "1.3 lbs mixed mushrooms"}, {"qty": "640", "name": "Arborio rice", "unit": "g", "category": "pantry", "estimate": "3 cups"}, {"qty": "200", "name": "White wine", "unit": "ml", "category": "pantry", "estimate": "1 cup"}]}, {"group": "Liquid & Finish", "items": [{"qty": "1800", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "7\u00bd cups hot stock"}, {"qty": "80", "name": "Butter", "unit": "g", "category": "dairy", "estimate": "6 tbsp"}, {"qty": "160", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "1\u00bd cups grated"}, {"qty": "40", "name": "Fresh parsley, chopped", "unit": "g", "category": "produce", "estimate": "2 small bunches"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}, {"qty": "4", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1 tsp ground"}]}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 10, "action": "Chop Parmesan", "detail": "Add cubed Parmesan to bowl and chop", "reverse": false, "accessories": [], "ingredients": [{"qty": "80g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Remove and set aside", "detail": "Remove grated Parmesan and set aside", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add onion and garlic to bowl and chop", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add olive oil and saut\u00e9 onion and garlic", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Add mushrooms", "detail": "Add chopped mushrooms and cook", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Mixed mushrooms"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add rice and wine", "detail": "Add arborio rice and white wine, stir to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "320g", "name": "Arborio rice"}, {"qty": "100ml", "name": "White wine"}]}, {"temp": "100\u00b0C", "time": "18 min", "speed": 1, "action": "Cook risotto", "detail": "Add hot vegetable stock and cook risotto", "reverse": true, "accessories": [], "ingredients": [{"qty": "900ml", "name": "Vegetable stock"}]}, {"temp": "", "time": "1 min", "speed": 2, "action": "Finish risotto", "detail": "Add butter, half the Parmesan, parsley, salt and pepper. Mix gently", "reverse": true, "accessories": [], "ingredients": [{"qty": "40g", "name": "Butter"}, {"qty": "40g", "name": "Parmesan cheese"}, {"qty": "20g", "name": "Fresh parsley"}, {"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Black pepper"}]}, {"temp": "", "time": "", "speed": null, "action": "Serve", "detail": "Serve immediately topped with remaining Parmesan", "reverse": false, "accessories": [], "ingredients": [{"qty": "40g", "name": "Remaining Parmesan"}]}]'::jsonb,
  '[{"temp": "", "time": "15 sec", "speed": 10, "action": "Chop all Parmesan (Bowl 1)", "detail": "Add all cubed Parmesan to Bowl 1 and chop", "reverse": false, "accessories": [], "ingredients": [{"qty": "160g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Remove and divide", "detail": "Remove grated Parmesan and divide into two portions", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "7 sec", "speed": 5, "action": "Chop aromatics for both bowls", "detail": "Add all onion and garlic to Bowl 1 and chop", "reverse": false, "accessories": [], "ingredients": [{"qty": "300g", "name": "Onion"}, {"qty": "30g", "name": "Garlic"}]}, {"temp": "", "time": "", "speed": null, "action": "Remove and divide", "detail": "Remove chopped aromatics and divide into two portions", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start Bowl 1 risotto", "detail": "Add half the aromatics and olive oil to Bowl 1, saut\u00e9", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g total", "name": "Onion/garlic mix"}, {"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Add mushrooms to Bowl 1", "detail": "Add half the mushrooms and cook", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Mixed mushrooms"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add rice and wine to Bowl 1", "detail": "Add half the rice and wine, stir to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "320g", "name": "Arborio rice"}, {"qty": "100ml", "name": "White wine"}]}, {"temp": "100\u00b0C", "time": "18 min", "speed": 1, "action": "Cook Bowl 1 risotto", "detail": "Add half the hot stock and cook risotto", "reverse": true, "accessories": [], "ingredients": [{"qty": "900ml", "name": "Vegetable stock"}]}, {"temp": "", "time": "1 min", "speed": 2, "action": "Finish Bowl 1", "detail": "Add half the butter, Parmesan, parsley, salt and pepper", "reverse": true, "accessories": [], "ingredients": [{"qty": "40g", "name": "Butter"}, {"qty": "40g", "name": "Parmesan"}, {"qty": "20g", "name": "Parsley"}, {"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Pepper"}]}, {"temp": "", "time": "30 sec", "speed": null, "action": "Keep warm and swap bowls", "detail": "Transfer Bowl 1 risotto to serving dish, keep warm. Install Bowl 2", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start Bowl 2 risotto", "detail": "Add remaining aromatics and olive oil to Bowl 2, saut\u00e9", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g total", "name": "Remaining onion/garlic"}, {"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Add mushrooms to Bowl 2", "detail": "Add remaining mushrooms and cook", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Mixed mushrooms"}]}, {"temp": "100\u00b0C", "time": "2 min", "speed": 1, "action": "Add rice and wine to Bowl 2", "detail": "Add remaining rice and wine, stir to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "320g", "name": "Arborio rice"}, {"qty": "100ml", "name": "White wine"}]}, {"temp": "100\u00b0C", "time": "18 min", "speed": 1, "action": "Cook Bowl 2 risotto", "detail": "Add remaining hot stock and cook risotto", "reverse": true, "accessories": [], "ingredients": [{"qty": "900ml", "name": "Vegetable stock"}]}, {"temp": "", "time": "1 min", "speed": 2, "action": "Finish Bowl 2", "detail": "Add remaining butter, Parmesan, parsley, salt and pepper", "reverse": true, "accessories": [], "ingredients": [{"qty": "40g", "name": "Butter"}, {"qty": "40g", "name": "Parmesan"}, {"qty": "20g", "name": "Parsley"}, {"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Pepper"}]}, {"temp": "", "time": "", "speed": null, "action": "Serve both portions", "detail": "Combine both bowls if desired or serve separately with remaining Parmesan", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '{"fat": "12g", "carbs": "58g", "fiber": "3g", "protein": "12g", "calories": 385}'::jsonb,
  4,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T09:17:35.723304+00:00',
  '2026-03-16T09:18:38.129+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  'c856ea3e-ae4b-49e6-b34b-bd401b32a4ba',
  'Vietnamese Vegetarian Pho',
  'Aromatic Vietnamese noodle soup with star anise, cinnamon, and fresh herbs. Plant-based version of the classic comfort food.',
  '4',
  '8',
  '90 min',
  '120 min',
  ARRAY['soup', 'vegan', 'main'],
  ARRAY['https://www.seriouseats.com/vegetarian-pho-recipe', 'https://www.bbcgoodfood.com/recipes/vegetarian-pho', 'https://cookieandkate.com/vegetarian-pho-recipe/', 'https://minimalistbaker.com/easy-vegan-pho/'],
  '🍜',
  '[{"group": "Aromatics", "items": [{"qty": "200", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 large onion"}, {"qty": "50", "name": "Fresh ginger, sliced", "unit": "g", "category": "produce", "estimate": "2 thumb-sized pieces"}, {"qty": "20", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "4 cloves"}]}, {"group": "Spices", "items": [{"qty": "6", "name": "Star anise", "unit": "g", "category": "spice", "estimate": "3 whole stars"}, {"qty": "5", "name": "Cinnamon stick", "unit": "g", "category": "spice", "estimate": "1 stick"}, {"qty": "2", "name": "Whole cloves", "unit": "g", "category": "spice", "estimate": "4-5 cloves"}, {"qty": "5", "name": "Coriander seeds", "unit": "g", "category": "spice", "estimate": "1 tsp"}, {"qty": "3", "name": "Fennel seeds", "unit": "g", "category": "spice", "estimate": "1/2 tsp"}]}, {"group": "Broth Base", "items": [{"qty": "30", "name": "Vegetable stock concentrate", "unit": "g", "category": "pantry", "estimate": "2 tbsp paste or 3 cubes"}, {"qty": "60", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}, {"qty": "1200", "name": "Water", "unit": "ml", "category": "pantry", "estimate": "5 cups"}, {"qty": "15", "name": "Brown sugar", "unit": "g", "category": "pantry", "estimate": "1 tbsp"}]}, {"group": "Protein & Noodles", "items": [{"qty": "300", "name": "Firm tofu, cubed", "unit": "g", "category": "produce", "estimate": "1 block"}, {"qty": "300", "name": "Rice noodles (banh pho)", "unit": "g", "category": "pantry", "estimate": "1 package"}]}, {"group": "Garnish", "items": [{"qty": "150", "name": "Bean sprouts", "unit": "g", "category": "produce", "estimate": "1 cup"}, {"qty": "30", "name": "Fresh cilantro", "unit": "g", "category": "produce", "estimate": "1 bunch"}, {"qty": "20", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "15-20 leaves"}, {"qty": "60", "name": "Lime, quartered", "unit": "g", "category": "produce", "estimate": "1 lime"}, {"qty": "30", "name": "Green onions, sliced", "unit": "g", "category": "produce", "estimate": "2-3 stalks"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 tsp"}]}]'::jsonb,
  '[{"group": "Aromatics", "items": [{"qty": "400", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "2 large onions"}, {"qty": "100", "name": "Fresh ginger, sliced", "unit": "g", "category": "produce", "estimate": "4 thumb-sized pieces"}, {"qty": "40", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "8 cloves"}]}, {"group": "Spices", "items": [{"qty": "12", "name": "Star anise", "unit": "g", "category": "spice", "estimate": "6 whole stars"}, {"qty": "10", "name": "Cinnamon stick", "unit": "g", "category": "spice", "estimate": "2 sticks"}, {"qty": "4", "name": "Whole cloves", "unit": "g", "category": "spice", "estimate": "8-10 cloves"}, {"qty": "10", "name": "Coriander seeds", "unit": "g", "category": "spice", "estimate": "2 tsp"}, {"qty": "6", "name": "Fennel seeds", "unit": "g", "category": "spice", "estimate": "1 tsp"}]}, {"group": "Broth Base", "items": [{"qty": "60", "name": "Vegetable stock concentrate", "unit": "g", "category": "pantry", "estimate": "4 tbsp paste or 6 cubes"}, {"qty": "120", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "8 tbsp"}, {"qty": "2400", "name": "Water", "unit": "ml", "category": "pantry", "estimate": "10 cups"}, {"qty": "30", "name": "Brown sugar", "unit": "g", "category": "pantry", "estimate": "2 tbsp"}]}, {"group": "Protein & Noodles", "items": [{"qty": "600", "name": "Firm tofu, cubed", "unit": "g", "category": "produce", "estimate": "2 blocks"}, {"qty": "600", "name": "Rice noodles (banh pho)", "unit": "g", "category": "pantry", "estimate": "2 packages"}]}, {"group": "Garnish", "items": [{"qty": "300", "name": "Bean sprouts", "unit": "g", "category": "produce", "estimate": "2 cups"}, {"qty": "60", "name": "Fresh cilantro", "unit": "g", "category": "produce", "estimate": "2 bunches"}, {"qty": "40", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "30-40 leaves"}, {"qty": "120", "name": "Lime, quartered", "unit": "g", "category": "produce", "estimate": "2 limes"}, {"qty": "60", "name": "Green onions, sliced", "unit": "g", "category": "produce", "estimate": "4-6 stalks"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}]}]'::jsonb,
  '[{"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Toast spices", "detail": "Add star anise, cinnamon stick, cloves, coriander seeds, and fennel seeds to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "21g total", "name": "All whole spices"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add quartered onions, ginger, and garlic to toasted spices", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "50g", "name": "Ginger"}, {"qty": "20g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Cook chopped aromatics with spices to develop flavors", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 3, "action": "Add liquids", "detail": "Add water, vegetable stock concentrate, soy sauce, and brown sugar", "reverse": false, "accessories": [], "ingredients": [{"qty": "1200ml", "name": "Water"}, {"qty": "30g", "name": "Stock concentrate"}, {"qty": "60ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Brown sugar"}]}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Simmer broth", "detail": "Cook to develop deep pho flavors, remove measuring cup", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "90\u00b0C", "time": "5 min", "speed": 1, "action": "Add tofu", "detail": "Add cubed tofu to gently heat through", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Tofu"}]}, {"temp": "", "time": "10 sec", "speed": 3, "action": "Season and finish", "detail": "Add salt and adjust seasoning to taste", "reverse": false, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}]}]'::jsonb,
  '[{"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Toast spices (Bowl 1)", "detail": "Add half the spices to Bowl 1 and toast", "reverse": false, "accessories": [], "ingredients": [{"qty": "10.5g", "name": "Half the spices"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics (Bowl 1)", "detail": "Add half the onions, ginger, and garlic to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "50g", "name": "Ginger"}, {"qty": "20g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Saut\u00e9 aromatics (Bowl 1)", "detail": "Cook chopped aromatics with spices", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 3, "action": "Add liquids (Bowl 1)", "detail": "Add half the water, stock concentrate, soy sauce, and brown sugar to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "1200ml", "name": "Water"}, {"qty": "30g", "name": "Stock concentrate"}, {"qty": "60ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Brown sugar"}]}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Start broth simmer (Bowl 1)", "detail": "Begin simmering Bowl 1 broth, remove measuring cup", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Prepare Bowl 2 (during Bowl 1 simmer)", "detail": "Toast remaining spices in clean Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "10.5g", "name": "Remaining spices"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics (Bowl 2)", "detail": "Add remaining onions, ginger, and garlic to Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "50g", "name": "Ginger"}, {"qty": "20g", "name": "Garlic"}]}, {"temp": "120\u00b0C", "time": "5 min", "speed": 1, "action": "Saut\u00e9 aromatics (Bowl 2)", "detail": "Cook chopped aromatics in Bowl 2", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 3, "action": "Add liquids (Bowl 2)", "detail": "Add remaining water, stock concentrate, soy sauce, and brown sugar to Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "1200ml", "name": "Water"}, {"qty": "30g", "name": "Stock concentrate"}, {"qty": "60ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Brown sugar"}]}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Simmer Bowl 2 broth", "detail": "Cook Bowl 2 broth to develop flavors", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "90\u00b0C", "time": "5 min", "speed": 1, "action": "Finish Bowl 1", "detail": "Add half the tofu to Bowl 1 and season with half the salt", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Tofu"}, {"qty": "8g", "name": "Salt"}]}, {"temp": "90\u00b0C", "time": "5 min", "speed": 1, "action": "Finish Bowl 2", "detail": "Add remaining tofu to Bowl 2 and season with remaining salt", "reverse": true, "accessories": [], "ingredients": [{"qty": "300g", "name": "Tofu"}, {"qty": "8g", "name": "Salt"}]}]'::jsonb,
  '{"fat": "8g", "carbs": "45g", "fiber": "4g", "protein": "18g", "calories": 320}'::jsonb,
  3,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-16T09:22:06.88862+00:00',
  '2026-03-16T09:23:11.12+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  'ab7d2cde-5a11-42ba-a727-6d005387f4dc',
  'Thai Red Curry with Tofu & Butternut Squash',
  'Aromatic Thai red curry with tender butternut squash and crispy tofu in rich coconut milk. Fragrant with kaffir lime and Thai basil.',
  '4-6',
  '8-12',
  '35 min',
  '50 min',
  ARRAY['main', 'vegan'],
  ARRAY['https://www.youtube.com/watch?v=xsyrSvUCW_A'],
  '🍛',
  '[{"group": "Aromatics", "items": [{"qty": "80", "name": "Shallots, halved", "unit": "g", "category": "produce", "estimate": "2 medium shallots"}, {"qty": "20", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "4 cloves"}, {"qty": "15", "name": "Fresh ginger, peeled", "unit": "g", "category": "produce", "estimate": "1 thumb-sized piece"}, {"qty": "30", "name": "Lemongrass, tender parts only", "unit": "g", "category": "produce", "estimate": "2 stalks"}]}, {"group": "Curry Base", "items": [{"qty": "45", "name": "Thai red curry paste", "unit": "g", "category": "pantry", "estimate": "3 tablespoons"}, {"qty": "200", "name": "Coconut cream (thick part)", "unit": "ml", "category": "pantry", "estimate": "1/2 can top layer"}, {"qty": "400", "name": "Coconut milk", "unit": "ml", "category": "pantry", "estimate": "1 can remaining"}]}, {"group": "Main Ingredients", "items": [{"qty": "400", "name": "Firm tofu, cubed 2cm", "unit": "g", "category": "protein", "estimate": "1 block"}, {"qty": "500", "name": "Butternut squash, cubed 2cm", "unit": "g", "category": "produce", "estimate": "1/2 medium squash"}, {"qty": "200", "name": "Thai eggplant, quartered", "unit": "g", "category": "produce", "estimate": "4 small or 1 regular eggplant"}]}, {"group": "Seasonings & Finish", "items": [{"qty": "30", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "2 tablespoons"}, {"qty": "15", "name": "Brown sugar", "unit": "g", "category": "pantry", "estimate": "1 tablespoon"}, {"qty": "6", "name": "Kaffir lime leaves", "unit": "leaves", "category": "produce", "estimate": "6 leaves"}, {"qty": "30", "name": "Thai basil leaves", "unit": "g", "category": "produce", "estimate": "1 large bunch"}, {"qty": "15", "name": "Lime juice, fresh", "unit": "ml", "category": "produce", "estimate": "1/2 lime"}, {"qty": "5", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1 teaspoon"}]}]'::jsonb,
  '[{"group": "Aromatics", "items": [{"qty": "160", "name": "Shallots, halved", "unit": "g", "category": "produce", "estimate": "4 medium shallots"}, {"qty": "40", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "8 cloves"}, {"qty": "30", "name": "Fresh ginger, peeled", "unit": "g", "category": "produce", "estimate": "2 thumb-sized pieces"}, {"qty": "60", "name": "Lemongrass, tender parts only", "unit": "g", "category": "produce", "estimate": "4 stalks"}]}, {"group": "Curry Base", "items": [{"qty": "90", "name": "Thai red curry paste", "unit": "g", "category": "pantry", "estimate": "6 tablespoons"}, {"qty": "400", "name": "Coconut cream (thick part)", "unit": "ml", "category": "pantry", "estimate": "1 can top layer"}, {"qty": "800", "name": "Coconut milk", "unit": "ml", "category": "pantry", "estimate": "2 cans remaining"}]}, {"group": "Main Ingredients", "items": [{"qty": "800", "name": "Firm tofu, cubed 2cm", "unit": "g", "category": "protein", "estimate": "2 blocks"}, {"qty": "1000", "name": "Butternut squash, cubed 2cm", "unit": "g", "category": "produce", "estimate": "1 medium squash"}, {"qty": "400", "name": "Thai eggplant, quartered", "unit": "g", "category": "produce", "estimate": "8 small or 2 regular eggplants"}]}, {"group": "Seasonings & Finish", "items": [{"qty": "60", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "4 tablespoons"}, {"qty": "30", "name": "Brown sugar", "unit": "g", "category": "pantry", "estimate": "2 tablespoons"}, {"qty": "12", "name": "Kaffir lime leaves", "unit": "leaves", "category": "produce", "estimate": "12 leaves"}, {"qty": "60", "name": "Thai basil leaves", "unit": "g", "category": "produce", "estimate": "2 large bunches"}, {"qty": "30", "name": "Lime juice, fresh", "unit": "ml", "category": "produce", "estimate": "1 lime"}, {"qty": "10", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "2 teaspoons"}]}]'::jsonb,
  '[{"temp": "", "time": "8 sec", "speed": 7, "action": "Prepare aromatics", "detail": "Add halved shallots, garlic, ginger, and lemongrass to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "80g", "name": "Shallots"}, {"qty": "20g", "name": "Garlic"}, {"qty": "15g", "name": "Ginger"}, {"qty": "30g", "name": "Lemongrass"}]}, {"temp": "120\u00b0C", "time": "4 min", "speed": 1, "action": "Fry curry paste", "detail": "Add red curry paste and coconut cream, cook to release oils", "reverse": true, "accessories": [], "ingredients": [{"qty": "45g", "name": "Red curry paste"}, {"qty": "200ml", "name": "Coconut cream"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Add tofu", "detail": "Add cubed tofu and fry briefly", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Tofu"}]}, {"temp": "100\u00b0C", "time": "12 min", "speed": 1, "action": "Add coconut milk and squash", "detail": "Add remaining coconut milk, butternut squash, and torn lime leaves", "reverse": true, "accessories": [], "ingredients": [{"qty": "400ml", "name": "Coconut milk"}, {"qty": "500g", "name": "Butternut squash"}, {"qty": "6 leaves", "name": "Kaffir lime leaves"}]}, {"temp": "100\u00b0C", "time": "5 min", "speed": 1, "action": "Add eggplant and seasonings", "detail": "Add eggplant, soy sauce, and brown sugar", "reverse": true, "accessories": [], "ingredients": [{"qty": "200g", "name": "Thai eggplant"}, {"qty": "30ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Brown sugar"}]}, {"temp": "", "time": "10 sec", "speed": 2, "action": "Final seasoning", "detail": "Add salt, stir through", "reverse": true, "accessories": [], "ingredients": [{"qty": "5g", "name": "Salt"}]}, {"temp": "", "time": "10 sec", "speed": 1, "action": "Finish with herbs", "detail": "Add Thai basil and lime juice, stir gently to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "30g", "name": "Thai basil"}, {"qty": "15ml", "name": "Lime juice"}]}]'::jsonb,
  '[{"temp": "", "time": "8 sec", "speed": 7, "action": "Prepare aromatics (both bowls)", "detail": "Add half the shallots, garlic, ginger, and lemongrass to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "80g", "name": "Shallots"}, {"qty": "20g", "name": "Garlic"}, {"qty": "15g", "name": "Ginger"}, {"qty": "30g", "name": "Lemongrass"}]}, {"temp": "120\u00b0C", "time": "4 min", "speed": 1, "action": "Bowl 1 - Fry curry paste", "detail": "Add half the red curry paste and coconut cream, cook to release oils", "reverse": true, "accessories": [], "ingredients": [{"qty": "45g", "name": "Red curry paste"}, {"qty": "200ml", "name": "Coconut cream"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Bowl 1 - Add tofu", "detail": "Add half the cubed tofu and fry briefly", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Tofu"}]}, {"temp": "100\u00b0C", "time": "17 min", "speed": 1, "action": "Bowl 1 - Simmer curry", "detail": "Add half coconut milk, squash, lime leaves. Meanwhile prep Bowl 2 aromatics", "reverse": true, "accessories": [], "ingredients": [{"qty": "400ml", "name": "Coconut milk"}, {"qty": "500g", "name": "Butternut squash"}, {"qty": "200g", "name": "Thai eggplant"}, {"qty": "as above", "name": "Seasonings"}]}, {"temp": "", "time": "30 sec", "speed": 1, "action": "Bowl 1 - Finish", "detail": "Add salt, basil, lime juice to Bowl 1. Transfer to serving dish", "reverse": true, "accessories": [], "ingredients": [{"qty": "5g", "name": "Salt"}, {"qty": "30g", "name": "Thai basil"}, {"qty": "15ml", "name": "Lime juice"}]}, {"temp": "varies", "time": "25 min", "speed": null, "action": "Bowl 2 - Repeat process", "detail": "Clean bowl, repeat entire process with remaining ingredients", "reverse": true, "accessories": [], "ingredients": [{"qty": "half portions", "name": "All remaining ingredients"}]}]'::jsonb,
  '{"fat": "28g", "carbs": "22g", "fiber": "6g", "protein": "18g", "calories": 385}'::jsonb,
  2,
  'b1411d00-ad6c-46dc-8cbf-87e4e08ddacb',
  '2026-03-16T20:01:05.624389+00:00',
  '2026-03-16T20:01:05.624389+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '8f06d872-a8eb-4d8d-8e4b-ca2a788920ec',
  'Vietnamese Pho with Tofu',
  'Aromatic Vietnamese noodle soup with fragrant five-spice broth, silky rice noodles, and golden pan-fried tofu.',
  '4',
  '8',
  '90 min',
  '105 min',
  ARRAY['soup', 'main', 'vegan'],
  '{}'::text[],
  '🍜',
  '[{"group": "Broth", "items": [{"qty": "200", "name": "Onion, halved", "unit": "g", "category": "produce", "estimate": "1 large onion"}, {"qty": "60", "name": "Fresh ginger, sliced", "unit": "g", "category": "produce", "estimate": "2 thumb-sized pieces"}, {"qty": "4", "name": "Star anise", "unit": "pieces", "category": "spices", "estimate": "4 whole pods"}, {"qty": "1", "name": "Cinnamon stick", "unit": "piece", "category": "spices", "estimate": "1 stick"}, {"qty": "4", "name": "Whole cloves", "unit": "pieces", "category": "spices", "estimate": "4 cloves"}, {"qty": "5", "name": "Fennel seeds", "unit": "g", "category": "spices", "estimate": "1 tsp"}, {"qty": "5", "name": "Coriander seeds", "unit": "g", "category": "spices", "estimate": "1 tsp"}, {"qty": "1500", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "1.5 liters"}, {"qty": "30", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "2 tbsp"}, {"qty": "15", "name": "Rock sugar", "unit": "g", "category": "pantry", "estimate": "1 tbsp"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 tsp"}]}, {"group": "Tofu & Noodles", "items": [{"qty": "300", "name": "Firm tofu, cubed", "unit": "g", "category": "pantry", "estimate": "1 block"}, {"qty": "240", "name": "Rice noodles (banh pho)", "unit": "g", "category": "pantry", "estimate": "4 portions"}, {"qty": "15", "name": "Neutral oil", "unit": "ml", "category": "pantry", "estimate": "1 tbsp"}]}, {"group": "Garnishes", "items": [{"qty": "100", "name": "Bean sprouts", "unit": "g", "category": "produce", "estimate": "1 cup"}, {"qty": "20", "name": "Fresh cilantro", "unit": "g", "category": "produce", "estimate": "1/2 bunch"}, {"qty": "20", "name": "Fresh mint", "unit": "g", "category": "produce", "estimate": "small handful"}, {"qty": "20", "name": "Thai basil", "unit": "g", "category": "produce", "estimate": "small handful"}, {"qty": "2", "name": "Lime", "unit": "pieces", "category": "produce", "estimate": "2 limes"}, {"qty": "10", "name": "Red chili, sliced", "unit": "g", "category": "produce", "estimate": "1 small chili"}, {"qty": "30", "name": "Spring onions, sliced", "unit": "g", "category": "produce", "estimate": "2-3 stalks"}]}]'::jsonb,
  '[{"group": "Broth", "items": [{"qty": "400", "name": "Onion, halved", "unit": "g", "category": "produce", "estimate": "2 large onions"}, {"qty": "120", "name": "Fresh ginger, sliced", "unit": "g", "category": "produce", "estimate": "4 thumb-sized pieces"}, {"qty": "8", "name": "Star anise", "unit": "pieces", "category": "spices", "estimate": "8 whole pods"}, {"qty": "2", "name": "Cinnamon stick", "unit": "pieces", "category": "spices", "estimate": "2 sticks"}, {"qty": "8", "name": "Whole cloves", "unit": "pieces", "category": "spices", "estimate": "8 cloves"}, {"qty": "10", "name": "Fennel seeds", "unit": "g", "category": "spices", "estimate": "2 tsp"}, {"qty": "10", "name": "Coriander seeds", "unit": "g", "category": "spices", "estimate": "2 tsp"}, {"qty": "3000", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3 liters"}, {"qty": "60", "name": "Soy sauce", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}, {"qty": "30", "name": "Rock sugar", "unit": "g", "category": "pantry", "estimate": "2 tbsp"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}]}, {"group": "Tofu & Noodles", "items": [{"qty": "600", "name": "Firm tofu, cubed", "unit": "g", "category": "pantry", "estimate": "2 blocks"}, {"qty": "480", "name": "Rice noodles (banh pho)", "unit": "g", "category": "pantry", "estimate": "8 portions"}, {"qty": "30", "name": "Neutral oil", "unit": "ml", "category": "pantry", "estimate": "2 tbsp"}]}, {"group": "Garnishes", "items": [{"qty": "200", "name": "Bean sprouts", "unit": "g", "category": "produce", "estimate": "2 cups"}, {"qty": "40", "name": "Fresh cilantro", "unit": "g", "category": "produce", "estimate": "1 bunch"}, {"qty": "40", "name": "Fresh mint", "unit": "g", "category": "produce", "estimate": "2 small handfuls"}, {"qty": "40", "name": "Thai basil", "unit": "g", "category": "produce", "estimate": "2 small handfuls"}, {"qty": "4", "name": "Lime", "unit": "pieces", "category": "produce", "estimate": "4 limes"}, {"qty": "20", "name": "Red chili, sliced", "unit": "g", "category": "produce", "estimate": "2 small chilies"}, {"qty": "60", "name": "Spring onions, sliced", "unit": "g", "category": "produce", "estimate": "4-6 stalks"}]}]'::jsonb,
  '[{"temp": "120\u00b0C", "time": "8 min", "speed": 1, "action": "Char aromatics", "detail": "Place onion halves and ginger slices in bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "60g", "name": "Ginger"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Add spices", "detail": "Add star anise, cinnamon, cloves, fennel seeds, and coriander seeds to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "4 pieces", "name": "Star anise"}, {"qty": "1 piece", "name": "Cinnamon stick"}, {"qty": "4 pieces", "name": "Cloves"}, {"qty": "5g", "name": "Fennel seeds"}, {"qty": "5g", "name": "Coriander seeds"}]}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Add stock and seasonings", "detail": "Add vegetable stock, soy sauce, and rock sugar to bowl", "reverse": true, "accessories": [], "ingredients": [{"qty": "1500ml", "name": "Vegetable stock"}, {"qty": "30ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Rock sugar"}]}, {"temp": "", "time": "2 min", "speed": 1, "action": "Strain broth", "detail": "Strain broth through simmering basket into another container, discard solids, return broth to bowl", "reverse": false, "accessories": ["simmering basket"], "ingredients": []}, {"note": "", "temp": "80\u00b0C", "time": "1 min", "speed": 1, "action": "Season broth", "detail": "Add salt to taste and keep warm", "reverse": false, "accessories": [], "ingredients": [{"qty": "6", "name": "Salt"}]}, {"temp": "", "time": "15 min", "speed": null, "action": "Prepare garnishes", "detail": "Meanwhile, pan-fry tofu cubes with oil until golden. Cook rice noodles according to package instructions. Arrange herbs, bean sprouts, lime wedges, and chili on serving plates", "reverse": false, "accessories": [], "ingredients": [{"qty": "300g", "name": "Tofu"}, {"qty": "240g", "name": "Rice noodles"}, {"qty": "15ml", "name": "Oil"}]}, {"temp": "", "time": "2 min", "speed": null, "action": "Serve", "detail": "Divide cooked noodles and tofu among bowls, ladle hot broth over, serve with garnishes on the side", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '[{"temp": "120\u00b0C", "time": "8 min", "speed": 1, "action": "Bowl 1: Char aromatics", "detail": "Place half the onions and ginger in Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "60g", "name": "Ginger"}]}, {"temp": "120\u00b0C", "time": "2 min", "speed": 1, "action": "Bowl 1: Add spices", "detail": "Add half the spices to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "4 pieces", "name": "Star anise"}, {"qty": "1 piece", "name": "Cinnamon stick"}, {"qty": "4 pieces", "name": "Cloves"}, {"qty": "5g", "name": "Fennel seeds"}, {"qty": "5g", "name": "Coriander seeds"}]}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Bowl 1: Start broth", "detail": "Add 1.5L stock, 30ml soy sauce, and 15g sugar to Bowl 1", "reverse": true, "accessories": [], "ingredients": [{"qty": "1500ml", "name": "Vegetable stock"}, {"qty": "30ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Rock sugar"}]}, {"temp": "120\u00b0C", "time": "10 min", "speed": 1, "action": "Bowl 2: Prepare second batch", "detail": "While Bowl 1 simmers, prep Bowl 2 with remaining aromatics and spices", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Onion"}, {"qty": "60g", "name": "Ginger"}, {"qty": "remaining", "name": "Spices"}]}, {"temp": "", "time": "3 min", "speed": 1, "action": "Bowl 1: Strain and transfer", "detail": "Strain Bowl 1 broth, transfer to large pot, keep warm", "reverse": false, "accessories": ["simmering basket"], "ingredients": []}, {"temp": "100\u00b0C", "time": "45 min", "speed": 1, "action": "Bowl 2: Complete second batch", "detail": "Add remaining 1.5L stock to Bowl 2, simmer 45 minutes", "reverse": true, "accessories": [], "ingredients": [{"qty": "1500ml", "name": "Vegetable stock"}, {"qty": "30ml", "name": "Soy sauce"}, {"qty": "15g", "name": "Rock sugar"}]}, {"temp": "", "time": "3 min", "speed": 1, "action": "Combine and season", "detail": "Strain Bowl 2 broth, combine with Bowl 1 broth, season with salt", "reverse": false, "accessories": ["simmering basket"], "ingredients": [{"qty": "16g", "name": "Salt"}]}, {"temp": "", "time": "20 min", "speed": null, "action": "Prepare accompaniments", "detail": "Pan-fry all tofu, cook all noodles, prepare garnishes", "reverse": false, "accessories": [], "ingredients": [{"qty": "600g", "name": "Tofu"}, {"qty": "480g", "name": "Rice noodles"}]}]'::jsonb,
  '{"fat": "12g", "carbs": "65g", "fiber": "4g", "protein": "18g", "calories": 420}'::jsonb,
  3,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-17T00:36:15.15281+00:00',
  '2026-03-17T00:39:48.819+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  'f77f2258-da1b-4c60-81d2-363ae0cdfb33',
  'Enchiladas Suizas Vegetarianas',
  'Enchiladas mexicanas rellenas de queso y espinacas, cubiertas con salsa verde de tomatillo y gratinadas con queso. Cremosas y reconfortantes.',
  '4-6',
  '8-12',
  '65 min',
  '85 min',
  ARRAY['main', 'mexican'],
  '{}'::text[],
  '🌯',
  '[{"group": "Salsa Verde", "items": [{"qty": "600", "name": "Tomatillos, husked and halved", "unit": "g", "category": "produce", "estimate": "12-15 medium tomatillos"}, {"qty": "100", "name": "White onion, quartered", "unit": "g", "category": "produce", "estimate": "2/3 medium onion"}, {"qty": "15", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "3 cloves"}, {"qty": "20", "name": "Jalape\u00f1o pepper, deseeded", "unit": "g", "category": "produce", "estimate": "1 small jalape\u00f1o"}, {"qty": "30", "name": "Fresh cilantro leaves", "unit": "g", "category": "produce", "estimate": "1/2 bunch"}, {"qty": "200", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "3/4 cup"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 tsp"}]}, {"group": "Relleno", "items": [{"qty": "300", "name": "Fresh spinach leaves", "unit": "g", "category": "produce", "estimate": "1 large bag"}, {"qty": "200", "name": "Monterey Jack cheese, cubed", "unit": "g", "category": "dairy", "estimate": "7 oz block"}, {"qty": "150", "name": "Mexican crema or sour cream", "unit": "ml", "category": "dairy", "estimate": "2/3 cup"}]}, {"group": "Ensamblado", "items": [{"qty": "20", "name": "Corn tortillas (6-inch)", "unit": "pieces", "category": "pantry", "estimate": "20 tortillas (4-5 per person)"}, {"qty": "150", "name": "Monterey Jack cheese, grated", "unit": "g", "category": "dairy", "estimate": "1.5 cups grated"}, {"qty": "100", "name": "Mexican crema", "unit": "ml", "category": "dairy", "estimate": "1/2 cup"}, {"qty": "60", "name": "Olive oil for frying", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}]}]'::jsonb,
  '[{"group": "Salsa Verde", "items": [{"qty": "1200", "name": "Tomatillos, husked and halved", "unit": "g", "category": "produce", "estimate": "24-30 medium tomatillos"}, {"qty": "200", "name": "White onion, quartered", "unit": "g", "category": "produce", "estimate": "1.3 medium onions"}, {"qty": "30", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "6 cloves"}, {"qty": "40", "name": "Jalape\u00f1o pepper, deseeded", "unit": "g", "category": "produce", "estimate": "2 small jalape\u00f1os"}, {"qty": "60", "name": "Fresh cilantro leaves", "unit": "g", "category": "produce", "estimate": "1 bunch"}, {"qty": "400", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "1.5 cups"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}]}, {"group": "Relleno", "items": [{"qty": "600", "name": "Fresh spinach leaves", "unit": "g", "category": "produce", "estimate": "2 large bags"}, {"qty": "400", "name": "Monterey Jack cheese, cubed", "unit": "g", "category": "dairy", "estimate": "14 oz blocks"}, {"qty": "300", "name": "Mexican crema or sour cream", "unit": "ml", "category": "dairy", "estimate": "1.3 cups"}]}, {"group": "Ensamblado", "items": [{"qty": "40", "name": "Corn tortillas (6-inch)", "unit": "pieces", "category": "pantry", "estimate": "40 tortillas (4-5 per person)"}, {"qty": "300", "name": "Monterey Jack cheese, grated", "unit": "g", "category": "dairy", "estimate": "3 cups grated"}, {"qty": "200", "name": "Mexican crema", "unit": "ml", "category": "dairy", "estimate": "1 cup"}, {"qty": "120", "name": "Olive oil for frying", "unit": "ml", "category": "pantry", "estimate": "8 tbsp"}]}]'::jsonb,
  '[{"temp": "", "time": "", "speed": null, "action": "Preheat oven", "detail": "Preheat oven to 180\u00b0C. Grease a large baking dish", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add onion and garlic to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "100g", "name": "White onion"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Add tomatillos and jalape\u00f1o", "detail": "Add tomatillos and jalape\u00f1o to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "600g", "name": "Tomatillos"}, {"qty": "20g", "name": "Jalape\u00f1o"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Cook salsa base", "detail": "Cook tomatillo mixture, scraping sides halfway", "reverse": true, "accessories": [], "ingredients": []}, {"temp": "", "time": "10 sec", "speed": 7, "action": "Add cilantro and stock", "detail": "Add cilantro and vegetable stock", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Cilantro"}, {"qty": "200ml", "name": "Vegetable stock"}]}, {"temp": "", "time": "5 sec", "speed": 8, "action": "Season salsa", "detail": "Add salt and blend until smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}]}, {"temp": "", "time": "", "speed": null, "action": "Transfer salsa", "detail": "Transfer salsa verde to a bowl and set aside. Clean bowl", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "Varoma", "time": "3 min", "speed": 1, "action": "Wilt spinach", "detail": "Steam spinach until wilted, then squeeze out excess water", "reverse": false, "accessories": ["Varoma dish"], "ingredients": [{"qty": "300g", "name": "Spinach"}]}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Prepare cheese filling", "detail": "Chop Monterey Jack cheese for filling", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Monterey Jack cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Mix filling", "detail": "Mix chopped cheese with wilted spinach and crema in a bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "150ml", "name": "Mexican crema"}]}, {"temp": "", "time": "", "speed": null, "action": "Warm tortillas", "detail": "Heat tortillas in a dry pan or microwave to make them pliable", "reverse": false, "accessories": [], "ingredients": [{"qty": "20 pieces", "name": "Corn tortillas"}]}, {"temp": "", "time": "", "speed": null, "action": "Assemble enchiladas", "detail": "Fill each tortilla with cheese-spinach mixture, roll tightly, and place seam-side down in baking dish", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "", "speed": null, "action": "Top enchiladas", "detail": "Pour salsa verde over enchiladas, drizzle with crema, and sprinkle with grated cheese", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Grated cheese"}, {"qty": "100ml", "name": "Mexican crema"}]}, {"temp": "", "time": "", "speed": null, "action": "Bake", "detail": "Bake for 20-25 minutes until cheese is bubbly and golden. Rest 5 minutes before serving", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '[{"temp": "", "time": "", "speed": null, "action": "Preheat oven", "detail": "Preheat oven to 180\u00b0C. Grease two large baking dishes", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Bowl 1: Chop aromatics", "detail": "Add half the onion and garlic to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "100g", "name": "White onion"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Bowl 1: Add tomatillos batch 1", "detail": "Add half the tomatillos and jalape\u00f1o to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "600g", "name": "Tomatillos"}, {"qty": "20g", "name": "Jalape\u00f1o"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Bowl 1: Cook salsa base", "detail": "Cook first batch of tomatillo mixture, scraping sides halfway", "reverse": true, "accessories": [], "ingredients": []}, {"temp": "", "time": "15 sec", "speed": 8, "action": "Bowl 1: Complete first salsa", "detail": "Add half the cilantro and stock, blend with salt until smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Cilantro"}, {"qty": "200ml", "name": "Stock"}, {"qty": "8g", "name": "Salt"}]}, {"temp": "", "time": "", "speed": null, "action": "Transfer and prep Bowl 2", "detail": "Transfer salsa to large bowl. Clean Bowl 1, set up Bowl 2 with remaining aromatics", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Bowl 2: Chop remaining aromatics", "detail": "Chop remaining onion and garlic in Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "100g", "name": "White onion"}, {"qty": "15g", "name": "Garlic"}]}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Bowl 2: Add tomatillos batch 2", "detail": "Add remaining tomatillos and jalape\u00f1o to Bowl 2", "reverse": false, "accessories": [], "ingredients": [{"qty": "600g", "name": "Tomatillos"}, {"qty": "20g", "name": "Jalape\u00f1o"}]}, {"temp": "Varoma", "time": "3 min", "speed": 1, "action": "Bowl 1: Steam spinach", "detail": "Steam half the spinach in Bowl 1 while Bowl 2 cooks", "reverse": false, "accessories": ["Varoma dish"], "ingredients": [{"qty": "300g", "name": "Spinach"}]}, {"temp": "100\u00b0C", "time": "15 min", "speed": 1, "action": "Bowl 2: Cook second salsa", "detail": "Cook second batch of tomatillo mixture", "reverse": true, "accessories": [], "ingredients": []}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Bowl 1: Chop cheese", "detail": "Clean Bowl 1, chop half the cheese for filling", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Monterey Jack cheese"}]}, {"temp": "", "time": "15 sec", "speed": 8, "action": "Bowl 2: Complete second salsa", "detail": "Add remaining cilantro, stock and salt to Bowl 2, blend smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Cilantro"}, {"qty": "200ml", "name": "Stock"}, {"qty": "8g", "name": "Salt"}]}, {"temp": "Varoma", "time": "3 min", "speed": 1, "action": "Bowl 2: Steam remaining spinach", "detail": "Steam remaining spinach in Bowl 2", "reverse": false, "accessories": ["Varoma dish"], "ingredients": [{"qty": "300g", "name": "Spinach"}]}, {"temp": "", "time": "8 sec", "speed": 6, "action": "Bowl 2: Chop remaining cheese", "detail": "Clean Bowl 2, chop remaining cheese", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Monterey Jack cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Mix fillings and assemble", "detail": "Combine all salsas, mix cheese with spinach and crema. Warm tortillas, fill, roll, and place in baking dishes", "reverse": false, "accessories": [], "ingredients": [{"qty": "40 pieces", "name": "Tortillas"}, {"qty": "300ml", "name": "Crema"}]}, {"temp": "", "time": "", "speed": null, "action": "Top and bake", "detail": "Top with salsa, crema drizzle, and grated cheese. Bake 25-30 minutes until bubbly", "reverse": false, "accessories": [], "ingredients": [{"qty": "300g", "name": "Grated cheese"}, {"qty": "200ml", "name": "Crema"}]}]'::jsonb,
  '{"fat": "28g", "carbs": "42g", "fiber": "6g", "protein": "18g", "calories": 485}'::jsonb,
  3,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-17T04:21:47.708399+00:00',
  '2026-03-17T04:21:47.708399+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  'af75ca2f-1a03-4a35-baf6-6cb1b8a2168c',
  'Panera-Style Creamy Mac and Cheese',
  'Rich and creamy macaroni and cheese with sharp Vermont cheddar in a velvety cheese sauce. Restaurant-quality comfort food made easy.',
  '4-6',
  '8-12',
  '35 min',
  '65 min',
  ARRAY['main', 'comfort-food'],
  '{}'::text[],
  '🧀',
  '[{"group": "Pasta", "items": [{"qty": "400", "name": "Elbow macaroni", "unit": "g", "category": "pantry", "estimate": "about 3 cups dry"}, {"qty": "1000", "name": "Water for pasta", "unit": "ml", "category": "pantry", "estimate": "4 cups"}, {"qty": "10", "name": "Salt for pasta water", "unit": "g", "category": "pantry", "estimate": "2 tsp"}]}, {"group": "Cheese Sauce", "items": [{"qty": "60", "name": "Butter", "unit": "g", "category": "dairy", "estimate": "4 tbsp"}, {"qty": "45", "name": "Plain flour", "unit": "g", "category": "pantry", "estimate": "3 tbsp"}, {"qty": "500", "name": "Whole milk", "unit": "ml", "category": "dairy", "estimate": "2 cups"}, {"qty": "125", "name": "Heavy cream", "unit": "ml", "category": "dairy", "estimate": "1/2 cup"}, {"qty": "300", "name": "Sharp cheddar cheese, cubed", "unit": "g", "category": "dairy", "estimate": "3 cups shredded"}, {"qty": "115", "name": "Cream cheese", "unit": "g", "category": "dairy", "estimate": "4 oz package"}, {"qty": "5", "name": "Dijon mustard", "unit": "g", "category": "pantry", "estimate": "1 tsp"}, {"qty": "2", "name": "Paprika", "unit": "g", "category": "pantry", "estimate": "1/2 tsp"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1 1/2 tsp"}, {"qty": "1", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1/4 tsp"}]}]'::jsonb,
  '[{"group": "Pasta", "items": [{"qty": "800", "name": "Elbow macaroni", "unit": "g", "category": "pantry", "estimate": "about 6 cups dry"}, {"qty": "2000", "name": "Water for pasta", "unit": "ml", "category": "pantry", "estimate": "8 cups"}, {"qty": "20", "name": "Salt for pasta water", "unit": "g", "category": "pantry", "estimate": "4 tsp"}]}, {"group": "Cheese Sauce", "items": [{"qty": "120", "name": "Butter", "unit": "g", "category": "dairy", "estimate": "8 tbsp"}, {"qty": "90", "name": "Plain flour", "unit": "g", "category": "pantry", "estimate": "6 tbsp"}, {"qty": "1000", "name": "Whole milk", "unit": "ml", "category": "dairy", "estimate": "4 cups"}, {"qty": "250", "name": "Heavy cream", "unit": "ml", "category": "dairy", "estimate": "1 cup"}, {"qty": "600", "name": "Sharp cheddar cheese, cubed", "unit": "g", "category": "dairy", "estimate": "6 cups shredded"}, {"qty": "230", "name": "Cream cheese", "unit": "g", "category": "dairy", "estimate": "8 oz"}, {"qty": "10", "name": "Dijon mustard", "unit": "g", "category": "pantry", "estimate": "2 tsp"}, {"qty": "4", "name": "Paprika", "unit": "g", "category": "pantry", "estimate": "1 tsp"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1/2 tsp"}]}]'::jsonb,
  '[{"temp": "100\u00b0C", "time": "12 min", "speed": 1, "action": "Cook pasta", "detail": "Add water and salt to bowl, insert simmering basket with pasta", "reverse": true, "accessories": ["simmering basket"], "ingredients": [{"qty": "1000ml", "name": "Water"}, {"qty": "10g", "name": "Salt"}, {"qty": "400g", "name": "Pasta"}]}, {"temp": "", "time": "", "speed": null, "action": "Drain pasta", "detail": "Remove simmering basket with pasta, set aside. Empty and rinse bowl", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "100\u00b0C", "time": "3 min", "speed": 2, "action": "Make roux", "detail": "Add butter to clean bowl, melt and cook with flour", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Butter"}, {"qty": "45g", "name": "Flour"}]}, {"temp": "90\u00b0C", "time": "5 min", "speed": 4, "action": "Add milk gradually", "detail": "Add milk and cream gradually while mixing to avoid lumps", "reverse": false, "accessories": [], "ingredients": [{"qty": "500ml", "name": "Milk"}, {"qty": "125ml", "name": "Heavy cream"}]}, {"temp": "80\u00b0C", "time": "3 min", "speed": 3, "action": "Melt cheeses", "detail": "Add cubed cheddar and cream cheese, melt until smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "300g", "name": "Cheddar cheese"}, {"qty": "115g", "name": "Cream cheese"}]}, {"temp": "", "time": "30 sec", "speed": 3, "action": "Season sauce", "detail": "Add mustard, paprika, salt, and pepper, mix well", "reverse": false, "accessories": [], "ingredients": [{"qty": "5g", "name": "Dijon mustard"}, {"qty": "2g", "name": "Paprika"}, {"qty": "8g", "name": "Salt"}, {"qty": "1g", "name": "Black pepper"}]}, {"temp": "", "time": "1 min", "speed": 2, "action": "Combine with pasta", "detail": "Add cooked pasta back to bowl, fold gently to coat", "reverse": true, "accessories": [], "ingredients": [{"qty": "400g", "name": "Cooked pasta"}]}]'::jsonb,
  '[{"temp": "100\u00b0C", "time": "12 min", "speed": 1, "action": "Bowl 1: Cook first batch pasta", "detail": "Add 1000ml water, 10g salt to Bowl 1, insert simmering basket with 400g pasta", "reverse": true, "accessories": ["simmering basket"], "ingredients": [{"qty": "1000ml", "name": "Water"}, {"qty": "10g", "name": "Salt"}, {"qty": "400g", "name": "Pasta"}]}, {"temp": "", "time": "", "speed": null, "action": "Prepare Bowl 2 while Bowl 1 cooks", "detail": "Set up second bowl with remaining water, salt, and pasta ready", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "100\u00b0C", "time": "12 min", "speed": 1, "action": "Bowl 2: Cook second batch pasta", "detail": "Swap bowls, cook remaining pasta while first batch cools", "reverse": true, "accessories": ["simmering basket"], "ingredients": [{"qty": "1000ml", "name": "Water"}, {"qty": "10g", "name": "Salt"}, {"qty": "400g", "name": "Pasta"}]}, {"temp": "100\u00b0C", "time": "3 min", "speed": 2, "action": "Bowl 1: Start cheese sauce", "detail": "Clean Bowl 1, add butter and flour for roux", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Butter"}, {"qty": "45g", "name": "Flour"}]}, {"temp": "90\u00b0C", "time": "5 min", "speed": 4, "action": "Bowl 1: Add liquids", "detail": "Add half the milk and cream to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "500ml", "name": "Milk"}, {"qty": "125ml", "name": "Heavy cream"}]}, {"temp": "100\u00b0C then 90\u00b0C", "time": "8 min", "speed": null, "action": "Bowl 2: Make second sauce", "detail": "Swap to clean Bowl 2, repeat roux and liquid process", "reverse": false, "accessories": [], "ingredients": [{"qty": "60g", "name": "Butter"}, {"qty": "45g", "name": "Flour"}, {"qty": "500ml", "name": "Milk"}, {"qty": "125ml", "name": "Heavy cream"}]}, {"temp": "80\u00b0C", "time": "4 min", "speed": 3, "action": "Both bowls: Add cheese and season", "detail": "Add half the cheese and seasonings to each bowl, melt and combine with pasta", "reverse": true, "accessories": [], "ingredients": [{"qty": "as divided", "name": "All remaining ingredients"}]}]'::jsonb,
  '{"fat": "28g", "carbs": "45g", "fiber": "2g", "protein": "22g", "calories": 520}'::jsonb,
  3,
  'c20352a7-06af-4ac1-aa62-c5b52ca513a1',
  '2026-03-18T04:15:26.282837+00:00',
  '2026-03-18T04:15:26.282837+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '8d76e019-d381-4933-82be-a368ade99f79',
  'Kale Sauce Pasta',
  'A vibrant pasta dish with creamy kale sauce made from blanched kale leaves, garlic, olive oil, and cheese.',
  '2',
  '4',
  '20 min',
  '25 min',
  ARRAY['main', 'vegetarian'],
  '{}'::text[],
  '🥬',
  '[{"group": "Sauce", "items": [{"qty": "10", "name": "Garlic cloves, peeled", "unit": "g", "category": "produce", "estimate": "2 cloves"}, {"qty": "60", "name": "Extra virgin olive oil", "unit": "ml", "category": "pantry", "estimate": "1/4 cup"}, {"qty": "450", "name": "Lacinato kale, thick ribs removed", "unit": "g", "category": "produce", "estimate": "1 pound"}, {"qty": "75", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "3/4 cup grated"}, {"qty": "8", "name": "Kosher salt", "unit": "g", "category": "pantry", "estimate": "1 1/2 tsp"}, {"qty": "2", "name": "Black pepper, freshly ground", "unit": "g", "category": "spices", "estimate": "1/2 tsp"}]}, {"group": "Pasta", "items": [{"qty": "225", "name": "Pasta", "unit": "g", "category": "pantry", "estimate": "1/2 pound"}, {"qty": "1500", "name": "Water for boiling", "unit": "ml", "category": "water", "estimate": "6 cups"}, {"qty": "15", "name": "Salt for pasta water", "unit": "g", "category": "pantry", "estimate": "1 tbsp"}]}]'::jsonb,
  '[{"group": "Sauce", "items": [{"qty": "20", "name": "Garlic cloves, peeled", "unit": "g", "category": "produce", "estimate": "4 cloves"}, {"qty": "120", "name": "Extra virgin olive oil", "unit": "ml", "category": "pantry", "estimate": "1/2 cup"}, {"qty": "900", "name": "Lacinato kale, thick ribs removed", "unit": "g", "category": "produce", "estimate": "2 pounds"}, {"qty": "150", "name": "Parmesan cheese, cubed", "unit": "g", "category": "dairy", "estimate": "1 1/2 cups grated"}, {"qty": "16", "name": "Kosher salt", "unit": "g", "category": "pantry", "estimate": "3 tsp"}, {"qty": "4", "name": "Black pepper, freshly ground", "unit": "g", "category": "spices", "estimate": "1 tsp"}]}, {"group": "Pasta", "items": [{"qty": "450", "name": "Pasta", "unit": "g", "category": "pantry", "estimate": "1 pound"}, {"qty": "3000", "name": "Water for boiling", "unit": "ml", "category": "water", "estimate": "12 cups"}, {"qty": "30", "name": "Salt for pasta water", "unit": "g", "category": "pantry", "estimate": "2 tbsp"}]}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 10, "action": "Grate Parmesan", "detail": "Add cubed Parmesan to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "75g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Set aside cheese", "detail": "Remove grated cheese and set aside", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Chop garlic", "detail": "Add garlic cloves to bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "10g", "name": "Garlic cloves"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Cook garlic", "detail": "Add olive oil and cook until fragrant", "reverse": false, "accessories": [], "ingredients": [{"qty": "60ml", "name": "Extra virgin olive oil"}]}, {"temp": "", "time": "", "speed": null, "action": "Boil water", "detail": "Meanwhile, boil salted water in a large pot and cook pasta according to package directions. Reserve 250ml pasta water before draining", "reverse": false, "accessories": [], "ingredients": [{"qty": "1500ml", "name": "Water"}, {"qty": "15g", "name": "Salt"}, {"qty": "225g", "name": "Pasta"}]}, {"temp": "", "time": "", "speed": null, "action": "Blanch kale", "detail": "Add kale leaves to the boiling pasta water for the last 2 minutes of cooking. Remove with tongs and add directly to Thermomix bowl", "reverse": false, "accessories": [], "ingredients": [{"qty": "450g", "name": "Lacinato kale"}]}, {"temp": "", "time": "30 sec", "speed": 10, "action": "Blend sauce", "detail": "Add 100ml hot pasta water and blend to smooth puree", "reverse": false, "accessories": [], "ingredients": [{"qty": "100ml", "name": "Reserved pasta water"}]}, {"temp": "", "time": "10 sec", "speed": 4, "action": "Season and finish", "detail": "Add salt, pepper, and half the grated cheese. Blend briefly", "reverse": false, "accessories": [], "ingredients": [{"qty": "8g", "name": "Kosher salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "40g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Combine with pasta", "detail": "Toss drained pasta with kale sauce, adding more pasta water if needed for creamy consistency. Serve immediately topped with remaining cheese", "reverse": false, "accessories": [], "ingredients": [{"qty": "225g", "name": "Cooked pasta"}, {"qty": "35g", "name": "Remaining cheese"}]}]'::jsonb,
  '[{"temp": "", "time": "15 sec", "speed": 10, "action": "Bowl 1: Grate all Parmesan", "detail": "Add all cubed Parmesan to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Parmesan cheese"}]}, {"temp": "", "time": "", "speed": null, "action": "Set aside cheese", "detail": "Remove grated cheese and divide into two portions. Set aside", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "3 sec", "speed": 7, "action": "Bowl 1: Chop half the garlic", "detail": "Add half the garlic cloves to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "10g", "name": "Garlic cloves"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Bowl 1: Cook first batch garlic", "detail": "Add half the olive oil and cook until fragrant", "reverse": false, "accessories": [], "ingredients": [{"qty": "60ml", "name": "Extra virgin olive oil"}]}, {"temp": "", "time": "", "speed": null, "action": "Start pasta water", "detail": "Meanwhile, boil large pot of salted water for pasta", "reverse": false, "accessories": [], "ingredients": [{"qty": "3000ml", "name": "Water"}, {"qty": "30g", "name": "Salt"}]}, {"temp": "", "time": "", "speed": null, "action": "Bowl 1: Add first batch kale", "detail": "Add half the blanched kale (removed from pasta water with tongs) to Bowl 1", "reverse": false, "accessories": [], "ingredients": [{"qty": "450g", "name": "Lacinato kale"}]}, {"temp": "", "time": "30 sec", "speed": 10, "action": "Bowl 1: Blend first sauce", "detail": "Add pasta water and blend to smooth puree", "reverse": false, "accessories": [], "ingredients": [{"qty": "100ml", "name": "Reserved pasta water"}]}, {"temp": "", "time": "10 sec", "speed": 4, "action": "Bowl 1: Season first batch", "detail": "Add half the salt, pepper, and cheese. Blend briefly. Set aside", "reverse": false, "accessories": [], "ingredients": [{"qty": "8g", "name": "Kosher salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "75g", "name": "Parmesan cheese"}]}, {"temp": "120\u00b0C then none", "time": "4 min", "speed": null, "action": "Bowl 2: Prepare second batch", "detail": "Clean bowl, add remaining garlic, oil, blanched kale, and repeat blending process", "reverse": false, "accessories": [], "ingredients": [{"qty": "half portions", "name": "Remaining ingredients"}]}, {"temp": "", "time": "", "speed": null, "action": "Combine and serve", "detail": "Cook all pasta, drain reserving water. Combine both sauce batches with pasta, adding pasta water as needed. Serve with remaining cheese", "reverse": false, "accessories": [], "ingredients": [{"qty": "450g", "name": "Cooked pasta"}]}]'::jsonb,
  '{"fat": "24g", "carbs": "58g", "fiber": "4g", "protein": "18g", "calories": 520}'::jsonb,
  3,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-18T04:47:30.039646+00:00',
  '2026-03-18T04:47:30.039646+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '8b10698d-3d05-4c19-99e6-56493032761b',
  'Very Moist Lemon Pound Cake',
  'An incredibly soft and moist lemon pound cake made with fresh lemon juice and zest, soaked in lemon syrup and topped with a glossy lemon glaze.',
  '8-10',
  '16-20',
  '90 min',
  '120 min',
  ARRAY['dessert', 'cake'],
  ARRAY['https://pastryliving.com/very-soft-moist-lemon-pound-cake-from-scratch/'],
  '🍋',
  '[{"group": "Cake Batter", "items": [{"qty": "115", "name": "Unsalted butter, room temperature, cubed", "unit": "g", "category": "dairy", "estimate": "1/2 cup"}, {"qty": "200", "name": "Granulated sugar", "unit": "g", "category": "pantry", "estimate": "1 cup"}, {"qty": "3", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1/2 teaspoon"}, {"qty": "2", "name": "Lemons, zested", "unit": "whole", "category": "produce", "estimate": "2 large lemons"}, {"qty": "110", "name": "Eggs, room temperature", "unit": "g", "category": "dairy", "estimate": "2 large eggs"}, {"qty": "150", "name": "All-purpose flour", "unit": "g", "category": "pantry", "estimate": "1 1/4 cups"}, {"qty": "3", "name": "Baking powder", "unit": "g", "category": "pantry", "estimate": "3/4 teaspoon"}, {"qty": "60", "name": "Sour cream", "unit": "g", "category": "dairy", "estimate": "1/4 cup"}, {"qty": "20", "name": "Honey", "unit": "g", "category": "pantry", "estimate": "1 tablespoon"}, {"qty": "5", "name": "Vanilla extract", "unit": "ml", "category": "pantry", "estimate": "1 teaspoon"}, {"qty": "30", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "2 tablespoons"}]}, {"group": "Lemon Syrup", "items": [{"qty": "60", "name": "Water", "unit": "ml", "category": "pantry", "estimate": "1/4 cup"}, {"qty": "30", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "2 tablespoons"}, {"qty": "50", "name": "Granulated sugar", "unit": "g", "category": "pantry", "estimate": "1/4 cup"}]}, {"group": "Lemon Glaze", "items": [{"qty": "100", "name": "Powdered sugar", "unit": "g", "category": "pantry", "estimate": "3/4 cup"}, {"qty": "15", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "1 tablespoon"}]}]'::jsonb,
  '[{"group": "Cake Batter (Bowl 1)", "items": [{"qty": "115", "name": "Unsalted butter, room temperature, cubed", "unit": "g", "category": "dairy", "estimate": "1/2 cup"}, {"qty": "200", "name": "Granulated sugar", "unit": "g", "category": "pantry", "estimate": "1 cup"}, {"qty": "3", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1/2 teaspoon"}, {"qty": "2", "name": "Lemons, zested", "unit": "whole", "category": "produce", "estimate": "2 large lemons"}, {"qty": "110", "name": "Eggs, room temperature", "unit": "g", "category": "dairy", "estimate": "2 large eggs"}, {"qty": "150", "name": "All-purpose flour", "unit": "g", "category": "pantry", "estimate": "1 1/4 cups"}, {"qty": "3", "name": "Baking powder", "unit": "g", "category": "pantry", "estimate": "3/4 teaspoon"}, {"qty": "60", "name": "Sour cream", "unit": "g", "category": "dairy", "estimate": "1/4 cup"}, {"qty": "20", "name": "Honey", "unit": "g", "category": "pantry", "estimate": "1 tablespoon"}, {"qty": "5", "name": "Vanilla extract", "unit": "ml", "category": "pantry", "estimate": "1 teaspoon"}, {"qty": "30", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "2 tablespoons"}]}, {"group": "Cake Batter (Bowl 2)", "items": [{"qty": "115", "name": "Unsalted butter, room temperature, cubed", "unit": "g", "category": "dairy", "estimate": "1/2 cup"}, {"qty": "200", "name": "Granulated sugar", "unit": "g", "category": "pantry", "estimate": "1 cup"}, {"qty": "3", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1/2 teaspoon"}, {"qty": "2", "name": "Lemons, zested", "unit": "whole", "category": "produce", "estimate": "2 large lemons"}, {"qty": "110", "name": "Eggs, room temperature", "unit": "g", "category": "dairy", "estimate": "2 large eggs"}, {"qty": "150", "name": "All-purpose flour", "unit": "g", "category": "pantry", "estimate": "1 1/4 cups"}, {"qty": "3", "name": "Baking powder", "unit": "g", "category": "pantry", "estimate": "3/4 teaspoon"}, {"qty": "60", "name": "Sour cream", "unit": "g", "category": "dairy", "estimate": "1/4 cup"}, {"qty": "20", "name": "Honey", "unit": "g", "category": "pantry", "estimate": "1 tablespoon"}, {"qty": "5", "name": "Vanilla extract", "unit": "ml", "category": "pantry", "estimate": "1 teaspoon"}, {"qty": "30", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "2 tablespoons"}]}, {"group": "Lemon Syrup (Double Batch)", "items": [{"qty": "120", "name": "Water", "unit": "ml", "category": "pantry", "estimate": "1/2 cup"}, {"qty": "60", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "1/4 cup"}, {"qty": "100", "name": "Granulated sugar", "unit": "g", "category": "pantry", "estimate": "1/2 cup"}]}, {"group": "Lemon Glaze (Double Batch)", "items": [{"qty": "200", "name": "Powdered sugar", "unit": "g", "category": "pantry", "estimate": "1 1/2 cups"}, {"qty": "30", "name": "Fresh lemon juice", "unit": "ml", "category": "produce", "estimate": "2 tablespoons"}]}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 3, "action": "Prepare lemon zest and sugar mixture", "detail": "Add granulated sugar, salt, and lemon zest to bowl. Mix to release oils", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Sugar"}, {"qty": "3g", "name": "Salt"}, {"qty": "from 2 lemons", "name": "Lemon zest"}]}, {"temp": "", "time": "3 min", "speed": 4, "action": "Cream butter mixture", "detail": "Add room temperature butter to sugar mixture. Cream until very light and fluffy", "reverse": false, "accessories": ["butterfly whisk"], "ingredients": [{"qty": "115g", "name": "Butter"}]}, {"temp": "", "time": "2 min", "speed": 3, "action": "Add eggs gradually", "detail": "With butterfly whisk running, gradually add room temperature eggs through measuring cup opening. Scrape down sides as needed", "reverse": false, "accessories": ["butterfly whisk"], "ingredients": [{"qty": "110g", "name": "Eggs"}]}, {"temp": "", "time": "20 sec", "speed": 3, "action": "Add dry ingredients", "detail": "Remove butterfly whisk. Add flour and baking powder. Mix until just combined", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Flour"}, {"qty": "3g", "name": "Baking powder"}]}, {"temp": "", "time": "30 sec", "speed": 3, "action": "Add wet ingredients", "detail": "Add sour cream, honey, vanilla, and lemon juice. Mix until smooth batter forms", "reverse": true, "accessories": [], "ingredients": [{"qty": "60g", "name": "Sour cream"}, {"qty": "20g", "name": "Honey"}, {"qty": "5ml", "name": "Vanilla"}, {"qty": "30ml", "name": "Lemon juice"}]}, {"temp": "", "time": "", "speed": "", "action": "Bake cake", "detail": "Transfer batter to greased 9x5 loaf pan. Bake at 160\u00b0C (325\u00b0F) for 50-60 minutes until golden and toothpick comes out clean", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "100\u00b0C", "time": "5 min", "speed": 2, "action": "Prepare lemon syrup", "detail": "Clean bowl. Add water, lemon juice, and sugar for syrup. Cook until sugar dissolves", "reverse": false, "accessories": [], "ingredients": [{"qty": "60ml", "name": "Water"}, {"qty": "30ml", "name": "Lemon juice"}, {"qty": "50g", "name": "Sugar"}]}, {"temp": "", "time": "", "speed": "", "action": "Apply syrup to warm cake", "detail": "While cake is still warm, poke holes with skewer and brush with lemon syrup. Let cool completely", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "20 sec", "speed": 4, "action": "Make lemon glaze", "detail": "Clean bowl. Add powdered sugar and lemon juice. Mix until smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "100g", "name": "Powdered sugar"}, {"qty": "15ml", "name": "Lemon juice"}]}, {"temp": "", "time": "", "speed": "", "action": "Finish cake", "detail": "Pour glaze over cooled cake. Let set for 15 minutes before serving", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '[{"temp": "", "time": "10 sec", "speed": 3, "action": "Prepare first lemon zest mixture (Bowl 1)", "detail": "Add granulated sugar, salt, and lemon zest to bowl. Mix to release oils", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Sugar"}, {"qty": "3g", "name": "Salt"}, {"qty": "from 2 lemons", "name": "Lemon zest"}]}, {"temp": "", "time": "3 min", "speed": 4, "action": "Cream first butter mixture (Bowl 1)", "detail": "Add room temperature butter to sugar mixture. Cream until very light and fluffy", "reverse": false, "accessories": ["butterfly whisk"], "ingredients": [{"qty": "115g", "name": "Butter"}]}, {"temp": "", "time": "2 min", "speed": 3, "action": "Add eggs gradually (Bowl 1)", "detail": "With butterfly whisk running, gradually add room temperature eggs. Scrape down sides as needed", "reverse": false, "accessories": ["butterfly whisk"], "ingredients": [{"qty": "110g", "name": "Eggs"}]}, {"temp": "", "time": "1 min", "speed": 3, "action": "Complete first batter (Bowl 1)", "detail": "Remove butterfly whisk. Add flour, baking powder, then wet ingredients. Mix until smooth", "reverse": true, "accessories": [], "ingredients": [{"qty": "150g", "name": "Flour"}, {"qty": "3g", "name": "Baking powder"}, {"qty": "60g", "name": "Sour cream"}, {"qty": "20g", "name": "Honey"}, {"qty": "5ml", "name": "Vanilla"}, {"qty": "30ml", "name": "Lemon juice"}]}, {"temp": "", "time": "10 sec", "speed": 3, "action": "Transfer and start second batch", "detail": "Transfer first batter to prepared pan. Clean bowl and start second batch with sugar mixture", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Sugar"}, {"qty": "3g", "name": "Salt"}, {"qty": "from 2 lemons", "name": "Lemon zest"}]}, {"temp": "", "time": "6 min", "speed": 3, "action": "Complete second batter (Bowl 2)", "detail": "Repeat creaming, eggs, and ingredient additions for second batch", "reverse": true, "accessories": ["butterfly whisk"], "ingredients": [{"qty": "as listed", "name": "All Bowl 2 ingredients"}]}, {"temp": "", "time": "", "speed": "", "action": "Bake both cakes", "detail": "Transfer second batter to prepared pan. Bake both loaves at 160\u00b0C (325\u00b0F) for 50-60 minutes until golden and toothpick comes out clean", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "100\u00b0C", "time": "5 min", "speed": 2, "action": "Prepare double batch syrup", "detail": "Clean bowl. Add doubled water, lemon juice, and sugar for syrup. Cook until sugar dissolves", "reverse": false, "accessories": [], "ingredients": [{"qty": "120ml", "name": "Water"}, {"qty": "60ml", "name": "Lemon juice"}, {"qty": "100g", "name": "Sugar"}]}, {"temp": "", "time": "", "speed": "", "action": "Apply syrup to warm cakes", "detail": "While cakes are still warm, poke holes with skewer and brush with lemon syrup. Let cool completely", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "", "time": "30 sec", "speed": 4, "action": "Make double batch glaze", "detail": "Clean bowl. Add doubled powdered sugar and lemon juice. Mix until smooth", "reverse": false, "accessories": [], "ingredients": [{"qty": "200g", "name": "Powdered sugar"}, {"qty": "30ml", "name": "Lemon juice"}]}, {"temp": "", "time": "", "speed": "", "action": "Finish cakes", "detail": "Pour glaze over cooled cakes. Let set for 15 minutes before serving", "reverse": false, "accessories": [], "ingredients": []}]'::jsonb,
  '{"fat": "8g", "carbs": "58g", "fiber": "1g", "protein": "5g", "calories": 320}'::jsonb,
  4,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-18T06:26:36.302848+00:00',
  '2026-03-18T06:29:30.523+00:00'
);
INSERT INTO public.recipes (id, title, description, servings_1bowl, servings_2bowl, time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji, ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl, nutrition, insulin_load, created_by, created_at, updated_at) VALUES (
  '496deb05-9e7d-4316-8bd9-0c82fb1e90db',
  'Classic Tomato Soup',
  'Rich, creamy tomato soup with fresh herbs and a touch of cream. Perfect comfort food for any season.',
  '4-6',
  '8-12',
  '35 min',
  '60 min',
  ARRAY['soup', 'vegetarian'],
  '{}'::text[],
  '🍅',
  '[{"group": "Aromatics", "items": [{"qty": "150", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "1 medium onion"}, {"qty": "15", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "3 cloves"}, {"qty": "100", "name": "Carrot, chunked", "unit": "g", "category": "produce", "estimate": "1 small carrot"}]}, {"group": "Base", "items": [{"qty": "30", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "2 tbsp"}, {"qty": "800", "name": "Canned whole tomatoes", "unit": "g", "category": "pantry", "estimate": "2 x 400g cans"}, {"qty": "500", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "2 cups"}, {"qty": "30", "name": "Tomato paste", "unit": "g", "category": "pantry", "estimate": "2 tbsp"}]}, {"group": "Seasonings", "items": [{"qty": "15", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "1 small bunch"}, {"qty": "10", "name": "Sugar", "unit": "g", "category": "pantry", "estimate": "2 tsp"}, {"qty": "8", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1.5 tsp"}, {"qty": "2", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1/2 tsp"}]}, {"group": "Finish", "items": [{"qty": "100", "name": "Heavy cream", "unit": "ml", "category": "dairy", "estimate": "1/2 cup"}]}]'::jsonb,
  '[{"group": "Aromatics", "items": [{"qty": "300", "name": "Onion, quartered", "unit": "g", "category": "produce", "estimate": "2 medium onions"}, {"qty": "30", "name": "Garlic cloves", "unit": "g", "category": "produce", "estimate": "6 cloves"}, {"qty": "200", "name": "Carrot, chunked", "unit": "g", "category": "produce", "estimate": "2 small carrots"}]}, {"group": "Base", "items": [{"qty": "60", "name": "Olive oil", "unit": "ml", "category": "pantry", "estimate": "4 tbsp"}, {"qty": "1600", "name": "Canned whole tomatoes", "unit": "g", "category": "pantry", "estimate": "4 x 400g cans"}, {"qty": "1000", "name": "Vegetable stock", "unit": "ml", "category": "pantry", "estimate": "4 cups"}, {"qty": "60", "name": "Tomato paste", "unit": "g", "category": "pantry", "estimate": "4 tbsp"}]}, {"group": "Seasonings", "items": [{"qty": "30", "name": "Fresh basil leaves", "unit": "g", "category": "produce", "estimate": "2 small bunches"}, {"qty": "20", "name": "Sugar", "unit": "g", "category": "pantry", "estimate": "4 tsp"}, {"qty": "16", "name": "Salt", "unit": "g", "category": "pantry", "estimate": "1 tbsp"}, {"qty": "4", "name": "Black pepper", "unit": "g", "category": "pantry", "estimate": "1 tsp"}]}, {"group": "Finish", "items": [{"qty": "200", "name": "Heavy cream", "unit": "ml", "category": "dairy", "estimate": "1 cup"}]}]'::jsonb,
  '[{"temp": "", "time": "5 sec", "speed": 5, "action": "Chop aromatics", "detail": "Add quartered onion, garlic cloves, and carrot chunks to bowl. Chop", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "15g", "name": "Garlic"}, {"qty": "100g", "name": "Carrot"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Saut\u00e9 aromatics", "detail": "Add olive oil and saut\u00e9 chopped vegetables", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "1 min", "speed": 1, "action": "Add tomato paste", "detail": "Add tomato paste and cook to develop flavor", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Tomato paste"}]}, {"temp": "100\u00b0C", "time": "20 min", "speed": 1, "action": "Add main ingredients", "detail": "Add canned tomatoes, vegetable stock, basil, and sugar", "reverse": true, "accessories": [], "ingredients": [{"qty": "800g", "name": "Canned tomatoes"}, {"qty": "500ml", "name": "Vegetable stock"}, {"qty": "15g", "name": "Fresh basil"}, {"qty": "10g", "name": "Sugar"}]}, {"temp": "", "time": "1 min", "speed": 9, "action": "Blend soup", "detail": "Blend soup until completely smooth", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "60\u00b0C", "time": "30 sec", "speed": 2, "action": "Season and finish", "detail": "Add salt, pepper, and cream. Mix gently to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "100ml", "name": "Heavy cream"}]}]'::jsonb,
  '[{"temp": "", "time": "5 sec", "speed": 5, "action": "Chop all aromatics - Bowl 1", "detail": "Add half the onions, garlic, and carrots to Bowl 1. Chop and set aside", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "15g", "name": "Garlic"}, {"qty": "100g", "name": "Carrot"}]}, {"temp": "", "time": "5 sec", "speed": 5, "action": "Chop remaining aromatics - Bowl 2", "detail": "Transfer to Bowl 2. Add remaining onions, garlic, and carrots. Chop and set aside", "reverse": false, "accessories": [], "ingredients": [{"qty": "150g", "name": "Onion"}, {"qty": "15g", "name": "Garlic"}, {"qty": "100g", "name": "Carrot"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start Bowl 1 soup", "detail": "Return to Bowl 1. Add chopped aromatics, olive oil, and saut\u00e9", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "1 min", "speed": 1, "action": "Add tomato paste - Bowl 1", "detail": "Add tomato paste to Bowl 1 and cook", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Tomato paste"}]}, {"temp": "100\u00b0C", "time": "20 min", "speed": 1, "action": "Simmer Bowl 1", "detail": "Add tomatoes, stock, basil, and sugar to Bowl 1. Start simmering", "reverse": true, "accessories": [], "ingredients": [{"qty": "800g", "name": "Canned tomatoes"}, {"qty": "500ml", "name": "Vegetable stock"}, {"qty": "15g", "name": "Fresh basil"}, {"qty": "10g", "name": "Sugar"}]}, {"temp": "120\u00b0C", "time": "3 min", "speed": 1, "action": "Start Bowl 2 (during Bowl 1 simmer)", "detail": "While Bowl 1 simmers, start Bowl 2. Add chopped aromatics and olive oil, saut\u00e9", "reverse": false, "accessories": [], "ingredients": [{"qty": "30ml", "name": "Olive oil"}]}, {"temp": "120\u00b0C", "time": "1 min", "speed": 1, "action": "Add tomato paste - Bowl 2", "detail": "Add tomato paste to Bowl 2 and cook", "reverse": false, "accessories": [], "ingredients": [{"qty": "30g", "name": "Tomato paste"}]}, {"temp": "100\u00b0C", "time": "16 min", "speed": 1, "action": "Simmer Bowl 2", "detail": "Add remaining tomatoes, stock, basil, and sugar to Bowl 2", "reverse": true, "accessories": [], "ingredients": [{"qty": "800g", "name": "Canned tomatoes"}, {"qty": "500ml", "name": "Vegetable stock"}, {"qty": "15g", "name": "Fresh basil"}, {"qty": "10g", "name": "Sugar"}]}, {"temp": "", "time": "1 min", "speed": 9, "action": "Blend Bowl 1", "detail": "Return to Bowl 1. Blend soup until completely smooth", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "60\u00b0C", "time": "30 sec", "speed": 2, "action": "Finish Bowl 1", "detail": "Add salt, pepper, and cream to Bowl 1. Mix and keep warm", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "100ml", "name": "Heavy cream"}]}, {"temp": "", "time": "1 min", "speed": 9, "action": "Blend Bowl 2", "detail": "Switch to Bowl 2. Blend soup until completely smooth", "reverse": false, "accessories": [], "ingredients": []}, {"temp": "60\u00b0C", "time": "30 sec", "speed": 2, "action": "Finish Bowl 2", "detail": "Add remaining salt, pepper, and cream to Bowl 2. Mix to combine", "reverse": true, "accessories": [], "ingredients": [{"qty": "8g", "name": "Salt"}, {"qty": "2g", "name": "Black pepper"}, {"qty": "100ml", "name": "Heavy cream"}]}]'::jsonb,
  '{"fat": "11g", "carbs": "18g", "fiber": "4g", "protein": "4g", "calories": 180}'::jsonb,
  2,
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-22T01:40:09.188072+00:00',
  '2026-03-22T01:40:09.188072+00:00'
);

-- Inventory
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'e9c0c1f9-9911-48ed-9e92-6c4c76391324',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Salad kit (lemon arugula)',
  NULL,
  'produce',
  '2026-03-22T00:39:47.240815+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '656027e4-4527-4d1f-9bf3-91cf351b2bcc',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Lemon',
  NULL,
  'produce',
  '2026-03-22T00:39:48.669+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'cf7aeaaf-1b22-4b6b-ab28-1e037b384e47',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Tortillas',
  NULL,
  'pantry',
  '2026-03-22T00:39:53.394+00:00',
  true,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '50eef231-1972-4f35-9d62-c9a168b01e89',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Sliced cheese (Monterey Jack and Cheddar)',
  NULL,
  'dairy',
  '2026-03-22T00:39:54.168773+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '5f95dd62-cb11-469a-8033-96a50c84b911',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Cookies',
  NULL,
  'pantry',
  '2026-03-22T00:39:57.669122+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '3e3da99b-b69a-4f3e-92c5-a4d931031add',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Tortillas Corn',
  NULL,
  'other',
  '2026-03-22T00:39:58.992649+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'e9d43587-e892-4ae9-82e6-6cdb8f302950',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Milk',
  NULL,
  'other',
  '2026-03-22T01:41:28.531584+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '0888e536-bb07-4244-851b-4dae048e3002',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Lettuce',
  NULL,
  'produce',
  '2026-03-22T01:41:36.626+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '092d10b3-1185-4647-b6c7-3ca41d412111',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Onion',
  NULL,
  'produce',
  '2026-03-22T01:41:37.208+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '28e43a51-b234-4927-8f9a-eebc2b0b2c26',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Honey',
  NULL,
  'pantry',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '40ad08cf-7cc2-49f0-84a8-d6a8f8c1a2b7',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Celery',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '455d0695-eab6-4ab1-b7f4-d816dc3b969c',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Red Onion',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '62718aa2-c4cc-4683-9f4a-305c2d4159d7',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Potato',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '67900f6a-a47d-4e04-be14-f2047667df8e',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Unsalted butter',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '8db072f5-7dc1-4855-9799-c11d7da386c6',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Eggs',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'e5b9be2f-9983-4ae7-8d64-ee6324530429',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Sugar',
  NULL,
  'pantry',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '91eefd2e-f71a-4627-9078-75a84808fcab',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Pepper',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '939507fe-58ea-40ac-b206-16047a56e127',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Cucumber',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '947cd70f-f3a2-441e-92de-a7c9a16c4bd0',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Smoked paprika',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'c7e53d55-2181-4462-901a-7e022a1002bd',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Frozen peas',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'dd5bccd5-da24-4106-9e6a-2233f4fb2b8b',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Carrot',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'edd34b68-4619-40d0-8840-32dc80ca7703',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Lemons, zested',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'fc945c39-40d9-4dc3-9d7c-a4f381e82ca4',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Pasta',
  NULL,
  'pantry',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '19b42c6a-9f0a-4c4d-bc93-bedf2c19162e',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Bay leaves',
  NULL,
  'other',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '39bf91ab-f5ce-45e2-a0ee-679bb754a7f4',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Garlic cloves',
  NULL,
  'other',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'c66fe227-6194-41e1-a8ed-81e37b55dc9f',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Vanilla extract',
  NULL,
  'spices',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '2b3d1749-4b64-4f94-986f-ec1ef28082a0',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Salt',
  NULL,
  'spices',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '954f8f96-3444-48b7-a78b-d6826863b6df',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Black Pepper',
  NULL,
  'spices',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '951413a7-55a3-48f3-b4a5-74cae6e13a31',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Lemon juice',
  NULL,
  'pantry',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '9274ffc3-2229-4316-9779-c8bdc16d9b2b',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Baking powder',
  NULL,
  'pantry',
  '2026-03-18T14:45:37.835+00:00',
  false,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '30dc9bf6-1192-4ad8-a7b3-4ced07ca89c4',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Toilet paper',
  NULL,
  'other',
  '2026-03-18T14:45:45.657+00:00',
  false,
  'household'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'f6845ddd-4600-47f7-9f0d-e9a826a3280f',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Hand soap',
  NULL,
  'other',
  '2026-03-18T14:45:45.657+00:00',
  false,
  'household'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '65fefa4b-7898-4875-96ca-1bcfce89d1ec',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Chicken nuggets',
  NULL,
  'protein',
  '2026-03-22T00:39:46.466+00:00',
  true,
  'frozen'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '4a461124-e6fe-4538-aff2-afba6f7e792b',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Apples',
  NULL,
  'produce',
  '2026-03-22T00:39:47.949+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '537f1ff3-43ec-4827-8193-2af85956fe9e',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Broccoli',
  NULL,
  'produce',
  '2026-03-22T00:39:49.399+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'ef9144c0-9fe4-43f1-bc84-a73f9cbf1e6a',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Avocados',
  NULL,
  'produce',
  '2026-03-22T00:39:50.211+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '425760f5-861a-4fc6-a09d-240187148c41',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Grapes',
  NULL,
  'produce',
  '2026-03-22T00:39:50.882+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '3d26d746-e5dc-4370-963d-5edf5151386c',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Ketchup',
  NULL,
  'pantry',
  '2026-03-22T00:39:51.639+00:00',
  true,
  'spices'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '7efc79c3-03d8-451b-85c0-ed773cc06764',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Bagels',
  NULL,
  'other',
  '2026-03-22T00:39:52.284+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'cdfdb2ff-6c46-40e5-8165-442c10995d51',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Brioche bread',
  NULL,
  'other',
  '2026-03-22T00:39:52.838+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'a6f689b7-1dbb-4322-b19e-51d54c36abea',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Block cheese',
  NULL,
  'dairy',
  '2026-03-22T00:39:54.83+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '8934cea1-d572-4108-96d4-3deb865ec42b',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Cream cheese',
  NULL,
  'dairy',
  '2026-03-22T00:39:55.383+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '68f85337-d820-4177-81ab-4c1372e11f67',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Sourdough bread (sliced)',
  NULL,
  'other',
  '2026-03-22T00:39:56.06583+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '6cd483c0-f5c4-4cd3-a781-5812cbcdbf10',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Garlic',
  NULL,
  'produce',
  '2026-03-22T00:39:56.496+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'a233f2c1-f7de-48f8-af56-362c69bd6aee',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Mustard aioli',
  NULL,
  'pantry',
  '2026-03-22T00:39:57.047579+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '0ea04f6e-b243-4113-9b34-64ae70331f04',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Wine',
  NULL,
  'other',
  '2026-03-22T00:39:58.463159+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '476c963e-9155-4fa7-aa8a-7a68ff2f4188',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Tomato',
  NULL,
  'produce',
  '2026-03-22T01:41:35.837+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '8dbef88c-9d56-4221-8e62-52be59cf30e1',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Oat milk',
  NULL,
  'dairy',
  '2026-03-22T01:41:37.886674+00:00',
  true,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '3b3f6793-3198-4c91-8fb5-25e80f0c2f04',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Cilantro',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '41489512-5552-4790-898c-4c031d1ce1c1',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Sour cream',
  NULL,
  'dairy',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '643ef2f7-87bb-4d5a-9ce9-313af7b39052',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'All-purpose flour',
  NULL,
  'pantry',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '786d913b-7134-4272-b120-7018eb636cca',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Water',
  NULL,
  'other',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '90e879ab-47e5-48bc-a054-5cbe6fb1a025',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Powdered sugar',
  NULL,
  'pantry',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'b7ebced3-0058-426f-93e4-ec1d9a1646a9',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Granulated sugar',
  NULL,
  'pantry',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'e6e330a1-d2cb-4ec7-a289-198926b30d64',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Mushrooms',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'e9f0f300-d20c-4790-a587-eb66e49cf3fb',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Salad kit, lemon arugula',
  NULL,
  'produce',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  'dc32442b-576f-4280-a124-f145cb7f635e',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Monterrey jack cheese',
  NULL,
  'dairy',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);
INSERT INTO public.inventory (id, user_id, item_name, quantity, category, updated_at, in_stock, section) VALUES (
  '4623e9e5-d59a-4e5f-bfe9-62d6f08fd0f4',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Cheddar cheese',
  NULL,
  'dairy',
  '2026-03-22T00:20:09.849+00:00',
  false,
  'fresh'
);

-- Cook Log
INSERT INTO public.cook_log (id, recipe_id, user_id, cooked_at, rating, feedback, bowl_mode) VALUES (
  '09dfa3c9-0ead-4287-bd1c-746103344089',
  '89dc79d2-7fd7-4206-ae31-cb6b9ee858b2',
  '4b5b9937-d45f-4090-a814-d31023243525',
  '2026-03-18T04:12:03.122307+00:00',
  NULL,
  NULL,
  1
);

-- Shopping List
INSERT INTO public.shopping_list (id, user_id, item_name, quantity, category, recipe_id, checked, added_at, source_inventory_id) VALUES (
  '821613e0-69f7-4ea9-90c7-6354d6d3416f',
  '4b5b9937-d45f-4090-a814-d31023243525',
  'Milk',
  NULL,
  'dairy',
  NULL,
  false,
  '2026-03-22T01:41:14.725921+00:00',
  NULL
);

-- End of backup