-- ==============================================================================
-- AgriDOST 4.0: Integration #8 — TinyFish AI Web Intelligence Persistence
-- Migration: 20261122_tinyfish_intelligence.sql
-- Table: agricultural_web_research
-- ==============================================================================

CREATE TABLE IF NOT EXISTS agricultural_web_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('mandi', 'schemes', 'crop_advisory', 'market_trends')),
  provider TEXT NOT NULL DEFAULT 'tinyfish',
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'secondary',
  is_official BOOLEAN NOT NULL DEFAULT false,
  extracted_summary TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'purged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_agricultural_web_research_updated_at ON agricultural_web_research;
CREATE TRIGGER trigger_agricultural_web_research_updated_at
BEFORE UPDATE ON agricultural_web_research
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Indexes for rapid lookup and cache invalidation
CREATE INDEX IF NOT EXISTS idx_agri_research_query ON agricultural_web_research(query);
CREATE INDEX IF NOT EXISTS idx_agri_research_category ON agricultural_web_research(category);
CREATE INDEX IF NOT EXISTS idx_agri_research_expires_at ON agricultural_web_research(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_agri_research_is_official ON agricultural_web_research(is_official);
CREATE INDEX IF NOT EXISTS idx_agri_research_status ON agricultural_web_research(status);

-- ==============================================================================
-- Row Level Security (RLS) Configuration
-- ==============================================================================
ALTER TABLE agricultural_web_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to active agricultural research" ON agricultural_web_research;
CREATE POLICY "Public read access to active agricultural research"
ON agricultural_web_research FOR SELECT
TO anon, authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "Authenticated users and services can insert research" ON agricultural_web_research;
CREATE POLICY "Authenticated users and services can insert research"
ON agricultural_web_research FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage research cache" ON agricultural_web_research;
CREATE POLICY "Service role can manage research cache"
ON agricultural_web_research FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Permissions
GRANT SELECT ON agricultural_web_research TO anon;
GRANT ALL ON agricultural_web_research TO authenticated, service_role;
