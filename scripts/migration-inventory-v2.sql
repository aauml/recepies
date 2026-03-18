-- Inventory V2 Migration: Add in_stock, section columns + shopping list link
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Date: 2026-03-17

-- 1. Add columns to inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS in_stock boolean DEFAULT true;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS section text DEFAULT 'fresh';

-- 2. Backfill section based on category
UPDATE inventory SET section = 'spices' WHERE category IN ('spices', 'pantry');
UPDATE inventory SET section = 'fresh' WHERE section IS NULL OR section NOT IN ('fresh', 'spices');

-- 3. Ensure all existing items are in_stock
UPDATE inventory SET in_stock = true WHERE in_stock IS NULL;

-- 4. Add source_inventory_id to shopping_list (links back to inventory for auto-sync)
ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS source_inventory_id uuid REFERENCES inventory(id);

-- 5. Fix miscategorized items (bay leaves, garlic cloves are spices)
UPDATE inventory SET section = 'spices' WHERE item_name IN ('Bay leaves', 'Garlic cloves');
