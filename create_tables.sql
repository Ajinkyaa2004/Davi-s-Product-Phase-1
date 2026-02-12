
-- Historical Matches Table
CREATE TABLE IF NOT EXISTS historical_matches (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    league VARCHAR(100),
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    home_goals INT,
    away_goals INT,
    result VARCHAR(10),
    home_odds NUMERIC(5,2),
    draw_odds NUMERIC(5,2),
    away_odds NUMERIC(5,2),
    bookmaker VARCHAR(50),
    UNIQUE(date, home_team, away_team)
);

-- Upcoming Fixtures Table (Snapshot)
CREATE TABLE IF NOT EXISTS upcoming_fixtures (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    league VARCHAR(100),
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    home_odds NUMERIC(5,2),
    draw_odds NUMERIC(5,2),
    away_odds NUMERIC(5,2),
    bookmaker VARCHAR(50),
    UNIQUE(date, home_team, away_team)
);

-- Standings Table
CREATE TABLE IF NOT EXISTS standings (
    rank INT,
    team VARCHAR(100),
    played INT,
    win INT,
    draw INT,
    lose INT,
    goals_for INT,
    goals_against INT,
    goal_diff INT,
    points INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team)
);

-- Top Scorers Table
CREATE TABLE IF NOT EXISTS top_scorers (
    rank INT,
    player VARCHAR(100),
    team VARCHAR(100),
    goals INT,
    assists INT,
    rating NUMERIC(4,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player, team)
);
