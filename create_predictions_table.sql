
-- Create Audit Logs / Predictions Table
-- This table stores every prediction made by the model, enabling backtesting and live auditing.

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    
    -- Match Identifiers
    fixture_id INT NOT NULL,
    date DATE NOT NULL,
    kickoff_time TIMESTAMP NOT NULL,
    league VARCHAR(100) NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    
    -- Prediction Details
    market VARCHAR(50) NOT NULL,        -- e.g., '1X2', 'Over 2.5'
    selection VARCHAR(50) NOT NULL,     -- e.g., 'Home', 'Away', 'Draw'
    odds_at_pick NUMERIC(5,2) NOT NULL, -- The odds taken
    odds_timestamp TIMESTAMP,           -- When the odds were captured
    
    -- Model Output
    model_prob NUMERIC(5,4) NOT NULL,   -- Predicted probability (0.0000 to 1.0000)
    implied_prob NUMERIC(5,4),          -- Bookmaker's implied probability (1/odds)
    edge NUMERIC(5,4),                  -- Model edge (model_prob - implied_prob)
    stake NUMERIC(10,2) DEFAULT 0,      -- Amount bet
    
    -- Result & Audit (Updated after match)
    result VARCHAR(10),                 -- 'Win', 'Loss', 'Void'
    profit_loss NUMERIC(10,2),          -- PnL amount
    closing_odds NUMERIC(5,2),          -- Final odds before kickoff
    closing_clv NUMERIC(5,4),           -- Closing Line Value (Closing Odds / Odds Taken)
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),          -- Version of the model used
    
    -- Constraints
    UNIQUE(fixture_id, model_version, market, selection)
);

-- Index for faster querying
CREATE INDEX idx_predictions_fixture_id ON predictions(fixture_id);
CREATE INDEX idx_predictions_date ON predictions(date);
