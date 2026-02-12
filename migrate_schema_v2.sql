
-- 1. Add new columns to historical_matches
ALTER TABLE historical_matches 
ADD COLUMN IF NOT EXISTS fixture_id INT,
ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS odds_captured_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS closing_odds_home NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS closing_odds_draw NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS closing_odds_away NUMERIC(5,2);

-- 2. Add new columns to upcoming_fixtures
ALTER TABLE upcoming_fixtures 
ADD COLUMN IF NOT EXISTS fixture_id INT,
ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS odds_captured_at TIMESTAMP;

-- 3. Add constraint for uniqueness based on fixture_id
-- We drop the old constraint first if it exists (optional, handled safely)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'historical_matches_fixture_id_key') THEN
        ALTER TABLE historical_matches ADD CONSTRAINT historical_matches_fixture_id_key UNIQUE (fixture_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'upcoming_fixtures_fixture_id_key') THEN
        ALTER TABLE upcoming_fixtures ADD CONSTRAINT upcoming_fixtures_fixture_id_key UNIQUE (fixture_id);
    END IF;
END $$;
