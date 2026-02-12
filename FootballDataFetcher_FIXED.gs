// API Keys
const ODDS_API_KEY = 'c7567ccbfe1544a0646bb4a020a30f60';
const FOOTBALL_API_KEY = '553255bbb767f2dba6a808621ea045cb';

// Base URLs
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io';

// League Mappings
const LEAGUE_MAPPING = {
  'EPL': { footballId: 39, oddsKey: 'soccer_epl', name: 'Premier League (England)' },
  'La Liga': { footballId: 140, oddsKey: 'soccer_spain_la_liga', name: 'La Liga (Spain)' },
  'Serie A': { footballId: 135, oddsKey: 'soccer_italy_serie_a', name: 'Serie A (Italy)' },
  'Bundesliga': { footballId: 78, oddsKey: 'soccer_germany_bundesliga', name: 'Bundesliga (Germany)' }
};

// Bookmaker Mappings
const BOOKMAKER_MAPPING = {
  'Bet365': 'bet365',
  'William Hill': 'williamhill',
  'Unibet': 'unibet_uk',
  'Sky Bet': 'skybet',
  'Ladbrokes': 'ladbrokes_uk',
  'Betfair': 'betfair_ex_uk',
  'Coral': 'coral'
};

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ Football Data')
    .addItem('⚙️ Setup Configuration', 'setupConfig')
    .addSeparator()
    .addItem('📅 Fetch Upcoming Fixtures', 'fetchUpcomingFixtures')
    .addItem('📊 Fetch Historical Data', 'fetchHistoricalData')
    .addItem('🏆 Fetch League Standings', 'fetchStandings')
    .addItem('⚽ Fetch Top Scorers', 'fetchTopScorers')
    .addSeparator()
    .addItem('💾 Download Upcoming Fixtures as CSV', 'downloadUpcomingFixturesCSV')
    .addItem('💾 Download Historical Data as CSV', 'downloadHistoricalDataCSV')
    .addSeparator()
    .addItem('🔧 Test API Connections', 'testAPIConnections')
    .addToUi();
}

/**
 * Sets up the configuration sheet
 */
function setupConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('Config');
  
  if (!configSheet) {
    configSheet = ss.insertSheet('Config');
  }
  
  configSheet.clear();
  
  // Headers
  configSheet.getRange('A1:B1').setValues([['Setting', 'Value']])
    .setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  // League options
  const leagueOptions = Object.keys(LEAGUE_MAPPING).map(key => `${key} - ${LEAGUE_MAPPING[key].name}`);
  
  configSheet.getRange('A2').setValue('League');
  configSheet.getRange('B2').setValue('EPL - Premier League (England)');
  configSheet.getRange('B2').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(leagueOptions, true)
      .build()
  );
  
  // Bookmaker options
  const bookmakerOptions = Object.keys(BOOKMAKER_MAPPING).map(key => key);
  
  configSheet.getRange('A3').setValue('Bookmaker');
  configSheet.getRange('B3').setValue('Bet365');
  configSheet.getRange('B3').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(bookmakerOptions, true)
      .build()
  );
  
  // Upcoming fixtures - Days ahead approach
  configSheet.getRange('A5').setValue('Upcoming - Days Ahead').setFontWeight('bold');
  configSheet.getRange('B5').setValue(10);
  configSheet.getRange('B5').setNumberFormat('0');
  
  // Historical data - Date ranges
  configSheet.getRange('A7').setValue('From Date (Historical)').setFontWeight('bold');
  configSheet.getRange('B7').setValue('2026-02-01');
  
  configSheet.getRange('A8').setValue('To Date (Historical)');
  configSheet.getRange('B8').setValue('2026-02-07');
  
  // Season (auto-detected based on current date) - MUST BE NUMBER
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const season = currentMonth >= 8 ? currentYear : currentYear - 1;
  
  configSheet.getRange('A10').setValue('Season (auto-detected)').setFontWeight('bold');
  configSheet.getRange('B10').setValue(season).setNumberFormat('0');
  configSheet.getRange('B10').setBackground('#fff3cd');
  
  // Instructions
  configSheet.getRange('A12').setValue('📌 Instructions:').setFontWeight('bold').setFontSize(12);
  configSheet.getRange('A13').setValue('1. Select League from dropdown in B2');
  configSheet.getRange('A14').setValue('2. Select Bookmaker from dropdown in B3');
  configSheet.getRange('A15').setValue('3. B5: Days ahead for upcoming fixtures (default 10)');
  configSheet.getRange('A16').setValue('4. B7-B8: Date range for historical data (YYYY-MM-DD)');
  configSheet.getRange('A17').setValue('5. B10: Season MUST match dates (2025 for 2025-26 season)');
  configSheet.getRange('A18').setValue('6. Use menu: ⚽ Football Data → Fetch data');
  configSheet.getRange('A19').setValue('7. Download as CSV after fetching');
  configSheet.getRange('A20').setValue('');
  configSheet.getRange('A21').setValue('⚠️ Note: Odds available 1-3 days before matches');
  
  configSheet.autoResizeColumns(1, 2);
  
  SpreadsheetApp.getUi().alert('✅ Configuration sheet created!\n\n4 leagues available.\nSeason set to: ' + season);
}

/**
 * Read configuration with proper date handling
 */
function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  
  if (!configSheet) {
    SpreadsheetApp.getUi().alert('⚠️ Please run "Setup Configuration" first!');
    throw new Error('Config sheet not found');
  }
  
  const leagueValue = configSheet.getRange('B2').getValue().toString();
  const bookmakerValue = configSheet.getRange('B3').getValue().toString();
  
  // Extract league key from dropdown value
  const leagueKey = leagueValue.split(' - ')[0];
  
  if (!LEAGUE_MAPPING[leagueKey]) {
    throw new Error('Invalid league selected');
  }
  
  // Format dates properly WITHOUT timezone shifts
  function formatDate(cellValue) {
    let dateStr = cellValue.toString();
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // If it's a Date object, format it properly
    if (cellValue instanceof Date) {
      const year = cellValue.getFullYear();
      const month = String(cellValue.getMonth() + 1).padStart(2, '0');
      const day = String(cellValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Otherwise try to parse and format
    const dateObj = new Date(cellValue);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Get days ahead for upcoming fixtures
  let daysAhead = configSheet.getRange('B5').getValue();
  if (typeof daysAhead === 'string') {
    daysAhead = parseInt(daysAhead);
  }
  if (!daysAhead || isNaN(daysAhead) || daysAhead < 1) {
    daysAhead = 10; // Default fallback
  }
  
  // Get season and ensure it's a number
  let season = configSheet.getRange('B10').getValue();
  if (typeof season === 'string') {
    season = parseInt(season);
  }
  if (!season || season < 2000 || season > 2100) {
    season = 2025; // Default fallback
  }
  
  // Calculate upcoming fixture dates
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);
  
  const upcomingStartDate = formatDate(today);
  const upcomingEndDate = formatDate(futureDate);
  
  // Validate calculated dates
  if (!upcomingStartDate || !upcomingEndDate || upcomingStartDate === 'NaN-NaN-NaN' || upcomingEndDate === 'NaN-NaN-NaN') {
    throw new Error('Failed to calculate dates. Please check B5 (Days Ahead) is a valid number.');
  }
  
  return {
    leagueKey: leagueKey,
    leagueConfig: LEAGUE_MAPPING[leagueKey],
    season: season,
    bookmaker: bookmakerValue,
    bookmakerKey: BOOKMAKER_MAPPING[bookmakerValue],
    daysAhead: daysAhead,
    upcomingStartDate: upcomingStartDate,
    upcomingEndDate: upcomingEndDate,
    historicalStartDate: formatDate(configSheet.getRange('B7').getValue()),
    historicalEndDate: formatDate(configSheet.getRange('B8').getValue())
  };
}

/**
 * Improved team name normalization for matching
 */
function normalizeTeamName(name) {
  if (!name) return '';
  
  return name.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/-/g, '')
    .replace(/&/g, 'and')
    // Remove common suffixes
    .replace(/fc$/g, '')
    .replace(/cf$/g, '')
    .replace(/afc$/g, '')
    .replace(/bfc$/g, '')
    .replace(/city$/g, '')
    .replace(/united$/g, 'utd')
    .replace(/utd$/g, 'utd')
    // Common variations
    .replace(/manchester/g, 'man')
    .replace(/tottenham/g, 'spurs')
    .replace(/hotspur/g, 'spurs')
    .replace(/nottingham/g, 'notts')
    .replace(/forest/g, '')
    .replace(/wolverhampton/g, 'wolves')
    .replace(/wanderers/g, '')
    .replace(/brighton/g, 'brighton')
    .replace(/hove/g, '')
    .replace(/albion/g, '')
    .replace(/west/g, 'west')
    .replace(/ham$/g, 'ham')
    .replace(/newcastle/g, 'newcastle');
}

/**
 * Compare team names with normalization
 */
function compareTeamNames(name1, name2) {
  if (!name1 || !name2) return false;
  
  // Exact match
  if (name1 === name2) return true;
  
  // Case insensitive exact match
  if (name1.toLowerCase() === name2.toLowerCase()) return true;
  
  // Normalized match
  const norm1 = normalizeTeamName(name1);
  const norm2 = normalizeTeamName(name2);
  
  if (norm1 === norm2) return true;
  
  // Partial match (one contains the other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    // But both must be substantial (more than 3 chars)
    if (norm1.length > 3 && norm2.length > 3) {
      return true;
    }
  }
  
  return false;
}

/**
 * Fetch odds for a specific fixture by searching The Odds API
 */
function fetchOddsForFixture(homeTeam, awayTeam, fixtureDate, oddsKey, bookmakerKey) {
  try {
    // Fetch current odds for the league
    const oddsUrl = `${ODDS_API_BASE}/sports/${oddsKey}/odds?regions=uk&markets=h2h&oddsFormat=decimal&apiKey=${ODDS_API_KEY}`;
    const oddsResponse = UrlFetchApp.fetch(oddsUrl, {'muteHttpExceptions': true});
    const oddsData = JSON.parse(oddsResponse.getContentText());
    
    if (!Array.isArray(oddsData)) {
      Logger.log('Invalid odds data returned');
      return {homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: 'N/A'};
    }
    
    Logger.log(`Searching odds for: ${homeTeam} vs ${awayTeam}`);
    Logger.log(`Available events: ${oddsData.length}`);
    
    // Try to find matching event - Phase 1: Teams + Time
    let bestMatch = null;
    let bestTimeDiff = 999;
    
    for (let event of oddsData) {
      const homeMatch = compareTeamNames(event.home_team, homeTeam);
      const awayMatch = compareTeamNames(event.away_team, awayTeam);
      
      if (homeMatch && awayMatch) {
        const eventDate = new Date(event.commence_time);
        const fixDate = new Date(fixtureDate);
        const timeDiff = Math.abs(eventDate - fixDate) / (1000 * 60 * 60);
        
        Logger.log(`✓ Team match found: "${event.home_team}" vs "${event.away_team}", time diff: ${timeDiff.toFixed(2)}h`);
        
        // Accept within 48 hours (more lenient)
        if (timeDiff < 48 && timeDiff < bestTimeDiff) {
          bestMatch = event;
          bestTimeDiff = timeDiff;
        }
      }
    }
    
    // Phase 2: If no match, try same day only (ignore time)
    if (!bestMatch) {
      Logger.log('No time-based match, trying date-only match...');
      const fixDate = new Date(fixtureDate);
      const fixDateStr = fixDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      for (let event of oddsData) {
        const eventDate = new Date(event.commence_time);
        const eventDateStr = eventDate.toISOString().split('T')[0];
        
        if (eventDateStr === fixDateStr) {
          const homeMatch = compareTeamNames(event.home_team, homeTeam);
          const awayMatch = compareTeamNames(event.away_team, awayTeam);
          
          if (homeMatch && awayMatch) {
            Logger.log(`✓ Date-only match: "${event.home_team}" vs "${event.away_team}"`);
            bestMatch = event;
            break;
          }
        }
      }
    }
    
    matchedEvent = bestMatch;
    
    if (!matchedEvent) {
      Logger.log(`❌ No match found for ${homeTeam} vs ${awayTeam}`);
      Logger.log(`Available teams in Odds API: ${oddsData.slice(0,5).map(e => e.home_team + ' vs ' + e.away_team).join(', ')}...`);
      return {homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: 'N/A'};
    }
    
    if (!matchedEvent.bookmakers || matchedEvent.bookmakers.length === 0) {
      Logger.log(`⚠️ No bookmakers available for ${homeTeam} vs ${awayTeam}`);
      return {homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: 'N/A'};
    }
    
    const matchType = bestTimeDiff < 48 ? `time-based (${bestTimeDiff.toFixed(2)}h)` : 'date-only';
    Logger.log(`✅ Found match [${matchType}]: "${matchedEvent.home_team}" vs "${matchedEvent.away_team}"`);
    Logger.log(`   Bookmakers available: ${matchedEvent.bookmakers.map(b => b.title).join(', ')}`);
    
    // Find preferred bookmaker
    let bookmaker = matchedEvent.bookmakers.find(b => b.key === bookmakerKey);
    
    // Fallback to first available bookmaker
    if (!bookmaker) {
      bookmaker = matchedEvent.bookmakers[0];
      Logger.log(`Preferred bookmaker not found, using: ${bookmaker.title}`);
    } else {
      Logger.log(`Using preferred bookmaker: ${bookmaker.title}`);
    }
    
    // Extract h2h odds
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    if (!h2hMarket || !h2hMarket.outcomes) {
      Logger.log('No h2h market available');
      return {homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: bookmaker.title};
    }
    
    let homeOdds = 'N/A', drawOdds = 'N/A', awayOdds = 'N/A';
    
    for (let outcome of h2hMarket.outcomes) {
      if (compareTeamNames(outcome.name, homeTeam) || 
          compareTeamNames(outcome.name, matchedEvent.home_team)) {
        homeOdds = outcome.price;
      } else if (compareTeamNames(outcome.name, awayTeam) || 
                 compareTeamNames(outcome.name, matchedEvent.away_team)) {
        awayOdds = outcome.price;
      } else if (outcome.name === 'Draw') {
        drawOdds = outcome.price;
      }
    }
    
    Logger.log(`Odds: H:${homeOdds} D:${drawOdds} A:${awayOdds}`);
    
    return {homeOdds: homeOdds, drawOdds: drawOdds, awayOdds: awayOdds, bookmaker: bookmaker.title};
    
  } catch (e) {
    Logger.log('Error fetching odds: ' + e.toString());
    return {homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: 'N/A'};
  }
}

/**
 * Fetch upcoming fixtures with odds
 */
function fetchUpcomingFixtures() {
  const config = getConfig();
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Upcoming Fixtures') 
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Upcoming Fixtures');
  
  sheet.clear();
  sheet.getRange('A1:H1').setValues([['Date', 'League', 'Home Team', 'Away Team', 'Home Odds', 'Draw Odds', 'Away Odds', 'Bookmaker']])
    .setFontWeight('bold').setBackground('#34a853').setFontColor('white');
  
  SpreadsheetApp.getUi().alert('Fetching fixtures from ' + config.upcomingStartDate + ' to ' + config.upcomingEndDate + '...\n\nThis may take a minute.');
  
  try {
    // Validate dates
    if (!config.upcomingStartDate || !config.upcomingEndDate) {
      throw new Error('Invalid date range');
    }
    
    // Validate season
    if (!config.season) {
      throw new Error('Season not set. Please run Setup Configuration again.');
    }
    
    Logger.log('Fetching fixtures for league: ' + config.leagueConfig.footballId + ', season: ' + config.season);
    Logger.log('Date range: ' + config.upcomingStartDate + ' to ' + config.upcomingEndDate);
    
    // Build URL with proper parameters
    const params = [
      `league=${config.leagueConfig.footballId}`,
      `season=${config.season}`,
      `from=${config.upcomingStartDate}`,
      `to=${config.upcomingEndDate}`
    ];
    
    const fixturesUrl = `${FOOTBALL_API_BASE}/fixtures?${params.join('&')}`;
    Logger.log('API URL: ' + fixturesUrl);
    
    const fixturesOptions = {
      'method': 'get',
      'headers': {
        'x-apisports-key': FOOTBALL_API_KEY
      },
      'muteHttpExceptions': true
    };
    
    const fixturesResponse = UrlFetchApp.fetch(fixturesUrl, fixturesOptions);
    const fixturesData = JSON.parse(fixturesResponse.getContentText());
    
    // Check for API errors
    if (fixturesData.errors && Object.keys(fixturesData.errors).length > 0) {
      throw new Error('Football API Error: ' + JSON.stringify(fixturesData.errors));
    }
    
    const fixtures = fixturesData.response || [];
    
    if (!fixtures || fixtures.length === 0) {
      SpreadsheetApp.getUi().alert('No fixtures found for selected league and dates.');
      return;
    }
    
    Logger.log(`Found ${fixtures.length} fixtures`);
    
    let count = 0;
    
    for (let fixture of fixtures) {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const fixtureDate = new Date(fixture.fixture.date);
      
      // Format date as dd-MM-yyyy
      const formattedDate = Utilities.formatDate(fixtureDate, 'GMT', 'dd-MM-yyyy');
      
      // Fetch odds for this specific fixture
      const odds = fetchOddsForFixture(
        homeTeam, 
        awayTeam, 
        fixture.fixture.date,
        config.leagueConfig.oddsKey,
        config.bookmakerKey
      );
      
      // Append row immediately
      sheet.appendRow([
        formattedDate,
        config.leagueKey,
        homeTeam,
        awayTeam,
        odds.homeOdds,
        odds.drawOdds,
        odds.awayOdds,
        odds.bookmaker
      ]);
      
      count++;
      
      // Rate limiting
      Utilities.sleep(800);
      
      Logger.log(`Processed ${count}/${fixtures.length}: ${homeTeam} vs ${awayTeam}`);
    }
    
    sheet.autoResizeColumns(1, 8);
    SpreadsheetApp.getUi().alert(`✅ Fetched ${count} upcoming fixtures successfully!\n\nUse menu to download as CSV.`);
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.toString());
    Logger.log('Error details: ' + e.toString());
  }
}

/**
 * Fetch historical data with results AND odds
 */
function fetchHistoricalData() {
  const config = getConfig();
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Historical Data') 
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Historical Data');
  
  sheet.clear();
  sheet.getRange('A1:K1').setValues([['Date', 'HomeTeam', 'AwayTeam', 'HomeGoals', 'AwayGoals', 'Result', 'League', 'Home Odds', 'Draw Odds', 'Away Odds', 'Bookmaker']])
    .setFontWeight('bold').setBackground('#fbbc04').setFontColor('white');
  
  const startDate = new Date(config.historicalStartDate);
  const endDate = new Date(config.historicalEndDate);
  
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  SpreadsheetApp.getUi().alert(`Fetching historical data (${daysDiff} days)...\n\nThis may take a minute.`);
  
  try {
    // Validate dates
    if (!config.historicalStartDate || !config.historicalEndDate) {
      throw new Error('Invalid date range');
    }
    
    // Validate season
    if (!config.season) {
      throw new Error('Season not set. Please run Setup Configuration again.');
    }
    
    Logger.log('Fetching historical data for league: ' + config.leagueConfig.footballId + ', season: ' + config.season);
    Logger.log('Date range: ' + config.historicalStartDate + ' to ' + config.historicalEndDate);
    
    // 1. Fetch Fixtures from Football API
    const params = [
      `league=${config.leagueConfig.footballId}`,
      `season=${config.season}`,
      `from=${config.historicalStartDate}`,
      `to=${config.historicalEndDate}`,
      `status=FT`
    ];
    
    const fixturesUrl = `${FOOTBALL_API_BASE}/fixtures?${params.join('&')}`;
    Logger.log('Football API URL: ' + fixturesUrl);
    
    const fixturesOptions = {
      'method': 'get',
      'headers': {
        'x-apisports-key': FOOTBALL_API_KEY
      },
      'muteHttpExceptions': true
    };
    
    const fixturesResponse = UrlFetchApp.fetch(fixturesUrl, fixturesOptions);
    const fixturesData = JSON.parse(fixturesResponse.getContentText());
    
    if (fixturesData.errors && Object.keys(fixturesData.errors).length > 0) {
      throw new Error('Football API Error: ' + JSON.stringify(fixturesData.errors));
    }
    
    const fixtures = fixturesData.response || [];
    
    if (!fixtures || fixtures.length === 0) {
      SpreadsheetApp.getUi().alert('No completed fixtures found for selected league and dates.');
      return;
    }
    
    Logger.log(`Found ${fixtures.length} completed fixtures`);
    
    // 2. Identify unique dates for Odds API calls
    const uniqueDates = new Set();
    fixtures.forEach(f => {
      const dateStr = f.fixture.date.split('T')[0]; // YYYY-MM-DD
      uniqueDates.add(dateStr);
    });
    
    Logger.log(`Need to fetch odds for ${uniqueDates.size} unique dates`);
    
    // 3. Fetch Odds for each date and store in lookup map
    const oddsMap = new Map(); // Key: "yyyy-mm-dd|home|away", Value: {home, draw, away}
    
    for (let dateStr of uniqueDates) {
      Logger.log(`Fetching historical odds for date: ${dateStr}`);
      const oddsForDay = fetchHistoricalOdds(config.leagueConfig.oddsKey, dateStr, config.bookmakerKey);
      
      oddsForDay.forEach(odd => {
        // Create a unique key for matching
        const key = `${dateStr}|${normalizeTeamName(odd.homeTeam)}|${normalizeTeamName(odd.awayTeam)}`;
        oddsMap.set(key, odd);
      });
      
      // Rate limiting for Odds API
      Utilities.sleep(500);
    }
    
    // 4. Process fixtures and match with odds
    let totalCount = 0;
    
    for (let fixture of fixtures) {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const homeGoals = fixture.goals.home;
      const awayGoals = fixture.goals.away;
      
      // Skip if no score data
      if (homeGoals === null || awayGoals === null) continue;
      
      const result = homeGoals > awayGoals ? 'Home' : (homeGoals < awayGoals ? 'Away' : 'Draw');
      
      const fixtureDate = new Date(fixture.fixture.date);
      const fixtureDateStr = fixture.fixture.date.split('T')[0];
      const formattedDate = Utilities.formatDate(fixtureDate, 'GMT', 'dd-MM-yyyy');
      
      // Lookup Odds
      let homeNorm = normalizeTeamName(homeTeam);
      let awayNorm = normalizeTeamName(awayTeam);
      let matchOdds = oddsMap.get(`${fixtureDateStr}|${homeNorm}|${awayNorm}`);
      
      // If not found, try fuzzy matching against all odds for that date
      if (!matchOdds) {
        for (let [key, val] of oddsMap.entries()) {
          if (key.startsWith(fixtureDateStr)) {
             const parts = key.split('|');
             if (parts.length === 3) {
                if (compareTeamNames(homeTeam, val.homeTeam) && compareTeamNames(awayTeam, val.awayTeam)) {
                  matchOdds = val;
                  break;
                }
             }
          }
        }
      }
      
      const finalOdds = matchOdds || { homeOdds: 'N/A', drawOdds: 'N/A', awayOdds: 'N/A', bookmaker: 'N/A' };
      
      if (!matchOdds) {
         Logger.log(`⚠️ Odds not found for: ${homeTeam} vs ${awayTeam} on ${fixtureDateStr}`);
      }
      
      // Append row
      sheet.appendRow([
        formattedDate,
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        result,
        config.leagueKey,
        finalOdds.homeOdds,
        finalOdds.drawOdds,
        finalOdds.awayOdds,
        finalOdds.bookmaker
      ]);
      
      totalCount++;
    }
    
    sheet.autoResizeColumns(1, 11);
    
    if (totalCount === 0) {
      SpreadsheetApp.getUi().alert('No historical data found for selected league and dates.');
    } else {
      SpreadsheetApp.getUi().alert(`✅ Fetched ${totalCount} historical matches with odds successfully!\n\nUse menu to download as CSV.`);
    }
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.toString());
    Logger.log('Error details: ' + e.toString());
  }
}

/**
 * Helper to fetch historical odds for a specific date from The Odds API
 */
function fetchHistoricalOdds(sportKey, dateStr, favoredBookmaker) {
  try {
    // For historical odds, we use the odds-history endpoint with a date parameter
    const isoDate = `${dateStr}T12:00:00Z`;
    
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds-history?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h&date=${isoDate}`;
    
    const response = UrlFetchApp.fetch(url, {'muteHttpExceptions': true});
    const result = JSON.parse(response.getContentText());
    
    const events = result.data;
    
    if (!events || !Array.isArray(events)) {
      Logger.log(`No events found in odds history for ${dateStr}`);
      return [];
    }
    
    const extractedOdds = [];
    
    for (let event of events) {
       if (!event.bookmakers || event.bookmakers.length === 0) continue;
       
       // Try to find favored bookmaker, else use first
       let bookmaker = event.bookmakers.find(b => b.key === favoredBookmaker) || event.bookmakers[0];
       
       const market = bookmaker.markets.find(m => m.key === 'h2h');
       if (!market || !market.outcomes) continue;
       
       let h = 'N/A', d = 'N/A', a = 'N/A';
       
       market.outcomes.forEach(o => {
          if (o.name === 'Draw') {
             d = o.price;
          } else if (compareTeamNames(o.name, event.home_team)) {
             h = o.price;
          } else if (compareTeamNames(o.name, event.away_team)) {
             a = o.price;
          }
       });
       
       extractedOdds.push({
         homeTeam: event.home_team,
         awayTeam: event.away_team,
         commenceTime: event.commence_time,
         homeOdds: h,
         drawOdds: d,
         awayOdds: a,
         bookmaker: bookmaker.title
       });
    }
    
    return extractedOdds;
    
  } catch (e) {
    Logger.log(`Error fetching historical odds for ${dateStr}: ${e.toString()}`);
    return [];
  }
}

/**
 * Download Upcoming Fixtures as CSV
 */
function downloadUpcomingFixturesCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Upcoming Fixtures');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('⚠️ No "Upcoming Fixtures" sheet found!\n\nPlease fetch data first.');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data to download!\n\nPlease fetch fixtures first.');
    return;
  }
  
  let csvContent = '';
  
  for (let row of data) {
    let csvRow = row.map(cell => {
      let cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        cellStr = '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',');
    
    csvContent += csvRow + '\n';
  }
  
  const blob = Utilities.newBlob(csvContent, 'text/csv', 'upcoming_fixtures.csv');
  const file = DriveApp.createFile(blob);
  
  SpreadsheetApp.getUi().alert(`✅ CSV file created successfully!\n\nFile: "${file.getName()}"\n\nCheck your Google Drive root folder.\n\nDirect link:\n${file.getUrl()}`);
}

/**
 * Download Historical Data as CSV
 */
function downloadHistoricalDataCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Historical Data');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('⚠️ No "Historical Data" sheet found!\n\nPlease fetch data first.');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ No data to download!\n\nPlease fetch historical data first.');
    return;
  }
  
  let csvContent = '';
  
  for (let row of data) {
    let csvRow = row.map(cell => {
      let cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        cellStr = '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',');
    
    csvContent += csvRow + '\n';
  }
  
  const blob = Utilities.newBlob(csvContent, 'text/csv', 'historical_data.csv');
  const file = DriveApp.createFile(blob);
  
  SpreadsheetApp.getUi().alert(`✅ CSV file created successfully!\n\nFile: "${file.getName()}"\n\nCheck your Google Drive root folder.\n\nDirect link:\n${file.getUrl()}`);
}

/**
 * Test both API connections
 */
function testAPIConnections() {
  const ui = SpreadsheetApp.getUi();
  let message = '🔧 API Connection Test\n\n';
  
  // Test Odds API
  try {
    const oddsUrl = `${ODDS_API_BASE}/sports?apiKey=${ODDS_API_KEY}`;
    const oddsResponse = UrlFetchApp.fetch(oddsUrl, {'muteHttpExceptions': true});
    const oddsData = JSON.parse(oddsResponse.getContentText());
    
    if (Array.isArray(oddsData)) {
      message += '✅ The Odds API: Connected\n';
      message += `   Available sports: ${oddsData.length}\n\n`;
    } else {
      message += '❌ The Odds API: Error\n\n';
    }
  } catch (error) {
    message += '❌ The Odds API: ' + error.toString() + '\n\n';
  }
  
  // Test Football API
  try {
    const footballUrl = `${FOOTBALL_API_BASE}/status`;
    const footballOptions = {
      'method': 'get',
      'headers': {
        'x-apisports-key': FOOTBALL_API_KEY
      },
      'muteHttpExceptions': true
    };
    
    const footballResponse = UrlFetchApp.fetch(footballUrl, footballOptions);
    const footballData = JSON.parse(footballResponse.getContentText());
    
    if (footballData.response) {
      message += '✅ Football API: Connected\n';
      message += `   Account: ${footballData.response.account.firstname} ${footballData.response.account.lastname}\n`;
      message += `   Requests today: ${footballData.response.requests.current}/${footballData.response.requests.limit_day}\n`;
    } else if (footballData.errors) {
      message += '❌ Football API: ' + JSON.stringify(footballData.errors) + '\n';
    } else {
      message += '❌ Football API: Unexpected response\n';
    }
  } catch (error) {
    message += '❌ Football API: ' + error.toString() + '\n';
  }
  
  ui.alert(message);
}

/**
 * Fetch League Standings
 */
function fetchStandings() {
  const config = getConfig();
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Standings') 
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Standings');
  
  sheet.clear();
  sheet.getRange('A1:J1').setValues([['Rank', 'Team', 'Played', 'Win', 'Draw', 'Lose', 'Goals For', 'Goals Against', 'Diff', 'Points']])
    .setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  SpreadsheetApp.getUi().alert('Fetching standings for ' + config.leagueConfig.name + '...');
  
  try {
    const params = [
      `league=${config.leagueConfig.footballId}`,
      `season=${config.season}`
    ];
    
    const url = `${FOOTBALL_API_BASE}/standings?${params.join('&')}`;
    const options = {
      'method': 'get',
      'headers': { 'x-apisports-key': FOOTBALL_API_KEY },
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(JSON.stringify(data.errors));
    }
    
    if (!data.response || data.response.length === 0) {
      throw new Error('No standings found for this league/season.');
    }
    
    const standings = data.response[0].league.standings[0]; // Usually the first array is the main table
    
    const rows = standings.map(team => [
      team.rank,
      team.team.name,
      team.all.played,
      team.all.win,
      team.all.draw,
      team.all.lose,
      team.all.goals.for,
      team.all.goals.against,
      team.goalsDiff,
      team.points
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 10).setValues(rows);
      sheet.autoResizeColumns(1, 10);
      SpreadsheetApp.getUi().alert('✅ Standings updated successfully!');
    }
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.toString());
    Logger.log(e.toString());
  }
}

/**
 * Fetch Top Scorers
 */
function fetchTopScorers() {
  const config = getConfig();
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Top Scorers') 
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Top Scorers');
  
  sheet.clear();
  sheet.getRange('A1:F1').setValues([['Rank', 'Player', 'Team', 'Goals', 'Assists', 'Rating']])
    .setFontWeight('bold').setBackground('#db4437').setFontColor('white');
  
  SpreadsheetApp.getUi().alert('Fetching top scorers for ' + config.leagueConfig.name + '...');
  
  try {
    const params = [
      `league=${config.leagueConfig.footballId}`,
      `season=${config.season}`
    ];
    
    const url = `${FOOTBALL_API_BASE}/players/topscorers?${params.join('&')}`;
    const options = {
      'method': 'get',
      'headers': { 'x-apisports-key': FOOTBALL_API_KEY },
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(JSON.stringify(data.errors));
    }
    
    const players = data.response || [];
    
    const rows = players.map((p, index) => [
      index + 1,
      p.player.name,
      p.statistics[0].team.name,
      p.statistics[0].goals.total || 0,
      p.statistics[0].goals.assists || 0,
      p.statistics[0].games.rating || 'N/A'
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 6).setValues(rows);
      sheet.autoResizeColumns(1, 6);
      SpreadsheetApp.getUi().alert('✅ Top Scorers updated successfully!');
    } else {
      SpreadsheetApp.getUi().alert('No top scorers data found.');
    }
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.toString());
    Logger.log(e.toString());
  }
}
