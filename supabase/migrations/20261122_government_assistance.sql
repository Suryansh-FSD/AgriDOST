-- ==============================================================================
-- AgriDOST: Government Assistance & Schemes PostgreSQL Migration
-- Migration: 20261122_government_assistance.sql
-- Description: Schema, Row Level Security (RLS), and Indexes for Government
--              Schemes, Eligibility Assessments, Applications, and Reminders.
-- ==============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for updating timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 1. Table: schemes
-- Cache of verified government schemes from Central and State portals
-- ==============================================================================
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('central', 'state', 'district')),
  department TEXT NOT NULL,
  ministry TEXT NOT NULL,
  applicable_states JSONB NOT NULL DEFAULT '["ALL"]'::jsonb,
  applicable_districts JSONB,
  beneficiary_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_crops JSONB DEFAULT '[]'::jsonb,
  eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefit_type TEXT NOT NULL,
  benefit_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  application_availability TEXT NOT NULL DEFAULT 'open' CHECK (application_availability IN ('open', 'seasonal', 'closed', 'ongoing')),
  application_deadline TIMESTAMPTZ,
  is_deadline_verified BOOLEAN NOT NULL DEFAULT false,
  official_info_url TEXT NOT NULL,
  official_application_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  last_verified_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  version TEXT NOT NULL DEFAULT '1.0.0',
  publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('published', 'draft', 'archived')),
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'unverified', 'incomplete')),
  faqs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for schemes updated_at
DROP TRIGGER IF EXISTS trigger_schemes_updated_at ON schemes;
CREATE TRIGGER trigger_schemes_updated_at
BEFORE UPDATE ON schemes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 2. Table: scheme_sources
-- Official portal references, gazettes, and verification timestamps
-- ==============================================================================
CREATE TABLE IF NOT EXISTS scheme_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  portal_name TEXT NOT NULL,
  portal_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'official_portal',
  verification_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. Table: farmer_scheme_applications
-- Farmer applications lifecycle tracker with self-reported vs verified status
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farmer_scheme_applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'preparing_documents',
      'ready_to_apply',
      'submitted',
      'under_review',
      'additional_info_required',
      'approved',
      'rejected',
      'closed'
    )
  ),
  status_source TEXT NOT NULL DEFAULT 'user_reported' CHECK (
    status_source IN ('user_reported', 'government_verified')
  ),
  application_reference_number TEXT,
  submission_date TIMESTAMPTZ,
  portal_url TEXT NOT NULL,
  next_action TEXT NOT NULL DEFAULT '',
  notes TEXT,
  documents_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for farmer_scheme_applications updated_at
DROP TRIGGER IF EXISTS trigger_farmer_scheme_applications_updated_at ON farmer_scheme_applications;
CREATE TRIGGER trigger_farmer_scheme_applications_updated_at
BEFORE UPDATE ON farmer_scheme_applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 4. Table: farmer_scheme_assessments
-- History of deterministic eligibility evaluations and scoring
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farmer_scheme_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN (
      'potentially_eligible',
      'potentially_ineligible',
      'more_information_required',
      'official_verification_required'
    )
  ),
  score_percentage INTEGER NOT NULL CHECK (score_percentage >= 0 AND score_percentage <= 100),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  passed_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  disclaimer TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. Table: scheme_reminders
-- Deadline and renewal reminders with verified source vs custom tracking
-- ==============================================================================
CREATE TABLE IF NOT EXISTS scheme_reminders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id TEXT NOT NULL,
  farmer_id UUID NOT NULL DEFAULT auth.uid(),
  scheme_id TEXT REFERENCES schemes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'deadline' CHECK (
    type IN ('deadline', 'document', 'followup', 'renewal')
  ),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_verified_source BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for scheme_reminders updated_at
DROP TRIGGER IF EXISTS trigger_scheme_reminders_updated_at ON scheme_reminders;
CREATE TRIGGER trigger_scheme_reminders_updated_at
BEFORE UPDATE ON scheme_reminders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 6. Indexes for Performance & Query Optimization
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_schemes_level ON schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_verification_status ON schemes(verification_status);
CREATE INDEX IF NOT EXISTS idx_scheme_sources_scheme_id ON scheme_sources(scheme_id);

-- Farmer Application Indexes
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_applications_farm_id ON farmer_scheme_applications(farm_id);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_applications_farmer_id ON farmer_scheme_applications(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_applications_scheme_id ON farmer_scheme_applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_applications_status ON farmer_scheme_applications(status);

-- Farmer Assessment Indexes
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_assessments_farm_id ON farmer_scheme_assessments(farm_id);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_assessments_farmer_id ON farmer_scheme_assessments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_assessments_scheme_id ON farmer_scheme_assessments(scheme_id);

-- Scheme Reminders Indexes
CREATE INDEX IF NOT EXISTS idx_scheme_reminders_farm_id ON scheme_reminders(farm_id);
CREATE INDEX IF NOT EXISTS idx_scheme_reminders_farmer_id ON scheme_reminders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_scheme_reminders_due_date ON scheme_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_scheme_reminders_scheme_id ON scheme_reminders(scheme_id);

-- ==============================================================================
-- 7. Row Level Security (RLS) Configuration
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_scheme_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_scheme_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_reminders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies: schemes (Public Read)
-- Verified government scheme catalog is publicly accessible to all users.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for verified schemes" ON schemes;
CREATE POLICY "Public read access for verified schemes"
ON schemes
FOR SELECT
USING (true);

-- ------------------------------------------------------------------------------
-- RLS Policies: scheme_sources (Public Read)
-- Scheme official source links and portal records are readable by all users.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for verified scheme sources" ON scheme_sources;
CREATE POLICY "Public read access for verified scheme sources"
ON scheme_sources
FOR SELECT
USING (true);

-- ------------------------------------------------------------------------------
-- RLS Policies: farmer_scheme_applications (Strict Farmer Isolation)
-- Authenticated farmers can ONLY view, insert, update, and delete their own apps.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view their own applications" ON farmer_scheme_applications;
CREATE POLICY "Farmers can view their own applications"
ON farmer_scheme_applications
FOR SELECT
USING (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert their own applications" ON farmer_scheme_applications;
CREATE POLICY "Farmers can insert their own applications"
ON farmer_scheme_applications
FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can update their own applications" ON farmer_scheme_applications;
CREATE POLICY "Farmers can update their own applications"
ON farmer_scheme_applications
FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete their own applications" ON farmer_scheme_applications;
CREATE POLICY "Farmers can delete their own applications"
ON farmer_scheme_applications
FOR DELETE
USING (auth.uid() = farmer_id);

-- ------------------------------------------------------------------------------
-- RLS Policies: farmer_scheme_assessments (Strict Farmer Isolation)
-- Authenticated farmers can ONLY view, insert, update, and delete their assessments.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view their own assessments" ON farmer_scheme_assessments;
CREATE POLICY "Farmers can view their own assessments"
ON farmer_scheme_assessments
FOR SELECT
USING (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert their own assessments" ON farmer_scheme_assessments;
CREATE POLICY "Farmers can insert their own assessments"
ON farmer_scheme_assessments
FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can update their own assessments" ON farmer_scheme_assessments;
CREATE POLICY "Farmers can update their own assessments"
ON farmer_scheme_assessments
FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete their own assessments" ON farmer_scheme_assessments;
CREATE POLICY "Farmers can delete their own assessments"
ON farmer_scheme_assessments
FOR DELETE
USING (auth.uid() = farmer_id);

-- ------------------------------------------------------------------------------
-- RLS Policies: scheme_reminders (Strict Farmer Isolation)
-- Authenticated farmers can ONLY view, insert, update, and delete their reminders.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Farmers can view their own reminders" ON scheme_reminders;
CREATE POLICY "Farmers can view their own reminders"
ON scheme_reminders
FOR SELECT
USING (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can insert their own reminders" ON scheme_reminders;
CREATE POLICY "Farmers can insert their own reminders"
ON scheme_reminders
FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can update their own reminders" ON scheme_reminders;
CREATE POLICY "Farmers can update their own reminders"
ON scheme_reminders
FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (auth.uid() = farmer_id);

DROP POLICY IF EXISTS "Farmers can delete their own reminders" ON scheme_reminders;
CREATE POLICY "Farmers can delete their own reminders"
ON scheme_reminders
FOR DELETE
USING (auth.uid() = farmer_id);

-- ==============================================================================
-- 8. Seed Reference Data (Initial Verified Government Schemes)
-- ==============================================================================
INSERT INTO schemes (
  id, name, short_name, description, level, department, ministry,
  applicable_states, beneficiary_categories, supported_activities,
  benefit_type, benefit_details, application_availability, official_info_url,
  official_application_url, source_name, version, publication_status, verification_status
) VALUES
(
  'pm-kisan',
  'Pradhan Mantri Kisan Samman Nidhi',
  'PM-KISAN',
  'Direct income support of INR 6,000 per year in three equal 4-monthly installments to eligible farmer families having cultivable land.',
  'central',
  'Department of Agriculture & Farmers Welfare',
  'Ministry of Agriculture & Farmers Welfare',
  '["ALL"]'::jsonb,
  '["marginal", "small", "semi_medium", "medium", "large"]'::jsonb,
  '["agriculture", "horticulture"]'::jsonb,
  'direct_benefit_transfer',
  '{"summary": "INR 6,000 / year in 3 installments of INR 2,000 via PFMS direct transfer", "amountMax": 6000, "frequency": "triannual", "amountDescription": "INR 2,000 per 4-month period"}'::jsonb,
  'ongoing',
  'https://pmkisan.gov.in/',
  'https://pmkisan.gov.in/RegistrationFormNew.aspx',
  'PM-KISAN Central Portal (DA&FW)',
  '1.0.0',
  'published',
  'verified'
),
(
  'pmfby',
  'Pradhan Mantri Fasal Bima Yojana',
  'PMFBY',
  'Comprehensive crop insurance coverage against non-preventable natural risks from pre-sowing to post-harvest stages.',
  'central',
  'Department of Agriculture & Farmers Welfare',
  'Ministry of Agriculture & Farmers Welfare',
  '["ALL"]'::jsonb,
  '["all", "marginal", "small", "tenant", "sharecropper"]'::jsonb,
  '["agriculture", "horticulture"]'::jsonb,
  'crop_insurance',
  '{"summary": "Crop loss indemnity payout based on Area Yield Index or localized perils", "amountDescription": "Premium capped at 2% Kharif, 1.5% Rabi, 5% annual commercial/horticultural crops"}'::jsonb,
  'seasonal',
  'https://pmfby.gov.in/',
  'https://pmfby.gov.in/farmerRegistrationForm',
  'National Crop Insurance Portal (NCIP)',
  '1.0.0',
  'published',
  'verified'
),
(
  'pm-kusum',
  'Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan',
  'PM-KUSUM',
  'Subsidy scheme for standalone solar pumps (Component B) and solarisation of existing grid-connected agricultural pumps (Component C).',
  'central',
  'Ministry of New and Renewable Energy',
  'Ministry of New and Renewable Energy',
  '["ALL"]'::jsonb,
  '["all", "marginal", "small", "women"]'::jsonb,
  '["agriculture", "horticulture"]'::jsonb,
  'solar_pump_subsidy',
  '{"summary": "Up to 60% capital subsidy (30% Central + 30% State) for solar irrigation pumps", "amountDescription": "Farmer contributes 40% (or 10% with 30% bank loan)"}'::jsonb,
  'open',
  'https://pmkusum.mnre.gov.in/',
  'https://pmkusum.mnre.gov.in/',
  'Ministry of New and Renewable Energy Portal',
  '1.0.0',
  'published',
  'verified'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Seed initial official scheme sources
INSERT INTO scheme_sources (id, scheme_id, portal_name, portal_url, source_type, verified_by, notes)
VALUES
(
  'source-pm-kisan-portal',
  'pm-kisan',
  'PM-KISAN Official Portal',
  'https://pmkisan.gov.in/',
  'official_portal',
  'AgriDOST Verification Desk',
  'Verified against DA&FW operational guidelines 2024'
),
(
  'source-pmfby-ncip',
  'pmfby',
  'National Crop Insurance Portal (NCIP)',
  'https://pmfby.gov.in/',
  'official_portal',
  'AgriDOST Verification Desk',
  'Verified against PMFBY Revised Operational Guidelines'
),
(
  'source-pm-kusum-mnre',
  'pm-kusum',
  'MNRE PM-KUSUM Portal',
  'https://pmkusum.mnre.gov.in/',
  'official_portal',
  'AgriDOST Verification Desk',
  'Component B and C state implementation guidelines verified'
)
ON CONFLICT (id) DO NOTHING;
