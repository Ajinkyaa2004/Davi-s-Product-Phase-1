
import requests
import json
import time
import datetime
from datetime import timedelta
import sys
import re
import argparse
import psycopg2
from psycopg2 import sql

# =============================================================================
# API Keys & Configuration
# =============================================================================

ODDS_API_KEY = 'c7567ccbfe1544a0646bb4a020a30f60'
FOOTBALL_API_KEY = '553255bbb767f2dba6a808621ea045cb'

# Base URLs
ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
FOOTBALL_API_BASE = 'https://v3.football.api-sports.io'

# Database Config
DB_CONFIG = {
    'dbname': 'football_db',
    'user': 'ajinkya',  # Default Mac user
    'host': 'localhost',
    'port': 5432
}

# League Mappings
LEAGUE_MAPPING = {
    'EPL': {'footballId': 39, 'oddsKey': 'soccer_epl', 'name': 'Premier League (England)'},
    'La Liga': {'footballId': 140, 'oddsKey': 'soccer_spain_la_liga', 'name': 'La Liga (Spain)'},
    'Serie A': {'footballId': 135, 'oddsKey': 'soccer_italy_serie_a', 'name': 'Serie A (Italy)'},
    'Bundesliga': {'footballId': 78, 'oddsKey': 'soccer_germany_bundesliga', 'name': 'Bundesliga (Germany)'}
}

# Bookmaker Mappings
BOOKMAKER_MAPPING = {
    'Bet365': 'bet365',
    'William Hill': 'williamhill',
    'Unibet': 'unibet_uk',
    'Sky Bet': 'skybet',
    'Ladbrokes': 'ladbrokes_uk',
    'Betfair': 'betfair_ex_uk',
    'Coral': 'coral'
}

# Default configuration
CONFIG = {
    'league': 'EPL',
    'bookmaker': 'Bet365',
    'days_ahead': 15,  # Increased window for upcoming
    'season': 2025
}

# =============================================================================
# Database Helper Functions
# =============================================================================

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database Connection Error: {e}")
        sys.exit(1)

def get_last_historical_date():
    """Check the database for the most recent match date."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT MAX(date) FROM historical_matches WHERE league = %s", (LEAGUE_MAPPING[CONFIG['league']]['name'],))
        result = cur.fetchone()[0]
        return result
    except Exception as e:
        print(f"Error checking last date: {e}")
        return None
    finally:
        cur.close()
        conn.close()

# =============================================================================
# Helper Functions (API & Matching)
# =============================================================================

def get_config_league():
    return LEAGUE_MAPPING.get(CONFIG['league'])

def get_config_bookmaker_key():
    return BOOKMAKER_MAPPING.get(CONFIG['bookmaker'])

def normalize_team_name(name):
    if not name: return ''
    name = name.lower()
    name = re.sub(r'\s+', '', name)
    name = re.sub(r'\.|-|\'', '', name)
    name = re.sub(r'&', 'and', name)
    # Remove standard suffixes
    name = re.sub(r'(fc|cf|afc|bfc|city)$', '', name)
    name = re.sub(r'(united|utd)$', 'utd', name)
    # Common mappings
    name = name.replace('manchester', 'man').replace('tottenham', 'spurs').replace('hotspur', 'spurs')
    name = name.replace('wolverhampton', 'wolves').replace('wanderers', '')
    name = name.replace('brighton', 'brighton').replace('hove', '').replace('albion', '')
    name = name.replace('west', 'west').replace('ham', 'ham').replace('newcastle', 'newcastle')
    return name

def compare_team_names(name1, name2):
    if not name1 or not name2: return False
    if name1 == name2: return True
    if name1.lower() == name2.lower(): return True
    norm1 = normalize_team_name(name1)
    norm2 = normalize_team_name(name2)
    if norm1 == norm2: return True
    if (len(norm1) > 3 and len(norm2) > 3) and (norm1 in norm2 or norm2 in norm1): return True
    return False

def api_get(url, headers=None, params=None):
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"API Error ({url}): {e}")
        return None

# =============================================================================
# Core Fetching Logic
# =============================================================================

def fetch_odds_for_fixture(home_team, away_team, fixture_date_str, odds_key, bookmaker_key):
    """
    Fetch upcoming odds. Returns odds + timestamp of when they were fetched.
    """
    # ... (existing logic, but now returns timestamp) ...
    # For optimization in main loop we act differently, but keeping compatible signature
    pass 

def fetch_historical_odds(sport_key, date_str, favored_bookmaker):
    """
    Fetch historical odds for a specific date.
    Returns list of odds objects with timestamps.
    """
    iso_date = f"{date_str}T12:00:00Z" # Snapshot time (noon UTC)
    url = f"{ODDS_API_BASE}/sports/{sport_key}/odds-history"
    params = {'apiKey': ODDS_API_KEY, 'regions': 'uk', 'markets': 'h2h', 'date': iso_date}
    
    data = api_get(url, params=params)
    if not data or 'data' not in data: return []
    
    extracted_odds = []
    timestamp = data.get('timestamp') # When this snapshot was taken
    
    for event in data['data']:
        if not event.get('bookmakers'): continue
        bookmaker = next((b for b in event['bookmakers'] if b['key'] == favored_bookmaker), event['bookmakers'][0])
        h2h = next((m for m in bookmaker['markets'] if m['key'] == 'h2h'), None)
        if not h2h: continue
        
        outcomes = {o['name']: o['price'] for o in h2h['outcomes']}
        h_price = next((p for n, p in outcomes.items() if compare_team_names(n, event['home_team'])), None)
        a_price = next((p for n, p in outcomes.items() if compare_team_names(n, event['away_team'])), None)
        d_price = outcomes.get('Draw', None)
        
        if h_price and a_price and d_price:
             extracted_odds.append({
                'homeTeam': event['home_team'], 'awayTeam': event['away_team'],
                'homeOdds': h_price, 'drawOdds': d_price, 'awayOdds': a_price,
                'bookmaker': bookmaker['title'],
                'timestamp': timestamp # When these odds were valid
            })
    return extracted_odds

# =============================================================================
# ETL Functions (Extract, Transform, Load)
# =============================================================================

def etl_upcoming_matches():
    """Fetch upcoming fixtures and REPLACE the current upcoming_fixtures table."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    lg_config = get_config_league()
    print(f"⏳ Fetching upcoming matches for {lg_config['name']}...")
    
    # 1. Fetch Fixtures
    today = datetime.date.today()
    future = today + timedelta(days=CONFIG['days_ahead'])
    url = f"{FOOTBALL_API_BASE}/fixtures"
    params = {'league': lg_config['footballId'], 'season': CONFIG['season'], 'from': today, 'to': future}
    data = api_get(url, headers={'x-apisports-key': FOOTBALL_API_KEY}, params=params)
    
    if not data or not data.get('response'):
        print("No upcoming fixtures found.")
        return

    fixtures = data['response']
    print(f"Found {len(fixtures)} upcoming fixtures.")
    
    # 2. Fetch Current Odds (Bulk)
    # We fetch ALL current odds for the league once to save API calls
    print("Fetching latest odds from The Odds API...")
    odds_url = f"{ODDS_API_BASE}/sports/{lg_config['oddsKey']}/odds"
    odds_data = api_get(odds_url, params={'apiKey': ODDS_API_KEY, 'regions': 'uk', 'markets': 'h2h', 'oddsFormat': 'decimal'})
    current_time = datetime.datetime.utcnow().isoformat()
    
    # 3. Match and Prepare Data
    records_to_insert = []
    
    for f in fixtures:
        fixture_id = f['fixture']['id']
        home = f['teams']['home']['name']
        away = f['teams']['away']['name']
        kickoff_time = f['fixture']['date'] # ISO string with time
        date_str = kickoff_time.split('T')[0]
        
        # Match with odds_data
        matched_odds = {'homeOdds': None, 'drawOdds': None, 'awayOdds': None, 'bookmaker': None}
        
        if odds_data:
            # Find best match
            for event in odds_data:
                if compare_team_names(event['home_team'], home) and compare_team_names(event['away_team'], away):
                     # Extract odds (similar logic to helper)
                     if event.get('bookmakers'):
                         bk = next((b for b in event['bookmakers'] if b['key'] == get_config_bookmaker_key()), event['bookmakers'][0])
                         mkt = next((m for m in bk['markets'] if m['key'] == 'h2h'), None)
                         if mkt:
                             outs = {o['name']: o['price'] for o in mkt['outcomes']}
                             matched_odds['homeOdds'] = next((v for k,v in outs.items() if compare_team_names(k, home)), None)
                             matched_odds['awayOdds'] = next((v for k,v in outs.items() if compare_team_names(k, away)), None)
                             matched_odds['drawOdds'] = outs.get('Draw')
                             matched_odds['bookmaker'] = bk['title']
                     break
        
        records_to_insert.append((
            fixture_id, date_str, kickoff_time, lg_config['name'], home, away,
            matched_odds['homeOdds'], matched_odds['drawOdds'], matched_odds['awayOdds'], matched_odds['bookmaker'],
            current_time if matched_odds['homeOdds'] else None
        ))
        
    # 4. Load into DB (Replace old upcoming)
    try:
        cur.execute("TRUNCATE upcoming_fixtures") 
        insert_query = """
            INSERT INTO upcoming_fixtures (fixture_id, date, kickoff_time, league, home_team, away_team, home_odds, draw_odds, away_odds, bookmaker, odds_captured_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (fixture_id) DO UPDATE 
            SET home_odds = EXCLUDED.home_odds, draw_odds = EXCLUDED.draw_odds, away_odds = EXCLUDED.away_odds, 
                bookmaker = EXCLUDED.bookmaker, odds_captured_at = EXCLUDED.odds_captured_at, kickoff_time = EXCLUDED.kickoff_time
        """
        cur.executemany(insert_query, records_to_insert)
        conn.commit()
        print(f"✅ Successfully updated {len(records_to_insert)} upcoming fixtures.")
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating upcoming fixtures: {e}")
    finally:
        cur.close()
        conn.close()

def etl_historical_matches(manual_start=None, manual_end=None, manual_season=None):
    """Incrementally fetch historical matches > store with TIMESTAMPS + fixture_id."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Season Override
    fetch_season = manual_season if manual_season else CONFIG['season']
    lg_config = get_config_league()
    
    # 1. Determine Date Range
    if manual_start and manual_end:
        start_date = datetime.datetime.strptime(manual_start, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(manual_end, '%Y-%m-%d').date()
        print(f"🔧 Manual Backfill Mode: {start_date} to {end_date} (Season {fetch_season})")
    else:
        last_date = get_last_historical_date()
        yesterday = datetime.date.today() - timedelta(days=1)
        
        if last_date:
            start_date = last_date + timedelta(days=1)
        else:
            # Fallback if DB is empty
            start_date = datetime.date(2025, 8, 1) # Start of season roughly
            
        end_date = yesterday
        
    if start_date > end_date:
        print("✅ Historical data is up to date.")
        return

    print(f"⏳ Fetching historical data from {start_date} to {end_date} (Season {fetch_season})...")
    
    # 2. Fetch Fixtures
    url = f"{FOOTBALL_API_BASE}/fixtures"
    params = {
        'league': lg_config['footballId'], 'season': fetch_season,
        'from': start_date, 'to': end_date, 'status': 'FT'
    }
    data = api_get(url, headers={'x-apisports-key': FOOTBALL_API_KEY}, params=params)
    
    if not data or not data.get('response'):
        print("No new historical fixtures found.")
        return
        
    fixtures = data['response']
    print(f"Found {len(fixtures)} matches to process.")
    
    # 3. Fetch Odds (Day by Day)
    unique_dates = sorted(list(set(f['fixture']['date'].split('T')[0] for f in fixtures)))
    odds_map = {}
    
    for d in unique_dates:
        print(f"   Fetching odds history for {d}...")
        daily_odds = fetch_historical_odds(lg_config['oddsKey'], d, get_config_bookmaker_key())
        for o in daily_odds:
            key = f"{d}|{normalize_team_name(o['homeTeam'])}|{normalize_team_name(o['awayTeam'])}"
            odds_map[key] = o
        time.sleep(0.6) # Rate limiting
        
    # 4. Prepare Records
    records = []
    for f in fixtures:
        fixture_id = f['fixture']['id']
        kickoff_time = f['fixture']['date']
        home = f['teams']['home']['name']
        away = f['teams']['away']['name']
        h_goals = f['goals']['home']
        a_goals = f['goals']['away']
        
        if h_goals is None: continue
        
        result = 'Home' if h_goals > a_goals else ('Away' if a_goals > h_goals else 'Draw')
        date_str = kickoff_time.split('T')[0]
        
        # Match Odds
        lookup_key = f"{date_str}|{normalize_team_name(home)}|{normalize_team_name(away)}"
        match_odds = odds_map.get(lookup_key)
        
        # Fuzzy fallback
        if not match_odds:
             for k, v in odds_map.items():
                if k.startswith(date_str) and compare_team_names(home, v['homeTeam']) and compare_team_names(away, v['awayTeam']):
                    match_odds = v
                    break
        
        h_odd = match_odds['homeOdds'] if match_odds and match_odds['homeOdds'] != 'N/A' else None
        d_odd = match_odds['drawOdds'] if match_odds and match_odds['drawOdds'] != 'N/A' else None
        a_odd = match_odds['awayOdds'] if match_odds and match_odds['awayOdds'] != 'N/A' else None
        bk = match_odds['bookmaker'] if match_odds else None
        captured_at = match_odds['timestamp'] if match_odds and 'timestamp' in match_odds else None

        records.append((
            fixture_id, date_str, kickoff_time, lg_config['name'], 
            home, away, h_goals, a_goals, result,
            h_odd, d_odd, a_odd, bk, captured_at
        ))
        
    # 5. Insert into DB (Upsert on fixture_id)
    try:
        insert_query = """
            INSERT INTO historical_matches (fixture_id, date, kickoff_time, league, home_team, away_team, home_goals, away_goals, result, home_odds, draw_odds, away_odds, bookmaker, odds_captured_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (fixture_id) DO UPDATE 
            SET home_odds = EXCLUDED.home_odds, draw_odds = EXCLUDED.draw_odds, away_odds = EXCLUDED.away_odds, 
                bookmaker = EXCLUDED.bookmaker, odds_captured_at = EXCLUDED.odds_captured_at, kickoff_time = EXCLUDED.kickoff_time
        """
        cur.executemany(insert_query, records)
        conn.commit()
        print(f"✅ Successfully inserted {len(records)} new historical matches.")
    except Exception as e:
        conn.rollback()
        print(f"❌ Error inserting historical matches: {e}")
    finally:
        cur.close()
        conn.close()

# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Football Data ETL Pipeline")
    parser.add_argument('--upcoming', action='store_true', help="Fetch and update upcoming fixtures")
    parser.add_argument('--historical', action='store_true', help="Fetch and update historical matches (incremental)")
    parser.add_argument('--all', action='store_true', help="Run full pipeline (Upcoming + Historical)")
    # Manual backfill arguments
    parser.add_argument('--start-date', help="Manual start date (YYYY-MM-DD)")
    parser.add_argument('--end-date', help="Manual end date (YYYY-MM-DD)")
    parser.add_argument('--season', type=int, help="Override season year (e.g. 2024)")
    
    args = parser.parse_args()
    
    if args.all:
        etl_historical_matches(args.start_date, args.end_date, args.season)
        etl_upcoming_matches()
    elif args.upcoming:
        etl_upcoming_matches()
    elif args.historical:
        etl_historical_matches(args.start_date, args.end_date, args.season)
    else:
        # Default Interactive Mode
        print("⚽ Football Data ETL (PostgreSQL Mode)")
        print("1. Run Full Pipeline (Historical + Upcoming)")
        print("2. Fetch Historical Only")
        print("3. Fetch Upcoming Only")
        print("4. Manual Backfill (Custom Dates)")
        print("5. Exit")
        
        c = input("Enter choice: ")
        if c == '1':
            etl_historical_matches()
            etl_upcoming_matches()
        elif c == '2':
            etl_historical_matches()
        elif c == '3':
            etl_upcoming_matches()
        elif c == '4':
            s = input("Start Date (YYYY-MM-DD): ")
            e = input("End Date (YYYY-MM-DD): ")
            y = input("Season (e.g. 2024): ")
            etl_historical_matches(s, e, int(y) if y else None)
        elif c == '5':
            sys.exit()
