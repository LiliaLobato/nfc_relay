/**
 * Main.js
 * Entry point for page data assembly. One function: BuildPageData.
 * Handles sheet setup, weekend detection, and office day writes.
 * All computation delegates to DataAssembler.
 */

//////// Global state ////////
const rawDate = new Date();
var sheet;
var cheatSheet;


/**
 * Builds the full page data object for the HTML template.
 * Handles sheet setup, weekend detection, and office day writes.
 *
 * @param {string} key 'Office' or 'Home'
 * @returns {Object} DATA contract with status, date, time, rings, days, calendar, charts.
 *   Returns { status: 'fatal', errorMessage } on setup failure.
 */
function BuildPageData(key) {
  const data = {};

  // ---- Setup ----
  try {
    sheet = GetCurrentSheet();
    data.weekNumber = GetCurrentISOWeek();
  } catch (e) {
    console.log('Setup error:', e.message);
    return { status: 'fatal', errorMessage: e.message };
  }

  const year     = rawDate.getFullYear();
  const monthIdx = rawDate.getMonth();

  data.date = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, dd/MMM/yyyy");
  data.time = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "h:mm a");

  // ---- Weekend check ----
  var dayOfWeek;
  try {
    dayOfWeek = GetCurrentDayOfWeek();
  } catch (e) {
    console.log('Weekend:', e.message);
    data.status        = 'weekend';
    data.statusLabel   = e.message;
    data.alreadyLogged = false;
    Object.assign(data, BuildStatsData(data.weekNumber, WEEK.Fri, year, monthIdx));
    console.log(JSON.stringify(data));
    return data;
  }

  // ---- Status resolution ----
  data.alreadyLogged = false;

  if (key === 'Office') {
    const currentDayCell = CalculateCurrentDayCell(dayOfWeek, data.weekNumber);
    try {
      AssertDayCellIsEmpty(currentDayCell);
      SetCurrentDayCellValue(currentDayCell, Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Office'));
      console.log('Marked as Office:', currentDayCell);
    } catch (e) {
      console.log('Already logged:', e.message);
      data.alreadyLogged = true;
    }
    data.status      = 'office';
    data.statusLabel = 'Office Day';
  } else {
    data.status      = 'home';
    data.statusLabel = 'Home Day';
    console.log('Home day, no write');
  }

  Object.assign(data, BuildStatsData(data.weekNumber, dayOfWeek, year, monthIdx));
  console.log(JSON.stringify(data));
  return data;
}
