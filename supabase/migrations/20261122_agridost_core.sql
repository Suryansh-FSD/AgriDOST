-- ==============================================================================
-- AgriDOST 4.0: Core Farm Management & Agronomy PostgreSQL Migration
-- Migration: 20261122_agridost_core.sql
-- Description: Core Schema, Foreign Keys, Performance Indexes, Updated-at Triggers,
--              and Tenant-Isolated Row Level Security (RLS) for AgriDOST 4.0:
--              farmer_profiles, farms, farm_zones, crop_plans, health_records,
--              farm_tasks, farm_supplies, tree_plans, spray_operations.
-- ==============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable timestamp trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 1. Table: farmer_profiles
-- Farmer identity, regional language preference, category, and regional metadata
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farmer_profiles (
  id UUID PRIMARY KEY DEFAULT coalesce(auth.uid(), gen_random_uuid()),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  state TEXT NOT NULL DEFAULT 'Maharashtra',
  district TEXT NOT NULL DEFAULT 'Nashik',
  taluka TEXT,
  village TEXT,
  pincode TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'mr')),
  farmer_category TEXT NOT NULL DEFAULT 'small' CHECK (
    farmer_category IN ('marginal', 'small', 'semi_medium', 'medium', 'large')
  ),
  aadhaar_hash TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farmer_profiles_updated_at ON farmer_profiles;
CREATE TRIGGER trigger_farmer_profiles_updated_at
BEFORE UPDATE ON farmer_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 2. Table: farms
-- Single Source of Truth for farm boundaries, area, soil, and agronomic baseline
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  boundary JSONB NOT NULL,
  area_sq_m DOUBLE PRECISION NOT NULL CHECK (area_sq_m >= 0),
  area_acres DOUBLE PRECISION NOT NULL CHECK (area_acres >= 0),
  location TEXT,
  location_details JSONB,
  soil_type TEXT,
  water_source TEXT,
  primary_crop TEXT,
  irrigation_type TEXT,
  owner_name TEXT,
  survey_number TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farms_updated_at ON farms;
CREATE TRIGGER trigger_farms_updated_at
BEFORE UPDATE ON farms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 3. Table: farm_zones
-- Delineated parcels within farm boundary: crop varieties, disease hotspots, spray paths
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farm_zones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  type TEXT NOT NULL CHECK (type IN ('crop', 'disease', 'spray')),
  name TEXT NOT NULL,
  geometry JSONB NOT NULL,
  color TEXT,
  area_sq_m DOUBLE PRECISION CHECK (area_sq_m >= 0),
  area_acres DOUBLE PRECISION CHECK (area_acres >= 0),
  -- Crop specific metadata
  crop_name TEXT,
  crop_variety TEXT,
  growth_stage TEXT,
  target_yield_tonnes DOUBLE PRECISION,
  -- Disease specific metadata
  disease_name TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence_score DOUBLE PRECISION CHECK (confidence_score >= 0 AND confidence_score <= 100),
  -- Spray specific metadata
  spray_status TEXT CHECK (spray_status IN ('pending', 'in_progress', 'completed', 'scheduled')),
  chemical_name TEXT,
  target_dosage_l_per_acre DOUBLE PRECISION,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farm_zones_updated_at ON farm_zones;
CREATE TRIGGER trigger_farm_zones_updated_at
BEFORE UPDATE ON farm_zones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 4. Table: crop_plans
-- Seasonal cropping plans, rationale, expected yields, and parcel allocation
-- ==============================================================================
CREATE TABLE IF NOT EXISTS crop_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  mode TEXT NOT NULL CHECK (mode IN ('ai_recommended', 'farmer_selected', 'combined')),
  season TEXT CHECK (season IN ('Kharif', 'Rabi', 'Zaid', 'Annual')),
  year INTEGER,
  zones JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale TEXT,
  expected_total_yield_tonnes DOUBLE PRECISION,
  estimated_net_profit_inr DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_crop_plans_updated_at ON crop_plans;
CREATE TRIGGER trigger_crop_plans_updated_at
BEFORE UPDATE ON crop_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 5. Table: health_records (Crop Health Observations & Diagnosis)
-- AI visual inspections, symptoms, chemical dosage recommendations & resolutions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS health_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  zone_id TEXT REFERENCES farm_zones(id) ON DELETE SET NULL,
  crop_affected TEXT,
  detected_disease TEXT,
  image_preview_url TEXT,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  possible_causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_note TEXT,
  confidence DOUBLE PRECISION,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detection_method TEXT,
  recommended_action TEXT,
  chemical_recommendation JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('ai_generated', 'needs_review', 'unavailable', 'active', 'treated', 'monitoring')
  ),
  missing_information JSONB DEFAULT '[]'::jsonb,
  limitations JSONB DEFAULT '[]'::jsonb,
  sources JSONB DEFAULT '[]'::jsonb,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_health_records_updated_at ON health_records;
CREATE TRIGGER trigger_health_records_updated_at
BEFORE UPDATE ON health_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 6. Table: farm_tasks
-- Agronomic operations, calendar schedules, irrigation & harvest actions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farm_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  category TEXT DEFAULT 'general' CHECK (
    category IN ('irrigation', 'fertilizer', 'inspection', 'harvest', 'general')
  ),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farm_tasks_updated_at ON farm_tasks;
CREATE TRIGGER trigger_farm_tasks_updated_at
BEFORE UPDATE ON farm_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 7. Table: farm_supplies
-- Farm inventory tracking: fertilizers, seeds, pesticides, equipment supplies
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farm_supplies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  item_name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'liters', 'bags', 'packets')),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low', 'ordered')),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farm_supplies_updated_at ON farm_supplies;
CREATE TRIGGER trigger_farm_supplies_updated_at
BEFORE UPDATE ON farm_supplies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 8. Table: tree_plans
-- Boundary tree agroforestry plans, species spacing, shade & root risk modeling
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tree_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  species_name TEXT NOT NULL,
  spacing_meters DOUBLE PRECISION NOT NULL CHECK (spacing_meters > 0),
  tree_count INTEGER NOT NULL CHECK (tree_count >= 0),
  shade_risk TEXT NOT NULL CHECK (shade_risk IN ('low', 'medium', 'high')),
  root_competition_note TEXT NOT NULL DEFAULT '',
  suggested_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_tree_plans_updated_at ON tree_plans;
CREATE TRIGGER trigger_tree_plans_updated_at
BEFORE UPDATE ON tree_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 9. Table: spray_operations
-- Precision chemical/fertilizer spray missions, drone flight telemetry & safety window
-- ==============================================================================
CREATE TABLE IF NOT EXISTS spray_operations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  zone_id TEXT REFERENCES farm_zones(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (
    operation_type IN ('Pesticide', 'Fungicide', 'Foliar Fertilizer', 'Herbicide')
  ),
  product_name TEXT NOT NULL,
  dosage_per_acre TEXT NOT NULL,
  dilution_ratio TEXT NOT NULL,
  equipment_type TEXT NOT NULL CHECK (
    equipment_type IN ('Drone', 'Tractor Boom', 'Knapsack Sprayer')
  ),
  flight_altitude_meters DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  wind_speed_kmh DOUBLE PRECISION NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  humidity_pct DOUBLE PRECISION NOT NULL,
  safety_status TEXT NOT NULL CHECK (safety_status IN ('optimal', 'caution', 'unsafe')),
  scheduled_time TIMESTAMPTZ NOT NULL,
  completed_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled')
  ),
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_spray_operations_updated_at ON spray_operations;
CREATE TRIGGER trigger_spray_operations_updated_at
BEFORE UPDATE ON spray_operations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 10. Table: farmer_telegram_registrations
-- Persistent Farmer Telegram opt-in consent records and notification channel bindings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farmer_telegram_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id TEXT NOT NULL UNIQUE,
  chat_id BIGINT NOT NULL,
  username TEXT,
  opt_in_status BOOLEAN NOT NULL DEFAULT true,
  language_preference TEXT NOT NULL DEFAULT 'hi' CHECK (language_preference IN ('en', 'hi', 'mr')),
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_timestamp TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_farmer_telegram_registrations_updated_at ON farmer_telegram_registrations;
CREATE TRIGGER trigger_farmer_telegram_registrations_updated_at
BEFORE UPDATE ON farmer_telegram_registrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 11. Performance & Foreign Key Indexes
-- ==============================================================================

-- farmer_profiles
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_phone ON farmer_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_state_district ON farmer_profiles(state, district);

-- farms
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id ON farms(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farms_created_at ON farms(created_at DESC);

-- farm_zones
CREATE INDEX IF NOT EXISTS idx_farm_zones_farm_id ON farm_zones(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_zones_farmer_id ON farm_zones(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farm_zones_farmer_farm ON farm_zones(farmer_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_zones_type ON farm_zones(type);

-- crop_plans
CREATE INDEX IF NOT EXISTS idx_crop_plans_farm_id ON crop_plans(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_plans_farmer_id ON crop_plans(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crop_plans_season_year ON crop_plans(season, year);

-- health_records
CREATE INDEX IF NOT EXISTS idx_health_records_farm_id ON health_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_health_records_farmer_id ON health_records(farmer_id);
CREATE INDEX IF NOT EXISTS idx_health_records_zone_id ON health_records(zone_id);
CREATE INDEX IF NOT EXISTS idx_health_records_status ON health_records(status);
CREATE INDEX IF NOT EXISTS idx_health_records_detected_at ON health_records(detected_at DESC);

-- farm_tasks
CREATE INDEX IF NOT EXISTS idx_farm_tasks_farm_id ON farm_tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_tasks_farmer_id ON farm_tasks(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farm_tasks_due_date ON farm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_farm_tasks_farmer_status ON farm_tasks(farmer_id, status);

-- farm_supplies
CREATE INDEX IF NOT EXISTS idx_farm_supplies_farm_id ON farm_supplies(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_supplies_farmer_id ON farm_supplies(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farm_supplies_status ON farm_supplies(status);

-- tree_plans
CREATE INDEX IF NOT EXISTS idx_tree_plans_farm_id ON tree_plans(farm_id);
CREATE INDEX IF NOT EXISTS idx_tree_plans_farmer_id ON tree_plans(farmer_id);

-- spray_operations
CREATE INDEX IF NOT EXISTS idx_spray_operations_farm_id ON spray_operations(farm_id);
CREATE INDEX IF NOT EXISTS idx_spray_operations_farmer_id ON spray_operations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_spray_operations_zone_id ON spray_operations(zone_id);
CREATE INDEX IF NOT EXISTS idx_spray_operations_scheduled_time ON spray_operations(scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_spray_operations_status ON spray_operations(status);

-- farmer_telegram_registrations
CREATE INDEX IF NOT EXISTS idx_telegram_farmer_id ON farmer_telegram_registrations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_telegram_chat_id ON farmer_telegram_registrations(chat_id);

-- ==============================================================================
-- 12. Row Level Security (RLS) Configuration & Strict Tenant Isolation
-- (select auth.uid()) subquery optimization ensures single evaluation per statement.
-- TO authenticated ensures anonymous public access is rejected at database layer.
-- ==============================================================================

ALTER TABLE farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE spray_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_telegram_registrations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 11.1 RLS: farmer_profiles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own profile" ON farmer_profiles;
CREATE POLICY "Farmers can view own profile"
ON farmer_profiles FOR SELECT
TO authenticated
USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Farmers can insert own profile" ON farmer_profiles;
CREATE POLICY "Farmers can insert own profile"
ON farmer_profiles FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Farmers can update own profile" ON farmer_profiles;
CREATE POLICY "Farmers can update own profile"
ON farmer_profiles FOR UPDATE
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Farmers can delete own profile" ON farmer_profiles;
CREATE POLICY "Farmers can delete own profile"
ON farmer_profiles FOR DELETE
TO authenticated
USING ((select auth.uid()) = id);

-- ------------------------------------------------------------------------------
-- 11.2 RLS: farms
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own farms" ON farms;
CREATE POLICY "Farmers can view own farms"
ON farms FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own farms" ON farms;
CREATE POLICY "Farmers can insert own farms"
ON farms FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own farms" ON farms;
CREATE POLICY "Farmers can update own farms"
ON farms FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own farms" ON farms;
CREATE POLICY "Farmers can delete own farms"
ON farms FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.3 RLS: farm_zones
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own farm zones" ON farm_zones;
CREATE POLICY "Farmers can view own farm zones"
ON farm_zones FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own farm zones" ON farm_zones;
CREATE POLICY "Farmers can insert own farm zones"
ON farm_zones FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own farm zones" ON farm_zones;
CREATE POLICY "Farmers can update own farm zones"
ON farm_zones FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own farm zones" ON farm_zones;
CREATE POLICY "Farmers can delete own farm zones"
ON farm_zones FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.4 RLS: crop_plans
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own crop plans" ON crop_plans;
CREATE POLICY "Farmers can view own crop plans"
ON crop_plans FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own crop plans" ON crop_plans;
CREATE POLICY "Farmers can insert own crop plans"
ON crop_plans FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own crop plans" ON crop_plans;
CREATE POLICY "Farmers can update own crop plans"
ON crop_plans FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own crop plans" ON crop_plans;
CREATE POLICY "Farmers can delete own crop plans"
ON crop_plans FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.5 RLS: health_records
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own health records" ON health_records;
CREATE POLICY "Farmers can view own health records"
ON health_records FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own health records" ON health_records;
CREATE POLICY "Farmers can insert own health records"
ON health_records FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own health records" ON health_records;
CREATE POLICY "Farmers can update own health records"
ON health_records FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own health records" ON health_records;
CREATE POLICY "Farmers can delete own health records"
ON health_records FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.6 RLS: farm_tasks
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own farm tasks" ON farm_tasks;
CREATE POLICY "Farmers can view own farm tasks"
ON farm_tasks FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own farm tasks" ON farm_tasks;
CREATE POLICY "Farmers can insert own farm tasks"
ON farm_tasks FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own farm tasks" ON farm_tasks;
CREATE POLICY "Farmers can update own farm tasks"
ON farm_tasks FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own farm tasks" ON farm_tasks;
CREATE POLICY "Farmers can delete own farm tasks"
ON farm_tasks FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.7 RLS: farm_supplies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own supplies" ON farm_supplies;
CREATE POLICY "Farmers can view own supplies"
ON farm_supplies FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own supplies" ON farm_supplies;
CREATE POLICY "Farmers can insert own supplies"
ON farm_supplies FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own supplies" ON farm_supplies;
CREATE POLICY "Farmers can update own supplies"
ON farm_supplies FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own supplies" ON farm_supplies;
CREATE POLICY "Farmers can delete own supplies"
ON farm_supplies FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.8 RLS: tree_plans
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own tree plans" ON tree_plans;
CREATE POLICY "Farmers can view own tree plans"
ON tree_plans FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own tree plans" ON tree_plans;
CREATE POLICY "Farmers can insert own tree plans"
ON tree_plans FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own tree plans" ON tree_plans;
CREATE POLICY "Farmers can update own tree plans"
ON tree_plans FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own tree plans" ON tree_plans;
CREATE POLICY "Farmers can delete own tree plans"
ON tree_plans FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 11.9 RLS: spray_operations
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own spray operations" ON spray_operations;
CREATE POLICY "Farmers can view own spray operations"
ON spray_operations FOR SELECT
TO authenticated
USING ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own spray operations" ON spray_operations;
CREATE POLICY "Farmers can insert own spray operations"
ON spray_operations FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own spray operations" ON spray_operations;
CREATE POLICY "Farmers can update own spray operations"
ON spray_operations FOR UPDATE
TO authenticated
USING ((select auth.uid()) = farmer_id)
WITH CHECK ((select auth.uid()) = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own spray operations" ON spray_operations;
CREATE POLICY "Farmers can delete own spray operations"
ON spray_operations FOR DELETE
TO authenticated
USING ((select auth.uid()) = farmer_id);

-- ------------------------------------------------------------------------------
-- 12.10 RLS: farmer_telegram_registrations
-- Tenant isolation ensures farmers can only query or update their own notification registrations.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view own telegram registration" ON farmer_telegram_registrations;
CREATE POLICY "Farmers can view own telegram registration"
ON farmer_telegram_registrations FOR SELECT
TO authenticated
USING ((select auth.uid())::text = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert own telegram registration" ON farmer_telegram_registrations;
CREATE POLICY "Farmers can insert own telegram registration"
ON farmer_telegram_registrations FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = farmer_id);

DROP POLICY IF EXISTS "Farmers can update own telegram registration" ON farmer_telegram_registrations;
CREATE POLICY "Farmers can update own telegram registration"
ON farmer_telegram_registrations FOR UPDATE
TO authenticated
USING ((select auth.uid())::text = farmer_id)
WITH CHECK ((select auth.uid())::text = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete own telegram registration" ON farmer_telegram_registrations;
CREATE POLICY "Farmers can delete own telegram registration"
ON farmer_telegram_registrations FOR DELETE
TO authenticated
USING ((select auth.uid())::text = farmer_id);

-- ==============================================================================
-- 13. Schema Grants & Public Schema Permissions
-- Grants explicit permissions to authenticated and service_role roles
-- and read-only schema introspection for anon
-- ==============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
