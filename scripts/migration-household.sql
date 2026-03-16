-- Household Sharing Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create household_members table
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- 3. Create household_invites table
CREATE TABLE IF NOT EXISTS household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, email)
);

-- 4. Add diet_preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_preferences JSONB DEFAULT '{}';

-- 5. Helper function: get all user IDs in caller's household
CREATE OR REPLACE FUNCTION get_my_household_member_ids()
RETURNS UUID[] AS $$
DECLARE
  hh_id UUID;
  member_ids UUID[];
BEGIN
  SELECT household_id INTO hh_id
  FROM household_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF hh_id IS NULL THEN
    RETURN ARRAY[auth.uid()];
  END IF;

  SELECT array_agg(user_id) INTO member_ids
  FROM household_members
  WHERE household_id = hh_id;

  RETURN member_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Enable RLS on new tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- 7. RLS for households
CREATE POLICY "hh_select" ON households FOR SELECT TO authenticated
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "hh_insert" ON households FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hh_update" ON households FOR UPDATE TO authenticated
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "hh_delete" ON households FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- 8. RLS for household_members
CREATE POLICY "hm_select" ON household_members FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members hm2 WHERE hm2.user_id = auth.uid()));
CREATE POLICY "hm_insert" ON household_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hm_delete" ON household_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- 9. RLS for household_invites
CREATE POLICY "hi_select" ON household_invites FOR SELECT TO authenticated
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    OR household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "hi_insert" ON household_invites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hi_update" ON household_invites FOR UPDATE TO authenticated
  USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "hi_delete" ON household_invites FOR DELETE TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'owner'));

-- 10. Update RLS on shopping_list to support household sharing
DROP POLICY IF EXISTS "shopping_list_select" ON shopping_list;
DROP POLICY IF EXISTS "shopping_list_insert" ON shopping_list;
DROP POLICY IF EXISTS "shopping_list_update" ON shopping_list;
DROP POLICY IF EXISTS "shopping_list_delete" ON shopping_list;

CREATE POLICY "shopping_list_select" ON shopping_list FOR SELECT TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "shopping_list_insert" ON shopping_list FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "shopping_list_update" ON shopping_list FOR UPDATE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "shopping_list_delete" ON shopping_list FOR DELETE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));

-- 11. Update RLS on inventory
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;
DROP POLICY IF EXISTS "inventory_delete" ON inventory;

CREATE POLICY "inventory_select" ON inventory FOR SELECT TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "inventory_insert" ON inventory FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "inventory_update" ON inventory FOR UPDATE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "inventory_delete" ON inventory FOR DELETE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));

-- 12. Update RLS on cook_log
DROP POLICY IF EXISTS "cook_log_select" ON cook_log;
DROP POLICY IF EXISTS "cook_log_insert" ON cook_log;
DROP POLICY IF EXISTS "cook_log_update" ON cook_log;
DROP POLICY IF EXISTS "cook_log_delete" ON cook_log;

CREATE POLICY "cook_log_select" ON cook_log FOR SELECT TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "cook_log_insert" ON cook_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "cook_log_update" ON cook_log FOR UPDATE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "cook_log_delete" ON cook_log FOR DELETE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));

-- 13. Update RLS on recipe_notes
DROP POLICY IF EXISTS "recipe_notes_select" ON recipe_notes;
DROP POLICY IF EXISTS "recipe_notes_insert" ON recipe_notes;
DROP POLICY IF EXISTS "recipe_notes_update" ON recipe_notes;
DROP POLICY IF EXISTS "recipe_notes_delete" ON recipe_notes;

CREATE POLICY "recipe_notes_select" ON recipe_notes FOR SELECT TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "recipe_notes_insert" ON recipe_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_notes_update" ON recipe_notes FOR UPDATE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
CREATE POLICY "recipe_notes_delete" ON recipe_notes FOR DELETE TO authenticated
  USING (user_id = ANY(get_my_household_member_ids()));
