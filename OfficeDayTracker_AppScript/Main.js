/**
 * Main.js
 * Entry point for page data assembly.
 *
 * First call of the day hits the sheet (6–7 API calls).
 * Subsequent calls serve from PropertiesService cache (0 sheet calls).
 * Soft reload (GetFreshData) always bypasses and refreshes the cache.
 * Office path bypasses cache when alreadyLogged=false — a write may be needed.
 */

//////// Global state ////////
const rawDate = new Date();
var ss;
var sheet;
var cheatSheet;


/**
 * Builds the full page data object for the HTML template.
 * Serves from cache when valid; falls through to sheet otherwise.
 *
 * @param {string} key 'Office' or 'Home'
 * @returns {Object} full DATA contract, or { status: 'fatal', errorMessage } on failure.
 */
function BuildPageData(key) {
  const data = {};

  // ---- Cache check (no sheet calls on hit) ----
  const cached = readCache();
  if (isCacheValid(cached, key)) {
    console.log('Cache hit for', key, '— skipping sheet reads');
    return buildPageDataFromCache(cached, key);
  }

  // ---- Setup ----
  try {
    sheet           = GetCurrentSheet();
    data.weekNumber = GetCurrentISOWeek();
  } catch(e) {
    console.log('Setup error:', e.message);
    return { status: 'fatal', errorMessage: e.message };
  }

  const bundle   = LoadSheetBundle(sheet, ss, rawDate.getFullYear(), data.weekNumber);
  cheatSheet     = ParseCheatSheet(bundle);

  const year     = rawDate.getFullYear();
  const monthIdx = rawDate.getMonth();

  data.date = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, dd/MMM/yyyy");
  data.time = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "h:mm a");

  // ---- Weekend check ----
  let dayOfWeek;
  try {
    dayOfWeek = GetCurrentDayOfWeek();
  } catch(e) {
    console.log('Weekend:', e.message);
    data.status               = 'weekend';
    data.statusLabel          = 'Weekend';
    data.alreadyLogged        = false;
    data.alreadyLoggedMessage = '';
    Object.assign(data, BuildStatsData(bundle, data.weekNumber, WEEK.Fri, year, monthIdx));
    writeCache(buildCacheEntry(data));
    return data;
  }

  // ---- Status resolution ----
  if (key === 'Office') {
    const cellAddress    = CalculateCurrentDayCell(dayOfWeek, data.weekNumber);
    const existingValue  = GetDayCellValue(bundle, dayOfWeek, data.weekNumber);
    const wasAlreadyLogged = !!existingValue;
    if (!wasAlreadyLogged) {
      const officeCode = Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Office');
      SetCurrentDayCellValue(cellAddress, officeCode);
      // Patch bundle in memory so calendar/stats see the write without a second sheet read
      bundle.main[weekRowIndex(data.weekNumber)][dayOfWeek] = officeCode;
      console.log('Marked as Office:', cellAddress);
    } else {
      console.log('Already logged:', cellAddress);
    }
    data.alreadyLogged        = wasAlreadyLogged;
    data.alreadyLoggedMessage = wasAlreadyLogged ? (ALREADY_LOGGED_MSGS.office || 'Already logged') : '';
    data.status               = 'office';
    data.statusLabel          = 'Office Day';
  } else {
    const cellValue = GetDayCellValue(bundle, dayOfWeek, data.weekNumber);
    Object.assign(data, _resolveStatusFromCell(cellValue));
    // Home is read-only — alreadyLogged only applies when a write is attempted
    data.alreadyLogged        = false;
    data.alreadyLoggedMessage = '';
    console.log('Home day, no write. Cell:', cellValue || 'empty');
  }

  Object.assign(data, BuildStatsData(bundle, data.weekNumber, dayOfWeek, year, monthIdx));
  writeCache(buildCacheEntry(data));
  return data;
}

/**
 * Soft reload: always reads from sheet, determines status from live cell data,
 * and writes a fully fresh cache entry. Never touches the existing cache for reads.
 * Called by the client refresh button via google.script.run.
 *
 * @returns {{ rings, days, calendar, charts }}
 */
function GetFreshData() {
  sheet = GetCurrentSheet();
  const weekNumber = GetCurrentISOWeek();
  const bundle     = LoadSheetBundle(sheet, ss, rawDate.getFullYear(), weekNumber);
  cheatSheet       = ParseCheatSheet(bundle);
  const year       = rawDate.getFullYear();
  const monthIdx   = rawDate.getMonth();

  let dayOfWeek;
  let isWeekend = false;
  try {
    dayOfWeek = GetCurrentDayOfWeek();
  } catch(e) {
    dayOfWeek = WEEK.Fri;
    isWeekend = true;
  }

  const stats = BuildStatsData(bundle, weekNumber, dayOfWeek, year, monthIdx);

  // Determine current status fresh from the bundle — never from the old cache
  let status, statusLabel, alreadyLogged, alreadyLoggedMessage;

  if (isWeekend) {
    status = 'weekend'; statusLabel = 'Weekend'; alreadyLogged = false; alreadyLoggedMessage = '';
  } else {
    const cellValue = GetDayCellValue(bundle, dayOfWeek, weekNumber);
    ({ status, statusLabel, alreadyLogged, alreadyLoggedMessage } = _resolveStatusFromCell(cellValue));
  }

  writeCache(buildCacheEntry({ alreadyLogged, status, statusLabel, alreadyLoggedMessage, ...stats }));
  // Return status fields so applyRefresh can update the title card.
  // alreadyLogged is always false here — the banner only fires on a write attempt at page load.
  return { ...stats, status, statusLabel, alreadyLogged: false, alreadyLoggedMessage: '' };
}