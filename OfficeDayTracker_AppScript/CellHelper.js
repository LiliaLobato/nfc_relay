/**
 * CellHelper.js
 * Cell address calculation, day-cell reads from a bundle, and day-cell writes.
 */


/**
 * Calculates the sheet cell address for a given day and ISO week.
 * Column D = Monday (WEEK.Mon=0), column H = Friday (WEEK.Fri=4).
 *
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4)
 * @param {number} workWeek ISO week number
 * @returns {string} cell address e.g. "D16"
 */
function CalculateCurrentDayCell(dayOfWeek, workWeek) {
  const col = String.fromCharCode('D'.charCodeAt(0) + dayOfWeek);
  const row = workWeek + MEGARANGE.rowOffset;
  return col + row;
}


/**
 * Returns the raw value of a day cell from the bundle.
 *
 * @param {SheetBundle} bundle
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4)
 * @param {number} weekNumber ISO week number
 * @returns {*}
 */
function GetDayCellValue(bundle, dayOfWeek, weekNumber) {
  return bundle.main[weekRowIndex(weekNumber)][dayOfWeek];
}


/**
 * Writes a value into a day cell. Only API write call in the read path.
 *
 * @param {string} cellAddress cell address e.g. "D16"
 * @param {*} value value to write
 */
function SetCurrentDayCellValue(cellAddress, value) {
  sheet.getRange(cellAddress).setValue(value);
}


/**
 * Resolves status fields from a raw day-cell value.
 * Used on the Home path and in GetFreshData to avoid duplicating this logic.
 *
 * @param {*} cellValue raw cell value from GetDayCellValue
 * @returns {{ status: string, statusLabel: string, alreadyLogged: boolean }}
 */
function _resolveStatusFromCell(cellValue) {
  if (!cellValue) return { status: 'home', statusLabel: 'Home Day', alreadyLogged: false, alreadyLoggedMessage: '' };
  const loggedType = cheatSheet[NormalizeCellKey(cellValue)] || 'Home';
  const status     = CellTypeFromValue(cellValue);
  return {
    status,
    statusLabel:          loggedType === 'Office' ? 'Office Day' : loggedType,
    alreadyLogged:        true,
    alreadyLoggedMessage: ALREADY_LOGGED_MSGS[status] || 'Already logged',
  };
}


/**
 * Maps a raw cell value to a CSS type string via cheatSheet.
 * Lowercases the label and strips spaces.
 *
 * @param {*} value raw cell value from getValues()
 * @returns {string} CSS class name, or 'home' if no match found
 */
function CellTypeFromValue(value) {
  if (!value && value !== 0) return 'home';
  const label = cheatSheet[NormalizeCellKey(value)];
  if (!label) return 'home';
  return label.toLowerCase().replace(/\s+/g, '');
}
