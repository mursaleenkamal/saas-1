-- =============================================================================
-- GymFlow Complete Database Schema
-- Generated: 2026-09-21T17:13:29.501Z
-- Safe for execution on a fresh or existing Supabase project
-- =============================================================================

-- ── 1. BASE SCHEMA ──────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLES
-- ================================================

-- Gyms table
CREATE TABLE IF NOT EXISTS gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  area TEXT,
  pending_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, member_number)
);


-- Memberships table (one per payment/renewal)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'quarterly', 'annual')),
  category TEXT CHECK (category IN ('strength', 'cardio', 'both')) DEFAULT 'both',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  admission_fee INTEGER NOT NULL DEFAULT 0,
  due_amount INTEGER NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'card')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Due Payments table
CREATE TABLE IF NOT EXISTS due_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'card')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session TEXT CHECK (session IN ('morning', 'evening')) DEFAULT 'morning',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  UNIQUE(member_id, date, session)
);


-- Admin Messages table (Super admin support)
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT NOT NULL DEFAULT 'super_admin',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_cleared_by_owner BOOLEAN DEFAULT false,
  is_cleared_by_admin BOOLEAN DEFAULT false
);

-- INDEXES (for performance)

-- Covering index for the RLS subquery pattern used on every protected table:
-- EXISTS (SELECT 1 FROM gyms WHERE id = table.gym_id AND owner_id = auth.uid())
CREATE INDEX IF NOT EXISTS idx_gyms_id_owner ON gyms(id, owner_id);

CREATE INDEX IF NOT EXISTS idx_members_gym_id ON members(gym_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_id ON memberships(gym_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_start_date ON memberships(gym_id, start_date);
CREATE INDEX IF NOT EXISTS idx_memberships_member_created ON memberships(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_id ON attendance(gym_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON attendance(member_id);

-- Issue 10 fix: Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date ON attendance(gym_id, date);

-- Issue 11 fix: Add partial index for dues aggregation
CREATE INDEX IF NOT EXISTS idx_members_gym_dues ON members(gym_id, pending_amount) WHERE pending_amount > 0;

CREATE INDEX IF NOT EXISTS idx_due_payments_gym_id ON due_payments(gym_id);

DROP POLICY IF EXISTS "Users can view their own gym" ON gyms;
CREATE POLICY "Users can view their own gym"
  ON gyms FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own gym" ON gyms;
CREATE POLICY "Users can insert their own gym"
  ON gyms FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own gym" ON gyms;
CREATE POLICY "Users can update their own gym"
  ON gyms FOR UPDATE
  USING (owner_id = auth.uid());

-- MEMBERS policies
DROP POLICY IF EXISTS "Gym owners can view their members" ON members;
CREATE POLICY "Gym owners can view their members"
  ON members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = members.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert members" ON members;
CREATE POLICY "Gym owners can insert members"
  ON members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = members.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update members" ON members;
CREATE POLICY "Gym owners can update members"
  ON members FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = members.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete members" ON members;
CREATE POLICY "Gym owners can delete members"
  ON members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = members.gym_id AND owner_id = auth.uid())
  );

-- MEMBERSHIPS policies
DROP POLICY IF EXISTS "Gym owners can view memberships" ON memberships;
CREATE POLICY "Gym owners can view memberships"
  ON memberships FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = memberships.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert memberships" ON memberships;
CREATE POLICY "Gym owners can insert memberships"
  ON memberships FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = memberships.gym_id AND owner_id = auth.uid())
  );

-- ATTENDANCE policies
DROP POLICY IF EXISTS "Gym owners can view attendance" ON attendance;
CREATE POLICY "Gym owners can view attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = attendance.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update attendance" ON attendance;
CREATE POLICY "Gym owners can update attendance"
  ON attendance FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = attendance.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert attendance" ON attendance;
CREATE POLICY "Gym owners can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = attendance.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete attendance" ON attendance;
CREATE POLICY "Gym owners can delete attendance"
  ON attendance FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = attendance.gym_id AND owner_id = auth.uid())
  );

-- ADMIN_MESSAGES policies
DROP POLICY IF EXISTS "Gym owners can read their admin messages" ON admin_messages;
CREATE POLICY "Gym owners can read their admin messages"
  ON admin_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = admin_messages.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can mark messages as read" ON admin_messages;
CREATE POLICY "Gym owners can mark messages as read"
  ON admin_messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = admin_messages.gym_id AND owner_id = auth.uid())
  );

-- ================================================
-- MIGRATIONS (run these if upgrading existing DB)
-- ================================================

-- [Migration 1] Add gender and area to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pending_amount INTEGER NOT NULL DEFAULT 0;

-- [Migration 2] Add member_number to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_number INTEGER;

-- Assign sequential numbers to existing members (per gym, ordered by join date)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY gym_id ORDER BY created_at) AS rn
  FROM members
)
UPDATE members SET member_number = numbered.rn
FROM numbered WHERE members.id = numbered.id;

-- Make member_number required and unique per gym
ALTER TABLE members ALTER COLUMN member_number SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_gym_id_member_number_key'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT members_gym_id_member_number_key UNIQUE (gym_id, member_number);
  END IF;
END $$;

-- [Migration 3] Add admission_fee to memberships
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS admission_fee INTEGER NOT NULL DEFAULT 0;

-- [Migration 4] Add performance indexes
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_member_number ON members(gym_id, member_number);
CREATE INDEX IF NOT EXISTS idx_members_gym_created ON members(gym_id, created_at DESC);

-- [Migration 5] Add age to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age > 0 AND age < 120);

-- [Migration 5b] Add date_of_birth to members (drives birthday_wishes WhatsApp automation)
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- [Migration 5c] Add cnic to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS cnic TEXT;
CREATE INDEX IF NOT EXISTS idx_members_cnic ON members(gym_id, cnic);

-- [Migration 7] Add profile info to gyms
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS phone TEXT;

-- [Migration 8] Support Pakistan payment methods (JazzCash, EasyPaisa, Raast) in gym_upi_config
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gym_upi_config') THEN
    ALTER TABLE gym_upi_config ALTER COLUMN currency SET DEFAULT 'PKR';
  END IF;
END $$;


-- ================================================
-- GEO NORMALIZATION ENGINE (Migration 6)
-- Run this entire block in Supabase SQL Editor
-- ================================================

-- Enable pg_trgm for fast fuzzy text search
-- Install in extensions schema to avoid extension_in_public warning
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- geo_localities: canonical place database
CREATE TABLE IF NOT EXISTS geo_localities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  name_phonetic TEXT,
  district TEXT,
  state TEXT NOT NULL DEFAULT 'Tamil Nadu',
  country TEXT NOT NULL DEFAULT 'India',
  locality_type TEXT,
  population INTEGER,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  geonames_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name_normalized, state)
);

CREATE INDEX IF NOT EXISTS idx_geo_localities_name_norm ON geo_localities(name_normalized);
CREATE INDEX IF NOT EXISTS idx_geo_localities_state ON geo_localities(state);
CREATE INDEX IF NOT EXISTS idx_geo_localities_district ON geo_localities(district);
CREATE INDEX IF NOT EXISTS idx_geo_localities_trgm ON geo_localities USING gin(name_normalized extensions.gin_trgm_ops);

-- geo_aliases: alternate spellings → canonical locality
CREATE TABLE IF NOT EXISTS geo_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias_raw TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  locality_id UUID NOT NULL REFERENCES geo_localities(id) ON DELETE CASCADE,
  alias_type TEXT NOT NULL DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias_normalized)
);

CREATE INDEX IF NOT EXISTS idx_geo_aliases_norm ON geo_aliases(alias_normalized);
CREATE INDEX IF NOT EXISTS idx_geo_aliases_locality ON geo_aliases(locality_id);

-- geo_gym_aliases: gym-specific learned aliases
CREATE TABLE IF NOT EXISTS geo_gym_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  alias_raw TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias_normalized, gym_id)
);

CREATE INDEX IF NOT EXISTS idx_geo_gym_aliases_gym ON geo_gym_aliases(gym_id);
CREATE INDEX IF NOT EXISTS idx_geo_gym_aliases_norm ON geo_gym_aliases(alias_normalized);

-- geo_normalization_log: audit trail
CREATE TABLE IF NOT EXISTS geo_normalization_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  raw_input TEXT NOT NULL,
  normalized_value TEXT,
  canonical_locality_id UUID REFERENCES geo_localities(id) ON DELETE SET NULL,
  confidence_score NUMERIC(5,4),
  matched_by TEXT,
  geo_hierarchy JSONB,
  requires_review BOOLEAN NOT NULL DEFAULT false,
  import_session_id TEXT,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_log_gym ON geo_normalization_log(gym_id);
CREATE INDEX IF NOT EXISTS idx_geo_log_raw ON geo_normalization_log(raw_input);
CREATE INDEX IF NOT EXISTS idx_geo_log_review ON geo_normalization_log(requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_geo_log_created ON geo_normalization_log(created_at DESC);

-- geo_review_queue: unresolved matches waiting for admin decision
CREATE TABLE IF NOT EXISTS geo_review_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  raw_input TEXT NOT NULL,
  top_suggestion TEXT,
  top_confidence NUMERIC(5,4),
  all_suggestions JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_to TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  log_id UUID REFERENCES geo_normalization_log(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_queue_gym ON geo_review_queue(gym_id);
CREATE INDEX IF NOT EXISTS idx_geo_queue_status ON geo_review_queue(status) WHERE status = 'pending';

-- RLS
ALTER TABLE geo_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_gym_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_normalization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read localities" ON geo_localities;
CREATE POLICY "Authenticated users can read localities"
  ON geo_localities FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read aliases" ON geo_aliases;
CREATE POLICY "Authenticated users can read aliases"
  ON geo_aliases FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE on geo_localities and geo_aliases is intentionally blocked for regular users.
-- In Postgres RLS, when ENABLE ROW LEVEL SECURITY is on and no matching policy exists for an
-- operation, the default is DENY. There are intentionally no INSERT/UPDATE/DELETE policies here.
-- Use the service role (admin client) for bulk seed operations only.
-- Do NOT add a permissive mutation policy thinking you are filling a gap - this is by design.

DROP POLICY IF EXISTS "Gym owners can manage their own gym aliases" ON geo_gym_aliases;
CREATE POLICY "Gym owners can manage their own gym aliases"
  ON geo_gym_aliases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = geo_gym_aliases.gym_id AND owner_id = auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Gym owners can view their normalization logs" ON geo_normalization_log;
CREATE POLICY "Gym owners can view their normalization logs"
  ON geo_normalization_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = geo_normalization_log.gym_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners can insert normalization logs" ON geo_normalization_log;
CREATE POLICY "Gym owners can insert normalization logs"
  ON geo_normalization_log FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = geo_normalization_log.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can view their review queue" ON geo_review_queue;
CREATE POLICY "Gym owners can view their review queue"
  ON geo_review_queue FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = geo_review_queue.gym_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners can manage their review queue" ON geo_review_queue;
CREATE POLICY "Gym owners can manage their review queue"
  ON geo_review_queue FOR ALL
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = geo_review_queue.gym_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM gyms WHERE id = geo_review_queue.gym_id AND owner_id = auth.uid()));

-- ── Helper functions (called by API routes via supabase.rpc) ─────────────────

-- Trigram similarity search
CREATE OR REPLACE FUNCTION search_localities_trigram(
  query_text TEXT,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  name_normalized TEXT,
  name_phonetic TEXT,
  district TEXT,
  state TEXT,
  trgm_score FLOAT
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    id, name, name_normalized, name_phonetic, district, state,
    similarity(name_normalized, query_text)::FLOAT AS trgm_score
  FROM geo_localities
  WHERE similarity(name_normalized, query_text) > 0.15
    AND is_active = true
  ORDER BY trgm_score DESC
  LIMIT result_limit;
$$;

-- Autocomplete search (prefix + trigram)
CREATE OR REPLACE FUNCTION search_localities_autocomplete(
  query_text TEXT,
  prefix_text TEXT,
  result_limit INTEGER DEFAULT 8
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  district TEXT,
  state TEXT
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT id, name, district, state
  FROM geo_localities
  WHERE (
    name_normalized ILIKE prefix_text || '%'
    OR similarity(name_normalized, query_text) > 0.20
  )
  AND is_active = true
  ORDER BY
    CASE WHEN name_normalized ILIKE prefix_text || '%' THEN 1 ELSE 2 END,
    similarity(name_normalized, query_text) DESC
  LIMIT result_limit;
$$;

-- ── Security hardening ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
  END IF;
END $$;

-- Create the gym plan prices table
CREATE TABLE IF NOT EXISTS gym_plan_prices (
  gym_id    UUID PRIMARY KEY REFERENCES gyms(id) ON DELETE CASCADE,
  monthly   INTEGER NOT NULL DEFAULT 1500,
  quarterly INTEGER NOT NULL DEFAULT 4000,
  annual    INTEGER NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only the gym owner can read their own prices
ALTER TABLE gym_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own plan prices" ON gym_plan_prices;
CREATE POLICY "Owner can read own plan prices"
  ON gym_plan_prices FOR SELECT
  USING (
    gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
  );


-- ================================================
-- [Migration 8] Onboarding system
-- ================================================

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS onboarding_data JSONB;

-- Update existing gyms to mark onboarding as completed (they were created before this feature)
UPDATE gyms SET onboarding_completed = TRUE WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- RLS already covers gyms table

-- Allow gym owners to update onboarding_data and onboarding_completed on their own gym
-- (covered by the existing "Users can update their own gym" policy)

-- ================================================
-- [Migration 9] Joining fees per plan in gym_plan_prices
-- ================================================

ALTER TABLE gym_plan_prices ADD COLUMN IF NOT EXISTS joining_fee_monthly   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gym_plan_prices ADD COLUMN IF NOT EXISTS joining_fee_quarterly  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gym_plan_prices ADD COLUMN IF NOT EXISTS joining_fee_annual     INTEGER NOT NULL DEFAULT 0;

-- Allow owners to write their own plan prices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gym_plan_prices' AND policyname = 'Owner can upsert own plan prices'
  ) THEN
    DROP POLICY IF EXISTS "Owner can upsert own plan prices" ON gym_plan_prices;
CREATE POLICY "Owner can upsert own plan prices"
  ON gym_plan_prices FOR INSERT
      WITH CHECK (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gym_plan_prices' AND policyname = 'Owner can update own plan prices'
  ) THEN
    DROP POLICY IF EXISTS "Owner can update own plan prices" ON gym_plan_prices;
CREATE POLICY "Owner can update own plan prices"
  ON gym_plan_prices FOR UPDATE
      USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ================================================
-- [Migration 10] Google Places hybrid geo metadata
-- Stores supplementary Google data alongside existing canonical area columns.
-- The canonical area columns (area, _area_confidence, etc.) remain unchanged.
-- ================================================

-- Add Google Places metadata columns to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_place_id       TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_formatted_addr TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_locality_raw   TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_city_raw       TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_state_raw      TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_postal_code    TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_latitude       NUMERIC(10, 7);
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_longitude      NUMERIC(10, 7);

-- Index for place_id lookups (deduplication, analytics)
CREATE INDEX IF NOT EXISTS idx_members_google_place_id ON members(google_place_id) WHERE google_place_id IS NOT NULL;

-- NOTE: google_place_id is supplementary metadata only.
-- The canonical area is still stored in members.area (free text, normalized by GymFlow pipeline).
-- Do NOT use google_place_id as a foreign key or canonical identifier.

-- Migration: Add legacy_member_id column to members table
-- Run this in your Supabase SQL editor or via the Supabase CLI.
--
-- Purpose:
--   When importing members from external systems (e.g. old gym software),
--   the original ID (e.g. "C1006", "MEM-042") is preserved here.
--   The new canonical ID format is GF-prefixed: GF0001, GF0042, etc.,
--   derived from the integer member_number column.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS legacy_member_id TEXT DEFAULT NULL;

COMMENT ON COLUMN members.legacy_member_id IS
  'Original member ID from an external/legacy system, preserved during import. '
  'The canonical GymFlow ID is derived from member_number as GF + zero-padded 4 digits.';

-- ================================================
-- INVENTORY
-- ================================================

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  sku TEXT,
  description TEXT,
  variant_name TEXT NOT NULL,
  cost_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  member_price NUMERIC,
  initial_stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_gym_id ON inventory(gym_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(gym_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(gym_id, sku);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- INVENTORY policies
DROP POLICY IF EXISTS "Gym owners can view their inventory" ON inventory;
CREATE POLICY "Gym owners can view their inventory"
  ON inventory FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert inventory" ON inventory;
CREATE POLICY "Gym owners can insert inventory"
  ON inventory FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update inventory" ON inventory;
CREATE POLICY "Gym owners can update inventory"
  ON inventory FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete inventory" ON inventory;
CREATE POLICY "Gym owners can delete inventory"
  ON inventory FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory.gym_id AND owner_id = auth.uid())
  );

-- ================================================
-- FUNCTIONS
-- ================================================

CREATE OR REPLACE FUNCTION increment_inventory_stock(p_inventory_id UUID, amount INTEGER)
RETURNS VOID AS $$
DECLARE
  v_gym_id UUID;
BEGIN
  SELECT gym_id INTO v_gym_id FROM inventory WHERE id = p_inventory_id;
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = v_gym_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE inventory
  SET initial_stock = GREATEST(0, initial_stock + amount),
      updated_at = NOW()
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- INVENTORY SALES (Revenue Tracking)
-- ================================================

CREATE TABLE IF NOT EXISTS inventory_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'card')),
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_sales_gym_id ON inventory_sales(gym_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sales_inventory_id ON inventory_sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sales_sold_at ON inventory_sales(gym_id, sold_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE inventory_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their inventory sales" ON inventory_sales;
CREATE POLICY "Gym owners can view their inventory sales"
  ON inventory_sales FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_sales.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert inventory sales" ON inventory_sales;
CREATE POLICY "Gym owners can insert inventory sales"
  ON inventory_sales FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_sales.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete inventory sales" ON inventory_sales;
CREATE POLICY "Gym owners can delete inventory sales"
  ON inventory_sales FOR DELETE
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = inventory_sales.gym_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners can update inventory sales" ON inventory_sales;
CREATE POLICY "Gym owners can update inventory sales"
  ON inventory_sales FOR UPDATE
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = inventory_sales.gym_id AND owner_id = auth.uid()));

-- ================================================
-- WORKOUT PROGRAMS
-- ================================================

CREATE TABLE IF NOT EXISTS workout_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  notes TEXT,
  duration INTEGER NOT NULL,
  frequency INTEGER,
  difficulty TEXT,
  goal TEXT,
  category TEXT,
  equipment TEXT,
  target_audience TEXT,
  experience_level TEXT,
  schedule JSONB NOT NULL,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_programs_gym_id ON workout_programs(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_programs_created ON workout_programs(gym_id, created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their programs" ON workout_programs;
CREATE POLICY "Gym owners can view their programs"
  ON workout_programs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert programs" ON workout_programs;
CREATE POLICY "Gym owners can insert programs"
  ON workout_programs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update programs" ON workout_programs;
CREATE POLICY "Gym owners can update programs"
  ON workout_programs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete programs" ON workout_programs;
CREATE POLICY "Gym owners can delete programs"
  ON workout_programs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

-- ================================================
-- [Migration 11] Add Category to Memberships
-- ================================================

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('strength', 'cardio', 'both')) DEFAULT 'both';


-- ================================================
-- [Migration 14] Add check_out_time to Attendance
-- ================================================

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;

-- ================================================
-- [Migration 15] Gym Deactivation
-- ================================================

-- Create an RPC function to safely check a gym's active status by email
CREATE OR REPLACE FUNCTION check_gym_active(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_is_active BOOLEAN;
BEGIN
  -- Find the user ID for this email from auth.users
  SELECT id INTO v_owner_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  IF v_owner_id IS NULL THEN
    RETURN false;
  END IF;

  -- Find the gym for this user
  SELECT is_active INTO v_is_active FROM public.gyms WHERE owner_id = v_owner_id LIMIT 1;
  
  IF v_is_active IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- [Migration 16] Support Tickets
-- ================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'issue', 'bug', 'high_priority')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_cleared_by_owner BOOLEAN DEFAULT false,
  is_cleared_by_admin BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_gym_id ON support_tickets(gym_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their support tickets" ON support_tickets;
CREATE POLICY "Gym owners can view their support tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = support_tickets.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert support tickets" ON support_tickets;
CREATE POLICY "Gym owners can insert support tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = support_tickets.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update their support tickets" ON support_tickets;
CREATE POLICY "Gym owners can update their support tickets"
  ON support_tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = support_tickets.gym_id AND owner_id = auth.uid()));


-- ================================================
-- [Migration 17] Enable Realtime for Support & Messages
-- ================================================

-- Add tables to the supabase_realtime publication to enable WebSocket broadcasting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;


-- ================================================
-- [Migration 12] Dashboard RPC
-- ================================================

CREATE OR REPLACE FUNCTION get_gym_dashboard(p_gym_id UUID, p_today DATE)
RETURNS JSON AS $$
DECLARE
  v_total_active INT;
  v_expiring_this_week INT;
  v_expired_count INT;
  v_today_attendance INT;
  v_today_collection NUMERIC;
  v_total_dues NUMERIC;
  v_expiring_members JSON;
BEGIN
  -- 1. Attendance today
  SELECT COUNT(*) INTO v_today_attendance
  FROM attendance
  WHERE gym_id = p_gym_id AND date = p_today;

  -- 2. Today's collection
  SELECT COALESCE(SUM(amount + admission_fee), 0) INTO v_today_collection
  FROM memberships
  WHERE gym_id = p_gym_id AND start_date = p_today;

  -- 3. Total dues
  SELECT COALESCE(SUM(pending_amount), 0) INTO v_total_dues
  FROM members
  WHERE gym_id = p_gym_id AND pending_amount > 0;

  -- 4. Member Statuses & Expiring Members
  -- We use a CTE to get the latest membership for each member
  WITH latest_memberships AS (
    SELECT 
      m.id AS member_id,
      m.name,
      m.phone,
      m.member_number,
      ms.end_date,
      ms.id AS membership_id,
      ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY ms.created_at DESC) as rn
    FROM members m
    LEFT JOIN memberships ms ON ms.member_id = m.id
    WHERE m.gym_id = p_gym_id
  ),
  member_statuses AS (
    SELECT 
      member_id,
      name,
      phone,
      member_number,
      end_date,
      CASE 
        WHEN end_date IS NULL THEN 'expired'
        WHEN end_date < p_today THEN 'expired'
        WHEN end_date >= p_today AND end_date <= (p_today + INTERVAL '7 days')::DATE THEN 'expiring'
        ELSE 'active'
      END as status,
      (end_date - p_today) as days_remaining
    FROM latest_memberships
    WHERE rn = 1
  )
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('active', 'expiring'))::INT,
    COUNT(*) FILTER (WHERE status = 'expiring')::INT,
    COUNT(*) FILTER (WHERE status = 'expired')::INT,
    COALESCE(
      json_agg(
        json_build_object(
          'id', member_id,
          'name', name,
          'phone', phone,
          'member_number', member_number,
          'status', status,
          'days_remaining', days_remaining,
          'latest_membership', json_build_object('end_date', end_date)
        ) ORDER BY days_remaining ASC
      ) FILTER (WHERE status = 'expiring'), 
      '[]'::json
    )
  INTO 
    v_total_active, 
    v_expiring_this_week, 
    v_expired_count,
    v_expiring_members
  FROM member_statuses;

  RETURN json_build_object(
    'stats', json_build_object(
      'total_active', COALESCE(v_total_active, 0),
      'expiring_this_week', COALESCE(v_expiring_this_week, 0),
      'expired_count', COALESCE(v_expired_count, 0),
      'today_attendance', COALESCE(v_today_attendance, 0),
      'today_collection', COALESCE(v_today_collection, 0),
      'total_dues', COALESCE(v_total_dues, 0)
    ),
    'expiringMembers', v_expiring_members
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- [Migration 13] Reports RPC
-- ================================================

CREATE OR REPLACE FUNCTION get_gym_reports(p_gym_id UUID, p_today DATE)
RETURNS JSON AS $$
DECLARE
  v_months JSON;
  v_inventory_sales JSON;
  v_recent_inventory_sales JSON;
  v_expired_count INT;
  v_active_count INT;
  v_churn_count INT;
  v_plan_counts JSON;
  v_gender_counts JSON;
  v_age_buckets JSON;
  v_new_members_by_month JSON;
  v_attendance_by_day JSON;
  v_top_areas JSON;
  v_members_with_dues JSON;
  v_total_dues_amount NUMERIC;
  v_expiring_members JSON;
  v_attendance_today_count INT;
BEGIN
  -- 1. Generate 6-month ranges
  -- We'll use a temporary table or just CTEs within queries. 
  -- Since we need it across multiple queries, let's create a temp table to make it cleaner,
  -- or just calculate the boundaries.
  
  -- Monthly Revenue (months)
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'total', COALESCE(rev.total, 0),
      'cash', COALESCE(rev.cash, 0),
      'upi', COALESCE(rev.upi, 0),
      'card', COALESCE(rev.card, 0),
      'transactions', COALESCE(rev.transactions, 0),
      'newMembers', COALESCE(rev.new_members, 0)
    ) ORDER BY mr.idx DESC -- We want oldest first (idx 5 down to 0)
  ), '[]'::json) INTO v_months
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT 
      SUM(amount + admission_fee) AS total,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'cash') AS cash,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'upi') AS upi,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'card') AS card,
      COUNT(*) AS transactions,
      COUNT(DISTINCT member_id) AS new_members
    FROM memberships
    WHERE gym_id = p_gym_id AND start_date >= mr.start_dt AND start_date <= mr.end_dt
  ) rev ON true;

  -- Monthly Inventory Sales
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'total', COALESCE(inv.total, 0),
      'quantity', COALESCE(inv.quantity, 0)
    ) ORDER BY mr.idx DESC
  ), '[]'::json) INTO v_inventory_sales
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT 
      SUM(total_price) AS total,
      SUM(quantity) AS quantity
    FROM inventory_sales
    WHERE gym_id = p_gym_id AND sold_at >= mr.start_dt AND sold_at <= (mr.end_dt + interval '1 day - 1 second')
  ) inv ON true;

  -- Recent Inventory Sales (Last 20)
  SELECT COALESCE(json_agg(row_to_json(inv_sales)), '[]'::json) INTO v_recent_inventory_sales
  FROM (
    SELECT total_price, quantity, product_name, variant_name, payment_mode, sold_at
    FROM inventory_sales
    WHERE gym_id = p_gym_id
    ORDER BY sold_at DESC
    LIMIT 20
  ) inv_sales;

  -- Latest Memberships & Member Statuses
  -- Using a CTE for latest membership per member
  WITH latest_memberships AS (
    SELECT DISTINCT ON (m.id)
      m.id AS member_id,
      m.name,
      m.phone,
      m.gender,
      m.age,
      m.area,
      m.pending_amount,
      m.created_at,
      ms.end_date,
      ms.plan
    FROM members m
    LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.gym_id = p_gym_id
    WHERE m.gym_id = p_gym_id
    ORDER BY m.id, ms.created_at DESC
  )
  SELECT 
    COUNT(*) FILTER (WHERE end_date < p_today),
    COUNT(*) FILTER (WHERE end_date >= p_today),
    COUNT(*) FILTER (WHERE end_date < p_today), -- Churn is same as expired currently
    json_build_object(
      'monthly', COUNT(*) FILTER (WHERE plan = 'monthly'),
      'quarterly', COUNT(*) FILTER (WHERE plan = 'quarterly'),
      'annual', COUNT(*) FILTER (WHERE plan = 'annual')
    ),
    json_build_object(
      'male', COUNT(*) FILTER (WHERE gender = 'male'),
      'female', COUNT(*) FILTER (WHERE gender = 'female'),
      'other', COUNT(*) FILTER (WHERE gender = 'other'),
      'unknown', COUNT(*) FILTER (WHERE gender IS NULL)
    ),
    json_build_object(
      '<18', COUNT(*) FILTER (WHERE age < 18),
      '18-25', COUNT(*) FILTER (WHERE age >= 18 AND age <= 25),
      '26-35', COUNT(*) FILTER (WHERE age >= 26 AND age <= 35),
      '36-45', COUNT(*) FILTER (WHERE age >= 36 AND age <= 45),
      '46+', COUNT(*) FILTER (WHERE age >= 46),
      'unknown', COUNT(*) FILTER (WHERE age IS NULL)
    ),
    COALESCE(
      json_agg(
        json_build_object(
          'name', name,
          'phone', phone,
          'endDate', end_date,
          'plan', COALESCE(plan, 'None')
        ) ORDER BY end_date ASC
      ) FILTER (WHERE end_date IS NOT NULL), '[]'::json
    )
  INTO 
    v_expired_count,
    v_active_count,
    v_churn_count,
    v_plan_counts,
    v_gender_counts,
    v_age_buckets,
    v_expiring_members
  FROM latest_memberships;

  -- New Members By Month (Using same 6 month logic)
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'count', COALESCE(mem.new_count, 0)
    ) ORDER BY mr.idx DESC
  ), '[]'::json) INTO v_new_members_by_month
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS new_count
    FROM members
    WHERE gym_id = p_gym_id AND created_at >= mr.start_dt AND created_at <= (mr.end_dt + interval '1 day - 1 second')
  ) mem ON true;

  -- Attendance By Day (Last 3 months)
  WITH day_names (idx, name) AS (
    VALUES (0, 'Sun'), (1, 'Mon'), (2, 'Tue'), (3, 'Wed'), (4, 'Thu'), (5, 'Fri'), (6, 'Sat')
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'name', dn.name,
      'count', COALESCE(att.cnt, 0)
    ) ORDER BY dn.idx ASC
  ), '[]'::json) INTO v_attendance_by_day
  FROM day_names dn
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM attendance
    WHERE gym_id = p_gym_id AND date >= (p_today - interval '3 months')::date
      AND EXTRACT(DOW FROM date) = dn.idx
  ) att ON true;

  -- Attendance Today Count
  SELECT COUNT(*) INTO v_attendance_today_count
  FROM attendance
  WHERE gym_id = p_gym_id AND date = p_today;

  -- Top 5 Areas (Changed to Top 10 in JS previously, let's keep Top 10)
  SELECT COALESCE(json_agg(area_agg), '[]'::json) INTO v_top_areas
  FROM (
    SELECT json_build_object('area', area, 'count', COUNT(*)) AS area_agg
    FROM members
    WHERE gym_id = p_gym_id AND area IS NOT NULL
    GROUP BY area
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) a;

  -- Dues Analytics
  SELECT 
    COALESCE(json_agg(
      json_build_object(
        'name', name,
        'phone', phone,
        'amount', pending_amount
      )
    ), '[]'::json),
    COALESCE(SUM(pending_amount), 0)
  INTO 
    v_members_with_dues,
    v_total_dues_amount
  FROM members
  WHERE gym_id = p_gym_id AND pending_amount > 0;

  -- Return final JSON
  RETURN json_build_object(
    'months', v_months,
    'inventorySales', v_inventory_sales,
    'recentInventorySales', v_recent_inventory_sales,
    'expiredCount', COALESCE(v_expired_count, 0),
    'activeCount', COALESCE(v_active_count, 0),
    'churnCount', COALESCE(v_churn_count, 0),
    'planCounts', COALESCE(v_plan_counts, '{}'::json),
    'genderCounts', COALESCE(v_gender_counts, '{}'::json),
    'ageBuckets', COALESCE(v_age_buckets, '{}'::json),
    'newMembersByMonth', v_new_members_by_month,
    'attendanceByDay', v_attendance_by_day,
    'topAreas', v_top_areas,
    'membersWithDues', v_members_with_dues,
    'totalDuesAmount', COALESCE(v_total_dues_amount, 0),
    'expiringMembers', v_expiring_members,
    'attendanceTodayCount', COALESCE(v_attendance_today_count, 0)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── MIGRATION: add_subscription.sql ──────────────────────────────────

  -- =============================================================
  -- GymFlow — Subscription & 14-Day Trial Migration (safe to re-run)
  -- Paste into Supabase Dashboard → SQL Editor → Run
  -- =============================================================

  -- ── 1. Add subscription columns to gyms ──────────────────────
  ALTER TABLE gyms
    ADD COLUMN IF NOT EXISTS trial_started_at        timestamptz,
    ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
    ADD COLUMN IF NOT EXISTS subscription_status     text NOT NULL DEFAULT 'trial'
                                                     CHECK (subscription_status IN ('trial', 'active', 'expired')),
    ADD COLUMN IF NOT EXISTS plan_type               text NOT NULL DEFAULT 'trial'
                                                     CHECK (plan_type IN ('trial', 'monthly', 'yearly', 'lifetime')),
    ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS subscription_ends_at    timestamptz;

  -- ── 2. Backfill existing gyms as active ──────────────────────
  -- (Gyms created before trials existed keep full access)
  UPDATE gyms
  SET subscription_status     = 'active',
      plan_type               = 'monthly',
      subscription_started_at = created_at
  WHERE subscription_status = 'trial'
    AND trial_started_at IS NULL;

  -- ── 3. Indexes ────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_gyms_subscription_status
    ON gyms(subscription_status);

  CREATE INDEX IF NOT EXISTS idx_gyms_trial_ends_at
    ON gyms(trial_ends_at)
    WHERE subscription_status = 'trial';

  -- ── 4. subscription_requests table ───────────────────────────
  CREATE TABLE IF NOT EXISTS subscription_requests (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    uploaded_file_url text NOT NULL,
    transaction_id   text,
    notes            text,
    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason text,
    submitted_at     timestamptz NOT NULL DEFAULT now(),
    reviewed_at      timestamptz,
    reviewed_by      text
  );

  CREATE INDEX IF NOT EXISTS idx_sub_requests_gym_id ON subscription_requests(gym_id);
  CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON subscription_requests(status);

  ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "gym owner read own requests" ON subscription_requests;
  DROP POLICY IF EXISTS "gym owner read own requests" ON subscription_requests;
CREATE POLICY "gym owner read own requests"
  ON subscription_requests FOR SELECT
    USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "gym owner insert own requests" ON subscription_requests;
  DROP POLICY IF EXISTS "gym owner insert own requests" ON subscription_requests;
CREATE POLICY "gym owner insert own requests"
  ON subscription_requests FOR INSERT
    WITH CHECK (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

  -- ── 5. platform_settings table (UPI details + prices) ────────
  CREATE TABLE IF NOT EXISTS platform_settings (
    id             int PRIMARY KEY DEFAULT 1,
    upi_id         text NOT NULL DEFAULT '',
    upi_name       text NOT NULL DEFAULT 'GymFlow',
    price_monthly  int  NOT NULL DEFAULT 2999,
    price_yearly   int  NOT NULL DEFAULT 29999,
    CHECK (id = 1)
  );

  INSERT INTO platform_settings DEFAULT VALUES
    ON CONFLICT (id) DO NOTHING;

  -- ── 6. Storage bucket for payment proof screenshots ──────────
  INSERT INTO storage.buckets (id, name, public)
    VALUES ('payment-proofs', 'payment-proofs', false)
    ON CONFLICT (id) DO NOTHING;

  DROP POLICY IF EXISTS "gym owner upload payment proof" ON storage.objects;
  DROP POLICY IF EXISTS "gym owner upload payment proof" ON storage.objects;
CREATE POLICY "gym owner upload payment proof"
  ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'payment-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  DROP POLICY IF EXISTS "gym owner read own payment proofs" ON storage.objects;
  DROP POLICY IF EXISTS "gym owner read own payment proofs" ON storage.objects;
CREATE POLICY "gym owner read own payment proofs"
  ON storage.objects FOR SELECT
    USING (
      bucket_id = 'payment-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- ── 7. Update check_gym_active RPC ───────────────────────────
  -- Returns false for admin-deactivated, expired-trial AND lapsed-paid accounts.
  -- (The app code checks subscription_status to tell them apart.)
  -- Lifetime plans store subscription_ends_at = NULL → never lapse.
  CREATE OR REPLACE FUNCTION check_gym_active(p_email text)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
    SELECT
      CASE
        WHEN g.is_active = false                   THEN false
        WHEN g.subscription_status = 'expired'     THEN false
        WHEN g.subscription_status = 'trial'
             AND g.trial_ends_at < now()           THEN false
        WHEN g.subscription_status = 'active'
             AND g.subscription_ends_at IS NOT NULL
             AND g.subscription_ends_at < now()    THEN false
        ELSE true
      END
    FROM auth.users u
    JOIN gyms g ON g.owner_id = u.id
    WHERE u.email = p_email
    LIMIT 1;
  $$;

-- ── MIGRATION: add_inventory_units_table.sql ──────────────────────────────────

-- ================================================
-- INVENTORY UNITS (Serialized Tracking)
-- ================================================

CREATE TABLE IF NOT EXISTS inventory_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'expired', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, barcode)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_units_gym_id ON inventory_units(gym_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_inventory_id ON inventory_units(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_barcode ON inventory_units(gym_id, barcode);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;

-- INVENTORY_UNITS policies
DROP POLICY IF EXISTS "Gym owners can view their inventory units" ON inventory_units;
CREATE POLICY "Gym owners can view their inventory units"
  ON inventory_units FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_units.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert inventory units" ON inventory_units;
CREATE POLICY "Gym owners can insert inventory units"
  ON inventory_units FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_units.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update inventory units" ON inventory_units;
CREATE POLICY "Gym owners can update inventory units"
  ON inventory_units FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_units.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete inventory units" ON inventory_units;
CREATE POLICY "Gym owners can delete inventory units"
  ON inventory_units FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = inventory_units.gym_id AND owner_id = auth.uid())
  );

-- ================================================
-- FUNCTIONS
-- ================================================

CREATE OR REPLACE FUNCTION increment_inventory_stock(p_inventory_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET initial_stock = GREATEST(0, initial_stock + amount),
      updated_at = NOW()
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';


-- ── MIGRATION: add_workout_programs.sql ──────────────────────────────────

-- ================================================
-- WORKOUT PROGRAMS
-- ================================================

CREATE TABLE IF NOT EXISTS workout_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  notes TEXT,
  duration INTEGER NOT NULL,
  frequency INTEGER,
  difficulty TEXT,
  goal TEXT,
  category TEXT,
  equipment TEXT,
  target_audience TEXT,
  experience_level TEXT,
  schedule JSONB NOT NULL,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_programs_gym_id ON workout_programs(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_programs_created ON workout_programs(gym_id, created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their programs" ON workout_programs;
CREATE POLICY "Gym owners can view their programs"
  ON workout_programs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert programs" ON workout_programs;
CREATE POLICY "Gym owners can insert programs"
  ON workout_programs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update programs" ON workout_programs;
CREATE POLICY "Gym owners can update programs"
  ON workout_programs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete programs" ON workout_programs;
CREATE POLICY "Gym owners can delete programs"
  ON workout_programs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = workout_programs.gym_id AND owner_id = auth.uid())
  );


-- ── MIGRATION: 20250704_create_whatsapp_tables.sql ──────────────────────────────────

-- WhatsApp Cloud API Database Schema
-- 
-- Tables for storing WhatsApp messages, statuses, and webhook logs.
-- Optimized for high-throughput webhook processing.

-- ════════════════════════════════════════════════════════════════════════════
-- WhatsApp Messages Table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Message identification
  message_id TEXT NOT NULL UNIQUE, -- WhatsApp message ID
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  
  -- Phone numbers
  phone_number_id TEXT NOT NULL, -- WhatsApp Business Phone Number ID
  from_number TEXT NOT NULL, -- Sender phone number (E.164 format)
  to_number TEXT NOT NULL, -- Recipient phone number (E.164 format)
  
  -- Message metadata
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL, -- text, image, video, audio, document, etc.
  
  -- Content
  content TEXT, -- Text content or caption
  media_id TEXT, -- WhatsApp media ID
  media_type TEXT, -- MIME type
  media_url TEXT, -- Downloaded media URL (S3, Supabase Storage, etc.)
  caption TEXT, -- Media caption
  
  -- Status tracking
  status TEXT CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'deleted')),
  conversation_id TEXT, -- WhatsApp conversation ID
  context_message_id TEXT, -- ID of message being replied to
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::JSONB, -- Flexible storage for message-specific data
  
  -- Error tracking
  error_code INTEGER,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_gym_id ON whatsapp_messages(gym_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number_id ON whatsapp_messages(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from_number ON whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id) WHERE conversation_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_gym_created ON whatsapp_messages(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_gym_from ON whatsapp_messages(gym_id, from_number, created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_messages_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- WhatsApp Webhook Logs Table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request identification
  request_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  
  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'status', 'error', 'unknown')),
  payload JSONB NOT NULL, -- Full webhook payload for debugging
  
  -- Processing metadata
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  processing_time_ms INTEGER,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for webhook logs
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_request_id ON whatsapp_webhook_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_phone_number_id ON whatsapp_webhook_logs(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_event_type ON whatsapp_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_created_at ON whatsapp_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_processed ON whatsapp_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_signature_valid ON whatsapp_webhook_logs(signature_valid);

-- Auto-delete old webhook logs (keep last 7 days)
CREATE OR REPLACE FUNCTION delete_old_whatsapp_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM whatsapp_webhook_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════
-- Gym WhatsApp Configuration Table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gym_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,
  
  -- WhatsApp Business Account configuration
  phone_number_id TEXT NOT NULL UNIQUE, -- WhatsApp Business Phone Number ID
  phone_number TEXT NOT NULL, -- Display phone number (E.164 format)
  business_account_id TEXT NOT NULL, -- WhatsApp Business Account ID
  
  -- Configuration
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reply_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gym_whatsapp_config_gym_id ON gym_whatsapp_config(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_whatsapp_config_phone_number_id ON gym_whatsapp_config(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_gym_whatsapp_config_enabled ON gym_whatsapp_config(enabled);

-- Updated timestamp trigger
CREATE TRIGGER gym_whatsapp_config_updated_at
  BEFORE UPDATE ON gym_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_messages_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ════════════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Messages: Gym owners can only see their own messages
DROP POLICY IF EXISTS whatsapp_messages_select_policy ON whatsapp_messages;
CREATE POLICY whatsapp_messages_select_policy
  ON whatsapp_messages
  FOR SELECT
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS whatsapp_messages_insert_policy ON whatsapp_messages;
CREATE POLICY whatsapp_messages_insert_policy
  ON whatsapp_messages
  FOR INSERT
  WITH CHECK (
    gym_id IN (
      SELECT id FROM gyms WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS whatsapp_messages_update_policy ON whatsapp_messages;
CREATE POLICY whatsapp_messages_update_policy
  ON whatsapp_messages
  FOR UPDATE
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE owner_id = auth.uid()
    )
  );

-- Webhook logs: Only accessible via service role (admin only)
DROP POLICY IF EXISTS whatsapp_webhook_logs_admin_policy ON whatsapp_webhook_logs;
CREATE POLICY whatsapp_webhook_logs_admin_policy
  ON whatsapp_webhook_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.jwt() ->> 'role' = 'service_role');

-- Config: Gym owners can manage their own config
DROP POLICY IF EXISTS gym_whatsapp_config_select_policy ON gym_whatsapp_config;
CREATE POLICY gym_whatsapp_config_select_policy
  ON gym_whatsapp_config
  FOR SELECT
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS gym_whatsapp_config_update_policy ON gym_whatsapp_config;
CREATE POLICY gym_whatsapp_config_update_policy
  ON gym_whatsapp_config
  FOR UPDATE
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE owner_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- Helpful Views
-- ════════════════════════════════════════════════════════════════════════════

-- View for conversation threads
CREATE OR REPLACE VIEW whatsapp_conversations AS
SELECT 
  gym_id,
  from_number AS contact_number,
  MAX(created_at) AS last_message_at,
  COUNT(*) AS message_count,
  COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound_count,
  COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_count,
  COUNT(*) FILTER (WHERE status = 'read') AS read_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM whatsapp_messages
WHERE direction = 'inbound'
GROUP BY gym_id, from_number
ORDER BY last_message_at DESC;

-- ════════════════════════════════════════════════════════════════════════════
-- Comments for documentation
-- ════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE whatsapp_messages IS 'Stores all WhatsApp messages (inbound and outbound)';
COMMENT ON TABLE whatsapp_webhook_logs IS 'Logs all webhook events for debugging and monitoring';
COMMENT ON TABLE gym_whatsapp_config IS 'WhatsApp Business configuration per gym';
COMMENT ON VIEW whatsapp_conversations IS 'Aggregated view of conversations by contact';


-- ── MIGRATION: 20260612_dashboard_rpc.sql ──────────────────────────────────

-- Migration: Add dashboard RPC function

CREATE OR REPLACE FUNCTION get_gym_dashboard(p_gym_id UUID, p_today DATE)
RETURNS JSON AS $$
DECLARE
  v_total_active INT;
  v_expiring_this_week INT;
  v_expired_count INT;
  v_today_attendance INT;
  v_today_collection NUMERIC;
  v_total_dues NUMERIC;
  v_expiring_members JSON;
BEGIN
  -- 1. Attendance today
  SELECT COUNT(*) INTO v_today_attendance
  FROM attendance
  WHERE gym_id = p_gym_id AND date = p_today;

  -- 2. Today's collection
  SELECT COALESCE(SUM(amount + admission_fee), 0) INTO v_today_collection
  FROM memberships
  WHERE gym_id = p_gym_id AND start_date = p_today;

  -- 3. Total dues
  SELECT COALESCE(SUM(pending_amount), 0) INTO v_total_dues
  FROM members
  WHERE gym_id = p_gym_id AND pending_amount > 0;

  -- 4. Member Statuses & Expiring Members
  -- We use a CTE to get the latest membership for each member
  WITH latest_memberships AS (
    SELECT 
      m.id AS member_id,
      m.name,
      m.phone,
      m.member_number,
      ms.end_date,
      ms.id AS membership_id,
      ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY ms.created_at DESC) as rn
    FROM members m
    LEFT JOIN memberships ms ON ms.member_id = m.id
    WHERE m.gym_id = p_gym_id
  ),
  member_statuses AS (
    SELECT 
      member_id,
      name,
      phone,
      member_number,
      end_date,
      CASE 
        WHEN end_date IS NULL THEN 'expired'
        WHEN end_date < p_today THEN 'expired'
        WHEN end_date >= p_today AND end_date <= (p_today + INTERVAL '7 days')::DATE THEN 'expiring'
        ELSE 'active'
      END as status,
      (end_date - p_today) as days_remaining
    FROM latest_memberships
    WHERE rn = 1
  )
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('active', 'expiring'))::INT,
    COUNT(*) FILTER (WHERE status = 'expiring')::INT,
    COUNT(*) FILTER (WHERE status = 'expired')::INT,
    COALESCE(
      json_agg(
        json_build_object(
          'id', member_id,
          'name', name,
          'phone', phone,
          'member_number', member_number,
          'status', status,
          'days_remaining', days_remaining,
          'latest_membership', json_build_object('end_date', end_date)
        ) ORDER BY days_remaining ASC
      ) FILTER (WHERE status = 'expiring'), 
      '[]'::json
    )
  INTO 
    v_total_active, 
    v_expiring_this_week, 
    v_expired_count,
    v_expiring_members
  FROM member_statuses;

  RETURN json_build_object(
    'stats', json_build_object(
      'total_active', COALESCE(v_total_active, 0),
      'expiring_this_week', COALESCE(v_expiring_this_week, 0),
      'expired_count', COALESCE(v_expired_count, 0),
      'today_attendance', COALESCE(v_today_attendance, 0),
      'today_collection', COALESCE(v_today_collection, 0),
      'total_dues', COALESCE(v_total_dues, 0)
    ),
    'expiringMembers', v_expiring_members
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';


-- ── MIGRATION: 20260612_reports_rpc.sql ──────────────────────────────────

-- Migration: Create get_gym_reports RPC

CREATE OR REPLACE FUNCTION get_gym_reports(p_gym_id UUID, p_today DATE)
RETURNS JSON AS $$
DECLARE
  v_months JSON;
  v_inventory_sales JSON;
  v_recent_inventory_sales JSON;
  v_expired_count INT;
  v_active_count INT;
  v_churn_count INT;
  v_plan_counts JSON;
  v_gender_counts JSON;
  v_age_buckets JSON;
  v_new_members_by_month JSON;
  v_attendance_by_day JSON;
  v_top_areas JSON;
  v_members_with_dues JSON;
  v_total_dues_amount NUMERIC;
  v_expiring_members JSON;
  v_attendance_today_count INT;
BEGIN
  -- 1. Generate 6-month ranges
  -- We'll use a temporary table or just CTEs within queries. 
  -- Since we need it across multiple queries, let's create a temp table to make it cleaner,
  -- or just calculate the boundaries.
  
  -- Monthly Revenue (months)
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'total', COALESCE(rev.total, 0),
      'cash', COALESCE(rev.cash, 0),
      'upi', COALESCE(rev.upi, 0),
      'card', COALESCE(rev.card, 0),
      'transactions', COALESCE(rev.transactions, 0),
      'newMembers', COALESCE(rev.new_members, 0)
    ) ORDER BY mr.idx DESC -- We want oldest first (idx 5 down to 0)
  ), '[]'::json) INTO v_months
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT 
      SUM(amount + admission_fee) AS total,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'cash') AS cash,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'upi') AS upi,
      SUM(amount + admission_fee) FILTER (WHERE payment_mode = 'card') AS card,
      COUNT(*) AS transactions,
      COUNT(DISTINCT member_id) AS new_members
    FROM memberships
    WHERE gym_id = p_gym_id AND start_date >= mr.start_dt AND start_date <= mr.end_dt
  ) rev ON true;

  -- Monthly Inventory Sales
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'total', COALESCE(inv.total, 0),
      'quantity', COALESCE(inv.quantity, 0)
    ) ORDER BY mr.idx DESC
  ), '[]'::json) INTO v_inventory_sales
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT 
      SUM(total_price) AS total,
      SUM(quantity) AS quantity
    FROM inventory_sales
    WHERE gym_id = p_gym_id AND sold_at >= mr.start_dt AND sold_at <= (mr.end_dt + interval '1 day - 1 second')
  ) inv ON true;

  -- Recent Inventory Sales (Last 20)
  SELECT COALESCE(json_agg(row_to_json(inv_sales)), '[]'::json) INTO v_recent_inventory_sales
  FROM (
    SELECT total_price, quantity, product_name, variant_name, payment_mode, sold_at
    FROM inventory_sales
    WHERE gym_id = p_gym_id
    ORDER BY sold_at DESC
    LIMIT 20
  ) inv_sales;

  -- Latest Memberships & Member Statuses
  -- Using a CTE for latest membership per member
  WITH latest_memberships AS (
    SELECT DISTINCT ON (m.id)
      m.id AS member_id,
      m.name,
      m.phone,
      m.gender,
      m.age,
      m.area,
      m.pending_amount,
      m.created_at,
      ms.end_date,
      ms.plan
    FROM members m
    LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.gym_id = p_gym_id
    WHERE m.gym_id = p_gym_id
    ORDER BY m.id, ms.created_at DESC
  )
  SELECT 
    COUNT(*) FILTER (WHERE end_date < p_today),
    COUNT(*) FILTER (WHERE end_date >= p_today),
    COUNT(*) FILTER (WHERE end_date < p_today), -- Churn is same as expired currently
    json_build_object(
      'monthly', COUNT(*) FILTER (WHERE plan = 'monthly'),
      'quarterly', COUNT(*) FILTER (WHERE plan = 'quarterly'),
      'annual', COUNT(*) FILTER (WHERE plan = 'annual')
    ),
    json_build_object(
      'male', COUNT(*) FILTER (WHERE gender = 'male'),
      'female', COUNT(*) FILTER (WHERE gender = 'female'),
      'other', COUNT(*) FILTER (WHERE gender = 'other'),
      'unknown', COUNT(*) FILTER (WHERE gender IS NULL)
    ),
    json_build_object(
      '<18', COUNT(*) FILTER (WHERE age < 18),
      '18-25', COUNT(*) FILTER (WHERE age >= 18 AND age <= 25),
      '26-35', COUNT(*) FILTER (WHERE age >= 26 AND age <= 35),
      '36-45', COUNT(*) FILTER (WHERE age >= 36 AND age <= 45),
      '46+', COUNT(*) FILTER (WHERE age >= 46),
      'unknown', COUNT(*) FILTER (WHERE age IS NULL)
    ),
    COALESCE(
      json_agg(
        json_build_object(
          'name', name,
          'phone', phone,
          'endDate', end_date,
          'plan', COALESCE(plan, 'None')
        ) ORDER BY end_date ASC
      ) FILTER (WHERE end_date IS NOT NULL), '[]'::json
    )
  INTO 
    v_expired_count,
    v_active_count,
    v_churn_count,
    v_plan_counts,
    v_gender_counts,
    v_age_buckets,
    v_expiring_members
  FROM latest_memberships;

  -- New Members By Month (Using same 6 month logic)
  WITH month_ranges AS (
    SELECT 
      (date_trunc('month', p_today - (i || ' months')::interval))::date AS start_dt,
      (date_trunc('month', p_today - (i || ' months')::interval) + interval '1 month - 1 day')::date AS end_dt,
      to_char(p_today - (i || ' months')::interval, 'Mon YYYY') AS label,
      i AS idx
    FROM generate_series(0, 5) AS i
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'label', mr.label,
      'count', COALESCE(mem.new_count, 0)
    ) ORDER BY mr.idx DESC
  ), '[]'::json) INTO v_new_members_by_month
  FROM month_ranges mr
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS new_count
    FROM members
    WHERE gym_id = p_gym_id AND created_at >= mr.start_dt AND created_at <= (mr.end_dt + interval '1 day - 1 second')
  ) mem ON true;

  -- Attendance By Day (Last 3 months)
  WITH day_names (idx, name) AS (
    VALUES (0, 'Sun'), (1, 'Mon'), (2, 'Tue'), (3, 'Wed'), (4, 'Thu'), (5, 'Fri'), (6, 'Sat')
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'name', dn.name,
      'count', COALESCE(att.cnt, 0)
    ) ORDER BY dn.idx ASC
  ), '[]'::json) INTO v_attendance_by_day
  FROM day_names dn
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM attendance
    WHERE gym_id = p_gym_id AND date >= (p_today - interval '3 months')::date
      AND EXTRACT(DOW FROM date) = dn.idx
  ) att ON true;

  -- Attendance Today Count
  SELECT COUNT(*) INTO v_attendance_today_count
  FROM attendance
  WHERE gym_id = p_gym_id AND date = p_today;

  -- Top 5 Areas (Changed to Top 10 in JS previously, let's keep Top 10)
  SELECT COALESCE(json_agg(area_agg), '[]'::json) INTO v_top_areas
  FROM (
    SELECT json_build_object('area', area, 'count', COUNT(*)) AS area_agg
    FROM members
    WHERE gym_id = p_gym_id AND area IS NOT NULL
    GROUP BY area
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) a;

  -- Dues Analytics
  SELECT 
    COALESCE(json_agg(
      json_build_object(
        'name', name,
        'phone', phone,
        'amount', pending_amount
      )
    ), '[]'::json),
    COALESCE(SUM(pending_amount), 0)
  INTO 
    v_members_with_dues,
    v_total_dues_amount
  FROM members
  WHERE gym_id = p_gym_id AND pending_amount > 0;

  -- Return final JSON
  RETURN json_build_object(
    'months', v_months,
    'inventorySales', v_inventory_sales,
    'recentInventorySales', v_recent_inventory_sales,
    'expiredCount', COALESCE(v_expired_count, 0),
    'activeCount', COALESCE(v_active_count, 0),
    'churnCount', COALESCE(v_churn_count, 0),
    'planCounts', COALESCE(v_plan_counts, '{}'::json),
    'genderCounts', COALESCE(v_gender_counts, '{}'::json),
    'ageBuckets', COALESCE(v_age_buckets, '{}'::json),
    'newMembersByMonth', v_new_members_by_month,
    'attendanceByDay', v_attendance_by_day,
    'topAreas', v_top_areas,
    'membersWithDues', v_members_with_dues,
    'totalDuesAmount', COALESCE(v_total_dues_amount, 0),
    'expiringMembers', v_expiring_members,
    'attendanceTodayCount', COALESCE(v_attendance_today_count, 0)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── MIGRATION: 20260613_attendance_checkout.sql ──────────────────────────────────

-- Migration: Add check_out_time to attendance

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;


-- ── MIGRATION: 20260614_attendance_sessions.sql ──────────────────────────────────

-- ================================================
-- [Migration 15] Add session tracking to Attendance
-- ================================================

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session TEXT CHECK (session IN ('morning', 'evening')) DEFAULT 'morning';

-- Drop the old unique constraint (member_id, date)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_member_id_date_key;

-- Add the new unique constraint (member_id, date, session)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_member_id_date_session_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_member_id_date_session_key UNIQUE (member_id, date, session);


-- ── MIGRATION: 20260624120000_fix_supabase_linter_warnings.sql ──────────────────────────────────

-- Fix Supabase database linter warnings
-- 1. Change SECURITY DEFINER to SECURITY INVOKER
-- 2. Set search_path = '' for functions to prevent search path mutation
-- 3. Revoke EXECUTE from anon role for these functions

ALTER FUNCTION get_gym_dashboard(UUID, DATE) SECURITY INVOKER SET search_path = '';
ALTER FUNCTION get_gym_reports(UUID, DATE) SECURITY INVOKER SET search_path = '';
ALTER FUNCTION increment_inventory_stock(UUID, INTEGER) SECURITY INVOKER SET search_path = '';

-- Handle rls_auto_enable if it exists (wrap in DO block to avoid errors if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    ALTER FUNCTION rls_auto_enable() SECURITY INVOKER SET search_path = '';
    REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM anon;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION get_gym_dashboard(UUID, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION get_gym_reports(UUID, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_inventory_stock(UUID, INTEGER) FROM anon;


-- ── MIGRATION: 20260624121000_add_membership_category.sql ──────────────────────────────────

-- Migration: Add Category to Memberships
-- Purpose: Support 'strength', 'cardio', or 'both' for memberships.

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('strength', 'cardio', 'both')) DEFAULT 'both';


-- ── MIGRATION: 20260624_security_fixes.sql ──────────────────────────────────

-- Migration: Security Fixes

-- Fix 1: Add WITH CHECK to geo_review_queue FOR ALL policy
DROP POLICY IF EXISTS "Gym owners can manage their review queue" ON geo_review_queue;
DROP POLICY IF EXISTS "Gym owners can manage their review queue" ON geo_review_queue;
CREATE POLICY "Gym owners can manage their review queue"
  ON geo_review_queue FOR ALL
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = geo_review_queue.gym_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM gyms WHERE id = geo_review_queue.gym_id AND owner_id = auth.uid()));

-- Fix 2: Remove NULL bypass for geo_normalization_log INSERT policy
DROP POLICY IF EXISTS "Gym owners can insert normalization logs" ON geo_normalization_log;
DROP POLICY IF EXISTS "Gym owners can insert normalization logs" ON geo_normalization_log;
CREATE POLICY "Gym owners can insert normalization logs"
  ON geo_normalization_log FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = geo_normalization_log.gym_id AND owner_id = auth.uid())
  );

-- Fix 3: Remove NULL created_by condition from geo_gym_aliases
DROP POLICY IF EXISTS "Gym owners can manage their own gym aliases" ON geo_gym_aliases;
DROP POLICY IF EXISTS "Gym owners can manage their own gym aliases" ON geo_gym_aliases;
CREATE POLICY "Gym owners can manage their own gym aliases"
  ON geo_gym_aliases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = geo_gym_aliases.gym_id AND owner_id = auth.uid())
    AND created_by = auth.uid()
  );

-- Fix 4: Add ownership check to increment_inventory_stock
CREATE OR REPLACE FUNCTION increment_inventory_stock(p_inventory_id UUID, amount INTEGER)
RETURNS VOID AS $$
DECLARE
  v_gym_id UUID;
BEGIN
  SELECT gym_id INTO v_gym_id FROM inventory WHERE id = p_inventory_id;
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = v_gym_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE inventory
  SET initial_stock = GREATEST(0, initial_stock + amount),
      updated_at = NOW()
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── MIGRATION: 20260625000000_audit_fixes.sql ──────────────────────────────────

-- Add missing indexes to optimize report aggregations and window functions
CREATE INDEX IF NOT EXISTS idx_memberships_member_created ON memberships(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_gym_created ON members(gym_id, created_at DESC);

-- Add missing UPDATE policy on inventory_sales
DROP POLICY IF EXISTS "Gym owners can update inventory sales" ON inventory_sales;
CREATE POLICY "Gym owners can update inventory sales"
  ON inventory_sales FOR UPDATE
  USING (EXISTS (SELECT 1 FROM gyms WHERE id = inventory_sales.gym_id AND owner_id = auth.uid()));


-- ── MIGRATION: 20260625140600_attendance_update_rls.sql ──────────────────────────────────

-- Migration: Add update policy for attendance

DROP POLICY IF EXISTS "Gym owners can update attendance" ON attendance;
CREATE POLICY "Gym owners can update attendance"
  ON attendance FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = attendance.gym_id AND owner_id = auth.uid())
  );


-- ── MIGRATION: 20260625150000_admin_messages.sql ──────────────────────────────────

-- Admin Messages Table
-- Super admin can send messages/support notes to gym owners.
-- Gym owners read them via their notifications page.

CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT NOT NULL DEFAULT 'super_admin',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by gym
CREATE INDEX IF NOT EXISTS idx_admin_messages_gym_id ON admin_messages(gym_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at ON admin_messages(created_at DESC);

-- Enable RLS
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- Gym owners can only read their own messages
DROP POLICY IF EXISTS "Gym owners can read their admin messages" ON admin_messages;
CREATE POLICY "Gym owners can read their admin messages"
  ON admin_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = admin_messages.gym_id AND owner_id = auth.uid())
  );

-- Gym owners can mark messages as read (update read_at only)
DROP POLICY IF EXISTS "Gym owners can mark messages as read" ON admin_messages;
CREATE POLICY "Gym owners can mark messages as read"
  ON admin_messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = admin_messages.gym_id AND owner_id = auth.uid())
  );

-- Only service_role (super admin) can insert messages (RLS bypassed for service role)
-- No INSERT policy needed — service role bypasses RLS by default


-- ── MIGRATION: 20260625160000_gym_deactivation.sql ──────────────────────────────────

-- 1. Add is_active column to gyms table
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Create an RPC function to safely check a gym's active status by email
-- This uses SECURITY DEFINER so it can query the gyms table (and auth.users) without the user needing to be logged in.
CREATE OR REPLACE FUNCTION check_gym_active(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_is_active BOOLEAN;
BEGIN
  -- Find the user ID for this email from auth.users
  SELECT id INTO v_owner_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  IF v_owner_id IS NULL THEN
    RETURN false;
  END IF;

  -- Find the gym for this user
  SELECT is_active INTO v_is_active FROM public.gyms WHERE owner_id = v_owner_id LIMIT 1;
  
  IF v_is_active IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── MIGRATION: 20260625161500_support_tickets.sql ──────────────────────────────────

-- ================================================
-- [Migration 16] Support Tickets
-- ================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'issue', 'bug', 'high_priority')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_gym_id ON support_tickets(gym_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their support tickets" ON support_tickets;
CREATE POLICY "Gym owners can view their support tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = support_tickets.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert support tickets" ON support_tickets;
CREATE POLICY "Gym owners can insert support tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = support_tickets.gym_id AND owner_id = auth.uid())
  );


-- ── MIGRATION: 20260625162500_realtime_support.sql ──────────────────────────────────

-- ================================================
-- [Migration 17] Enable Realtime for Support & Messages
-- ================================================

-- Add tables to the supabase_realtime publication to enable WebSocket broadcasting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;


-- ── MIGRATION: 20260626010000_add_clear_flags.sql ──────────────────────────────────

-- Add clear/soft-delete flags to admin_messages and support_tickets

-- Admin messages
ALTER TABLE admin_messages 
ADD COLUMN IF NOT EXISTS is_cleared_by_owner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cleared_by_admin BOOLEAN DEFAULT false;

-- Support tickets
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS is_cleared_by_owner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cleared_by_admin BOOLEAN DEFAULT false;


-- ── MIGRATION: 20260627_perf_indexes.sql ──────────────────────────────────

-- Performance indexes for Issues 8 & 9 from the 27 June 2026 production audit.
-- Run: supabase db push

-- Issue 8: Compound index for the most common attendance query pattern.
-- Both dashboard RPC and attendance page query: WHERE gym_id = ? AND date = ?
-- A compound index allows an index-only scan instead of two separate single-column index scans.
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date
  ON attendance(gym_id, date);

-- Issue 9: Compound index for membership expiry status queries.
-- The idx_memberships_end_date single-column index has no gym_id, meaning it covers all gyms.
-- When the query planner uses it for a gym-scoped query, it must re-filter by gym_id after the scan.
-- This compound index enables an index-only scan for the dashboard RPC and expiring members logic.
CREATE INDEX IF NOT EXISTS idx_memberships_gym_end_date
  ON memberships(gym_id, end_date);

-- Bonus: Partial index for dues queries — only indexes rows that actually have outstanding dues.
-- This makes the "Total Dues" dashboard stat query significantly faster on large datasets.
CREATE INDEX IF NOT EXISTS idx_members_gym_dues
  ON members(gym_id, pending_amount)
  WHERE pending_amount > 0;


-- ── MIGRATION: 20260705_whatsapp_automation.sql ──────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- WhatsApp Automation Logs
--
-- Tracks every automated WhatsApp template message sent by the system.
-- Used to:
--   1. Prevent duplicate sends (idempotency at DB level)
--   2. Enforce schedule logic (e.g. "only send every 3 days")
--   3. Stop reminders after renewal/payment
--   4. Audit trail for all automated sends
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_automation_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id       UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  phone_number    TEXT        NOT NULL,
  template_name   TEXT        NOT NULL,
  -- Cycle tracking — groups reminder messages for the same trigger event
  -- Format: "<template>:<member_id>:<trigger_date_iso>"
  -- e.g. "membership_expiry_reminder:uuid:2026-07-10"
  cycle_key       TEXT        NOT NULL,
  -- How many times this template has been sent in the current cycle
  send_count      INTEGER     NOT NULL DEFAULT 1,
  -- WhatsApp message ID returned by Meta API (null if send failed)
  message_id      TEXT,
  -- 'sent' | 'failed' | 'skipped'
  status          TEXT        NOT NULL DEFAULT 'sent',
  error_message   TEXT,
  -- ISO date when this specific message was sent
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The trigger date for the cycle (e.g. expiry date, due date)
  trigger_date    DATE,
  metadata        JSONB       DEFAULT '{}'::JSONB
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_member_id
  ON whatsapp_automation_logs(member_id);

CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_gym_id
  ON whatsapp_automation_logs(gym_id);

CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_template
  ON whatsapp_automation_logs(template_name);

CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_cycle_key
  ON whatsapp_automation_logs(cycle_key);

-- Fast "did we already send today?" check
CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_sent_at
  ON whatsapp_automation_logs(sent_at DESC);

-- Unique constraint: one send per (member, template, day).
-- Prevents the cron from firing twice in the same day for the same member.
-- Uses timezone('UTC', sent_at)::date — TIMESTAMPTZ::date is not immutable
-- because it depends on session timezone, so the explicit UTC cast is required.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_auto_logs_daily_dedup
  ON whatsapp_automation_logs(member_id, template_name, (timezone('UTC', sent_at)::date));

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE whatsapp_automation_logs ENABLE ROW LEVEL SECURITY;

-- Only service role (cron) writes; gym owners can read their own logs
DROP POLICY IF EXISTS wa_auto_logs_select ON whatsapp_automation_logs;
CREATE POLICY wa_auto_logs_select
  ON whatsapp_automation_logs
  FOR SELECT
  USING (
    gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
  );

-- ── Members table: add date_of_birth column if missing ─────────────────────
-- Needed for birthday_wishes automation

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN members.date_of_birth
  IS 'Used for automated birthday_wishes WhatsApp messages';

COMMENT ON TABLE whatsapp_automation_logs
  IS 'Tracks every automated WhatsApp template message. Used for idempotency and schedule enforcement.';


-- ── MIGRATION: 20260706_whatsapp_automation_hardening.sql ──────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- WhatsApp Automation — Hardening
--
-- Fixes two correctness issues in the automation engine:
--
--   B2. cancelReminderCycles() records a single `status = 'cancelled'` sentinel
--       row to close a cycle. The previous full unique index on
--       (member_id, template_name, sent_at::date) blocked that insert whenever a
--       real send had already happened for the member+template on the same day,
--       so cancellation silently failed.
--
--       The dedup we actually need is: "never send the SAME template to the SAME
--       member more than once per day". That only concerns rows that represent an
--       actual send (status = 'sent'). We therefore replace the full unique index
--       with a PARTIAL unique index scoped to status = 'sent', which lets any
--       number of 'cancelled' / 'failed' / 'skipped' rows coexist with a send on
--       the same day.
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop the old full unique index (blocked same-day cancellation rows).
DROP INDEX IF EXISTS idx_wa_auto_logs_daily_dedup;

-- Recreate it as a PARTIAL unique index that only constrains real sends.
-- Uses timezone('UTC', sent_at)::date — TIMESTAMPTZ::date is not immutable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_auto_logs_daily_dedup_sent
  ON whatsapp_automation_logs (member_id, template_name, (timezone('UTC', sent_at)::date))
  WHERE status = 'sent';

-- Composite index to resolve "the current cycle for this member+template"
-- quickly (latest row by sent_at within a member+template).
CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_member_template_sent
  ON whatsapp_automation_logs (member_id, template_name, sent_at DESC);

COMMENT ON INDEX idx_wa_auto_logs_daily_dedup_sent
  IS 'Prevents more than one actual send (status=sent) per member+template+day. '
     'Cancelled/failed/skipped rows are intentionally excluded so a cycle can be '
     'cancelled on the same day a reminder was sent.';


-- ── MIGRATION: 20260708_drop_phone_unique_constraint.sql ──────────────────────────────────

-- Allow duplicate phone numbers across members within the same gym.
-- Family members, shared phones, and walk-in registrations are common scenarios.
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_gym_id_phone_key;


-- ── MIGRATION: 20260712_members_is_imported.sql ──────────────────────────────────

-- Migration: mark members created via Excel/CSV import.
--
-- Imported members behave exactly like manually created members EXCEPT they
-- must never receive the `_gymflow_welcome_member` template (they are existing
-- gym members, not new registrations). This flag lets the UI suppress the
-- welcome template for them. Manually created members default to false.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN members.is_imported
  IS 'True for members created via Excel/CSV import. Suppresses the _gymflow_welcome_member template; all other automations behave identically.';


-- ── MIGRATION: 20260713_whatsapp_send_queue.sql ──────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- WhatsApp Send Queue
--
-- Throttled outbound queue for automated WhatsApp template messages. Bulk sends
-- (post-import batch + the daily automation cron) are ENQUEUED here instead of
-- dispatched inline, then drained at a fixed rate (5 per 5 minutes, globally)
-- so the single shared WhatsApp Cloud API number is never seen as spamming.
--
-- Idempotency & cadence still live in whatsapp_automation_logs: each queue row
-- carries the id of its pre-claimed 'sent' log row (log_row_id), which the drain
-- reconciles via finalizeSend after the actual send.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_send_queue (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  template_name TEXT        NOT NULL,
  -- Full TemplateContext passed straight to sendWhatsAppTemplate at drain time.
  context       JSONB       NOT NULL DEFAULT '{}'::JSONB,
  -- Mirrors the automation-log cycle key for traceability.
  cycle_key     TEXT        NOT NULL,
  trigger_date  DATE,
  -- The pre-claimed whatsapp_automation_logs row this send reconciles on drain.
  log_row_id    UUID,
  -- pending | sending | sent | failed | cancelled
  status        TEXT        NOT NULL DEFAULT 'pending',
  -- Row becomes eligible for draining once now() >= scheduled_at.
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts      INTEGER     NOT NULL DEFAULT 0,
  max_attempts  INTEGER     NOT NULL DEFAULT 3,
  -- Set when a drain claims the row, to avoid concurrent double-processing.
  locked_at     TIMESTAMPTZ,
  last_error    TEXT,
  message_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ
);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Primary drain query: oldest due pending rows first.
CREATE INDEX IF NOT EXISTS idx_wa_queue_due
  ON whatsapp_send_queue (scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_wa_queue_gym
  ON whatsapp_send_queue (gym_id);

-- Enqueue-time dedup: at most one active (pending/sending) row per
-- member+template+cycle. The daily-slot claim is the primary idempotency gate;
-- this is a cheap second guard against enqueuing the same send twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_queue_active_dedup
  ON whatsapp_send_queue (member_id, template_name, cycle_key)
  WHERE status IN ('pending', 'sending');

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE whatsapp_send_queue ENABLE ROW LEVEL SECURITY;

-- Service role (cron / drain) manages rows; gym owners may read their own queue.
DROP POLICY IF EXISTS wa_queue_select ON whatsapp_send_queue;
CREATE POLICY wa_queue_select
  ON whatsapp_send_queue
  FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

COMMENT ON TABLE whatsapp_send_queue
  IS 'Throttled outbound queue for automated WhatsApp sends (5 per 5 minutes, drained via QStash).';


-- ── MIGRATION: 20260717000000_admin_subscription_management.sql ──────────────────────────────────

-- ============================================================
-- GymFlow Admin Subscription Management Migration
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add admin-facing columns to gyms ─────────────────────

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS admin_notes              TEXT,
  ADD COLUMN IF NOT EXISTS subscription_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_vip                   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_payment_verified       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_support          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_renewal_eligible     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifetime_offer            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_disabled            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_payment_amount       INTEGER,
  ADD COLUMN IF NOT EXISTS last_payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS last_transaction_id       TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_date         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_status       TEXT DEFAULT 'none'
                                                     CHECK (last_payment_status IN ('none', 'paid', 'pending', 'failed'));

-- ── 2. subscription_audit_logs table ────────────────────────

CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  prev_status     TEXT,
  new_status      TEXT,
  prev_plan       TEXT,
  new_plan        TEXT,
  prev_expiry     TIMESTAMPTZ,
  new_expiry      TIMESTAMPTZ,
  action          TEXT NOT NULL,
  performed_by    TEXT NOT NULL DEFAULT 'admin',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_gym_id    ON subscription_audit_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON subscription_audit_logs(gym_id, created_at DESC);

ALTER TABLE subscription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin (service role) can do everything; regular users cannot read audit logs
-- These are read via the service role from the admin API, so no RLS needed for authenticated users.

-- ── 3. gym_usage_stats table ────────────────────────────────
-- Tracks cumulative usage metrics for each gym for admin monitoring.

CREATE TABLE IF NOT EXISTS gym_usage_stats (
  gym_id                UUID PRIMARY KEY REFERENCES gyms(id) ON DELETE CASCADE,
  total_members         INTEGER NOT NULL DEFAULT 0,
  total_attendance      INTEGER NOT NULL DEFAULT 0,
  total_payments        INTEGER NOT NULL DEFAULT 0,
  total_revenue         BIGINT  NOT NULL DEFAULT 0,
  whatsapp_sent         INTEGER NOT NULL DEFAULT 0,
  reports_generated     INTEGER NOT NULL DEFAULT 0,
  storage_used_kb       BIGINT  NOT NULL DEFAULT 0,
  last_active_at        TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gym_usage_stats ENABLE ROW LEVEL SECURITY;

-- Only gym owners can read their own stats (service role used for writes from admin)
DROP POLICY IF EXISTS "Gym owners can view own usage stats" ON gym_usage_stats;
CREATE POLICY "Gym owners can view own usage stats"
  ON gym_usage_stats FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

-- ── 4. Backfill gym_usage_stats for existing gyms ───────────

INSERT INTO gym_usage_stats (gym_id, total_members, total_attendance, total_payments, total_revenue, updated_at)
SELECT
  g.id,
  COUNT(DISTINCT m.id)::INTEGER,
  COUNT(DISTINCT a.id)::INTEGER,
  COUNT(DISTINCT ms.id)::INTEGER,
  COALESCE(SUM(ms.amount + ms.admission_fee), 0)::BIGINT,
  now()
FROM gyms g
LEFT JOIN members m ON m.gym_id = g.id
LEFT JOIN attendance a ON a.gym_id = g.id
LEFT JOIN memberships ms ON ms.gym_id = g.id
GROUP BY g.id
ON CONFLICT (gym_id) DO NOTHING;

-- ── 5. Function to increment usage stats ────────────────────

CREATE OR REPLACE FUNCTION increment_gym_usage_stat(
  p_gym_id   UUID,
  p_field    TEXT,
  p_amount   INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  -- Only allow known fields to prevent SQL injection
  IF p_field NOT IN (
    'total_members', 'total_attendance', 'total_payments',
    'total_revenue', 'whatsapp_sent', 'reports_generated', 'storage_used_kb'
  ) THEN
    RAISE EXCEPTION 'Unknown field: %', p_field;
  END IF;

  INSERT INTO gym_usage_stats (gym_id, updated_at)
  VALUES (p_gym_id, now())
  ON CONFLICT (gym_id) DO NOTHING;

  EXECUTE format(
    'UPDATE gym_usage_stats SET %I = %I + $1, last_active_at = now(), updated_at = now() WHERE gym_id = $2',
    p_field, p_field
  ) USING p_amount, p_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 6. Trigger to auto-update usage stats on membership insert ──

CREATE OR REPLACE FUNCTION sync_usage_on_membership_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gym_usage_stats (gym_id, total_payments, total_revenue, updated_at)
  VALUES (NEW.gym_id, 1, NEW.amount + NEW.admission_fee, now())
  ON CONFLICT (gym_id) DO UPDATE
  SET
    total_payments = gym_usage_stats.total_payments + 1,
    total_revenue  = gym_usage_stats.total_revenue + EXCLUDED.total_revenue,
    last_active_at = now(),
    updated_at     = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_usage_on_membership ON memberships;
CREATE TRIGGER trg_usage_on_membership
AFTER INSERT ON memberships
FOR EACH ROW EXECUTE FUNCTION sync_usage_on_membership_insert();

-- ── 7. Trigger to auto-update member count ──────────────────

CREATE OR REPLACE FUNCTION sync_usage_on_member_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gym_usage_stats (gym_id, total_members, updated_at)
  VALUES (NEW.gym_id, 1, now())
  ON CONFLICT (gym_id) DO UPDATE
  SET
    total_members  = gym_usage_stats.total_members + 1,
    last_active_at = now(),
    updated_at     = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_usage_on_member ON members;
CREATE TRIGGER trg_usage_on_member
AFTER INSERT ON members
FOR EACH ROW EXECUTE FUNCTION sync_usage_on_member_insert();

-- ── 8. Trigger to auto-update attendance count ──────────────

CREATE OR REPLACE FUNCTION sync_usage_on_attendance_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gym_usage_stats (gym_id, total_attendance, updated_at)
  VALUES (NEW.gym_id, 1, now())
  ON CONFLICT (gym_id) DO UPDATE
  SET
    total_attendance = gym_usage_stats.total_attendance + 1,
    last_active_at   = now(),
    updated_at       = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_usage_on_attendance ON attendance;
CREATE TRIGGER trg_usage_on_attendance
AFTER INSERT ON attendance
FOR EACH ROW EXECUTE FUNCTION sync_usage_on_attendance_insert();

-- ── 9. Trigger to auto-increment whatsapp count ─────────────
-- This should be called from whatsapp_send_queue after a successful send.
-- We add it as a function to call via RPC from the API server.

CREATE OR REPLACE FUNCTION record_whatsapp_sent(p_gym_id UUID, p_count INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  INSERT INTO gym_usage_stats (gym_id, whatsapp_sent, updated_at)
  VALUES (p_gym_id, p_count, now())
  ON CONFLICT (gym_id) DO UPDATE
  SET
    whatsapp_sent  = gym_usage_stats.whatsapp_sent + p_count,
    last_active_at = now(),
    updated_at     = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 10. Admin subscription action helper function ────────────
-- Creates an audit log entry. Called from admin API (service role).

CREATE OR REPLACE FUNCTION log_subscription_action(
  p_gym_id       UUID,
  p_action       TEXT,
  p_prev_status  TEXT DEFAULT NULL,
  p_new_status   TEXT DEFAULT NULL,
  p_prev_plan    TEXT DEFAULT NULL,
  p_new_plan     TEXT DEFAULT NULL,
  p_prev_expiry  TIMESTAMPTZ DEFAULT NULL,
  p_new_expiry   TIMESTAMPTZ DEFAULT NULL,
  p_performed_by TEXT DEFAULT 'admin',
  p_notes        TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO subscription_audit_logs (
    gym_id, action, prev_status, new_status,
    prev_plan, new_plan, prev_expiry, new_expiry,
    performed_by, notes
  )
  VALUES (
    p_gym_id, p_action, p_prev_status, p_new_status,
    p_prev_plan, p_new_plan, p_prev_expiry, p_new_expiry,
    p_performed_by, p_notes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── MIGRATION: 20260718_enable_realtime_subscriptions.sql ──────────────────────────────────

-- ============================================================
-- Enable Realtime for gyms and subscription_requests
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

DO $$
BEGIN
  -- Add gyms table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gyms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gyms;
  END IF;

  -- Add subscription_requests table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'subscription_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE subscription_requests;
  END IF;
END $$;


-- ── MIGRATION: 20260718_fix_check_gym_active_rpc.sql ──────────────────────────────────

-- ============================================================
-- Fix check_gym_active RPC to handle cancelled and suspended statuses
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Update the check_gym_active RPC to return false for cancelled/suspended accounts
-- Previously only checked: is_active=false, expired, lapsed trial, lapsed paid
-- Now also blocks: cancelled, suspended
CREATE OR REPLACE FUNCTION check_gym_active(p_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN g.is_active = false                   THEN false
      WHEN g.subscription_status = 'expired'     THEN false
      WHEN g.subscription_status = 'cancelled'   THEN false
      WHEN g.subscription_status = 'suspended'   THEN false
      WHEN g.subscription_status = 'trial'
           AND g.trial_ends_at < now()           THEN false
      WHEN g.subscription_status = 'active'
           AND g.subscription_ends_at IS NOT NULL
           AND g.subscription_ends_at < now()    THEN false
      ELSE true
    END
  FROM auth.users u
  JOIN gyms g ON g.owner_id = u.id
  WHERE u.email = p_email
  LIMIT 1;
$$;


-- ── MIGRATION: 20260718_subscription_status_expand.sql ──────────────────────────────────

-- Expand subscription_status to include cancelled and suspended
ALTER TABLE gyms
  DROP CONSTRAINT IF EXISTS gyms_subscription_status_check;

ALTER TABLE gyms
  ADD CONSTRAINT gyms_subscription_status_check
  CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled', 'suspended'));

-- Also expand plan_type if needed
ALTER TABLE gyms
  DROP CONSTRAINT IF EXISTS gyms_plan_type_check;

ALTER TABLE gyms
  ADD CONSTRAINT gyms_plan_type_check
  CHECK (plan_type IN ('trial', 'monthly', 'quarterly', 'yearly', 'lifetime'));


-- ── MIGRATION: 20260722_realtime_complete_verification.sql ──────────────────────────────────

-- ============================================================
-- Verify all tables required for Realtime are in the publication.
--
-- This is a comprehensive safety-net migration that ensures every table
-- used by the app's Realtime subscriptions is present in
-- supabase_realtime. Idempotent — safe to run repeatedly.
--
-- Tables required:
--   gyms                  → ShellGuard, AccountClient, AdminDashboardRealtime
--   subscription_requests → SubscriptionClient, AdminSubscriptionList, AdminDashboardRealtime
--   admin_messages        → SupportTabsClient, AccountMenu
--   support_tickets       → SupportTabsClient, Admin Support Page
-- ============================================================

DO $$
BEGIN
  -- gyms: subscription status, account activation, name changes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'gyms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gyms;
  END IF;

  -- subscription_requests: payment proof submissions, approval/rejection
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'subscription_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE subscription_requests;
  END IF;

  -- admin_messages: messages from admin to gym owners
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
  END IF;

  -- support_tickets: gym owner tickets and resolution updates
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;


-- ── MIGRATION: 20260723_add_gym_upi_config.sql ──────────────────────────────────

-- ============================================================
-- Gym UPI Merchant Configuration
--
-- Stores the normalized UPI merchant data parsed from the gym
-- owner's uploaded/scanned QR code. One row per gym.
-- ============================================================

CREATE TABLE IF NOT EXISTS gym_upi_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,

  -- Normalized merchant data (extracted from the QR code)
  upi_id TEXT NOT NULL,                -- pa: payee VPA e.g. 9384271126@ibl
  merchant_name TEXT NOT NULL,         -- pn: display name
  merchant_code TEXT,                  -- mc: merchant category code (optional)
  currency TEXT NOT NULL DEFAULT 'INR',-- cu: currency

  -- Raw parsed parameters from the original QR (for future compatibility)
  raw_params JSONB NOT NULL DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast gym lookup
CREATE INDEX IF NOT EXISTS idx_gym_upi_config_gym_id ON gym_upi_config(gym_id);

-- Row Level Security
ALTER TABLE gym_upi_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view their UPI config" ON gym_upi_config;
CREATE POLICY "Gym owners can view their UPI config"
  ON gym_upi_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = gym_upi_config.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can insert their UPI config" ON gym_upi_config;
CREATE POLICY "Gym owners can insert their UPI config"
  ON gym_upi_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gyms WHERE id = gym_upi_config.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can update their UPI config" ON gym_upi_config;
CREATE POLICY "Gym owners can update their UPI config"
  ON gym_upi_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = gym_upi_config.gym_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym owners can delete their UPI config" ON gym_upi_config;
CREATE POLICY "Gym owners can delete their UPI config"
  ON gym_upi_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM gyms WHERE id = gym_upi_config.gym_id AND owner_id = auth.uid())
  );


-- ── MIGRATION: 20260723_perf_sell_inventory_rpc.sql ──────────────────────────────────

-- ============================================================
-- Atomic inventory sale RPC
--
-- Collapses the previous 3-round-trip sell flow (SELECT product →
-- INSERT sale → UPDATE stock) into a single atomic transaction, and
-- fixes an oversell race: two concurrent sells could each read the same
-- stock level and both succeed. Row-level FOR UPDATE lock prevents that.
--
-- Runs SECURITY DEFINER but re-verifies gym ownership via auth.uid(), so
-- it is safe to expose to the authenticated (anon-key + JWT) client.
--
-- Idempotent: safe to re-run (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION sell_inventory_item(
  p_inventory_id UUID,
  p_quantity     INTEGER,
  p_unit_price   NUMERIC,
  p_payment_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product  inventory%ROWTYPE;
  v_price    NUMERIC;
  v_total    NUMERIC;
  v_mode     TEXT;
  v_sale_id  UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  v_mode := CASE WHEN p_payment_mode IN ('cash', 'upi', 'card') THEN p_payment_mode ELSE 'cash' END;

  -- Lock the product row so concurrent sells serialize and cannot oversell.
  SELECT * INTO v_product FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  -- Re-verify ownership inside the definer function.
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = v_product.gym_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_product.initial_stock < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product.initial_stock;
  END IF;

  v_price := COALESCE(p_unit_price, v_product.selling_price);
  v_total := v_price * p_quantity;

  INSERT INTO inventory_sales (
    gym_id, inventory_id, product_name, variant_name,
    quantity, unit_price, total_price, payment_mode
  ) VALUES (
    v_product.gym_id, p_inventory_id, v_product.product_name, v_product.variant_name,
    p_quantity, v_price, v_total, v_mode
  )
  RETURNING id INTO v_sale_id;

  UPDATE inventory
  SET initial_stock = initial_stock - p_quantity,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object(
    'sale_id',         v_sale_id,
    'product_name',    v_product.product_name,
    'quantity',        p_quantity,
    'total_price',     v_total,
    'remaining_stock', v_product.initial_stock - p_quantity
  );
END;
$$;


-- ── MIGRATION: update_prices_and_qr.sql ──────────────────────────────────

-- =============================================================
-- GymFlow — Update Subscription Prices & Remove QR Code URL
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Update the existing prices
UPDATE platform_settings
SET price_monthly = 2999,
    price_yearly  = 29999
WHERE id = 1;

-- 2. Drop the qr_code_url column as we are hardcoding the images in the UI
ALTER TABLE platform_settings
DROP COLUMN IF EXISTS qr_code_url;


