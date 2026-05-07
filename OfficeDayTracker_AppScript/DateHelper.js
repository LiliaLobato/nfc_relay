/**
 * DateHelper.js
 * ISO week date utilities.
 */

/**
 * Returns the Monday date of a given ISO week and year.
 * Anchors to Jan 4 (always in WW1) to find the WW1 Monday, then offsets by week.
 *
 * @param {number} ww ISO week number (1-53)
 * @param {number} yr full year
 * @returns {Date} midnight local time on the Monday of that week
 */
function GetMondayOfISOWeek(ww, yr) {
  const jan4   = new Date(yr, 0, 4);
  const ww1Mon = new Date(jan4);
  ww1Mon.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7);

  const result = new Date(ww1Mon);
  result.setDate(ww1Mon.getDate() + (ww - 1) * 7);
  return result;
}

/**
 * Returns the ISO weekday index for today (WEEK.Mon=0 .. WEEK.Fri=4).
 * Throws on weekends as a control flow signal;
 * caught by BuildPageData to trigger the weekend view.
 *
 * @returns {number} WEEK.Mon (0) to WEEK.Fri (4)
 * @throws {Error} on weekends; message is the weekend status label shown in the UI
 */
function GetCurrentDayOfWeek(){
  const isoDay = (rawDate.getDay() + 6) % 7;
  if (isoDay > WEEK.Fri) {
    throw new Error(`It's ${Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, MMM d")} — what are you doing in the office?`);
  }
  return isoDay;
}

/**
 * Returns the ISO week number for any date.
 *
 * @param {Date} date
 * @returns {number} ISO week number (1-53)
 */
function GetISOWeekForDate(date) {
  const target = new Date(date.valueOf());
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  
  const week1 = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * Returns the ISO week number for today. Validates the result is in range 1-53.
 *
 * @returns {number} ISO week number
 * @throws {Error} if the calculated week is out of range (should not happen in practice)
 */
function GetCurrentISOWeek(){
  const workWeek = GetISOWeekForDate(rawDate);
  if (workWeek < 1 || workWeek > 53 || !workWeek) {
    throw new Error('Calculated work week '+ workWeek + ' for date' +
    Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MMM/yyyy") +
    ' is out of range 1-53');
  }
  return workWeek;
}
