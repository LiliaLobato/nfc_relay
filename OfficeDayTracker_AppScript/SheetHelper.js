/**
 * SheetHelper.js
 * All Google Sheets read operations.
 * Each function maps directly to a getRange/getValue call.
 * Sheet layout constants (DATALOCATION, MONTHLY) live in GlobalConstants.js.
 */

/**
 * Gets the current year's sheet and initialises the global cheatSheet.
 * Sets the global `sheet` variable as a side effect.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 * @throws {Error} if no sheet exists for the current year
 */
function GetCurrentSheet(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = String(rawDate.getFullYear());
    sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found`);
    }

    GetCheatSheet();

    return sheet;
}

/**
 * Normalises a raw cell value to a consistent cheatSheet key.
 * All keys are stored and looked up in upper-case so sheet casing never matters.
 *
 * @param {*} value raw cell value
 * @returns {string}
 */
function NormalizeCellKey(value) {
  return String(value).toUpperCase();
}

/**
 * Reads the code to label mapping into the global cheatSheet.
 */
function GetCheatSheet(){
  const rawCheatSheet = sheet.getRange(DATALOCATION.cheatSheetRange).getValues();

  cheatSheet = {};
  rawCheatSheet.forEach(row => {
    const key   = NormalizeCellKey(row[1]);
    const value = row[0];
    if (row[1] && value) cheatSheet[key] = value;
  });
}

/**
 * Maps a raw cell value to a CSS type string via cheatSheet.
 * Lowercases the label and strips spaces.
 *
 * NOTE: The JS layer is not fully agnostic. CSS class names must match the label.
 * Adding a new day type requires updating the sheet and HTML/CSS.
 * Labels must be alphanumeric only (spaces are stripped, hyphens would break the match).
 *
 * @param {*} value raw cell value from getValues()
 * @returns {string} CSS class name for that cell, or 'home' if no match found
 */
function CellTypeFromValue(value) {
  if (!value && value !== 0) return 'home';
  const label = cheatSheet[NormalizeCellKey(value)];
  if (!label) return 'home';
  return label.toLowerCase().replace(/\s+/g, '');
}

/**
 * Gets raw daily cell values for a range of ISO weeks.
 * Each row is [Mon, Tue, Wed, Thu, Fri] for that week.
 *
 * @param {number} startWeek first ISO week (1-based)
 * @param {number} endWeek last ISO week (1-based)
 * @returns {Array[][]} result[i] is WW(startWeek+i) daily values
 */
function GetDailyDataRange(startWeek, endWeek) {
  const startRow = startWeek + wwRowOffset;
  const endRow   = endWeek   + wwRowOffset;
  return sheet.getRange(`${DATALOCATION.weekDataStartCol}${startRow}:${DATALOCATION.weekDataEndCol}${endRow}`).getValues();
}

/**
 * Gets BELT average values for a single ISO week.
 * Calculated by sheet formulas.
 *
 * @param {number} workWeek ISO week number
 * @returns {{ best10of12: number, best8of12: number, best8of10: number }}
 */
function GetBeltAverages(workWeek) {
  const row = workWeek + wwRowOffset;
  return {
    best10of12: sheet.getRange(DATALOCATION.best10of12Col + row).getValue(),
    best8of12:  sheet.getRange(DATALOCATION.best8of12Col + row).getValue(),
    best8of10:  sheet.getRange(DATALOCATION.best8of10Col + row).getValue()
  };
}

/**
 * Gets BELT average values for a range of ISO weeks.
 *
 * @param {number} startWeek first ISO week
 * @param {number} endWeek last ISO week
 * @returns {Array[][]} result[i] is BELT values for WW(startWeek+i)
 */
function GetBeltAveragesRange(startWeek, endWeek) {
  const startRow = startWeek + wwRowOffset;
  const endRow   = endWeek   + wwRowOffset;
  return sheet.getRange(`${DATALOCATION.best10of12Col}${startRow}:${DATALOCATION.best8of10Col}${endRow}`).getValues();
}

/**
 * Gets the weekly office day goal from cell E10.
 *
 * @returns {number}
 */
function GetWeekGoal() {
  return sheet.getRange(DATALOCATION.weekGoalCell).getValue();
}

/**
 * Gets raw data arrays from the prior year sheet for chart continuity.
 * Returns null if no prior year sheet exists.
 *
 * @param {number} year current year; reads the (year-1) sheet
 * @returns {{ weekData: Array[][], beltData: Array[][], monthly: Array[][] }|null}
 */
function GetPriorYearData(year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const priorSheet = ss.getSheetByName(String(year - 1));
  if (!priorSheet) return null;
  return {
    weekData: priorSheet.getRange(DATALOCATION.weekDataRange).getValues(),
    beltData: priorSheet.getRange(DATALOCATION.beltDataRange).getValues(),
    monthly:  priorSheet.getRange(DATALOCATION.monthlyBreakdownDataRange).getValues().slice(3),
  };
}

/**
 * Gets the monthly breakdown data as a 12-element array.
 * Index 0 is January, index 11 is December.
 * Use MONTHLY constants to access individual columns within each row.
 *
 * @returns {Array[][]} 12 rows of monthly stats
 */
function GetMonthlyBreakdown() {
  const values = sheet.getRange(DATALOCATION.monthlyBreakdownDataRange).getValues();
  return values.slice(3);
}

/**
 * Gets the number of office days still needed this week and next.
 *
 * @param {number} workWeek current ISO week number
 * @returns {{ thisWeek: number, nextWeek: number }}
 */
function GetDaysNeeded(workWeek) {
  const row = workWeek + wwRowOffset;
  return {
    thisWeek: sheet.getRange(DATALOCATION.daysNeededCol + row).getValue(),
    nextWeek: sheet.getRange(DATALOCATION.daysNeededCol + (row + 1)).getValue(),
  };
}
