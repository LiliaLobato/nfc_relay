/**
 * CellHelper.js
 * Cell address calculation and day-cell write operations.
 */

/**
 * Writes a value into a day cell in the daily tracking grid.
 *
 * @param {string} currentDayCell cell address
 * @param {*} newValue value to write
 */
function SetCurrentDayCellValue(currentDayCell, newValue){
  return sheet.getRange(currentDayCell).setValue(newValue);
}

/**
 * Throws if the day cell already has a value.
 * Caught by BuildPageData to set alreadyLogged = true; message becomes the status label.
 *
 * @param {string} currentDayCell cell address
 * @throws {Error} if the cell already contains a value
 */
function AssertDayCellIsEmpty(currentDayCell){
  const value = sheet.getRange(currentDayCell).getValue();

  if (value){
    throw new Error(`You ${CellTypeFromValue(value) === 'office' ? 'already ': ''}set up ${
    Utilities.formatDate(rawDate, Session.getScriptTimeZone(),"EEEE, MMM d") } as ${cheatSheet[value]} day.`);
  }
}

/**
 * Calculates the sheet cell address for a given day and ISO week.
 * Column D = Monday (WEEK.Mon=0), column H = Friday (WEEK.Fri=4).
 *
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4)
 * @param {number} workWeek ISO week number
 * @returns {string} cell address
 */
function CalculateCurrentDayCell(dayOfWeek, workWeek){
  const dayOfWeekColumnOffset = "D".charCodeAt(0);
  const row = workWeek + wwRowOffset;
  const column = String.fromCharCode(dayOfWeek + dayOfWeekColumnOffset);

  return column+row;
}
