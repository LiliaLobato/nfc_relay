/**
 * SheetHelper.js
 * Sheet connection, bulk data loading, key normalisation, and cheat-sheet parsing.
 *
 * Two-phase design:
 *   1. GetCurrentSheet()    — resolves the Sheet object, sets globals ss/sheet.
 *   2. LoadSheetBundle(...) — 2 getValues() calls for current year; +2 for prior year only when
 *                            the chart lookback window reaches it (weeks ≤ CHART_LOOKBACK.yearWeeks).
 *
 * Domain-specific bundle readers live in their respective helper files:
 *   CellHelper   — CellTypeFromValue
 *   WeekHelper   — GetWeekGoal, GetDailyDataRange
 *   ChartsHelper — GetBeltAveragesRange, GetDaysNeeded
 *   MonthHelper  — GetMonthlyBreakdown
 *   YearHelper   — GetPriorYearData
 *
 * SheetBundle = {
 *   main:    Array[][]   DATALOCATION.megaRange (D7:N64)
 *   monthly: Array[][]   DATALOCATION.monthlyBreakdownDataRange (R6:AV20)
 *   prior:   { main: Array[][], monthly: Array[][] } | null
 * }
 */


/**
 * Resolves the current year's Sheet object and sets the globals ss and sheet.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 * @throws {Error} if no sheet exists for the current year
 */
function GetCurrentSheet() {
  ss    = SpreadsheetApp.getActiveSpreadsheet();
  sheet = ss.getSheetByName(String(rawDate.getFullYear()));
  if (!sheet) throw new Error(`Sheet ${rawDate.getFullYear()} not found`);
  return sheet;
}


/**
 * Fetches all sheet data in two getValues() calls per sheet and returns a SheetBundle.
 * Pure fetch — no parsing, no side effects beyond the API calls.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet current year sheet
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss active spreadsheet
 * @param {number} year current calendar year
 * @param {number} weekNumber current ISO week number
 * @returns {SheetBundle}
 */
function LoadSheetBundle(sheet, ss, year, weekNumber) {
  const main    = sheet.getRange(DATALOCATION.megaRange).getValues();
  const monthly = sheet.getRange(DATALOCATION.monthlyBreakdownDataRange).getValues();

  // Prior year data is only needed while the year-chart lookback window reaches back into it.
  // After week CHART_LOOKBACK.yearWeeks both chart windows fit entirely in the current year.
  let prior = null;
  if (weekNumber <= CHART_LOOKBACK.yearWeeks) {
    const priorSheet = ss.getSheetByName(String(year - 1));
    if (priorSheet) {
      prior = {
        main:        priorSheet.getRange(DATALOCATION.priorMegaRange).getValues(),
        monthly:     priorSheet.getRange(DATALOCATION.monthlyBreakdownDataRange).getValues(),
        weeksInYear: GetISOWeeksInYear(year - 1),
      };
    }
  }

  return { main, monthly, prior };
}


/**
 * Returns the 0-based row index within the mega range for a given ISO week number.
 * WW1 is at sheet row 13 (index 6); each subsequent week adds one row.
 *
 * @param {number} weekNumber ISO week number (1-based)
 * @returns {number}
 */
function weekRowIndex(weekNumber) {
  return weekNumber + MEGARANGE.ww1SheetRow - MEGARANGE.firstSheetRow - 1;
}


/**
 * Normalises a raw cell value to a consistent cheatSheet key (upper-case).
 *
 * @param {*} value raw cell value
 * @returns {string}
 */
function NormalizeCellKey(value) {
  return String(value).toUpperCase();
}


/**
 * Parses the code-to-label cheat sheet from a bundle and returns it as a plain object.
 * Does not set the global cheatSheet — caller is responsible for assignment.
 *
 * @param {SheetBundle} bundle
 * @returns {Object.<string, string>} normalised-code → label map
 */
function ParseCheatSheet(bundle) {
  const result = {};
  for (let i = 0; i < MEGARANGE.cheatSheetRows; i++) {
    const code  = bundle.main[i][MEGARANGE.colCheatCode];
    const label = bundle.main[i][MEGARANGE.colCheatLabel];
    if (code && label) result[NormalizeCellKey(code)] = label;
  }
  return result;
}


