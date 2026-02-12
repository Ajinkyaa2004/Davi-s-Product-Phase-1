# Football Data ETL Pipeline (Phase 1 Foundation)

A production-grade ETL pipeline that fetches football match data (fixtures, results, odds) and stores it in a PostgreSQL database for ML modeling.

## 🚀 Project Status
**Phase 1 Foundation: MOSTLY COMPLETE**

### ✅ Implemented Features
- **Automated Usage**: Daily cron job fetches new data at 9:00 AM.
- **Data Integrity**: Uses `fixture_id` as primary key to prevent duplicates.
- **Timestamps**: Captures exact `kickoff_time` and `odds_captured_at` for temporal validity.
- **Incremental Loading**: Only fetches new/changed data to respect API rate limits.
- **Schema**:
  - `historical_matches`: Completed games with results and odds snapshots.
  - `upcoming_fixtures`: Next 15 days of games with live odds.
  - `predictions`: Audit log table ready for ML model outputs.

### 🚧 Pending / Next Steps
- **Backtest Harness**: A script to run historical strategy tests and calculate ROI/edge is **pending**.
- **Missing Data Rules**: Strict implementation of "T-6h" odds fallback rules (currently best-effort).

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- Python 3.10+
- PostgreSQL 14+
- `pip` (Python package manager)

### 2. Installation
Clone the repository and install dependencies:
```bash
# Activate virtual environment
source .venv/bin/activate

# Install required libraries
pip install requests psycopg2-binary
```

### 3. Database Setup
Ensure PostgreSQL is running and create the database:
```bash
createdb football_db

# Apply Schema (Run these in order)
psql -d football_db -f create_tables.sql
psql -d football_db -f migrate_schema_v2.sql
psql -d football_db -f create_predictions_table.sql
```

---

## 🖥️ Usage

### Automated Mode (Cron)
The pipeline is designed to run automatically.
Check your crontab:
```bash
crontab -l
```
Standard Schedule: `0 9 * * *` (Daily at 9 AM).

### Manual Mode (CLI)
You can manually trigger updates using the CLI:

```bash
# Run Full Pipeline (Historical + Upcoming)
python3 football_data_fetcher.py --all

# Fetch Only Upcoming Fixtures
python3 football_data_fetcher.py --upcoming

# Backfill Historical Data (Custom Range)
python3 football_data_fetcher.py --historical --start-date 2025-08-01 --end-date 2026-02-12
```

---

## 📊 Viewing Data

### Recommended: pgAdmin 4
1. Connect to `localhost` / `football_db`.
2. Browse `Schemas` > `public` > `Tables`.
3. Right-click `historical_matches` > **View/Edit Data**.

### Command Line
```bash
# Check latest data
psql -d football_db -c "SELECT date, home_team, away_team, home_odds FROM historical_matches ORDER BY date DESC LIMIT 5;"
```

---

## 📂 Project Structure
- `football_data_fetcher.py`: Main ETL script (Extract, Transform, Load).
- `create_tables.sql`: Initial database schema.
- `migrate_schema_v2.sql`: Schema updates for timestamps & fixture IDs.
- `create_predictions_table.sql`: Schema for ML audit logs.
# Davi-s-Product-Phase-1
